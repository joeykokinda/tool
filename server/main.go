// ytserver downloads YouTube videos with yt-dlp for the page at tools.jkokinda.com/yt/.
// Config comes from the environment: YT_PASSWORD (required), ADDR, YT_DIR.
package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	maxConcurrentJobs   = 2
	jobLifetime         = time.Hour
	jobTimeout          = 30 * time.Minute
	maxFailedLogins     = 10
	failedLoginWindow   = time.Hour
	maxDownloadFileSize = "4G"
)

var allowedHosts = map[string]bool{
	"youtube.com": true, "www.youtube.com": true, "m.youtube.com": true,
	"music.youtube.com": true, "youtu.be": true,
}

// validateVideoURL keeps yt-dlp pointed at YouTube only, so the service cannot be used to fetch
// arbitrary or internal URLs from brach.
func validateVideoURL(rawURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme != "https" || parsed.User != nil || !allowedHosts[strings.ToLower(parsed.Host)] {
		return "", errors.New("only https YouTube links are accepted")
	}
	return parsed.String(), nil
}

// loginLimiter caps wrong passwords across all clients. The password is short, so guessing has to be slow.
type loginLimiter struct {
	mutex    sync.Mutex
	failures []time.Time
}

func (limiter *loginLimiter) locked(now time.Time) bool {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()
	recent := limiter.failures[:0]
	for _, failure := range limiter.failures {
		if now.Sub(failure) < failedLoginWindow {
			recent = append(recent, failure)
		}
	}
	limiter.failures = recent
	return len(recent) >= maxFailedLogins
}

func (limiter *loginLimiter) recordFailure(now time.Time) {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()
	limiter.failures = append(limiter.failures, now)
}

type job struct {
	State    string `json:"state"` // running, done, error
	Progress string `json:"progress"`
	Filename string `json:"filename,omitempty"`
	Error    string `json:"error,omitempty"`
	path     string
}

type server struct {
	passwordHash [32]byte
	workDir      string
	limiter      loginLimiter
	slots        chan struct{}
	mutex        sync.Mutex
	jobs         map[string]*job
}

func (app *server) authorized(request *http.Request) (allowed bool, lockedOut bool) {
	now := time.Now()
	if app.limiter.locked(now) {
		return false, true
	}
	given := sha256.Sum256([]byte(strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")))
	if subtle.ConstantTimeCompare(given[:], app.passwordHash[:]) == 1 {
		return true, false
	}
	app.limiter.recordFailure(now)
	return false, false
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"error": message})
}

func (app *server) createJob(writer http.ResponseWriter, request *http.Request) {
	allowed, lockedOut := app.authorized(request)
	if lockedOut {
		writeError(writer, http.StatusTooManyRequests, "too many wrong passwords, locked for up to an hour")
		return
	}
	if !allowed {
		writeError(writer, http.StatusUnauthorized, "wrong password")
		return
	}
	var body struct {
		URL    string `json:"url"`
		Format string `json:"format"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 4096)).Decode(&body); err != nil {
		writeError(writer, http.StatusBadRequest, "bad request body")
		return
	}
	videoURL, err := validateVideoURL(body.URL)
	if err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	select {
	case app.slots <- struct{}{}:
	default:
		writeError(writer, http.StatusTooManyRequests, "two downloads are already running, try again shortly")
		return
	}

	randomBytes := make([]byte, 16)
	rand.Read(randomBytes)
	jobID := hex.EncodeToString(randomBytes)
	jobDir := filepath.Join(app.workDir, jobID)
	if err := os.MkdirAll(jobDir, 0o700); err != nil {
		<-app.slots
		writeError(writer, http.StatusInternalServerError, "could not create work directory")
		return
	}
	current := &job{State: "running", Progress: "starting"}
	app.mutex.Lock()
	app.jobs[jobID] = current
	app.mutex.Unlock()

	go app.run(jobID, jobDir, current, videoURL, body.Format == "audio")
	time.AfterFunc(jobLifetime, func() {
		app.mutex.Lock()
		delete(app.jobs, jobID)
		app.mutex.Unlock()
		os.RemoveAll(jobDir)
	})
	writeJSON(writer, http.StatusAccepted, map[string]string{"id": jobID})
}

func (app *server) run(jobID, jobDir string, current *job, videoURL string, audioOnly bool) {
	defer func() { <-app.slots }()
	arguments := []string{
		"--no-playlist", "--newline", "--no-warnings", "--restrict-filenames",
		"--max-filesize", maxDownloadFileSize,
		"--js-runtimes", "node",
		"--progress-template", "download:PROGRESS %(progress._percent_str)s",
		"-o", filepath.Join(jobDir, "%(title).120B.%(ext)s"),
	}
	if audioOnly {
		arguments = append(arguments, "-x", "--audio-format", "mp3")
	} else {
		arguments = append(arguments, "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4")
	}
	arguments = append(arguments, "--", videoURL)

	ctx, cancel := context.WithTimeout(context.Background(), jobTimeout)
	defer cancel()
	command := exec.CommandContext(ctx, "yt-dlp", arguments...)
	stdout, _ := command.StdoutPipe()
	var stderr strings.Builder
	command.Stderr = &stderr

	finish := func(update func()) {
		app.mutex.Lock()
		update()
		app.mutex.Unlock()
	}
	if err := command.Start(); err != nil {
		finish(func() { current.State, current.Error = "error", "yt-dlp is not available on the server" })
		return
	}
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		if percent, found := strings.CutPrefix(scanner.Text(), "PROGRESS "); found {
			finish(func() { current.Progress = strings.TrimSpace(percent) })
		}
	}
	if err := command.Wait(); err != nil {
		lines := strings.Split(strings.TrimSpace(stderr.String()), "\n")
		log.Printf("job %s failed: %v: %s", jobID, err, stderr.String())
		finish(func() { current.State, current.Error = "error", lines[len(lines)-1] })
		return
	}
	entries, _ := os.ReadDir(jobDir)
	if len(entries) != 1 {
		finish(func() { current.State, current.Error = "error", "download produced no file (too large or unavailable)" })
		return
	}
	finish(func() {
		current.State, current.Progress = "done", "100%"
		current.Filename = entries[0].Name()
		current.path = filepath.Join(jobDir, entries[0].Name())
	})
}

// The job id is 128 random bits and only handed to an authorized caller, so it doubles as the
// credential for status and file requests (a plain link can then trigger the browser download).
func (app *server) lookup(request *http.Request) (job, bool) {
	app.mutex.Lock()
	defer app.mutex.Unlock()
	current, found := app.jobs[request.PathValue("id")]
	if !found {
		return job{}, false
	}
	return *current, true
}

func (app *server) jobStatus(writer http.ResponseWriter, request *http.Request) {
	current, found := app.lookup(request)
	if !found {
		writeError(writer, http.StatusNotFound, "no such download (they expire after an hour)")
		return
	}
	writeJSON(writer, http.StatusOK, current)
}

func (app *server) jobFile(writer http.ResponseWriter, request *http.Request) {
	current, found := app.lookup(request)
	if !found || current.State != "done" {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": current.Filename}))
	http.ServeFile(writer, request, current.path)
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func main() {
	password := os.Getenv("YT_PASSWORD")
	if password == "" {
		log.Fatal("YT_PASSWORD is required")
	}
	app := &server{
		passwordHash: sha256.Sum256([]byte(password)),
		workDir:      envOr("YT_DIR", filepath.Join(os.TempDir(), "ytserver")),
		slots:        make(chan struct{}, maxConcurrentJobs),
		jobs:         map[string]*job{},
	}
	// leftovers from a previous run are unreachable, their job ids died with the process
	os.RemoveAll(app.workDir)
	if err := os.MkdirAll(app.workDir, 0o700); err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /jobs", app.createJob)
	mux.HandleFunc("GET /jobs/{id}", app.jobStatus)
	mux.HandleFunc("GET /jobs/{id}/file", app.jobFile)
	address := envOr("ADDR", "127.0.0.1:8377")
	log.Printf("ytserver listening on %s", address)
	log.Fatal(http.ListenAndServe(address, mux))
}
