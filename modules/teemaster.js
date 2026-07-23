// ══════════════════════════════════════════════════════
//  ████████  TEE MASTER PRO 5K MODULE  ████████
// ══════════════════════════════════════════════════════
import { studioRemoveBgWithAI, studioRemoveBgLocal, studioFloodFillRemove } from './image-utils.js';

const TM = {
    imageQueue: [],
    processedResults: [],
    isProcessing: false,
    zoom: 1,
    bgMode: 'black',
    currentTool: 'picker',
    pickedColor: null,
    magicTolerance: 30,
};

function $(id) { return document.getElementById(id); }

export function initTeeMasterModule(helpers) {
    const { showToast, studioUpdateCounts, studioRenderGrid, STUDIO } = helpers;

    const dropZone = $('tm-dropzone');
    const fileInput = $('tm-file-input');

    if (!dropZone) return;

    // ── Drag & Drop ──
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#10B981'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'rgba(139,92,246,0.2)'; });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); tmHandleFiles(e.dataTransfer.files, helpers); });
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => tmHandleFiles(e.target.files, helpers));

    // ── Toolbar ──
    const zoomInBtn = $('tm-zoom-in-btn');
    const zoomOutBtn = $('tm-zoom-out-btn');
    const zoomResetBtn = $('tm-zoom-reset-btn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => { TM.zoom = Math.min(TM.zoom + 0.25, 4); applyZoom(); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { TM.zoom = Math.max(TM.zoom - 0.25, 0.25); applyZoom(); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { TM.zoom = 1; applyZoom(); });

    const bgBlack = $('tm-bg-black-btn');
    const bgWhite = $('tm-bg-white-btn');
    const bgTrans = $('tm-bg-trans-btn');
    if (bgBlack) bgBlack.addEventListener('click', () => tmSetBg('black'));
    if (bgWhite) bgWhite.addEventListener('click', () => tmSetBg('white'));
    if (bgTrans) bgTrans.addEventListener('click', () => tmSetBg('trans'));

    // ── Main Processing ──
    const startBtn = $('tm-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (TM.isProcessing || TM.imageQueue.length === 0) return;
            TM.isProcessing = true;
            TM.processedResults = [];
            STUDIO.step2Results = [];

            startBtn.disabled = true;
            startBtn.innerHTML = '<div class="spinner-small"></div> جاري المعالجة...';

            const useAI = document.querySelector('input[name="tm-bg-detect"]:checked')?.value === 'ai';
            const geminiKey = $('tm-gemini-key')?.value || '';
            const total = TM.imageQueue.length;

            for (let i = 0; i < total; i++) {
                const item = TM.imageQueue[i];
                try {
                    let processed;
                    if (useAI && geminiKey) {
                        processed = await studioRemoveBgWithAI(item.dataURL, geminiKey);
                    } else if (TM.pickedColor) {
                        processed = await studioFloodFillRemove(item.dataURL, TM.pickedColor.r, TM.pickedColor.g, TM.pickedColor.b, TM.magicTolerance);
                    } else {
                        processed = await studioRemoveBgLocal(item.dataURL);
                    }

                    // Upscale 5K
                    processed = await tmUpscaleTo5K(processed);

                    TM.processedResults.push({ name: item.name, dataURL: processed });
                    STUDIO.step2Results.push({ name: item.name, dataURL: processed, status: '✅' });
                } catch (err) {
                    TM.processedResults.push({ name: item.name, dataURL: item.dataURL });
                    STUDIO.step2Results.push({ name: item.name, dataURL: item.dataURL, status: '⚠️' });
                }
            }

            TM.isProcessing = false;
            startBtn.innerHTML = '✅ اكتملت المعالجة!';
            startBtn.disabled = false;

            STUDIO.step3Files = STUDIO.step2Results.map(item => ({ ...item }));
            studioUpdateCounts();
            showToast('🎉 اكتملت معالجة الصور في TeeMaster Pro!');
        });
    }

    // Expose global for Studio navigation
    window.tmAddFilesFromStudio = function (filesArr) {
        TM.imageQueue = [...filesArr];
        STUDIO.step2Files = [...filesArr];
        tmRenderQueueGrid();
        showToast('🚀 تم جلب الصور من المرحلة الأولى بنجاح');
    };
}

async function tmHandleFiles(files, helpers) {
    const { showToast } = helpers;
    if (!files.length) return;

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        const dataURL = await new Promise(r => { reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
        TM.imageQueue.push({ name: file.name, dataURL });
    }
    tmRenderQueueGrid();
    showToast(`✅ تم إضافة ${files.length} صور`);
}

function tmRenderQueueGrid() {
    const grid = $('tm-queue-grid');
    if (!grid) return;
    grid.innerHTML = TM.imageQueue.map((item, i) => `
    <div class="tm-thumb-item" data-index="${i}">
       <img src="${item.dataURL}">
       <div class="tm-thumb-name">${item.name}</div>
    </div>
  `).join('');
}

function tmSetBg(mode) {
    TM.bgMode = mode;
    const preview = $('tm-preview-container');
    if (!preview) return;
    if (mode === 'black') preview.style.background = '#111';
    else if (mode === 'white') preview.style.background = '#fff';
    else preview.style.background = 'repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%) 0 0 / 16px 16px';
}

function applyZoom() {
    const canvas = $('tm-main-canvas');
    if (canvas) canvas.style.transform = `scale(${TM.zoom})`;
}

async function tmUpscaleTo5K(dataURL) {
    return new Promise(resolve => {
        const TARGET = 5000;
        const img = new Image();
        img.onload = () => {
            if (img.width >= TARGET && img.height >= TARGET) { resolve(dataURL); return; }
            const c = document.createElement('canvas');
            c.width = TARGET; c.height = TARGET;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, TARGET, TARGET);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            const scale = Math.min(TARGET / img.width, TARGET / img.height);
            const newW = Math.round(img.width * scale), newH = Math.round(img.height * scale);
            ctx.drawImage(img, Math.round((TARGET - newW) / 2), Math.round((TARGET - newH) / 2), newW, newH);
            resolve(c.toDataURL('image/png'));
        };
        img.src = dataURL;
    });
}
