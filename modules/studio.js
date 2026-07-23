// ══════════════════════════════════════════════════════
//  ████████  STUDIO PIPELINE MODULE  ████████
// ══════════════════════════════════════════════════════
import { studioRemoveAIMarks } from './image-utils.js';

export const STUDIO = {
    step: 1,
    totalSteps: 5,
    step1Files: [],
    step2Files: [],
    step2Results: [],
    step3Files: [],
    step4Files: [],

    // UI Selectors
    btnPrev: document.getElementById('studio-prev'),
    btnNext: document.getElementById('studio-next'),
    stepTitle: document.getElementById('studio-step-title'),
    stepDesc: document.getElementById('studio-step-desc'),
    progress: document.getElementById('studio-progress'),

    panels: [
        document.getElementById('studio-panel-1'), // Step 1: Library
        document.getElementById('studio-panel-2'), // Step 2: TeeMaster Pro
        document.getElementById('studio-panel-3'), // Step 3: Design Gen V2
        document.getElementById('studio-panel-4'), // Step 4: SEO Bulk
        document.getElementById('studio-panel-5')  // Step 5: Autopilot
    ],

    grid1: document.getElementById('studio-grid-1'),
    grid3: document.getElementById('studio-grid-3'),
    grid4: document.getElementById('studio-grid-4'),
    grid5: document.getElementById('studio-grid-5'),

    counts: {
        s1: document.getElementById('studio-count-1'),
        s2: document.getElementById('studio-count-2'),
        s3: document.getElementById('studio-count-3'),
        s4: document.getElementById('studio-count-4'),
        s5: document.getElementById('studio-count-5'),
    }
};

export function initStudioModule(helpers) {
    const { showToast, switchTab, renderQueue, saveQueueToStorage, loadAPAccounts } = helpers;
    if (!STUDIO.btnNext) return;

    STUDIO.btnNext.addEventListener('click', () => studioNextStep(helpers));
    STUDIO.btnPrev.addEventListener('click', () => studioPrevStep());

    // Init Step 1 (Library Import)
    const libCheckAll = document.getElementById('studio-lib-check-all');
    const libContainer = document.getElementById('studio-lib-container');
    const libImportBtn = document.getElementById('studio-lib-import-btn');

    if (libImportBtn) {
        libImportBtn.addEventListener('click', () => {
            chrome.storage.local.get(['savedDesignQueue'], (res) => {
                const queue = res.savedDesignQueue || [];
                if (queue.length === 0) return showToast('⚠️ لا يوجد تصاميم في طابور الـ SEO حالياً');

                STUDIO.step1Files = queue.map(item => ({
                    id: item.id,
                    name: item.file.name,
                    dataURL: 'data:image/png;base64,' + item.base64,
                    status: 'ready'
                }));

                studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, (idx) => {
                    STUDIO.step1Files.splice(idx, 1);
                    studioRenderGrid(STUDIO.grid1, STUDIO.step1Files);
                    studioUpdateCounts();
                });
                studioUpdateCounts();
                showToast(`✅ تم استيراد ${STUDIO.step1Files.length} تصميماً من الطابور!`);
            });
        });
    }

    studioGoToStep(1);

    const peelBtn = document.getElementById('studio-peel-process-btn');
    if (peelBtn) peelBtn.addEventListener('click', () => studioPeelBananaProcess(showToast));
    const peelDl = document.getElementById('studio-peel-download-btn');
    if (peelDl) peelDl.addEventListener('click', studioPeelDownloadAll);
}

async function studioPeelBananaProcess(showToast) {
    if (STUDIO.isProcessingPeel || !STUDIO.step1Files.length) return;
    STUDIO.isProcessingPeel = true;
    STUDIO.step1Results = [];
    const pb = document.getElementById('studio-peel-bar');
    const btn = document.getElementById('studio-peel-process-btn');
    if (btn) btn.disabled = true;

    const total = STUDIO.step1Files.length;
    for (let i = 0; i < total; i++) {
        const item = STUDIO.step1Files[i];
        try {
            const processed = await studioRemoveAIMarks(item.dataURL);
            STUDIO.step1Results.push({ name: item.name, dataURL: processed, status: '✅' });
            STUDIO.step1Files[i].status = '✅';
        } catch (e) {
            STUDIO.step1Results.push({ ...item, status: '⚠️' });
        }
        if (pb) pb.style.width = Math.round(((i + 1) / total) * 100) + '%';
    }
    STUDIO.isProcessingPeel = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '✅ اكتملت الإزالة'; }
    STUDIO.step2Files = [...STUDIO.step1Results];
    studioUpdateCounts();
    showToast(`✅ اكتملت إزالة العلامات من ${STUDIO.step1Results.length} صورة!`);
}

function studioPeelDownloadAll() {
    if (!STUDIO.step1Results.length) return;
    STUDIO.step1Results.forEach((item, i) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = item.dataURL;
            a.download = `peel_${item.name}`;
            a.click();
        }, i * 300);
    });
}

function studioGoToStep(s) {
    STUDIO.step = s;
    STUDIO.panels.forEach((p, i) => {
        if (p) p.style.display = (i + 1 === s) ? 'block' : 'none';
    });

    if (STUDIO.progress) {
        const pct = (s / STUDIO.totalSteps) * 100;
        STUDIO.progress.style.width = pct + '%';
    }

    STUDIO.btnPrev.style.display = (s === 1) ? 'none' : 'flex';
    STUDIO.btnNext.innerHTML = (s === STUDIO.totalSteps) ? '<i class="fa-solid fa-flag-checkered"></i> إنهاء وعودة' : 'المرحلة التالية <i class="fa-solid fa-arrow-left"></i>';

    const titles = [
        "1. اختيار التصاميم",
        "2. إزالة الخلفية والتحسين (5K)",
        "3. الذكاء الاصطناعي (Studio V2)",
        "4. توليد بيانات SEO الشاملة",
        "5. الرفع المؤتمت (Autopilot)"
    ];
    if (STUDIO.stepTitle) STUDIO.stepTitle.textContent = titles[s - 1];

    // Logic per step activation
    if (s === 2 && window.tmAddFilesFromStudio) {
        window.tmAddFilesFromStudio(STUDIO.step1Files);
    }
}

function studioNextStep(helpers) {
    if (STUDIO.step < STUDIO.totalSteps) {
        studioGoToStep(STUDIO.step + 1);
    } else {
        helpers.showToast('🎉 اكتملت رحلة Studio بنجاح!');
    }
}

function studioPrevStep() {
    if (STUDIO.step > 1) {
        studioGoToStep(STUDIO.step - 1);
    }
}

export function studioUpdateCounts() {
    if (STUDIO.counts.s1) STUDIO.counts.s1.textContent = STUDIO.step1Files.length;
    if (STUDIO.counts.s2) STUDIO.counts.s2.textContent = STUDIO.step2Files.length;
    if (STUDIO.counts.s3) STUDIO.counts.s3.textContent = STUDIO.step3Files.length;
    if (STUDIO.counts.s4) STUDIO.counts.s4.textContent = STUDIO.step4Files.length;
    if (STUDIO.counts.s5) STUDIO.counts.s5.textContent = STUDIO.step5Files.length;
}

export function studioRenderGrid(container, files, removeCallback) {
    if (!container) return;
    container.innerHTML = files.map((f, i) => `
    <div class="studio-item animate-scale-in" data-index="${i}">
      <img src="${f.dataURL || 'icon.png'}" onerror="this.src='icon.png'">
      <div class="studio-item-name">${f.name || 'Untitled'}</div>
      ${removeCallback ? `<button class="studio-item-remove" data-index="${i}">✕</button>` : ''}
      ${f.status === '✅' ? '<div class="studio-item-badge">✅</div>' : ''}
    </div>
  `).join('');

    if (removeCallback) {
        container.querySelectorAll('.studio-item-remove').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                removeCallback(parseInt(btn.dataset.index));
            };
        });
    }
}
