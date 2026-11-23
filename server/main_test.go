package main

import (
	"testing"
	"time"
)

func TestValidateVideoURL(t *testing.T) {
	accepted := []string{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", " https://music.youtube.com/watch?v=x "}
	rejected := []string{
		"http://www.youtube.com/watch?v=x", "https://127.0.0.1:8080/", "https://youtube.com.evil.test/watch",
		"https://user@youtube.com/watch", "file:///etc/passwd", "--exec=id", "https://www.youtube.com:8443/x", "",
	}
	for _, candidate := range accepted {
		if _, err := validateVideoURL(candidate); err != nil {
			t.Errorf("%q should be accepted: %v", candidate, err)
		}
	}
	for _, candidate := range rejected {
		if _, err := validateVideoURL(candidate); err == nil {
			t.Errorf("%q should be rejected", candidate)
		}
	}
}

func TestLoginLimiter(t *testing.T) {
	var limiter loginLimiter
	start := time.Now()
	for attempt := 0; attempt < maxFailedLogins; attempt++ {
		if limiter.locked(start) {
			t.Fatalf("locked after only %d failures", attempt)
		}
		limiter.recordFailure(start)
	}
	if !limiter.locked(start) {
		t.Fatal("should be locked after the maximum failures")
	}
	if limiter.locked(start.Add(failedLoginWindow + time.Second)) {
		t.Fatal("should unlock once the window has passed")
	}
}
