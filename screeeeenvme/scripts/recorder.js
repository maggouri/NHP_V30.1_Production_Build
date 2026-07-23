const SETTINGS_KEY = "screeeeenvmeSettings";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || "desktop";
const tabId = Number(params.get("tabId")) || 0;
const sourceTitle = params.get("title") || "Recording";

const elements = {
  modeBadge: document.getElementById("modeBadge"),
  title: document.getElementById("recordingTitle"),
  subtitle: document.getElementById("recordingSubtitle"),
  preview: document.getElementById("preview"),
  countdown: document.getElementById("countdownDisplay"),
  status: document.getElementById("statusText"),
  timer: document.getElementById("timerText"),
  log: document.getElementById("logBox"),
  start: document.getElementById("startButton"),
  pause: document.getElementById("pauseButton"),
  stop: document.getElementById("stopButton")
};

let settings = null;
let composedStream = null;
let mediaRecorder = null;
let recorderChunks = [];
let startedAt = 0;
let timerInterval = null;

function setStatus(text) {
  elements.status.textContent = text;
}

function setLog(text, isError = false) {
  elements.log.textContent = text;
  elements.log.style.color = isError ? "#ff9d9d" : "#92b4a8";
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  settings = {
    useMic: true,
    useTabAudio: true,
    useSystemAudio: true,
    countdown: Number(params.get("countdown")) || 3,
    ...(stored[SETTINGS_KEY] || {})
  };
}

async function getDesktopStream() {
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30
    },
    audio: settings.useSystemAudio
  });
}

async function getTabStream() {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  return navigator.mediaDevices.getUserMedia({
    audio: settings.useTabAudio
      ? {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId
          }
        }
      : false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        maxWidth: 3840,
        maxHeight: 2160,
        maxFrameRate: 30
      }
    }
  });
}

async function getMicStream() {
  if (!settings.useMic) {
    return null;
  }

  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

function chooseMimeType() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function composeRecordingStream(primaryStream, micStream) {
  const finalStream = new MediaStream();
  primaryStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  let hasAudio = false;

  [primaryStream, micStream].filter(Boolean).forEach((stream) => {
    if (stream.getAudioTracks().length > 0) {
      hasAudio = true;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(destination);
    }
  });

  if (hasAudio) {
    destination.stream.getAudioTracks().forEach((track) => finalStream.addTrack(track));
  }

  return finalStream;
}

async function startPreviewAndRecorder() {
  setStatus("Preparing");
  setLog("Requesting capture source...");

  const primaryStream = mode === "tab" ? await getTabStream() : await getDesktopStream();
  const micStream = await getMicStream();
  composedStream = await composeRecordingStream(primaryStream, micStream);

  elements.preview.srcObject = composedStream;
  await elements.preview.play().catch(() => {});

  const mimeType = chooseMimeType();
  mediaRecorder = new MediaRecorder(composedStream, mimeType ? { mimeType } : undefined);
  recorderChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recorderChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    clearInterval(timerInterval);
    setStatus("Saving");
    setLog("Saving the recording locally...");

    const blob = new Blob(recorderChunks, { type: mediaRecorder.mimeType || "video/webm" });
    const filename = buildRecordingFilename();
    const objectUrl = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: objectUrl,
      filename: `screeeeenvme/recordings/${filename}`,
      conflictAction: "uniquify",
      saveAs: false
    });

    await chrome.runtime.sendMessage({
      action: "add-recent-item",
      item: {
        kind: "video",
        mode,
        title: sourceTitle,
        filename,
        bytes: blob.size,
        createdAt: Date.now()
      }
    });

    setStatus("Saved");
    setLog("Recording saved locally. You can close this window.");
    stopTracks();
    URL.revokeObjectURL(objectUrl);
  };

  mediaRecorder.start(1000);
  startedAt = Date.now();
  setStatus("Recording");
  setLog("Recording in progress...");
  elements.start.disabled = true;
  elements.pause.disabled = false;
  elements.stop.disabled = false;

  timerInterval = window.setInterval(() => {
    elements.timer.textContent = formatDuration(Date.now() - startedAt);
  }, 250);

  const autoStopTrack = composedStream.getVideoTracks()[0];

  if (autoStopTrack) {
    autoStopTrack.addEventListener("ended", () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    });
  }
}

function stopTracks() {
  if (!composedStream) {
    return;
  }

  composedStream.getTracks().forEach((track) => track.stop());
  composedStream = null;
}

function buildRecordingFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTitle = String(sourceTitle)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "recording";

  return `${mode}-${safeTitle}-${stamp}.webm`;
}

async function runCountdown() {
  let remaining = Number(settings.countdown) || 0;

  if (remaining <= 0) {
    return;
  }

  elements.countdown.hidden = false;

  while (remaining > 0) {
    elements.countdown.textContent = String(remaining);
    setStatus("Countdown");
    setLog(`Recording starts in ${remaining} second(s)...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    remaining -= 1;
  }

  elements.countdown.hidden = true;
}

async function beginRecordingFlow() {
  elements.start.disabled = true;

  try {
    await runCountdown();
    await startPreviewAndRecorder();
  } catch (error) {
    console.error(error);
    setStatus("Failed");
    setLog(error.message || "Unable to start recording.", true);
    elements.start.disabled = false;
    elements.pause.disabled = true;
    elements.stop.disabled = true;
    stopTracks();
  }
}

elements.start.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    return;
  }

  await beginRecordingFlow();
});

elements.pause.addEventListener("click", () => {
  if (!mediaRecorder) {
    return;
  }

  if (mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    setStatus("Paused");
    setLog("Recording paused.");
    elements.pause.textContent = "Resume";
  } else if (mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    setStatus("Recording");
    setLog("Recording resumed.");
    elements.pause.textContent = "Pause";
  }
});

elements.stop.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    elements.pause.disabled = true;
    elements.stop.disabled = true;
  }
});

window.addEventListener("beforeunload", () => {
  clearInterval(timerInterval);
  stopTracks();
});

async function init() {
  await loadSettings();

  const modeLabel = mode === "tab" ? "This Tab" : "Desktop";
  elements.modeBadge.textContent = modeLabel;
  elements.title.textContent = sourceTitle;
  elements.subtitle.textContent =
    mode === "tab"
      ? "Recording the active tab locally. Tab audio can be included if enabled."
      : "Choose a screen or window and save the result locally.";
  setStatus("Ready");
  setLog("Press Start to begin.");
}

init().catch((error) => {
  setStatus("Failed");
  setLog(error.message || "Unable to initialize recorder.", true);
});
