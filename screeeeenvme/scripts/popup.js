const SETTINGS_KEY = "screeeeenvmeSettings";
const DEFAULT_SETTINGS = {
  useMic: true,
  useTabAudio: true,
  useSystemAudio: true,
  countdown: 3,
  openEditorAfterCapture: false
};

const statusBar = document.getElementById("statusBar");
const useMicInput = document.getElementById("useMic");
const useTabAudioInput = document.getElementById("useTabAudio");
const useSystemAudioInput = document.getElementById("useSystemAudio");
const countdownInput = document.getElementById("countdown");
const openEditorAfterCaptureInput = document.getElementById("openEditorAfterCapture");

function setStatus(message, isError = false) {
  statusBar.textContent = message;
  statusBar.style.color = isError ? "#a93131" : "#587167";
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
  useMicInput.checked = settings.useMic;
  useTabAudioInput.checked = settings.useTabAudio;
  useSystemAudioInput.checked = settings.useSystemAudio;
  countdownInput.value = String(settings.countdown);
  openEditorAfterCaptureInput.checked = Boolean(settings.openEditorAfterCapture);
}

async function saveSettings() {
  const settings = {
    useMic: useMicInput.checked,
    useTabAudio: useTabAudioInput.checked,
    useSystemAudio: useSystemAudioInput.checked,
    countdown: Number(countdownInput.value),
    openEditorAfterCapture: openEditorAfterCaptureInput.checked
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function sendAction(action, payload = {}) {
  setStatus("Working...");

  try {
    const response = await chrome.runtime.sendMessage({ action, ...payload });

    if (!response?.ok) {
      throw new Error(response?.error || "Action failed.");
    }

    setStatus(response.message || "Done.");

    if (response.closePopup) {
      window.close();
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  }
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const settings = await saveSettings();
    await sendAction(button.dataset.action, { settings });
  });
});

document.getElementById("openLibrary").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
  window.close();
});

document.getElementById("openAnnotator").addEventListener("click", async () => {
  await sendAction("open-annotator");
});

document.getElementById("openDownloads").addEventListener("click", async () => {
  try {
    await chrome.downloads.showDefaultFolder();
    setStatus("Opened the downloads folder.");
  } catch (error) {
    setStatus("Unable to open the downloads folder.", true);
  }
});

[useMicInput, useTabAudioInput, useSystemAudioInput, countdownInput, openEditorAfterCaptureInput].forEach((element) => {
  element.addEventListener("change", async () => {
    await saveSettings();
    setStatus("Settings saved.");
  });
});

loadSettings().catch(() => {
  setStatus("Unable to load settings.", true);
});
