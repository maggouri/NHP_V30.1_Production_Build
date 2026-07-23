// ══════════════════════════════════════════════════════
//  ████████  STUDIO PIPELINE & TEEMASTER MODULE  ████████
// ══════════════════════════════════════════════════════

// Dependencies
let showToast;
let designQueue;
let switchTab;
let renderQueue;
let saveQueueToStorage;
let workspaceHandle;
let showDesignPreview;

const STUDIO = {
    step1Files: [], step1Results: [],
    step2Files: [], step2Results: [],
    step3Files: [],
    currentStep: 1,
    isProcessingPeel: false,
    isProcessingTeemaster: false,
    get grid1() { return document.getElementById('studio-grid-1'); },
    get grid2() { return document.getElementById('studio-grid-2'); },
    get fileList3() { return document.getElementById('studio-file-list-3'); },
    get peelProcessBtn() { return document.getElementById('studio-peel-process-btn'); },
    get peelDownloadBtn() { return document.getElementById('studio-peel-download-btn'); },
    get toStep2Btn() { return document.getElementById('studio-to-step2-btn'); },
    get teemasterProcessBtn() { return document.getElementById('studio-teemaster-process-btn'); },
    get teemasterDownloadBtn() { return document.getElementById('studio-teemaster-download-btn'); },
    get toStep3Btn() { return document.getElementById('studio-to-step3-btn'); },
    get toSeoBtn() { return document.getElementById('studio-to-seo-btn'); },
    get bulkNameInput() { return document.getElementById('studio-bulk-name'); },
    repo: {
        grid: document.getElementById('repo-items-grid'),
        count: document.getElementById('repo-count-status'),
        qty: document.getElementById('repo-transfer-qty'),
        items: []
    }
};

function studioProcessCapturedImage(data) {
    if (!data || !data.dataURL) return;
    const item = { name: data.name || `captured_${Date.now()}.png`, dataURL: data.dataURL, status: '' };

    STUDIO.step1Files.push(item);

    const removeFn1 = (idx) => {
        STUDIO.step1Files.splice(idx, 1);
        studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
        studioUpdateStep1UI(); studioUpdateCounts();
    };

    studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
    studioUpdateStep1UI();
    studioUpdateCounts();
    showToast(`✨ تم التقاط تصميم من Gemini بنجاح!`);
}

function studioActivateStep(step) {
    STUDIO.currentStep = step;
    for (let i = 1; i <= 3; i++) {
        const sec = document.getElementById(`studio-section-${i}`);
        if (sec) sec.classList.toggle('active', i === step);

        const icon = document.getElementById(`studio-icon-step${i}`);
        const label = document.getElementById(`studio-label-step${i}`);

        if (icon) {
            icon.classList.toggle('active', i === step);
            let isDone = (i === 1 && STUDIO.step1Results.length > 0) ||
                (i === 2 && STUDIO.step2Results.length > 0) ||
                (i === 3 && STUDIO.step3Files.length > 0);

            if (isDone) icon.classList.add('done');
            else icon.classList.remove('done');
        }
        if (label) label.classList.toggle('active', i === step);
    }

    const a1 = document.getElementById('studio-arrow-1');
    const a2 = document.getElementById('studio-arrow-2');
    if (a1) a1.classList.toggle('done-arrow', STUDIO.step1Results.length > 0);
    if (a2) a2.classList.toggle('done-arrow', STUDIO.step2Results.length > 0);
}

function studioGoToStep(step) {
    studioActivateStep(step);
    let currentFiles = (step === 1) ? STUDIO.step1Files : (step === 2) ? STUDIO.step2Files : STUDIO.step3Files;
    if (currentFiles.length === 0) {
        const input = document.getElementById(`studio-file-input-${step}`);
        if (input) input.click();
    }
};


function studioReadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function studioDataURLtoBlob(dataURL) {
    const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

function studioRenderGrid(gridEl, filesArr, onRemoveFn) {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    filesArr.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'studio-img-card';
        const img = document.createElement('img');
        img.src = item.dataURL || item.url || '';
        img.alt = item.name;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'img-remove';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => { e.stopPropagation(); onRemoveFn(idx); };
        const statusEl = document.createElement('div');
        statusEl.className = 'img-status';
        statusEl.textContent = item.status || '';
        statusEl.style.display = item.status ? 'block' : 'none';
        card.appendChild(img); card.appendChild(removeBtn); card.appendChild(statusEl);
        gridEl.appendChild(card);
    });
}

function studioRenderFileList3() {
    const listEl = STUDIO.fileList3;
    if (!listEl) return;
    listEl.innerHTML = '';
    if (STUDIO.step3Files.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">لا توجد صور بعد</div>';
        return;
    }
    STUDIO.step3Files.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = `studio-file-item ${item.selected ? 'selected' : ''}`;
        row.style.cursor = 'default';

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'studio-item-check-3';
        check.checked = !!item.selected;
        check.style.cssText = 'width:14px; height:14px; accent-color:var(--primary); cursor:pointer; flex-shrink:0;';
        check.onchange = () => {
            item.selected = check.checked;
            row.classList.toggle('selected', item.selected);
            studioUpdateStep3SelectionUI();
        };

        const thumb = document.createElement('img');
        thumb.className = 'studio-file-thumb';
        thumb.src = item.dataURL;
        thumb.alt = item.name;
        thumb.style.cursor = 'pointer';
        thumb.onclick = () => { check.checked = !check.checked; check.onchange(); };

        const nameInput = document.createElement('input');
        nameInput.className = 'studio-file-name-edit';
        nameInput.type = 'text';
        nameInput.value = (item.customName || item.name.replace(/\.[^.]+$/, ''));
        nameInput.placeholder = 'اسم الملف...';
        nameInput.onchange = () => { STUDIO.step3Files[idx].customName = nameInput.value.trim() || item.name; };
        const extSpan = document.createElement('span');
        extSpan.style.cssText = 'color:var(--text-muted);font-size:10px;flex-shrink:0;';
        extSpan.textContent = '.png';

        row.appendChild(check);
        row.appendChild(thumb);
        row.appendChild(nameInput);
        row.appendChild(extSpan);
        listEl.appendChild(row);
    });
    studioUpdateCounts();
    studioUpdateStep3SelectionUI();
}

function studioUpdateStep3SelectionUI() {
    const selectedCount = STUDIO.step3Files.filter(f => f.selected).length;
    const dlSelectedBtn = document.getElementById('studio-download-selected-btn');
    const saveRepoBtn = document.getElementById('studio-save-repo-btn');
    const selectAll = document.getElementById('studio-select-all-3');

    if (dlSelectedBtn) {
        dlSelectedBtn.disabled = selectedCount === 0;
        dlSelectedBtn.innerHTML = `<i class="fa-solid fa-square-check"></i> تحميل المختار (${selectedCount})`;
    }
    if (saveRepoBtn) {
        saveRepoBtn.innerHTML = `<i class="fa-solid fa-server"></i> حفظ ${selectedCount > 0 ? 'المحدد' : 'الكل'} في المستودع`;
    }
    if (selectAll) {
        selectAll.checked = selectedCount === STUDIO.step3Files.length && selectedCount > 0;
    }
}

function studioUpdateCounts() {
    const counts = [
        ['studio-step1-count', STUDIO.step1Files.length],
        ['studio-step2-count', STUDIO.step2Files.length],
        ['studio-step3-count', STUDIO.step3Files.length],
        ['studio-step2-badge', STUDIO.step2Files.length || STUDIO.step1Results.length],
        ['studio-step3-badge', STUDIO.step3Files.length || STUDIO.step2Results.length],
        ['studio-seo-badge', STUDIO.step3Files.length],
    ];
    counts.forEach(([id, n]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${n} صور`;
        if (id === 'studio-seo-badge') {
            const has = (n > 0);
            ['studio-to-seo-btn', 'studio-to-aut-btn', 'studio-to-both-btn', 'studio-save-repo-btn'].forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.disabled = !has;
            });
        }
    });
}

async function studioHandleFiles1(files) {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) { showToast('⚠️ لا توجد صور صحيحة'); return; }
    for (const file of valid) {
        const dataURL = await studioReadFileAsDataURL(file);
        STUDIO.step1Files.push({ file, name: file.name, dataURL, status: '' });
    }
    const removeFn = (idx) => {
        STUDIO.step1Files.splice(idx, 1);
        studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn);
        studioUpdateStep1UI(); studioUpdateCounts();
    };
    studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn);
    studioUpdateStep1UI(); studioUpdateCounts();
    showToast(`✅ تمت إضافة ${valid.length} صورة للمرحلة 1`);
}

function studioUpdateStep1UI() {
    const has = STUDIO.step1Files.length > 0;
    const hasRes = STUDIO.step1Results.length > 0;
    if (STUDIO.peelProcessBtn) STUDIO.peelProcessBtn.disabled = !has || STUDIO.isProcessingPeel;
    if (STUDIO.peelDownloadBtn) STUDIO.peelDownloadBtn.style.display = hasRes ? 'flex' : 'none';
    if (STUDIO.toStep2Btn) { STUDIO.toStep2Btn.disabled = !(has || hasRes); const b = document.getElementById('studio-step2-badge'); if (b) b.textContent = `${hasRes ? STUDIO.step1Results.length : STUDIO.step1Files.length} صور`; }
}

async function studioPeelBananaProcess() {
    // ... (implementation is in popup.js, will be moved here)
}

// All other studio functions will be moved here...

export function initStudioPipelineModule(helpers) {
    showToast = helpers.showToast;
    designQueue = helpers.designQueue;
    switchTab = helpers.switchTab;
    renderQueue = helpers.renderQueue;
    saveQueueToStorage = helpers.saveQueueToStorage;
    workspaceHandle = helpers.workspaceHandle;
    showDesignPreview = helpers.showDesignPreview;

    // Event listeners that were in DOMContentLoaded
    [1, 2, 3].forEach(step => {
        const navNode = document.getElementById(`studio-nav-step${step}`);
        if (navNode) {
            navNode.addEventListener('click', (e) => {
                e.preventDefault();
                studioGoToStep(step);
            });
        }
    });

    // ... other listeners will be moved here
}
