const api = "/yt/api";
const form = document.getElementById("download-form");
const statusLine = document.getElementById("status");
const fileLink = document.getElementById("file-link");
const submitButton = document.getElementById("submit");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const setStatus = (text, isError = false) => {
  statusLine.textContent = text;
  statusLine.className = isError ? "error" : "muted";
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  fileLink.hidden = true;
  setStatus("Starting");
  try {
    const started = await fetch(`${api}/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${document.getElementById("password").value}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: document.getElementById("video-url").value, format: document.getElementById("format").value }),
    });
    const { id, error } = await started.json();
    if (!started.ok) throw new Error(error);

    for (;;) {
      await wait(1500);
      const job = await (await fetch(`${api}/jobs/${id}`)).json();
      if (job.state === "error" || job.error) throw new Error(job.error);
      if (job.state === "done") {
        fileLink.href = `${api}/jobs/${id}/file`;
        fileLink.textContent = `Save ${job.filename}`;
        fileLink.hidden = false;
        setStatus("Ready (kept for an hour)");
        window.location.href = fileLink.href;
        break;
      }
      setStatus(`Downloading ${job.progress}`);
    }
  } catch (caught) {
    setStatus(caught instanceof TypeError ? "Could not reach the download server." : caught.message, true);
  } finally {
    submitButton.disabled = false;
  }
});
