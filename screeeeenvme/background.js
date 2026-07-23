const SETTINGS_KEY = "screeeeenvmeSettings";
const RECENT_ITEMS_KEY = "screeeeenvmeRecentItems";
const EDITOR_IMAGE_KEY = "screeeeenvmeEditorImage";
const EDITOR_BUFFER_KEY = "screeeeenvmeBufferedImages";
const DEFAULT_SETTINGS = {
  useMic: true,
  useTabAudio: true,
  useSystemAudio: true,
  countdown: 3,
  openEditorAfterCapture: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(SETTINGS_KEY);

  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === "capture-visible") {
      await handleCaptureVisible();
    } else if (command === "capture-selected") {
      await handleCaptureSelected();
    } else if (command === "capture-full-page") {
      await handleCaptureFullPage();
    }
  } catch (error) {
    console.error("Command failed:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      let response;

      switch (message.action) {
        case "capture-visible":
          response = await handleCaptureVisible(message.settings);
          break;
        case "capture-selected":
          response = await handleCaptureSelected(message.settings);
          break;
        case "capture-full-page":
          response = await handleCaptureFullPage(message.settings);
          break;
        case "record-tab":
          response = await openRecorderWindow("tab");
          break;
        case "record-desktop":
          response = await openRecorderWindow("desktop");
          break;
        case "open-annotator":
          response = await openAnnotatorWindow(null);
          break;
        case "add-recent-item":
          await addRecentItem(message.item);
          response = { ok: true };
          break;
        case "get-recent-items":
          response = { ok: true, items: await getRecentItems() };
          break;
        case "clear-recent-items":
          await chrome.storage.local.set({ [RECENT_ITEMS_KEY]: [] });
          response = { ok: true };
          break;
        case "get-editor-image":
          response = { ok: true, image: await getEditorImage() };
          break;
        case "set-editor-image":
          await setEditorImage(message.image || null);
          response = { ok: true };
          break;
        case "get-editor-buffer":
          response = { ok: true, items: await getBufferedEditorImages() };
          break;
        case "set-editor-buffer":
          await setBufferedEditorImages(Array.isArray(message.items) ? message.items : []);
          response = { ok: true };
          break;
        default:
          response = { ok: false, error: "Unknown action." };
      }

      sendResponse(response);
    } catch (error) {
      console.error("Background action failed:", error);
      sendResponse({ ok: false, error: error.message || "Unexpected error." });
    }
  })();

  return true;
});

async function handleCaptureVisible(settingsOverride) {
  const tab = await getActiveTab();
  ensureSupportedTab(tab);
  const settings = await getEffectiveSettings(settingsOverride);

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  if (settings.openEditorAfterCapture) {
    await openAnnotatorWindow({
      dataUrl,
      title: tab.title,
      source: "visible"
    });
    return { ok: true, message: "Visible screenshot opened in the editor.", closePopup: true };
  }

  const filename = buildFilename("capture", tab.title, "png");
  await downloadDataUrl(dataUrl, `screeeeenvme/captures/${filename}`);

  await addRecentItem({
    kind: "image",
    mode: "visible",
    title: tab.title,
    filename,
    createdAt: Date.now()
  });

  return { ok: true, message: "Visible screenshot saved locally." };
}

async function handleCaptureSelected(settingsOverride) {
  const tab = await getActiveTab();
  ensureSupportedTab(tab);
  const settings = await getEffectiveSettings(settingsOverride);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["scripts/selection.js"]
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__screeeeenvmeStartSelection()
  });

  if (!result || result.cancelled) {
    return { ok: true, message: "Selection cancelled." };
  }

  const visibleDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const croppedDataUrl = await cropVisibleCapture(visibleDataUrl, result);

  if (settings.openEditorAfterCapture) {
    await openAnnotatorWindow({
      dataUrl: croppedDataUrl,
      title: tab.title,
      source: "selected"
    });
    return { ok: true, message: "Selected capture opened in the editor.", closePopup: true };
  }

  const filename = buildFilename("selection", tab.title, "png");
  await downloadDataUrl(croppedDataUrl, `screeeeenvme/captures/${filename}`);

  await addRecentItem({
    kind: "image",
    mode: "selected",
    title: tab.title,
    filename,
    createdAt: Date.now()
  });

  return { ok: true, message: "Selected area saved locally." };
}

async function handleCaptureFullPage(settingsOverride) {
  const tab = await getActiveTab();
  ensureSupportedTab(tab);
  const settings = await getEffectiveSettings(settingsOverride);

  const [{ result: metrics }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      totalHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      ),
      originalX: window.scrollX,
      originalY: window.scrollY,
      title: document.title
    })
  });

  const positions = buildScrollPositions(metrics.totalHeight, metrics.viewportHeight);
  const captures = [];

  for (const y of positions) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (targetY) => {
        window.scrollTo(0, targetY);
        await new Promise((resolve) => setTimeout(resolve, 180));
      },
      args: [y]
    });

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    captures.push({ y, dataUrl });
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (x, y) => window.scrollTo(x, y),
    args: [metrics.originalX, metrics.originalY]
  });

  const stitchedDataUrl = await stitchPageCaptures(captures, metrics);

  if (settings.openEditorAfterCapture) {
    await openAnnotatorWindow({
      dataUrl: stitchedDataUrl,
      title: metrics.title || tab.title,
      source: "full-page"
    });
    return { ok: true, message: "Full page capture opened in the editor.", closePopup: true };
  }

  const filename = buildFilename("full-page", metrics.title || tab.title, "png");
  await downloadDataUrl(stitchedDataUrl, `screeeeenvme/captures/${filename}`);

  await addRecentItem({
    kind: "image",
    mode: "full-page",
    title: metrics.title || tab.title,
    filename,
    createdAt: Date.now()
  });

  return { ok: true, message: "Full page screenshot saved locally." };
}

async function openRecorderWindow(mode) {
  const tab = await getActiveTab();
  ensureSupportedTab(tab);

  const settings = await getSettings();
  const url = new URL(chrome.runtime.getURL("recorder.html"));
  url.searchParams.set("mode", mode);
  url.searchParams.set("tabId", String(tab.id));
  url.searchParams.set("title", tab.title || "Recording");
  url.searchParams.set("countdown", String(settings.countdown));

  await chrome.windows.create({
    url: url.toString(),
    type: "popup",
    width: 430,
    height: 700
  });

  return { ok: true, message: "Recorder opened.", closePopup: true };
}

async function openAnnotatorWindow(image) {
  await setEditorImage(image);

  await chrome.windows.create({
    url: chrome.runtime.getURL("annotator.html"),
    type: "popup",
    width: 1380,
    height: 940
  });

  return { ok: true, message: "Drawing studio opened.", closePopup: true };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return tab;
}

function ensureSupportedTab(tab) {
  const url = tab.url || "";
  const blockedSchemes = ["chrome://", "edge://", "about:", "chrome-extension://"];

  if (blockedSchemes.some((scheme) => url.startsWith(scheme))) {
    throw new Error("This page cannot be captured by an extension.");
  }
}

function buildFilename(prefix, title, extension) {
  const safeTitle = sanitizeFilename(title || "untitled");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${safeTitle}-${stamp}.${extension}`;
}

function sanitizeFilename(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "item";
}

async function downloadDataUrl(dataUrl, filename) {
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    conflictAction: "uniquify",
    saveAs: false
  });
}

function buildScrollPositions(totalHeight, viewportHeight) {
  const positions = [];
  let current = 0;

  while (current < totalHeight) {
    positions.push(current);
    current += viewportHeight;
  }

  const last = Math.max(totalHeight - viewportHeight, 0);

  if (!positions.includes(last)) {
    positions.push(last);
  }

  return [...new Set(positions)];
}

async function cropVisibleCapture(dataUrl, selection) {
  const imageBitmap = await dataUrlToImageBitmap(dataUrl);
  const scaleX = imageBitmap.width / selection.viewportWidth;
  const scaleY = imageBitmap.height / selection.viewportHeight;

  const cropX = Math.max(0, Math.round(selection.x * scaleX));
  const cropY = Math.max(0, Math.round(selection.y * scaleY));
  const cropWidth = Math.max(1, Math.round(selection.width * scaleX));
  const cropHeight = Math.max(1, Math.round(selection.height * scaleY));

  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const context = canvas.getContext("2d");
  context.drawImage(
    imageBitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

async function stitchPageCaptures(captures, metrics) {
  const bitmaps = await Promise.all(
    captures.map(async (capture) => ({
      ...capture,
      bitmap: await dataUrlToImageBitmap(capture.dataUrl)
    }))
  );

  const first = bitmaps[0]?.bitmap;

  if (!first) {
    throw new Error("Unable to capture the page.");
  }

  const scale = first.width / metrics.viewportWidth;
  const canvasWidth = Math.round(metrics.viewportWidth * scale);
  const canvasHeight = Math.round(metrics.totalHeight * scale);
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d");

  bitmaps.forEach(({ y, bitmap }) => {
    const destinationY = Math.round(y * scale);
    context.drawImage(bitmap, 0, destinationY, bitmap.width, bitmap.height);
  });

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

async function dataUrlToImageBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function addRecentItem(item) {
  const current = await chrome.storage.local.get(RECENT_ITEMS_KEY);
  const items = Array.isArray(current[RECENT_ITEMS_KEY]) ? current[RECENT_ITEMS_KEY] : [];
  const next = [item, ...items].slice(0, 40);
  await chrome.storage.local.set({ [RECENT_ITEMS_KEY]: next });
}

async function getRecentItems() {
  const current = await chrome.storage.local.get(RECENT_ITEMS_KEY);
  return Array.isArray(current[RECENT_ITEMS_KEY]) ? current[RECENT_ITEMS_KEY] : [];
}

async function getSettings() {
  const current = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(current[SETTINGS_KEY] || {}) };
}

async function getEffectiveSettings(settingsOverride) {
  return settingsOverride ? { ...DEFAULT_SETTINGS, ...settingsOverride } : getSettings();
}

async function setEditorImage(image) {
  await chrome.storage.local.set({ [EDITOR_IMAGE_KEY]: image });
}

async function getEditorImage() {
  const current = await chrome.storage.local.get(EDITOR_IMAGE_KEY);
  return current[EDITOR_IMAGE_KEY] || null;
}

async function getBufferedEditorImages() {
  const current = await chrome.storage.local.get(EDITOR_BUFFER_KEY);
  return Array.isArray(current[EDITOR_BUFFER_KEY]) ? current[EDITOR_BUFFER_KEY] : [];
}

async function setBufferedEditorImages(items) {
  await chrome.storage.local.set({ [EDITOR_BUFFER_KEY]: items.slice(0, 30) });
}

chrome.downloads.onCreated.addListener((item) => {
  const url = item.url || "";
  const referrer = item.referrer || "";

  if (!isGeminiDownload(url, referrer)) {
    return;
  }

  void processGeminiImageForStudio(url, item.filename);
});

function isGeminiDownload(url, referrer) {
  return (
    url.includes("googleusercontent.com") ||
    url.startsWith("blob:") ||
    referrer.includes("gemini.google.com")
  );
}

async function processGeminiImageForStudio(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const imageData = {
      title: stripExtension(filename) || `gemini-${Date.now()}`,
      source: "gemini",
      filename: filename || `gemini-${Date.now()}.png`,
      dataUrl,
      createdAt: Date.now()
    };

    const buffer = await getBufferedEditorImages();
    const nextBuffer = [imageData, ...buffer].slice(0, 30);
    await setBufferedEditorImages(nextBuffer);

    try {
      await chrome.runtime.sendMessage({ action: "editor-buffer-updated", image: imageData });
    } catch (error) {
      // No active editor is listening. Buffering alone is enough.
    }
  } catch (error) {
    console.error("Gemini studio capture failed:", error);
  }
}

function stripExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}
