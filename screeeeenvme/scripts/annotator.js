const canvas = document.getElementById("editorCanvas");
const context = canvas.getContext("2d");
const emptyStage = document.getElementById("emptyStage");
const imageTitle = document.getElementById("imageTitle");
const statusBox = document.getElementById("statusBox");
const fileInput = document.getElementById("fileInput");
const colorPicker = document.getElementById("colorPicker");
const sizeRange = document.getElementById("sizeRange");
const sizeReadout = document.getElementById("sizeReadout");
const canvasWrap = document.getElementById("canvasWrap");
const bufferList = document.getElementById("bufferList");

const state = {
  image: null,
  imageTitle: "annotated-image",
  tool: "pen",
  color: colorPicker.value,
  size: Number(sizeRange.value),
  shapes: [],
  tempShape: null,
  isDrawing: false,
  bufferedImages: []
};

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.background = isError ? "#4b1f1f" : "#122921";
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll(".tool-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
}

function syncSizeLabel() {
  sizeReadout.textContent = `${state.size} px`;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function showCanvas(show) {
  canvas.style.display = show ? "block" : "none";
  emptyStage.style.display = show ? "none" : "grid";
}

function drawArrow(shape) {
  const { x1, y1, x2, y2, color, size } = shape;
  const headLength = Math.max(14, size * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  context.strokeStyle = color;
  context.lineWidth = size;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();

  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 7),
    y2 - headLength * Math.sin(angle - Math.PI / 7)
  );
  context.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 7),
    y2 - headLength * Math.sin(angle + Math.PI / 7)
  );
  context.closePath();
  context.fill();
}

function drawRect(shape) {
  const width = shape.x2 - shape.x1;
  const height = shape.y2 - shape.y1;
  context.strokeStyle = shape.color;
  context.lineWidth = shape.size;
  context.strokeRect(shape.x1, shape.y1, width, height);
}

function drawEllipse(shape) {
  const centerX = (shape.x1 + shape.x2) / 2;
  const centerY = (shape.y1 + shape.y2) / 2;
  const radiusX = Math.abs(shape.x2 - shape.x1) / 2;
  const radiusY = Math.abs(shape.y2 - shape.y1) / 2;

  context.strokeStyle = shape.color;
  context.lineWidth = shape.size;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.stroke();
}

function drawPen(shape) {
  if (!shape.points || shape.points.length < 2) {
    return;
  }

  context.strokeStyle = shape.color;
  context.lineWidth = shape.size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(shape.points[0].x, shape.points[0].y);

  for (let index = 1; index < shape.points.length; index += 1) {
    context.lineTo(shape.points[index].x, shape.points[index].y);
  }

  context.stroke();
}

function drawText(shape) {
  context.fillStyle = shape.color;
  context.font = `${Math.max(16, shape.size * 5)}px "Segoe UI", Tahoma, sans-serif`;
  context.textBaseline = "top";
  context.fillText(shape.text, shape.x, shape.y);
}

function drawShape(shape) {
  if (!shape) {
    return;
  }

  switch (shape.type) {
    case "pen":
      drawPen(shape);
      break;
    case "arrow":
      drawArrow(shape);
      break;
    case "rect":
      drawRect(shape);
      break;
    case "ellipse":
      drawEllipse(shape);
      break;
    case "text":
      drawText(shape);
      break;
    default:
      break;
  }
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (state.image) {
    context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  } else {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  state.shapes.forEach(drawShape);
  drawShape(state.tempShape);
}

function resetAnnotations() {
  state.shapes = [];
  state.tempShape = null;
}

function normalizeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "annotated-image";
}

function updateTitle(title) {
  state.imageTitle = title || "annotated-image";
  imageTitle.textContent = state.imageTitle;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function syncBufferedImages() {
  await chrome.runtime.sendMessage({
    action: "set-editor-buffer",
    items: state.bufferedImages
  });
}

function renderBufferedImages() {
  if (!bufferList) {
    return;
  }

  if (!state.bufferedImages.length) {
    bufferList.innerHTML = `<div class="buffer-empty">No buffered Gemini images yet.</div>`;
    return;
  }

  bufferList.innerHTML = "";

  state.bufferedImages.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "buffer-item";
    card.innerHTML = `
      <strong>${escapeHtml(item.title || item.filename || "Gemini image")}</strong>
      <div class="buffer-item-meta">${escapeHtml(item.source || "buffered")} / ${formatDate(item.createdAt)}</div>
      <div class="buffer-item-actions">
        <button class="mini-btn" data-load-index="${index}">Load</button>
        <button class="mini-btn" data-remove-index="${index}">Remove</button>
      </div>
    `;
    bufferList.appendChild(card);
  });

  bufferList.querySelectorAll("[data-load-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.loadIndex);
      const item = state.bufferedImages[index];
      if (!item) {
        return;
      }

      await loadImageFromDataUrl(item.dataUrl, item.title || item.filename || "gemini-image");
      setStatus("Buffered Gemini image loaded into the studio.");
    });
  });

  bufferList.querySelectorAll("[data-remove-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.removeIndex);
      state.bufferedImages.splice(index, 1);
      renderBufferedImages();
      await syncBufferedImages();
      setStatus("Buffered image removed.");
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadImageFromDataUrl(dataUrl, title) {
  const image = new Image();
  image.onload = () => {
    state.image = image;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    updateTitle(title);
    resetAnnotations();
    showCanvas(true);
    render();
    setStatus("Image loaded. Start drawing.");
  };
  image.onerror = () => {
    setStatus("Unable to load the image.", true);
  };
  image.src = dataUrl;
}

async function loadImageFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    await loadImageFromDataUrl(reader.result, file.name.replace(/\.[^.]+$/, ""));
  };
  reader.readAsDataURL(file);
}

function beginShape(point) {
  switch (state.tool) {
    case "pen":
      state.tempShape = {
        type: "pen",
        color: state.color,
        size: state.size,
        points: [point]
      };
      break;
    case "arrow":
    case "rect":
    case "ellipse":
      state.tempShape = {
        type: state.tool,
        color: state.color,
        size: state.size,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y
      };
      break;
    default:
      state.tempShape = null;
      break;
  }
}

function extendShape(point) {
  if (!state.tempShape) {
    return;
  }

  if (state.tempShape.type === "pen") {
    state.tempShape.points.push(point);
  } else {
    state.tempShape.x2 = point.x;
    state.tempShape.y2 = point.y;
  }
}

function finalizeShape() {
  if (!state.tempShape) {
    return;
  }

  if (state.tempShape.type === "pen" && state.tempShape.points.length < 2) {
    state.tempShape = null;
    render();
    return;
  }

  state.shapes.push(state.tempShape);
  state.tempShape = null;
  render();
}

canvas.addEventListener("mousedown", (event) => {
  if (!state.image) {
    return;
  }

  const point = getCanvasPoint(event);

  if (state.tool === "text") {
    const text = window.prompt("Enter text");

    if (text && text.trim()) {
      state.shapes.push({
        type: "text",
        color: state.color,
        size: state.size,
        x: point.x,
        y: point.y,
        text: text.trim()
      });
      render();
    }
    return;
  }

  state.isDrawing = true;
  beginShape(point);
  render();
});

canvas.addEventListener("mousemove", (event) => {
  if (!state.isDrawing || !state.tempShape) {
    return;
  }

  extendShape(getCanvasPoint(event));
  render();
});

window.addEventListener("mouseup", () => {
  if (!state.isDrawing) {
    return;
  }

  state.isDrawing = false;
  finalizeShape();
});

document.querySelectorAll(".tool-btn").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

colorPicker.addEventListener("change", () => {
  state.color = colorPicker.value;
});

sizeRange.addEventListener("input", () => {
  state.size = Number(sizeRange.value);
  syncSizeLabel();
});

document.getElementById("uploadButton").addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  await loadImageFile(fileInput.files[0]);
  fileInput.value = "";
});

document.getElementById("undoButton").addEventListener("click", () => {
  if (state.shapes.length === 0) {
    return;
  }

  state.shapes.pop();
  render();
  setStatus("Last annotation removed.");
});

document.getElementById("clearButton").addEventListener("click", () => {
  resetAnnotations();
  render();
  setStatus("All annotations cleared.");
});

document.getElementById("saveButton").addEventListener("click", async () => {
  if (!state.image) {
    setStatus("Load an image first.", true);
    return;
  }

  render();
  const filename = `annotated-${normalizeFileName(state.imageTitle)}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const objectUrl = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url: objectUrl,
    filename: `screeeeenvme/captures/${filename}`,
    conflictAction: "uniquify",
    saveAs: false
  });

  await chrome.runtime.sendMessage({
    action: "add-recent-item",
    item: {
      kind: "image",
      mode: "annotated",
      title: state.imageTitle,
      filename,
      bytes: blob.size,
      createdAt: Date.now()
    }
  });

  URL.revokeObjectURL(objectUrl);
  setStatus("Annotated image saved locally.");
});

window.addEventListener("paste", async (event) => {
  const file = [...(event.clipboardData?.files || [])][0];
  if (file) {
    await loadImageFile(file);
  }
});

window.addEventListener("keydown", async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (state.shapes.length > 0) {
      state.shapes.pop();
      render();
      setStatus("Undo applied.");
    }
  }
});

canvasWrap.addEventListener("dragover", (event) => {
  event.preventDefault();
});

canvasWrap.addEventListener("drop", async (event) => {
  event.preventDefault();
  const file = [...(event.dataTransfer?.files || [])][0];
  if (file) {
    await loadImageFile(file);
  }
});

async function loadInitialEditorImage() {
  const response = await chrome.runtime.sendMessage({ action: "get-editor-image" });
  const image = response?.image;
  const bufferResponse = await chrome.runtime.sendMessage({ action: "get-editor-buffer" });
  state.bufferedImages = Array.isArray(bufferResponse?.items) ? bufferResponse.items : [];
  renderBufferedImages();

  if (image?.dataUrl) {
    await loadImageFromDataUrl(image.dataUrl, image.title || image.source || "captured-image");
  } else if (state.bufferedImages[0]?.dataUrl) {
    await loadImageFromDataUrl(
      state.bufferedImages[0].dataUrl,
      state.bufferedImages[0].title || state.bufferedImages[0].filename || "gemini-image"
    );
    setStatus("Loaded the latest buffered Gemini image.");
  } else {
    showCanvas(false);
    setStatus("Drawing studio ready. Upload, drop, or paste an image.");
  }
}

document.getElementById("clearInboxButton").addEventListener("click", async () => {
  state.bufferedImages = [];
  renderBufferedImages();
  await syncBufferedImages();
  setStatus("Gemini inbox cleared.");
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "editor-buffer-updated" && message.image) {
    state.bufferedImages = [message.image, ...state.bufferedImages].slice(0, 30);
    renderBufferedImages();

    if (!state.image) {
      void loadImageFromDataUrl(
        message.image.dataUrl,
        message.image.title || message.image.filename || "gemini-image"
      );
      setStatus("New Gemini image received and loaded.");
    } else {
      setStatus("New Gemini image arrived in the inbox.");
    }
  }
});

syncSizeLabel();
setTool("pen");
loadInitialEditorImage().catch((error) => {
  setStatus(error.message || "Unable to open the drawing studio.", true);
});
