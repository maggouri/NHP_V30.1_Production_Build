const STORAGE_KEY = 'nhp_private_recorder_settings';
const DEFAULT_SETTINGS = {
  microphone: true,
  systemAudio: true,
  saveAs: false,
  quality: '1080',
  fps: '30',
  toolColor: '#ffde59',
  toolSize: 4,
  zoom: '1'
};

const UI = {
  microphone: document.getElementById('opt-microphone'),
  systemAudio: document.getElementById('opt-system-audio'),
  saveAs: document.getElementById('opt-save-as'),
  quality: document.getElementById('opt-quality'),
  fps: document.getElementById('opt-fps'),
  start: document.getElementById('btn-start-recording'),
  pause: document.getElementById('btn-pause-recording'),
  stop: document.getElementById('btn-stop-recording'),
  downloadLast: document.getElementById('btn-download-last'),
  toolbarStart: document.getElementById('btn-toolbar-start'),
  toolbarPause: document.getElementById('btn-toolbar-pause'),
  toolbarStop: document.getElementById('btn-toolbar-stop'),
  toolbarToggle: document.getElementById('btn-toggle-toolbar'),
  toolbarExpand: document.getElementById('btn-expand-toolbar'),
  toolbarGrip: document.getElementById('toolbar-grip'),
  toolbar: document.getElementById('floating-toolbar'),
  toolbarDock: document.getElementById('toolbar-dock'),
  toolButtons: Array.from(document.querySelectorAll('.tool-btn')),
  toolColor: document.getElementById('tool-color'),
  toolSize: document.getElementById('tool-size'),
  toolSizeValue: document.getElementById('tool-size-value'),
  toolZoom: document.getElementById('tool-zoom'),
  undo: document.getElementById('btn-undo-annotation'),
  clear: document.getElementById('btn-clear-annotations'),
  preview: document.getElementById('preview-video'),
  sourceVideo: document.getElementById('source-video'),
  stageWrap: document.getElementById('stage-wrap'),
  stageCanvas: document.getElementById('stage-canvas'),
  overlay: document.getElementById('preview-overlay'),
  textEditor: document.getElementById('text-editor'),
  timer: document.getElementById('recording-timer'),
  statusPill: document.getElementById('status-pill'),
  statusNote: document.getElementById('status-note'),
  lastStatus: document.getElementById('last-status-value'),
  lastFile: document.getElementById('last-file-value'),
  lastOutput: document.getElementById('last-output-label'),
  saveMode: document.getElementById('save-mode-value')
};

const state = {
  recorder: null,
  displayStream: null,
  micStream: null,
  audioContext: null,
  destinationNode: null,
  recordingStream: null,
  chunks: [],
  previewUrl: '',
  lastBlob: null,
  lastFilename: '',
  renderLoopId: 0,
  sourceWidth: 1280,
  sourceHeight: 720,
  startedAt: 0,
  pausedAt: 0,
  pausedDuration: 0,
  timerId: null,
  isStopping: false,
  isToolbarCollapsed: false,
  activeTool: 'pen',
  shapes: [],
  draftShape: null,
  isDrawing: false,
  isPanning: false,
  textDraftPoint: null,
  isPointerInside: false,
  zoom: 1,
  sourceRect: { x: 0, y: 0, width: 1280, height: 720 },
  viewOffsetX: 0,
  viewOffsetY: 0,
  panStartClientX: 0,
  panStartClientY: 0,
  panOriginX: 0,
  panOriginY: 0,
  toolbarDrag: {
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0
  }
};

const stageContext = UI.stageCanvas.getContext('2d', { alpha: false });

init().catch((error) => {
  console.error('Recorder init failed:', error);
  setStatus('تعذر تهيئة مسجل الشاشة المحلي.', 'error');
});

async function init() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  const settings = { ...DEFAULT_SETTINGS, ...(stored?.[STORAGE_KEY] || {}) };

  UI.microphone.checked = settings.microphone;
  UI.systemAudio.checked = settings.systemAudio;
  UI.saveAs.checked = settings.saveAs;
  UI.quality.value = settings.quality;
  UI.fps.value = settings.fps;
  UI.toolColor.value = settings.toolColor;
  UI.toolSize.value = String(settings.toolSize);
  UI.toolZoom.value = settings.zoom;

  state.zoom = Number(settings.zoom) || 1;

  bindSettingPersistence();
  bindActions();
  updateToolUi();
  refreshSaveModeLabel();
  setStatus('اضغط بدء التسجيل ثم اختر الشاشة أو التبويب الذي تريد تسجيله.', 'idle');
  renderStage();
}

function bindSettingPersistence() {
  [UI.microphone, UI.systemAudio, UI.saveAs, UI.quality, UI.fps, UI.toolColor, UI.toolSize, UI.toolZoom]
    .forEach((element) => {
      element?.addEventListener('change', async () => {
        state.zoom = Number(UI.toolZoom.value) || 1;
        updateToolUi();
        await chrome.storage.local.set({ [STORAGE_KEY]: readSettings() });
        refreshSaveModeLabel();
        renderStage();
      });
    });
}

function bindActions() {
  UI.start?.addEventListener('click', startRecording);
  UI.pause?.addEventListener('click', togglePauseResume);
  UI.stop?.addEventListener('click', stopRecording);
  UI.downloadLast?.addEventListener('click', async () => {
    if (!state.lastBlob || !state.lastFilename) return;
    await downloadBlob(state.lastBlob, state.lastFilename, UI.saveAs.checked);
  });

  UI.toolbarStart?.addEventListener('click', startRecording);
  UI.toolbarPause?.addEventListener('click', togglePauseResume);
  UI.toolbarStop?.addEventListener('click', stopRecording);
  UI.toolbarToggle?.addEventListener('click', collapseToolbar);
  UI.toolbarExpand?.addEventListener('click', expandToolbar);
  UI.undo?.addEventListener('click', undoLastShape);
  UI.clear?.addEventListener('click', clearShapes);

  UI.toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTool(button.dataset.tool || 'pen');
    });
  });

  UI.toolbarGrip?.addEventListener('pointerdown', startToolbarDrag);
  UI.toolbarGrip?.addEventListener('dblclick', resetToolbarPosition);
  window.addEventListener('pointermove', handleToolbarDrag);
  window.addEventListener('pointerup', stopToolbarDrag);
  window.addEventListener('pointercancel', stopToolbarDrag);

  UI.stageCanvas.addEventListener('pointerdown', handlePointerDown);
  UI.stageCanvas.addEventListener('pointermove', handlePointerMove);
  UI.stageCanvas.addEventListener('pointerup', handlePointerUp);
  UI.stageCanvas.addEventListener('pointerleave', handlePointerUp);
  UI.stageCanvas.addEventListener('pointercancel', handlePointerUp);

  UI.textEditor?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideTextEditor();
      return;
    }

    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      commitTextDraft();
    }
  });

  UI.textEditor?.addEventListener('blur', () => {
    if (!UI.textEditor.classList.contains('hidden')) commitTextDraft();
  });

  window.addEventListener('keydown', handleKeyboardShortcuts);

  window.addEventListener('beforeunload', () => {
    cleanupStreams();
    clearPreviewUrl();
    clearTimer();
    cancelRenderLoop();
  });
}

function handleKeyboardShortcuts(event) {
  const targetTag = event.target?.tagName;
  const isTypingTarget = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable;

  if (event.key === 'Escape') {
    if (!UI.textEditor.classList.contains('hidden')) {
      event.preventDefault();
      hideTextEditor();
      renderStage();
      return;
    }

    if (state.draftShape) {
      event.preventDefault();
      state.draftShape = null;
      state.isDrawing = false;
      renderStage();
      return;
    }
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'z' && !isTypingTarget) {
    event.preventDefault();
    undoLastShape();
    return;
  }

  if (isTypingTarget) return;

  const quickTools = {
    p: 'pen',
    a: 'arrow',
    r: 'rectangle',
    o: 'ellipse',
    t: 'text',
    s: 'step',
    l: 'spotlight',
    h: 'pan'
  };

  const nextTool = quickTools[event.key.toLowerCase()];
  if (nextTool) {
    event.preventDefault();
    setActiveTool(nextTool);
  }
}

function setActiveTool(tool) {
  state.activeTool = tool;
  hideTextEditor();
  updateToolUi();
}

function startToolbarDrag(event) {
  if (!UI.toolbar || UI.toolbar.classList.contains('hidden')) return;

  const toolbarRect = UI.toolbar.getBoundingClientRect();
  state.toolbarDrag.active = true;
  state.toolbarDrag.pointerId = event.pointerId;
  state.toolbarDrag.offsetX = event.clientX - toolbarRect.left;
  state.toolbarDrag.offsetY = event.clientY - toolbarRect.top;

  UI.toolbarGrip?.setPointerCapture?.(event.pointerId);
}

function handleToolbarDrag(event) {
  if (!state.toolbarDrag.active || event.pointerId !== state.toolbarDrag.pointerId) return;

  const wrapRect = UI.stageWrap?.getBoundingClientRect();
  if (!wrapRect) return;

  const nextLeft = event.clientX - wrapRect.left - state.toolbarDrag.offsetX;
  const nextTop = event.clientY - wrapRect.top - state.toolbarDrag.offsetY;
  applyToolbarPosition(nextLeft, nextTop);
}

function stopToolbarDrag(event) {
  if (!state.toolbarDrag.active || event.pointerId !== state.toolbarDrag.pointerId) return;

  state.toolbarDrag.active = false;
  state.toolbarDrag.pointerId = null;

  try {
    UI.toolbarGrip?.releasePointerCapture?.(event.pointerId);
  } catch (_) {
    // Ignore release errors when the pointer is already released.
  }
}

function resetToolbarPosition() {
  applyToolbarPosition(18, 18);
}

function applyToolbarPosition(left, top) {
  if (!UI.toolbar || !UI.stageWrap) return;

  const wrapRect = UI.stageWrap.getBoundingClientRect();
  const toolbarRect = UI.toolbar.getBoundingClientRect();
  const maxLeft = Math.max(10, wrapRect.width - toolbarRect.width - 10);
  const maxTop = Math.max(10, wrapRect.height - toolbarRect.height - 10);
  const safeLeft = clamp(left, 10, maxLeft);
  const safeTop = clamp(top, 10, maxTop);

  UI.toolbar.style.left = `${safeLeft}px`;
  UI.toolbar.style.top = `${safeTop}px`;
  UI.toolbarDock.style.left = `${safeLeft}px`;
  UI.toolbarDock.style.top = `${safeTop}px`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readSettings() {
  return {
    microphone: UI.microphone.checked,
    systemAudio: UI.systemAudio.checked,
    saveAs: UI.saveAs.checked,
    quality: UI.quality.value,
    fps: UI.fps.value,
    toolColor: UI.toolColor.value,
    toolSize: Number(UI.toolSize.value) || DEFAULT_SETTINGS.toolSize,
    zoom: UI.toolZoom.value
  };
}

function refreshSaveModeLabel() {
  const saveMode = UI.saveAs.checked ? 'حفظ باسم' : 'تنزيل مباشر';
  const outputLabel = UI.saveAs.checked ? 'سيظهر لك مربع اختيار الملف' : 'Downloads/NHP Recordings';

  UI.saveMode.textContent = saveMode;
  UI.lastOutput.textContent = outputLabel;
}

function updateToolUi() {
  const size = Number(UI.toolSize.value) || DEFAULT_SETTINGS.toolSize;
  UI.toolSizeValue.textContent = `${size}px`;

  UI.toolButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === state.activeTool);
  });

  const cursorByTool = {
    pen: 'crosshair',
    arrow: 'crosshair',
    rectangle: 'crosshair',
    ellipse: 'crosshair',
    text: 'text',
    step: 'copy',
    spotlight: 'crosshair',
    pan: (Number(UI.toolZoom.value) || 1) > 1 ? 'grab' : 'not-allowed'
  };

  UI.stageCanvas.style.cursor = cursorByTool[state.activeTool] || 'default';
}

async function startRecording() {
  if (state.recorder && state.recorder.state !== 'inactive') return;

  resetDrawingState();
  clearPreviewUrl();
  state.lastBlob = null;
  state.lastFilename = '';
  state.isStopping = false;

  UI.downloadLast.disabled = true;
  updateButtonsForBusyStart();
  setStatus('اختر الآن الشاشة أو التبويب من نافذة كروم لبدء التسجيل.', 'busy');

  try {
    const settings = readSettings();
    const quality = Number(settings.quality) || 1080;
    const fps = Number(settings.fps) || 30;

    state.displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: fps, max: fps },
        width: { ideal: Math.min(Math.round((quality * 16) / 9), 2560) },
        height: { ideal: quality }
      },
      audio: settings.systemAudio
    });

    if (settings.microphone) {
      try {
        state.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (error) {
        console.warn('Microphone unavailable:', error);
        setStatus('بدأ التسجيل بدون ميكروفون لأن إذنه غير متاح.', 'busy');
      }
    }

    await prepareSourceVideo();
    state.recordingStream = await buildRecordingStream(fps);

    state.recorder = new MediaRecorder(state.recordingStream, {
      mimeType: pickMimeType(),
      videoBitsPerSecond: getVideoBitsPerSecond(quality, fps)
    });

    state.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) state.chunks.push(event.data);
    };

    state.recorder.onstop = finalizeRecording;
    state.recorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      setStatus(`حدث خطأ أثناء التسجيل: ${event.error?.message || 'غير معروف'}`, 'error');
      cleanupStreams();
      updateButtonsForIdle();
      showOverlay('تعذر استمرار التسجيل', 'حدث خطأ أثناء كتابة الفيديو. حاول بدء جلسة جديدة.');
    };

    const displayVideoTrack = state.displayStream.getVideoTracks()[0];
    if (displayVideoTrack) {
      displayVideoTrack.addEventListener('ended', () => {
        if (state.recorder && state.recorder.state !== 'inactive' && !state.isStopping) {
          stopRecording();
        }
      });
    }

    showLiveStage();
    expandToolbar();
    startRenderLoop();

    state.startedAt = Date.now();
    state.pausedAt = 0;
    state.pausedDuration = 0;
    state.chunks = [];

    state.recorder.start(1000);
    startTimer();
    updateButtonsForRecording();
    setStatus('التسجيل يعمل الآن. استخدم الشريط العائم للرسم أو التوقف أو الإيقاف المؤقت.', 'recording');
  } catch (error) {
    console.error('Start recording failed:', error);
    cleanupStreams();
    updateButtonsForIdle();

    if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
      setStatus('تم إلغاء عملية الالتقاط أو رفض الإذن.', 'idle');
      showOverlay('لم يبدأ التسجيل', 'أغلق نافذة الاختيار أو أعد المحاولة واختر شاشة أو تبويبًا صالحًا.');
      return;
    }

    setStatus(`تعذر بدء التسجيل: ${error.message || 'خطأ غير معروف'}`, 'error');
    showOverlay('تعذر بدء التسجيل', 'حدث خطأ أثناء تهيئة الشاشة أو الصوت. أعد المحاولة مرة أخرى.');
  }
}

async function prepareSourceVideo() {
  UI.sourceVideo.srcObject = state.displayStream;
  UI.sourceVideo.muted = true;

  await new Promise((resolve, reject) => {
    const onLoaded = async () => {
      cleanup();
      try {
        await UI.sourceVideo.play();
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error('تعذر تجهيز معاينة الشاشة.'));
    };

    const cleanup = () => {
      UI.sourceVideo.removeEventListener('loadedmetadata', onLoaded);
      UI.sourceVideo.removeEventListener('error', onError);
    };

    UI.sourceVideo.addEventListener('loadedmetadata', onLoaded, { once: true });
    UI.sourceVideo.addEventListener('error', onError, { once: true });
  });

  state.sourceWidth = UI.sourceVideo.videoWidth || state.displayStream.getVideoTracks()[0]?.getSettings().width || 1280;
  state.sourceHeight = UI.sourceVideo.videoHeight || state.displayStream.getVideoTracks()[0]?.getSettings().height || 720;

  UI.stageCanvas.width = state.sourceWidth;
  UI.stageCanvas.height = state.sourceHeight;
  state.sourceRect = { x: 0, y: 0, width: state.sourceWidth, height: state.sourceHeight };
}

async function buildRecordingStream(fps) {
  const canvasStream = UI.stageCanvas.captureStream(fps);
  const audioStream = await buildMixedAudioStream();

  if (audioStream) {
    audioStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
  }

  return canvasStream;
}

async function buildMixedAudioStream() {
  const audioStreams = [];
  if (state.displayStream?.getAudioTracks().length) audioStreams.push(state.displayStream);
  if (state.micStream?.getAudioTracks().length) audioStreams.push(state.micStream);
  if (!audioStreams.length) return null;

  state.audioContext = new AudioContext();
  state.destinationNode = state.audioContext.createMediaStreamDestination();

  audioStreams.forEach((audioStream) => {
    const source = state.audioContext.createMediaStreamSource(audioStream);
    source.connect(state.destinationNode);
  });

  return state.destinationNode.stream;
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  return candidates.find((value) => MediaRecorder.isTypeSupported(value)) || '';
}

function getVideoBitsPerSecond(quality, fps) {
  if (quality >= 1440) return fps >= 60 ? 18000000 : 14000000;
  if (quality >= 1080) return fps >= 60 ? 14000000 : 10000000;
  return fps >= 60 ? 9000000 : 6000000;
}

function togglePauseResume() {
  if (!state.recorder) return;

  if (state.recorder.state === 'recording') {
    state.recorder.pause();
    state.pausedAt = Date.now();
    clearTimer();
    setPauseButtonsLabel(true);
    setStatus('تم إيقاف التسجيل مؤقتًا. يمكنك الرسم أو الكتابة ثم الاستئناف.', 'paused');
    renderStage();
    return;
  }

  if (state.recorder.state === 'paused') {
    if (state.pausedAt) {
      state.pausedDuration += Date.now() - state.pausedAt;
      state.pausedAt = 0;
    }

    state.recorder.resume();
    startTimer();
    setPauseButtonsLabel(false);
    setStatus('عاد التسجيل للعمل.', 'recording');
  }
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === 'inactive') return;

  commitTextDraft();
  state.isStopping = true;
  clearTimer();

  if (state.recorder.state === 'paused') {
    if (state.pausedAt) {
      state.pausedDuration += Date.now() - state.pausedAt;
      state.pausedAt = 0;
    }
    state.recorder.resume();
  }

  UI.pause.disabled = true;
  UI.stop.disabled = true;
  UI.toolbarPause.disabled = true;
  UI.toolbarStop.disabled = true;
  setStatus('جارٍ إنهاء التسجيل وتجهيز الملف للحفظ...', 'busy');
  state.recorder.stop();
}

async function finalizeRecording() {
  try {
    const mimeType = state.recorder?.mimeType || 'video/webm';
    const blob = new Blob(state.chunks, { type: mimeType });
    if (!blob.size) throw new Error('الملف الناتج فارغ.');

    const filename = buildFilename();
    state.lastBlob = blob;
    state.lastFilename = filename;

    clearPreviewUrl();
    state.previewUrl = URL.createObjectURL(blob);
    UI.preview.src = state.previewUrl;
    UI.preview.controls = true;
    UI.preview.muted = false;

    showPlayback();
    await downloadBlob(blob, filename, UI.saveAs.checked);

    UI.lastFile.textContent = filename;
    UI.downloadLast.disabled = false;
    setStatus('تم حفظ الفيديو محليًا بنجاح.', 'idle');
  } catch (error) {
    console.error('Finalize recording failed:', error);
    setStatus(`فشل حفظ الفيديو: ${error.message || 'خطأ غير معروف'}`, 'error');
    showOverlay('فشل حفظ الفيديو', 'تم إيقاف التسجيل لكن تعذر تجهيز الملف النهائي.');
  } finally {
    cleanupStreams();
    updateButtonsForIdle();
  }
}

function buildFilename() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-') + '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-');

  return `NHP Recordings/NHP_Screen_Recording_${stamp}.webm`;
}

async function downloadBlob(blob, filename, saveAs) {
  const url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        UI.lastStatus.textContent = `تم إنشاء التنزيل #${downloadId}`;
        resolve(downloadId);
      });
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function startTimer() {
  clearTimer();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 1000);
}

function clearTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimer() {
  if (!state.startedAt) {
    UI.timer.textContent = '00:00:00';
    return;
  }

  const pausedDelta = state.pausedAt ? Date.now() - state.pausedAt : 0;
  const elapsed = Math.max(0, Date.now() - state.startedAt - state.pausedDuration - pausedDelta);
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  UI.timer.textContent = `${hours}:${minutes}:${seconds}`;
}

function startRenderLoop() {
  cancelRenderLoop();

  const draw = () => {
    renderStage();
    if (state.displayStream) state.renderLoopId = window.requestAnimationFrame(draw);
  };

  state.renderLoopId = window.requestAnimationFrame(draw);
}

function cancelRenderLoop() {
  if (state.renderLoopId) {
    window.cancelAnimationFrame(state.renderLoopId);
    state.renderLoopId = 0;
  }
}

function renderStage() {
  const width = UI.stageCanvas.width || state.sourceWidth;
  const height = UI.stageCanvas.height || state.sourceHeight;

  if (!width || !height) return;

  stageContext.clearRect(0, 0, width, height);
  stageContext.fillStyle = '#02060b';
  stageContext.fillRect(0, 0, width, height);

  const videoReady = Boolean(
    UI.sourceVideo.srcObject &&
    UI.sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    state.displayStream
  );

  if (videoReady) {
    drawVideoFrame(width, height);
  } else {
    drawStagePlaceholder(width, height);
  }

  state.shapes.filter((shape) => shape.type === 'spotlight').forEach((shape) => drawShape(shape));
  if (state.draftShape?.type === 'spotlight') drawShape(state.draftShape);

  state.shapes.filter((shape) => shape.type !== 'spotlight').forEach((shape) => drawShape(shape));
  if (state.draftShape && state.draftShape.type !== 'spotlight') drawShape(state.draftShape);

  if (state.recorder?.state === 'paused') {
    drawPausedOverlay(width, height);
  }
}

function drawVideoFrame(width, height) {
  const zoom = Number(UI.toolZoom.value) || 1;
  const drawWidth = width * zoom;
  const drawHeight = height * zoom;
  const maxOffsetX = Math.max(0, (drawWidth - width) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - height) / 2);

  state.viewOffsetX = clamp(state.viewOffsetX, -maxOffsetX, maxOffsetX);
  state.viewOffsetY = clamp(state.viewOffsetY, -maxOffsetY, maxOffsetY);

  const drawX = (width - drawWidth) / 2 + state.viewOffsetX;
  const drawY = (height - drawHeight) / 2 + state.viewOffsetY;

  stageContext.drawImage(UI.sourceVideo, drawX, drawY, drawWidth, drawHeight);
  state.sourceRect = { x: drawX, y: drawY, width: drawWidth, height: drawHeight };
}

function drawStagePlaceholder(width, height) {
  stageContext.fillStyle = '#06101c';
  stageContext.fillRect(0, 0, width, height);
  stageContext.fillStyle = 'rgba(143, 167, 191, 0.8)';
  stageContext.font = `700 ${Math.max(20, Math.round(width * 0.024))}px "Segoe UI", Tahoma, Arial`;
  stageContext.textAlign = 'center';
  stageContext.fillText('المعاينة ستظهر هنا بعد بدء التسجيل', width / 2, height / 2 - 10);
  stageContext.font = `400 ${Math.max(14, Math.round(width * 0.014))}px "Segoe UI", Tahoma, Arial`;
  stageContext.fillText('ابدأ التسجيل ثم اختر الشاشة أو التبويب من نافذة كروم.', width / 2, height / 2 + 24);
}

function drawPausedOverlay(width, height) {
  stageContext.fillStyle = 'rgba(4, 10, 18, 0.34)';
  stageContext.fillRect(0, 0, width, height);
  stageContext.fillStyle = '#fde68a';
  stageContext.font = `700 ${Math.max(22, Math.round(width * 0.028))}px "Segoe UI", Tahoma, Arial`;
  stageContext.textAlign = 'center';
  stageContext.fillText('التسجيل متوقف مؤقتًا', width / 2, 54);
}

function drawShape(shape) {
  stageContext.save();
  stageContext.lineCap = 'round';
  stageContext.lineJoin = 'round';
  stageContext.strokeStyle = shape.color;
  stageContext.fillStyle = shape.color;
  stageContext.lineWidth = shape.size;

  if (shape.type === 'pen') {
    if (!shape.points?.length) {
      stageContext.restore();
      return;
    }

    stageContext.beginPath();
    stageContext.moveTo(shape.points[0].x, shape.points[0].y);
    shape.points.slice(1).forEach((point) => {
      stageContext.lineTo(point.x, point.y);
    });
    stageContext.stroke();
    stageContext.restore();
    return;
  }

  if (shape.type === 'arrow') {
    drawArrow(shape.startX, shape.startY, shape.endX, shape.endY, shape.size, shape.color);
    stageContext.restore();
    return;
  }

  if (shape.type === 'rectangle') {
    const rect = normalizeRect(shape.startX, shape.startY, shape.endX, shape.endY);
    stageContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
    stageContext.restore();
    return;
  }

  if (shape.type === 'ellipse') {
    const rect = normalizeRect(shape.startX, shape.startY, shape.endX, shape.endY);
    stageContext.beginPath();
    stageContext.ellipse(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.max(1, rect.width / 2),
      Math.max(1, rect.height / 2),
      0,
      0,
      Math.PI * 2
    );
    stageContext.stroke();
    stageContext.restore();
    return;
  }

  if (shape.type === 'spotlight') {
    const spot = normalizeSpotlight(shape);
    stageContext.save();
    stageContext.fillStyle = 'rgba(3, 8, 15, 0.52)';
    stageContext.beginPath();
    stageContext.rect(0, 0, UI.stageCanvas.width, UI.stageCanvas.height);
    stageContext.ellipse(spot.cx, spot.cy, spot.rx, spot.ry, 0, 0, Math.PI * 2);
    stageContext.fill('evenodd');

    stageContext.strokeStyle = shape.color;
    stageContext.lineWidth = Math.max(3, shape.size);
    stageContext.setLineDash([10, 8]);
    stageContext.beginPath();
    stageContext.ellipse(spot.cx, spot.cy, spot.rx, spot.ry, 0, 0, Math.PI * 2);
    stageContext.stroke();
    stageContext.restore();
    return;
  }

  if (shape.type === 'step') {
    const radius = Math.max(18, shape.size * 4);
    stageContext.save();
    stageContext.fillStyle = shape.color;
    stageContext.strokeStyle = 'rgba(255,255,255,0.92)';
    stageContext.lineWidth = Math.max(2, shape.size * 0.6);
    stageContext.beginPath();
    stageContext.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
    stageContext.fill();
    stageContext.stroke();

    stageContext.fillStyle = '#041018';
    stageContext.font = `800 ${Math.max(16, radius * 0.95)}px "Segoe UI", Tahoma, Arial`;
    stageContext.textAlign = 'center';
    stageContext.textBaseline = 'middle';
    stageContext.fillText(String(shape.number), shape.x, shape.y + 1);
    stageContext.restore();
    return;
  }

  if (shape.type === 'text') {
    stageContext.font = `${Math.max(18, shape.size * 7)}px "Segoe UI", Tahoma, Arial`;
    stageContext.textAlign = 'right';
    stageContext.textBaseline = 'top';
    drawMultilineText(shape.text, shape.x, shape.y);
    stageContext.restore();
  }
}

function drawArrow(startX, startY, endX, endY, size, color) {
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLength = Math.max(14, size * 4);

  stageContext.save();
  stageContext.strokeStyle = color;
  stageContext.fillStyle = color;
  stageContext.lineWidth = size;
  stageContext.beginPath();
  stageContext.moveTo(startX, startY);
  stageContext.lineTo(endX, endY);
  stageContext.stroke();

  stageContext.beginPath();
  stageContext.moveTo(endX, endY);
  stageContext.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 7),
    endY - headLength * Math.sin(angle - Math.PI / 7)
  );
  stageContext.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 7),
    endY - headLength * Math.sin(angle + Math.PI / 7)
  );
  stageContext.closePath();
  stageContext.fill();
  stageContext.restore();
}

function drawMultilineText(text, x, y) {
  const lines = String(text || '').split(/\r?\n/);
  const fontSize = parseInt(stageContext.font, 10) || 24;
  const lineHeight = Math.round(fontSize * 1.35);

  lines.forEach((line, index) => {
    stageContext.fillText(line, x, y + index * lineHeight);
  });
}

function handlePointerDown(event) {
  if (!canDraw()) return;

  if (state.activeTool === 'pan') {
    if ((Number(UI.toolZoom.value) || 1) <= 1) return;

    state.isPanning = true;
    UI.stageCanvas.style.cursor = 'grabbing';
    state.panStartClientX = event.clientX;
    state.panStartClientY = event.clientY;
    state.panOriginX = state.viewOffsetX;
    state.panOriginY = state.viewOffsetY;
    UI.stageCanvas.setPointerCapture(event.pointerId);
    return;
  }

  const point = getCanvasPoint(event);
  if (!point) return;

  if (state.activeTool === 'step') {
    state.shapes.push({
      type: 'step',
      color: UI.toolColor.value,
      size: Number(UI.toolSize.value) || DEFAULT_SETTINGS.toolSize,
      x: point.x,
      y: point.y,
      number: getNextStepNumber()
    });
    renderStage();
    return;
  }

  if (state.activeTool === 'text') {
    openTextEditor(point, event);
    return;
  }

  state.isDrawing = true;
  state.draftShape = createDraftShape(point);
  UI.stageCanvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!canDraw()) return;
  state.isPointerInside = true;

  if (state.isPanning) {
    state.viewOffsetX = state.panOriginX + (event.clientX - state.panStartClientX);
    state.viewOffsetY = state.panOriginY + (event.clientY - state.panStartClientY);
    renderStage();
    return;
  }

  if (!state.isDrawing || !state.draftShape) return;

  const point = getCanvasPoint(event);
  if (!point) return;

  if (state.draftShape.type === 'pen') {
    state.draftShape.points.push(point);
  } else {
    state.draftShape.endX = point.x;
    state.draftShape.endY = point.y;
  }

  renderStage();
}

function handlePointerUp(event) {
  if (state.isPanning) {
    state.isPanning = false;
    updateToolUi();
  }

  if (state.isDrawing && state.draftShape) {
    finalizeDraftShape();
  }

  state.isDrawing = false;
  if (event.pointerId != null && UI.stageCanvas.hasPointerCapture(event.pointerId)) {
    UI.stageCanvas.releasePointerCapture(event.pointerId);
  }
}

function canDraw() {
  return Boolean(state.displayStream && UI.stageCanvas.classList.contains('hidden') === false);
}

function getCanvasPoint(event) {
  const rect = UI.stageCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    x: ((event.clientX - rect.left) / rect.width) * UI.stageCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * UI.stageCanvas.height
  };
}

function createDraftShape(point) {
  const color = UI.toolColor.value;
  const size = Number(UI.toolSize.value) || DEFAULT_SETTINGS.toolSize;

  if (state.activeTool === 'pen') {
    return { type: 'pen', color, size, points: [point] };
  }

  return {
    type: state.activeTool,
    color,
    size,
    startX: point.x,
    startY: point.y,
    endX: point.x,
    endY: point.y
  };
}

function finalizeDraftShape() {
  if (!state.draftShape) return;

  const shape = state.draftShape;
  state.draftShape = null;

  if (shape.type === 'pen' && shape.points.length < 2) {
    renderStage();
    return;
  }

  if ((shape.type === 'arrow' || shape.type === 'rectangle' || shape.type === 'ellipse') && isTinyShape(shape)) {
    renderStage();
    return;
  }

  state.shapes.push(shape);
  renderStage();
}

function isTinyShape(shape) {
  return Math.abs(shape.endX - shape.startX) < 6 && Math.abs(shape.endY - shape.startY) < 6;
}

function undoLastShape() {
  hideTextEditor();
  if (!state.shapes.length) return;
  state.shapes.pop();
  renderStage();
}

function clearShapes() {
  hideTextEditor();
  state.shapes = [];
  state.draftShape = null;
  renderStage();
}

function openTextEditor(point, event) {
  const stageRect = UI.stageCanvas.getBoundingClientRect();
  const textLeft = Math.min(event.clientX - stageRect.left, stageRect.width - 260);
  const textTop = Math.min(event.clientY - stageRect.top, stageRect.height - 110);

  state.textDraftPoint = point;
  UI.textEditor.style.left = `${Math.max(10, textLeft)}px`;
  UI.textEditor.style.top = `${Math.max(10, textTop)}px`;
  UI.textEditor.value = '';
  UI.textEditor.classList.remove('hidden');
  UI.textEditor.focus();
}

function commitTextDraft() {
  if (UI.textEditor.classList.contains('hidden')) return;

  const text = UI.textEditor.value.trim();
  if (text && state.textDraftPoint) {
    state.shapes.push({
      type: 'text',
      color: UI.toolColor.value,
      size: Number(UI.toolSize.value) || DEFAULT_SETTINGS.toolSize,
      x: state.textDraftPoint.x,
      y: state.textDraftPoint.y,
      text
    });
  }

  hideTextEditor();
  renderStage();
}

function hideTextEditor() {
  UI.textEditor.classList.add('hidden');
  UI.textEditor.value = '';
  state.textDraftPoint = null;
}

function collapseToolbar() {
  state.isToolbarCollapsed = true;
  UI.toolbar.classList.add('hidden');
  UI.toolbarDock.classList.remove('hidden');
  UI.toolbarDock.style.left = UI.toolbar.style.left || '18px';
  UI.toolbarDock.style.top = UI.toolbar.style.top || '18px';
}

function expandToolbar() {
  state.isToolbarCollapsed = false;
  UI.toolbar.classList.remove('hidden');
  UI.toolbarDock.classList.add('hidden');
  applyToolbarPosition(parseFloat(UI.toolbar.style.left || '18'), parseFloat(UI.toolbar.style.top || '18'));
}

function normalizeRect(startX, startY, endX, endY) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function normalizeSpotlight(shape) {
  const rect = normalizeRect(shape.startX, shape.startY, shape.endX, shape.endY);
  const fallbackRadius = Math.max(48, shape.size * 10);

  if (rect.width < 10 && rect.height < 10) {
    return {
      cx: shape.startX,
      cy: shape.startY,
      rx: fallbackRadius,
      ry: fallbackRadius
    };
  }

  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: Math.max(20, rect.width / 2),
    ry: Math.max(20, rect.height / 2)
  };
}

function getNextStepNumber() {
  return state.shapes.filter((shape) => shape.type === 'step').length + 1;
}

function showLiveStage() {
  UI.preview.classList.add('hidden');
  UI.stageCanvas.classList.remove('hidden');
  UI.overlay.classList.add('hidden');
  if (!UI.toolbar.style.left) resetToolbarPosition();
  if (!state.isToolbarCollapsed) UI.toolbar.classList.remove('hidden');
}

function showPlayback() {
  UI.stageCanvas.classList.add('hidden');
  UI.preview.classList.remove('hidden');
  UI.overlay.classList.add('hidden');
  UI.toolbar.classList.add('hidden');
  UI.toolbarDock.classList.add('hidden');
}

function showOverlay(title, copy) {
  UI.overlay.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-title">${escapeHtml(title)}</div>
      <div class="overlay-copy">${escapeHtml(copy)}</div>
    </div>
  `;
  UI.overlay.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanupStreams() {
  cancelRenderLoop();

  [state.displayStream, state.micStream, state.recordingStream].forEach((stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  });

  if (state.audioContext) state.audioContext.close().catch(() => {});

  state.displayStream = null;
  state.micStream = null;
  state.recordingStream = null;
  state.audioContext = null;
  state.destinationNode = null;
  state.recorder = null;
  state.chunks = [];
  state.startedAt = 0;
  state.pausedAt = 0;
  state.pausedDuration = 0;
  state.isStopping = false;

  UI.sourceVideo.pause();
  UI.sourceVideo.srcObject = null;
  clearTimer();
  setPauseButtonsLabel(false);
}

function clearPreviewUrl() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = '';
  }

  UI.preview.removeAttribute('src');
  UI.preview.load();
}

function resetDrawingState() {
  state.shapes = [];
  state.draftShape = null;
  state.isDrawing = false;
  state.isPanning = false;
  state.viewOffsetX = 0;
  state.viewOffsetY = 0;
  hideTextEditor();
  renderStage();
}

function updateButtonsForBusyStart() {
  UI.start.disabled = true;
  UI.pause.disabled = true;
  UI.stop.disabled = true;
  UI.toolbarStart.disabled = true;
  UI.toolbarPause.disabled = true;
  UI.toolbarStop.disabled = true;
}

function updateButtonsForRecording() {
  UI.start.disabled = true;
  UI.pause.disabled = false;
  UI.stop.disabled = false;
  UI.toolbarStart.disabled = true;
  UI.toolbarPause.disabled = false;
  UI.toolbarStop.disabled = false;
}

function updateButtonsForIdle() {
  UI.start.disabled = false;
  UI.pause.disabled = true;
  UI.stop.disabled = true;
  UI.toolbarStart.disabled = false;
  UI.toolbarPause.disabled = true;
  UI.toolbarStop.disabled = true;
  UI.timer.textContent = '00:00:00';

  if (!state.lastBlob) {
    UI.stageCanvas.classList.add('hidden');
    UI.preview.classList.add('hidden');
    showOverlay('المسجل جاهز', 'ابدأ التسجيل ثم اختر الشاشة أو التبويب، وبعدها ستظهر أدوات الشرح فوق المعاينة.');
  }
}

function setPauseButtonsLabel(isPaused) {
  const label = isPaused ? 'استئناف' : 'إيقاف مؤقت';
  UI.pause.textContent = label;
  UI.toolbarPause.textContent = label;
}

function setStatus(message, mode) {
  UI.statusNote.textContent = message;
  UI.lastStatus.textContent = message;
  UI.statusPill.className = 'status-pill';

  if (mode === 'recording') {
    UI.statusPill.classList.add('recording');
    UI.statusPill.textContent = 'يسجل الآن';
    return;
  }

  if (mode === 'paused') {
    UI.statusPill.classList.add('paused');
    UI.statusPill.textContent = 'متوقف مؤقتًا';
    return;
  }

  if (mode === 'error') {
    UI.statusPill.classList.add('error');
    UI.statusPill.textContent = 'خطأ';
    return;
  }

  if (mode === 'busy') {
    UI.statusPill.textContent = 'جارٍ التحضير';
    return;
  }

  UI.statusPill.textContent = 'جاهز';
}
