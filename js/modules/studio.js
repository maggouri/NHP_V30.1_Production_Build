// ══════════════════════════════════════════════════════
//  ████████  STUDIO PIPELINE MODULE  ████████
// ══════════════════════════════════════════════════════

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

/**
 * عالج الصور الملتقطة من Gemini (أو أي نافذة خارجية) وأضفها لخط الإنتاج
 */
function studioProcessCapturedImage(data) {
  if (!data || !data.dataURL) return;
  const item = { name: data.name || `captured_${Date.now()}.png`, dataURL: data.dataURL, status: '' };

  // تجنب التكرار بناءً على الاسم أو المحتوى إذا أمكن، لكن هنا سنعتمد على الاسم والوقت
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

// استلام الصور المباشرة من الخلفية
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'studio_add_image') {
    studioProcessCapturedImage(msg.data);
  }
});

// فحص الصور المخزنة مؤقتاً عند فتح الـ popup
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['studio_buffered_images'], (res) => {
    if (res.studio_buffered_images && res.studio_buffered_images.length > 0) {
      res.studio_buffered_images.forEach(img => studioProcessCapturedImage(img));
      chrome.storage.local.remove('studio_buffered_images');
    }
  });
});

window.studioGoToStep = function (step) {
  studioActivateStep(step);
  // Only trigger upload dialog if the current step has no files, enabling flexible navigation
  let currentFiles = (step === 1) ? STUDIO.step1Files : (step === 2) ? STUDIO.step2Files : STUDIO.step3Files;
  if (currentFiles.length === 0) {
    const input = document.getElementById(`studio-file-input-${step}`);
    if (input) input.click();
  }
};

function studioActivateStep(step) {
  STUDIO.currentStep = step;
  for (let i = 1; i <= 3; i++) {
    const sec = document.getElementById(`studio-section-${i}`);
    if (sec) sec.classList.toggle('active', i === step);

    const icon = document.getElementById(`studio-icon-step${i}`);
    const label = document.getElementById(`studio-label-step${i}`);

    if (icon) {
      icon.classList.toggle('active', i === step);
      // Logic for 'done' status: if step i has results or it's a previous step with data
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
    // New enabled logic for additional destination buttons
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
  if (STUDIO.isProcessingPeel || !STUDIO.step1Files.length) return;
  STUDIO.isProcessingPeel = true;
  STUDIO.step1Results = [];
  const pw = document.getElementById('studio-peel-progress'), pb = document.getElementById('studio-peel-bar'), pp = document.getElementById('studio-peel-pct');
  if (pw) pw.style.display = 'block';
  STUDIO.peelProcessBtn.disabled = true;
  STUDIO.peelProcessBtn.innerHTML = '<div class="spinner-small"></div> جاري الإزالة...';
  const total = STUDIO.step1Files.length;
  for (let i = 0; i < total; i++) {
    const item = STUDIO.step1Files[i];
    const cards = STUDIO.grid1 ? STUDIO.grid1.querySelectorAll('.studio-img-card') : [];
    if (cards[i]) { cards[i].classList.add('processing'); const s = cards[i].querySelector('.img-status'); if (s) { s.textContent = '⏳ جاري...'; s.style.display = 'block'; } }
    try {
      const processed = await studioRemoveAIMarks(item.dataURL);
      STUDIO.step1Results.push({ name: item.name, dataURL: processed, status: '✅' });
      STUDIO.step1Files[i].status = '✅';
      if (cards[i]) { cards[i].classList.remove('processing'); cards[i].classList.add('success'); const s = cards[i].querySelector('.img-status'); if (s) s.textContent = '✅'; const img = cards[i].querySelector('img'); if (img) img.src = processed; }
    } catch (e) {
      STUDIO.step1Results.push({ ...item, status: '⚠️' });
      if (cards[i]) { cards[i].classList.remove('processing'); const s = cards[i].querySelector('.img-status'); if (s) s.textContent = '⚠️ خطأ'; }
    }
    const pct = Math.round(((i + 1) / total) * 100);
    if (pb) pb.style.width = pct + '%'; if (pp) pp.textContent = pct + '%';
    await new Promise(r => setTimeout(r, 80));
  }
  STUDIO.isProcessingPeel = false;
  STUDIO.peelProcessBtn.innerHTML = '<i class="fa-solid fa-check"></i> اكتملت الإزالة';
  if (STUDIO.peelDownloadBtn) STUDIO.peelDownloadBtn.style.display = 'flex';
  if (STUDIO.toStep2Btn) STUDIO.toStep2Btn.disabled = false;
  STUDIO.step2Files = [...STUDIO.step1Results];

  // -- AUTO MOVE TO REPOSITORY (User requested after Peel Banana) --
  if (workspaceHandle) {
    showToast('⏳ جاري إضافة النتائج للمستودع المحلي...');
    for (const item of STUDIO.step1Results) {
      if (item.status === '✅') await studioSaveToRepo(item);
    }
    studioRefreshRepository();
  } else {
    showToast('💡 ملاحظة: فعل المجلد المحلي في Admin لحفظ النتائج تلقائياً');
  }

  studioUpdateCounts();
  showToast(`✅ اكتملت إزالة العلامات من ${STUDIO.step1Results.length} صورة!`);
}

async function studioSaveToRepo(item) {
  if (!workspaceHandle) return;
  try {
    const fileName = `peel_${item.name}`;
    const fileHandle = await workspaceHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    // base64 to blob
    const bstr = atob(item.dataURL.split(',')[1]);
    let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    const blob = new Blob([u8arr], { type: 'image/png' });

    await writable.write(blob);
    await writable.close();
  } catch (e) { console.error('Repo Save Error:', e); }
}

async function studioCommitToRepo() {
  if (!workspaceHandle) return showToast('⚠️ يرجى تفعيل المجلد المحلي في Admin أولاً');

  const selectedItems = STUDIO.step3Files.filter(f => f.selected);
  const itemsToSave = selectedItems.length > 0 ? selectedItems : STUDIO.step3Files;

  if (itemsToSave.length === 0) return showToast('⚠️ لا توجد صور للحفظ');

  // Check permissions first
  try {
    const permission = await workspaceHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const request = await workspaceHandle.requestPermission({ mode: 'readwrite' });
      if (request !== 'granted') return showToast('⚠️ يرجى الموافقة على صلاحيات الوصول للمجلد أولاً');
    }
  } catch (e) {
    console.error('Permission Re-check Error:', e);
    return showToast('⚠️ فشل التحقق من صلاحيات المجلد. يرجى إعادة تفعيله من قسم Admin');
  }

  showToast(`⏳ جاري حفظ ${itemsToSave.length} صورة في المستودع المحلي...`);
  let savedCount = 0;
  let errors = [];

  for (const item of itemsToSave) {
    const finalName = `${item.customName || item.name.replace(/\.[^.]+$/, '')}.png`;
    try {
      const fileHandle = await workspaceHandle.getFileHandle(finalName, { create: true });
      const writable = await fileHandle.createWritable();

      const bstr = atob(item.dataURL.split(',')[1]);
      let n = bstr.length; const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: 'image/png' });

      await writable.write(blob);
      await writable.close();
      savedCount++;
    } catch (e) {
      console.error('Commit to Repo Error:', e);
      errors.push(finalName);
    }
  }

  if (savedCount > 0) {
    showToast(`✅ تم حفظ ${savedCount} صورة في المستودع بنجاح`);
    if (errors.length > 0) setTimeout(() => showToast(`⚠️ فشل حفظ ${errors.length} صور`), 2000);
  } else {
    showToast('❌ لم يتم حفظ أي صور. تأكد من صلاحيات المجلد في Admin');
  }

  studioRefreshRepository();
}

async function studioRefreshRepository() {
  if (!workspaceHandle || !STUDIO.repo.grid) return;
  try {
    const files = [];
    for await (const entry of workspaceHandle.values()) {
      if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) {
        files.push(entry);
      }
    }
    STUDIO.repo.items = files;
    STUDIO.repo.count.textContent = `Available Designs: ${files.length}`;

    if (files.length === 0) {
      STUDIO.repo.grid.innerHTML = '<div class="empty-msg" style="width:100%; text-align:center; padding:10px; font-size:10px;">لا توجد تصاميم جاهزة حالياً في المستودع المحلى</div>';
      return;
    }

    STUDIO.repo.grid.innerHTML = '';
    // Show last 20 for performance in the scroll area
    for (const fileHandle of files.slice(-20).reverse()) {
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      const div = document.createElement('div');
      div.className = 'repo-item';
      div.title = fileHandle.name;
      div.innerHTML = `
        <input type="checkbox" class="repo-item-check" data-name="${fileHandle.name}">
        <img src="${url}" loading="lazy">
      `;
      // Revoke to save memory
      div.querySelector('img').onload = () => URL.revokeObjectURL(url);

      div.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = div.querySelector('.repo-item-check');
        cb.checked = !cb.checked;
      });

      STUDIO.repo.grid.appendChild(div);
    }
  } catch (e) { console.error('Repo Refresh Error:', e); }
}

async function studioDeleteSelectedFromRepo() {
  if (!workspaceHandle) return;
  const selected = STUDIO.repo.grid.querySelectorAll('.repo-item-check:checked');
  if (selected.length === 0) return showToast('⚠️ يرجى تحديد الصور أولاً');

  if (!confirm(`هل أنت متأكد من حذف ${selected.length} صورة نهائياً من المستودع؟`)) return;

  showToast('⏳ جاري الحذف من المستودع...');
  let deletedCount = 0;
  for (const cb of selected) {
    const fileName = cb.getAttribute('data-name');
    try {
      await workspaceHandle.removeEntry(fileName);
      deletedCount++;
    } catch (e) { console.error('Delete Error:', e); }
  }
  showToast(`🗑️ تم حذف ${deletedCount} صورة بنجاح`);
  studioRefreshRepository();
  const selectAll = document.getElementById('repo-select-all');
  if (selectAll) selectAll.checked = false;
}

async function studioTransferFromRepo(dest) {
  if (!workspaceHandle || STUDIO.repo.items.length === 0) return showToast('⚠️ المستودع فارغ');

  const selectedCbs = STUDIO.repo.grid.querySelectorAll('.repo-item-check:checked');
  let toProcess = [];

  if (selectedCbs.length > 0) {
    // Collect specific selected items
    for (const cb of selectedCbs) {
      const name = cb.getAttribute('data-name');
      const handle = STUDIO.repo.items.find(h => h.name === name);
      if (handle) toProcess.push(handle);
    }
  } else {
    // Fallback to quantity
    const qtyInput = STUDIO.repo.qty;
    const qty = parseInt(qtyInput.value) || 5;
    toProcess = STUDIO.repo.items.slice(-qty).reverse(); // Latest ones
  }

  if (toProcess.length === 0) return showToast('⚠️ لم يتم تحديد صور للارسال');

  showToast(`🚀 جاري سحب ${toProcess.length} تصميم من المستودع...`);

  // Clear existing queue to push fresh batch from Repo
  window.designQueue.length = 0;

  for (const fileHandle of toProcess) {
    const file = await fileHandle.getFile();
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    window.designQueue.push({
      id: 'repo_' + Date.now() + Math.random(),
      name: fileHandle.name,
      base64: base64,
      status: 'pending',
      meta: null
    });
  }

  window.saveQueueToStorage();

  if (dest === 'seo') {
    switchTab('seo');
    showToast('✨ تم الانتقال لـ SEO AI للمراجعة');
  } else {
    switchTab('autopilot');
    showToast('🚀 تم النقل لـ AUT لبدء الرفع');
  }

  if (typeof window.renderDesignQueue === 'function') {
    window.renderDesignQueue();
    if (window.designQueue && window.designQueue.length > 0) window.showDesignPreview(0);
  }

  studioRefreshRepository();
}

const StudioWatermarkEngine = {
  alphaMaps: new Map(),
  bgImages: new Map(),
  configs: {
    small: { size: 48, margin: 32, asset: 'Peel Banana/assets/bg_48.png' },
    large: { size: 96, margin: 64, asset: 'Peel Banana/assets/bg_96.png' }
  },
  async init() {
    if (this.bgImages.size > 0) return;
    const loadImage = (path) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        res(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = rej;
      img.src = chrome.runtime.getURL(path);
    });
    try {
      this.bgImages.set(48, await loadImage(this.configs.small.asset));
      this.bgImages.set(96, await loadImage(this.configs.large.asset));
    } catch (e) { console.error("Watermark assets failed:", e); }
  },
  getAlphaMap(size) {
    if (!this.alphaMaps.has(size)) {
      const data = this.bgImages.get(size);
      if (!data) return null;
      const alpha = new Float32Array(size * size);
      for (let i = 0; i < alpha.length; i++) alpha[i] = Math.max(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2]) / 255;
      this.alphaMaps.set(size, alpha);
    }
    return this.alphaMaps.get(size);
  }
};

async function studioRemoveAIMarks(dataURL) {
  await StudioWatermarkEngine.init();
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const config = (img.width > 1024 && img.height > 1024) ? StudioWatermarkEngine.configs.large : StudioWatermarkEngine.configs.small;
      const alphaMap = StudioWatermarkEngine.getAlphaMap(config.size);
      if (alphaMap) {
        const x = img.width - config.size - config.margin, y = img.height - config.size - config.margin;
        if (x >= 0 && y >= 0) {
          const d = id.data;
          for (let r = 0; r < config.size; r++) {
            for (let col = 0; col < config.size; col++) {
              const i = ((y + r) * img.width + (x + col)) * 4;
              let a = Math.min(alphaMap[r * config.size + col], 0.99);
              if (a < 0.002) continue;
              for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, Math.round((d[i + j] - a * 255) / (1 - a))));
            }
          }
          ctx.putImageData(id, 0, 0);
        }
      }
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}


function studioPeelDownloadAll() {
  if (!STUDIO.step1Results.length) { showToast('⚠️ لا توجد صور'); return; }
  STUDIO.step1Results.forEach((item, i) => setTimeout(() => { const a = document.createElement('a'); a.href = item.dataURL; a.download = `peel_${item.name}`; a.click(); }, i * 300));
  STUDIO.step1Results.forEach((item, i) => setTimeout(() => {
    const blob = studioDataURLtoBlob(item.dataURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peel_${item.name}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, i * 300));
  showToast(`📥 جاري تحميل ${STUDIO.step1Results.length} صورة...`);
}

async function studioHandleFiles2(files) {
  const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!valid.length) return;
  for (const file of valid) {
    const dataURL = await studioReadFileAsDataURL(file);
    const item = { file, name: file.name, dataURL, status: '' };
    STUDIO.step2Files.push(item);
    // Sync to Stage 1 (Library)
    STUDIO.step1Files.push({ ...item });
  }
  // Update Grids
  const removeFn2 = (idx) => { STUDIO.step2Files.splice(idx, 1); studioRenderGrid(STUDIO.grid2, STUDIO.step2Files, removeFn2); studioUpdateStep2UI(); studioUpdateCounts(); };
  studioRenderGrid(STUDIO.grid2, STUDIO.step2Files, removeFn2);

  const removeFn1 = (idx) => { STUDIO.step1Files.splice(idx, 1); studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1); studioUpdateStep1UI(); studioUpdateCounts(); };
  studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);

  studioUpdateStep1UI(); studioUpdateStep2UI(); studioUpdateCounts();
  showToast(`✅ تمت إضافة ${valid.length} صور (تمت مزامنتها مع المكتبة)`);
}

function studioUpdateStep2UI() {
  const has = STUDIO.step2Files.length > 0; const hasRes = STUDIO.step2Results.length > 0;
  if (STUDIO.teemasterProcessBtn) STUDIO.teemasterProcessBtn.disabled = !has || STUDIO.isProcessingTeemaster;
  if (STUDIO.teemasterDownloadBtn) STUDIO.teemasterDownloadBtn.style.display = hasRes ? 'flex' : 'none';
  if (STUDIO.toStep3Btn) { STUDIO.toStep3Btn.disabled = !(has || hasRes); const b = document.getElementById('studio-step3-badge'); if (b) b.textContent = `${hasRes ? STUDIO.step2Results.length : STUDIO.step2Files.length} صور`; }
}

async function studioTeemasterProcess() {
  if (STUDIO.isProcessingTeemaster || !STUDIO.step2Files.length) return;
  STUDIO.isProcessingTeemaster = true; STUDIO.step2Results = [];
  const pw = document.getElementById('studio-teemaster-progress-wrap'), pb = document.getElementById('studio-teemaster-bar'), pp = document.getElementById('studio-teemaster-pct');
  if (pw) pw.style.display = 'block';
  STUDIO.teemasterProcessBtn.disabled = true;
  STUDIO.teemasterProcessBtn.innerHTML = '<div class="spinner-small"></div> جاري إزالة الخلفية...';
  const geminiKey = document.getElementById('central-gemini-key')?.value || '';
  const useAI = document.querySelector('input[name="studio-bg-detect"]:checked')?.value === 'ai';
  const total = STUDIO.step2Files.length;
  for (let i = 0; i < total; i++) {
    const item = STUDIO.step2Files[i];
    const cards = STUDIO.grid2 ? STUDIO.grid2.querySelectorAll('.studio-img-card') : [];
    if (cards[i]) { cards[i].classList.add('processing'); const s = cards[i].querySelector('.img-status'); if (s) { s.textContent = '⏳ جاري...'; s.style.display = 'block'; } }
    try {
      const processed = useAI && geminiKey ? await studioRemoveBgWithAI(item.dataURL, geminiKey) : await studioRemoveBgLocal(item.dataURL);
      STUDIO.step2Results.push({ name: item.name, dataURL: processed, status: '✅' });
      if (cards[i]) { cards[i].classList.remove('processing'); cards[i].classList.add('success'); const s = cards[i].querySelector('.img-status'); if (s) s.textContent = '✅'; const img = cards[i].querySelector('img'); if (img) img.src = processed; }
    } catch (e) {
      STUDIO.step2Results.push({ ...item, status: '⚠️' });
      if (cards[i]) { cards[i].classList.remove('processing'); const s = cards[i].querySelector('.img-status'); if (s) s.textContent = '⚠️ خطأ'; }
    }
    const pct = Math.round(((i + 1) / total) * 100);
    if (pb) pb.style.width = pct + '%'; if (pp) pp.textContent = pct + '%';
    await new Promise(r => setTimeout(r, 120));
  }
  STUDIO.isProcessingTeemaster = false;
  STUDIO.teemasterProcessBtn.innerHTML = '<i class="fa-solid fa-check"></i> اكتملت الإزالة';
  if (STUDIO.teemasterDownloadBtn) STUDIO.teemasterDownloadBtn.style.display = 'flex';
  if (STUDIO.toStep3Btn) STUDIO.toStep3Btn.disabled = false;
  STUDIO.step3Files = STUDIO.step2Results.map(item => ({ ...item, customName: null }));
  studioUpdateCounts();
  showToast(`✅ اكتملت إزالة الخلفية من ${STUDIO.step2Results.length} صورة!`);
}

async function studioRemoveBgWithAI(dataURL, apiKey) {
  const base64 = dataURL.split(',')[1];
  const mimeType = dataURL.split(';')[0].split(':')[1] || 'image/png';
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Return ONLY JSON: {"bg_color":"#RRGGBB","tolerance":30}. Identify the dominant background color of this image.' }, { inlineData: { mimeType: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 100 } })
    });
    if (!response.ok) throw new Error('API error');
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const match = text.match(/\{[^}]+\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    const bg = parsed.bg_color || '#FFFFFF';
    const tol = parsed.tolerance || 30;
    const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
    return studioFloodFillRemove(dataURL, r, g, b, tol);
  } catch (e) { return studioRemoveBgLocal(dataURL); }
}

async function studioRemoveBgLocal(dataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, c.width, c.height); const data = id.data;
      const corners = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
      let br = 0, bg = 0, bb = 0;
      corners.forEach(([x, y]) => { const i = (y * img.width + x) * 4; br += data[i]; bg += data[i + 1]; bb += data[i + 2]; });
      br = Math.round(br / 4); bg = Math.round(bg / 4); bb = Math.round(bb / 4);
      const visited = new Uint8Array(img.width * img.height);
      function fill(sx, sy) {
        const stack = [[sx, sy]];
        while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue; const idx = y * img.width + x; if (visited[idx]) continue; const pi = idx * 4; if (data[pi + 3] === 0) { visited[idx] = 1; continue; } const dr = data[pi] - br, dg = data[pi + 1] - bg, db = data[pi + 2] - bb; if (Math.sqrt(dr * dr + dg * dg + db * db) > 35) continue; visited[idx] = 1; data[pi + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      }
      corners.forEach(([x, y]) => fill(x, y));
      ctx.putImageData(id, 0, 0); resolve(c.toDataURL('image/png'));
    }; img.src = dataURL;
  });
}

function studioFloodFillRemove(dataURL, tr, tg, tb, tolerance) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, c.width, c.height); const data = id.data;
      const visited = new Uint8Array(img.width * img.height);
      function fill(sx, sy) {
        const stack = [[sx, sy]];
        while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue; const idx = y * img.width + x; if (visited[idx]) continue; const pi = idx * 4; if (data[pi + 3] === 0) { visited[idx] = 1; continue; } const dr = data[pi] - tr, dg = data[pi + 1] - tg, db = data[pi + 2] - tb; if (Math.sqrt(dr * dr + dg * dg + db * db) > tolerance) continue; visited[idx] = 1; data[pi + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      }
      [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]].forEach(([x, y]) => fill(x, y));
      ctx.putImageData(id, 0, 0); resolve(c.toDataURL('image/png'));
    }; img.src = dataURL;
  });
}

function studioTeemasterDownloadAll() {
  if (!STUDIO.step2Results.length) { showToast('⚠️ لا توجد صور'); return; }
  STUDIO.step2Results.forEach((item, i) => setTimeout(() => { const a = document.createElement('a'); a.href = item.dataURL; a.download = `nobg_${item.name}`; a.click(); }, i * 300));
  STUDIO.step2Results.forEach((item, i) => setTimeout(() => {
    const blob = studioDataURLtoBlob(item.dataURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nobg_${item.name}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, i * 300));
  showToast(`📥 جاري تحميل ${STUDIO.step2Results.length} صورة...`);
}

function studioApplyBulkName() {
  const base = STUDIO.bulkNameInput?.value?.trim();
  if (!base) { showToast('⚠️ أدخل اسماً أولاً'); return; }
  if (!STUDIO.step3Files.length) { showToast('⚠️ لا توجد صور'); return; }
  STUDIO.step3Files.forEach((item, idx) => { item.customName = base; });
  studioRenderFileList3();
  if (STUDIO.toSeoBtn) STUDIO.toSeoBtn.disabled = false;
  showToast(`✅ تم تطبيق الاسم على ${STUDIO.step3Files.length} صورة!`);
}

function studioDownloadFinal() {
  if (!STUDIO.step3Files.length) { showToast('⚠️ لا توجد صور'); return; }
  STUDIO.step3Files.forEach((item, i) => setTimeout(() => { const a = document.createElement('a'); a.href = item.dataURL; a.download = `${item.customName || item.name.replace(/\.[^.]+$/, '')}.png`; a.click(); }, i * 300));
  STUDIO.step3Files.forEach((item, i) => setTimeout(() => {
    const blob = studioDataURLtoBlob(item.dataURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.customName || item.name.replace(/\.[^.]+$/, '')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, i * 300));
  showToast(`📥 جاري تحميل ${STUDIO.step3Files.length} صورة...`);
}

function studioSendToSEO() { studioSendToDestination('seo'); }
function studioSendToAUT() { studioSendToDestination('aut'); }
function studioSendToBoth() { studioSendToDestination('both'); }

function studioSendToDestination(dest) {
  const selectedItems = STUDIO.step3Files.filter(f => f.selected);
  const itemsToSend = selectedItems.length > 0 ? selectedItems : STUDIO.step3Files;

  if (itemsToSend.length === 0) { showToast('⚠️ لا توجد صور في الطابور'); return; }
  if (typeof window.designQueue === 'undefined') { showToast('❌ المحرك غير متاح حالياً'); return; }

  // Clear existing queue to push fresh results from Studio
  window.designQueue.length = 0;

  itemsToSend.forEach(item => {
    const finalName = `${item.customName || item.name.replace(/\.[^.]+$/, '')}.png`;
    const itemId = "st_" + Math.random().toString(36).substr(2, 9);

    window.designQueue.push({
      id: itemId,
      name: finalName,
      base64: item.dataURL.split(',')[1],
      meta: null,
      status: 'pending'
    });
  });

  window.saveQueueToStorage();

  if (dest === 'seo') switchTab('seo');
  else if (dest === 'aut') switchTab('autopilot');
  else if (dest === 'both') {
    showToast('🚀 تم إرسال الصور للتبويبين! سننتقل لـ SEO AI للمراجعة.');
    switchTab('seo');
  }

  setTimeout(() => {
    if (typeof window.renderDesignQueue === 'function') {
      window.renderDesignQueue();
      if (window.designQueue && window.designQueue.length > 0) window.showDesignPreview(0);
    }
    showToast(`🚀 تم إرسال ${itemsToSend.length} صورة بنجاح!`);
  }, 400);
}

function studioDownloadSelected() {
  const selected = STUDIO.step3Files.filter(f => f.selected);
  if (!selected.length) { showToast('⚠️ يرجى تحديد الصور أولاً'); return; }
  selected.forEach((item, i) => setTimeout(() => {
    const blob = studioDataURLtoBlob(item.dataURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = item.dataURL;
    a.href = url;
    a.download = `${item.customName || item.name.replace(/\.[^.]+$/, '')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, i * 300));
  showToast(`📥 جاري تحميل ${selected.length} صورة مختارة...`);
}

function studioResetPipeline() {
  if (!confirm('إعادة تعيين كل مراحل Studio؟')) return;
  Object.assign(STUDIO, { step1Files: [], step1Results: [], step2Files: [], step2Results: [], step3Files: [], isProcessingPeel: false, isProcessingTeemaster: false });
  if (STUDIO.grid1) STUDIO.grid1.innerHTML = ''; if (STUDIO.grid2) STUDIO.grid2.innerHTML = '';
  if (STUDIO.fileList3) STUDIO.fileList3.innerHTML = '';
  ['studio-peel-progress', 'studio-teemaster-progress-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  if (STUDIO.peelProcessBtn) { STUDIO.peelProcessBtn.disabled = true; STUDIO.peelProcessBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> بدء إزالة العلامات'; }
  if (STUDIO.teemasterProcessBtn) { STUDIO.teemasterProcessBtn.disabled = true; STUDIO.teemasterProcessBtn.innerHTML = '<i class="fa-solid fa-magic"></i> بدء إزالة الخلفية بالذكاء الاصطناعي'; }
  if (STUDIO.peelDownloadBtn) STUDIO.peelDownloadBtn.style.display = 'none';
  if (STUDIO.teemasterDownloadBtn) STUDIO.teemasterDownloadBtn.style.display = 'none';
  if (STUDIO.toStep2Btn) STUDIO.toStep2Btn.disabled = true;
  if (STUDIO.toStep3Btn) STUDIO.toStep3Btn.disabled = true;
  if (STUDIO.toSeoBtn) STUDIO.toSeoBtn.disabled = true;
  studioActivateStep(1); studioUpdateCounts(); showToast('♻️ تمت إعادة تعيين Studio');
}


function studioSetupDragDrop(zoneId, inputId, handler) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handler(e.dataTransfer.files); });
  const input = document.getElementById(inputId);
  if (input) input.addEventListener('change', e => handler(e.target.files));
}

document.addEventListener('DOMContentLoaded', () => {
  // ── Setup drag-drop for zone 1 ──
  studioSetupDragDrop('studio-upload-zone-1', 'studio-file-input-1', studioHandleFiles1);

  // ── Zone 2 drag-drop: routes into TeeMaster Engine ──
  const zone2 = document.getElementById('studio-upload-zone-2');
  if (zone2) {
    zone2.addEventListener('dragover', e => { e.preventDefault(); zone2.classList.add('dragover'); });
    zone2.addEventListener('dragleave', () => zone2.classList.remove('dragover'));
    zone2.addEventListener('drop', e => {
      e.preventDefault(); zone2.classList.remove('dragover');
      if (typeof window.tmAddFilesFromStudio === 'function') {
        // Convert FileList to array of dataURLs then pass
        const handleDrop = async (files) => {
          const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
          const items = [];
          for (const file of valid) {
            const dataURL = await studioReadFileAsDataURL(file);
            items.push({ name: file.name, dataURL, status: '' });
          }
          if (items.length) window.tmAddFilesFromStudio(items);
          showToast(`✅ تمت إضافة ${valid.length} صورة للطابور`);
        };
        handleDrop(e.dataTransfer.files);
      }
    });
  }
  const fileInput2 = document.getElementById('studio-file-input-2');
  if (fileInput2) {
    fileInput2.addEventListener('change', async (e) => {
      const valid = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      const items = [];
      for (const file of valid) {
        const dataURL = await studioReadFileAsDataURL(file);
        items.push({ name: file.name, dataURL, status: '' });
      }
      if (items.length && typeof window.tmAddFilesFromStudio === 'function') {
        window.tmAddFilesFromStudio(items);
        showToast(`✅ تمت إضافة ${valid.length} صورة`);
      }
      fileInput2.value = '';
    });
  }

  // ── Upload buttons ──
  // ── Studio Navigation (Icons) ──
  [1, 2, 3].forEach(step => {
    const navNode = document.getElementById(`studio-nav-step${step}`);
    if (navNode) {
      navNode.addEventListener('click', (e) => {
        e.preventDefault();
        window.studioGoToStep(step);
      });
    }
  });

  // ── Gemini Studio Button ──
  const studioGeminiBtn = document.getElementById('btn-studio-gemini');
  if (studioGeminiBtn) {
    studioGeminiBtn.addEventListener('click', () => {
      STUDIO_GEMINI.show();
    });
  }

  const uploadBtn1 = document.getElementById('studio-upload-btn-1');
  const fi1 = document.getElementById('studio-file-input-1');
  if (uploadBtn1 && fi1) uploadBtn1.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fi1.click(); });

  const uploadBtn2 = document.getElementById('studio-upload-btn-2');
  if (uploadBtn2 && fileInput2) uploadBtn2.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fileInput2.click(); });

  const zone3 = document.getElementById('studio-upload-zone-3');
  const fileInput3 = document.getElementById('studio-file-input-3');
  const uploadBtn3 = document.getElementById('studio-upload-btn-3');
  if (zone3 && fileInput3) {
    zone3.addEventListener('dragover', e => { e.preventDefault(); zone3.classList.add('dragover'); });
    zone3.addEventListener('dragleave', () => zone3.classList.remove('dragover'));
    zone3.addEventListener('drop', async e => {
      e.preventDefault(); zone3.classList.remove('dragover');
      const valid = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      for (const file of valid) {
        const dataURL = await studioReadFileAsDataURL(file);
        const item = { name: file.name, dataURL, status: '', customName: null };
        STUDIO.step3Files.push(item);
        STUDIO.step1Files.push({ ...item });
      }
      studioRenderFileList3();
      const removeFn1 = (idx) => { STUDIO.step1Files.splice(idx, 1); studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1); studioUpdateStep1UI(); studioUpdateCounts(); };
      studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
      studioUpdateStep1UI(); studioUpdateCounts();
      if (valid.length) showToast(`✅ تمت إضافة ${valid.length} صور (تمت مزامنتها مع المكتبة)`);
    });
    fileInput3.addEventListener('change', async e => {
      const valid = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      for (const file of valid) {
        const dataURL = await studioReadFileAsDataURL(file);
        const item = { name: file.name, dataURL, status: '', customName: null };
        STUDIO.step3Files.push(item);
        STUDIO.step1Files.push({ ...item });
      }
      studioRenderFileList3();
      const removeFn1 = (idx) => { STUDIO.step1Files.splice(idx, 1); studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1); studioUpdateStep1UI(); studioUpdateCounts(); };
      studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
      studioUpdateStep1UI(); studioUpdateCounts();
      if (valid.length) showToast(`✅ تمت إضافة ${valid.length} صور (تمت مزامنتها مع المكتبة)`);
      fileInput3.value = '';
    });
    if (uploadBtn3) uploadBtn3.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fileInput3.click(); });
  }

  const peelBtn = document.getElementById('studio-peel-process-btn');
  if (peelBtn) peelBtn.addEventListener('click', studioPeelBananaProcess);

  const peelDl = document.getElementById('studio-peel-download-btn');
  if (peelDl) peelDl.addEventListener('click', studioPeelDownloadAll);

  const toStep2 = document.getElementById('studio-to-step2-btn');
  if (toStep2) toStep2.addEventListener('click', () => {
    // Pass images from Step 1 into TeeMaster Engine
    const sourcFiles = STUDIO.step1Results.length > 0 ? STUDIO.step1Results : STUDIO.step1Files;
    if (typeof window.tmAddFilesFromStudio === 'function' && sourcFiles.length > 0) {
      window.tmAddFilesFromStudio(sourcFiles);
    }
    studioActivateStep(2);
  });

  // Note: teemaster-process-btn is now handled by the TeeMaster Engine itself (tm-start-btn)
  // studio-teemaster-download-btn is also handled by the engine

  const toStep3 = document.getElementById('studio-to-step3-btn');
  if (toStep3) toStep3.addEventListener('click', () => {
    if (STUDIO.step2Results.length > 0) STUDIO.step3Files = STUDIO.step2Results.map(item => ({ ...item, customName: null }));
    else if (STUDIO.step2Files.length > 0) STUDIO.step3Files = STUDIO.step2Files.map(item => ({ ...item, customName: null }));
    studioRenderFileList3();
    if (STUDIO.toSeoBtn) STUDIO.toSeoBtn.disabled = STUDIO.step3Files.length === 0;
    studioUpdateCounts(); studioActivateStep(3);
  });

  const applyBulk = document.getElementById('studio-apply-bulk-name');
  if (applyBulk) applyBulk.addEventListener('click', studioApplyBulkName);

  const dlFinal = document.getElementById('studio-download-final-btn');
  if (dlFinal) dlFinal.addEventListener('click', studioDownloadFinal);

  const dlSelected = document.getElementById('studio-download-selected-btn');
  if (dlSelected) dlSelected.addEventListener('click', studioDownloadSelected);

  const selectAll3 = document.getElementById('studio-select-all-3');
  if (selectAll3) {
    selectAll3.addEventListener('change', () => {
      STUDIO.step3Files.forEach(f => f.selected = selectAll3.checked);
      studioRenderFileList3();
    });
  }

  const resetBtn = document.getElementById('studio-reset-pipeline-btn');
  if (resetBtn) resetBtn.addEventListener('click', studioResetPipeline);

  const toSeo = document.getElementById('studio-to-seo-btn');
  if (toSeo) toSeo.addEventListener('click', studioSendToSEO);

  const saveToRepoBtn = document.getElementById('studio-save-repo-btn');
  if (saveToRepoBtn) saveToRepoBtn.addEventListener('click', studioCommitToRepo);

  const toBoth = document.getElementById('studio-to-both-btn');
  if (toBoth) toBoth.addEventListener('click', studioSendToBoth);

  // --- REPOSITORY LISTENERS ---
  const sendToSeoRepo = document.getElementById('repo-send-to-seo');
  if (sendToSeoRepo) sendToSeoRepo.addEventListener('click', () => studioTransferFromRepo('seo'));

  const sendToAutRepo = document.getElementById('repo-send-to-aut');
  if (sendToAutRepo) sendToAutRepo.addEventListener('click', () => studioTransferFromRepo('aut'));

  const selectAllRepo = document.getElementById('repo-select-all');
  if (selectAllRepo) {
    selectAllRepo.addEventListener('change', () => {
      STUDIO.repo.grid.querySelectorAll('.repo-item-check').forEach(cb => {
        cb.checked = selectAllRepo.checked;
      });
    });
  }

  const deleteFromRepo = document.getElementById('repo-delete-from-repo');
  if (deleteFromRepo) deleteFromRepo.addEventListener('click', studioDeleteSelectedFromRepo);

  // Refresh repo when navigating to Studio tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'tab-studio') studioRefreshRepository();
    });
  });

  document.querySelectorAll('input[name="studio-bg-detect"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('input[name="studio-bg-detect"]').forEach(r => {
        r.parentElement.style.borderColor = r.checked ? '#10B981' : 'var(--border)';
        r.parentElement.style.background = r.checked ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.2)';
      });
      const gg = document.getElementById('studio-gemini-key-group');
      if (gg) gg.style.display = radio.value === 'ai' ? 'block' : 'none';
    });
  });

  const defRadio = document.querySelector('input[name="studio-bg-detect"]:checked');
  if (defRadio) { defRadio.parentElement.style.borderColor = '#10B981'; defRadio.parentElement.style.background = 'rgba(16,185,129,0.15)'; }

  studioUpdateCounts();

  // ══ TeeMaster Pro 5K Engine (STUDIO Step 2) ══
  initTeeMasterEngine();
});

// ══════════════════════════════════════════════════════
//  ████████  TEEMASTER PRO 5K ENGINE  ████████
//  Full implementation: Preview, Canvas Tools, Queue,
//  Zoom, BG Toggle, Crop, Magic Wand, Eraser, AI BG Remove
// ══════════════════════════════════════════════════════

function initTeeMasterEngine() {
  // State
  const TM = {
    imageQueue: [],       // { file, dataURL, name }
    processedResults: [], // { name, dataURL }
    currentImg: null,     // current image in preview
    currentCtx: null,
    originalImageData: null,
    originalCanvas: null,
    undoStack: [],
    zoom: 1,
    currentTool: 'color',
    pickedColor: null,    // { r, g, b }
    cropStart: null,
    cropRect: null,
    isDrawingCrop: false,
    freePath: [],
    magicTolerance: 30,
    bgMode: 'black',      // 'black'|'white'|'trans'
    isProcessing: false,
  };

  // DOM helpers
  const $ = id => document.getElementById(id);
  const canvas = $('tm-preview-canvas');
  const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

  function tmLog(msg) {
    const log = $('tm-log-area');
    if (!log) return;
    const line = document.createElement('div');
    line.style.cssText = 'padding:1px 0; border-bottom:1px solid rgba(255,255,255,0.04);';
    line.textContent = `▸ ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function tmSetProgress(done, total) {
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const fill = $('tm-progress-fill');
    const text = $('tm-progress-text');
    const pctEl = $('tm-progress-pct');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `جاري المعالجة: ${done} / ${total}`;
    if (pctEl) pctEl.textContent = pct + '%';
  }

  function tmEnableStartBtn() {
    const btn = $('tm-start-btn');
    if (!btn) return;
    if (TM.imageQueue.length > 0) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.classList.add('pulse-active'); // Add a pulse effect when it's ready
      btn.innerHTML = `<i class="fa-solid fa-play"></i> بدء معالجة ${TM.imageQueue.length} صورة الآن`;
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.classList.remove('pulse-active');
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ارفع الصور لبدء المعالجة';
    }
  }

  function tmUpdateQueueInfo() {
    const info = $('tm-queue-info');
    const count = $('tm-queue-count');
    if (info) info.style.display = TM.imageQueue.length > 0 ? 'block' : 'none';
    if (count) count.textContent = TM.imageQueue.length;
    tmEnableStartBtn();
    studioUpdateCounts();
  }

  // ── Load image into preview canvas (Smart Fit to Viewport) ──
  function tmShowPreview(item) {
    if (!canvas || !ctx || !item) return;
    TM.currentImg = item;
    const img = new Image();
    img.onload = () => {
      TM.nativeW = img.width;
      TM.nativeH = img.height;

      // Native canvas size for precision
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      TM.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      TM.undoStack = [];
      
      TM.originalCanvas = document.createElement('canvas');
      TM.originalCanvas.width = canvas.width;
      TM.originalCanvas.height = canvas.height;
      TM.originalCanvas.getContext('2d').drawImage(img, 0, 0);

      // Show section first to get layout availability
      const previewSection = $('tm-preview-section');
      if (previewSection) previewSection.style.display = 'block';

      // Advanced Fit Calculation
      const container = $('tm-preview-container');
      // Extension popups are usually ~380-450px. Use clientWidth or fallback.
      const availableW = (container && container.clientWidth > 50) ? container.clientWidth - 20 : 350;
      const availableH = 300; // Fixed max height for better UX

      const scaleW = availableW / img.width;
      const scaleH = availableH / img.height;

      // Select the smaller scale to fit entirely, max 100%
      TM.zoom = Math.min(scaleW, scaleH, 1);
      TM.fitZoom = TM.zoom;

      applyZoom();

      const queueSection = $('tm-queue-section');
      if (queueSection) queueSection.style.display = TM.imageQueue.length > 0 ? 'block' : 'none';

      tmLog(`🔍 معاينة متوافقة: ${item.name} (${img.width}×${img.height}px)`);

      // Auto-scroll to preview to ensure user sees it
      previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    img.src = item.dataURL;
  }

  function initWorkspaceDragPan() {
    const workspace = document.querySelector('#studio-section-2 .tm-workspace');
    if (!workspace) return;
    if (workspace.dataset.tmDragPanInit === '1') return;
    workspace.dataset.tmDragPanInit = '1';

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const interactiveSelector = 'button, input, select, textarea, label, a, [contenteditable="true"]';
    const onPanEnd = () => {
      isDown = false;
      workspace.classList.remove('ctrl-panning');
    };

    if (workspace.dataset.tmCtrlPanKeybindInit !== '1') {
      workspace.dataset.tmCtrlPanKeybindInit = '1';
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Control') return;
        workspace.classList.add('ctrl-ready');
      });
      document.addEventListener('keyup', (e) => {
        if (e.key !== 'Control') return;
        workspace.classList.remove('ctrl-ready');
        onPanEnd();
      });
    }

    workspace.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !e.ctrlKey) return;
      if (e.target.closest(interactiveSelector)) return;

      const previewContainer = $('tm-preview-container');
      if (previewContainer && !previewContainer.contains(e.target)) return;

      const canScrollX = workspace.scrollWidth > workspace.clientWidth;
      const canScrollY = workspace.scrollHeight > workspace.clientHeight;
      if (!canScrollX && !canScrollY) return;

      isDown = true;
      workspace.classList.add('ctrl-ready');
      workspace.classList.add('ctrl-panning');
      startX = e.pageX;
      startY = e.pageY;
      scrollLeft = workspace.scrollLeft;
      scrollTop = workspace.scrollTop;
      e.preventDefault();
    });

    workspace.addEventListener('mouseleave', () => {
      onPanEnd();
    });

    workspace.addEventListener('mouseup', () => {
      onPanEnd();
    });

    workspace.addEventListener('mousemove', (e) => {
      if (!isDown || !e.ctrlKey) {
        if (isDown && !e.ctrlKey) onPanEnd();
        return;
      }
      const walkX = e.pageX - startX;
      const walkY = e.pageY - startY;
      workspace.scrollLeft = scrollLeft - walkX;
      workspace.scrollTop = scrollTop - walkY;
      e.preventDefault();
    });
  }

  function applyZoom() {
    if (!canvas) return;
    // Set visual dimensions while maintaining native internal resolution
    const displayW = Math.round(canvas.width * TM.zoom);
    const displayH = Math.round(canvas.height * TM.zoom);

    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    canvas.style.display = 'block';
    canvas.style.margin = 'auto'; // Center the image

    const zl = $('tm-zoom-level');
    if (zl) zl.textContent = Math.round(TM.zoom * 100) + '%';
  }

  function tmRedrawCanvas() {
    if (!ctx || !TM.currentImg) return;
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); };
    img.src = TM.currentImg.dataURL;
  }

  function tmSaveUndo() {
    if (!ctx || !canvas) return;
    TM.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (TM.undoStack.length > 20) TM.undoStack.shift();
  }

  // ── Add files to queue ──
  async function tmAddFiles(files) {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    for (const file of valid) {
      const dataURL = await studioReadFileAsDataURL(file);
      const item = { file, name: file.name, dataURL };
      TM.imageQueue.push(item);
      STUDIO.step2Files.push({ name: file.name, dataURL, status: '' });
    }
    if (TM.imageQueue.length === 1) tmShowPreview(TM.imageQueue[0]);
    tmRenderQueueGrid();
    tmUpdateQueueInfo();
    showToast(`✅ تمت إضافة ${valid.length} صورة للطابور`);
  }

  function tmRenderQueueGrid() {
    const grid = $('tm-queue-grid');
    if (!grid) return;
    grid.innerHTML = '';
    TM.imageQueue.forEach((item, i) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--border); aspect-ratio:1; cursor:pointer;';
      const img = document.createElement('img');
      img.src = item.dataURL;
      img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
      img.onclick = () => tmShowPreview(item);
      const rmBtn = document.createElement('button');
      rmBtn.innerHTML = '✕';
      rmBtn.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.85);color:#fff;border:none;width:16px;height:16px;border-radius:50%;font-size:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      rmBtn.onclick = (e) => { e.stopPropagation(); TM.imageQueue.splice(i, 1); STUDIO.step2Files.splice(i, 1); tmRenderQueueGrid(); tmUpdateQueueInfo(); };
      wrapper.appendChild(img); wrapper.appendChild(rmBtn);
      grid.appendChild(wrapper);
    });
  }

  // ── Canvas Tool Logic ──
  function tmGetCurrentTool() {
    const checked = document.querySelector('input[name="tm-preview-tool"]:checked');
    return checked ? checked.value : 'color';
  }

  function tmGetCanvasPos(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) / TM.zoom),
      y: Math.round((e.clientY - rect.top) / TM.zoom)
    };
  }

  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      const { x, y } = tmGetCanvasPos(e);
      TM.currentTool = tmGetCurrentTool();

      if (TM.currentTool === 'color') {
        if (!ctx) return;
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        TM.pickedColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        const disp = $('tm-color-display');
        const manColor = $('tm-manual-color');
        if (disp) disp.textContent = hex;
        if (manColor) manColor.value = hex;
        tmLog(`التقاط لون: ${hex}`);
        return;
      }

      if (TM.currentTool === 'magic-wand' || TM.currentTool === 'magic-global') {
        tmSaveUndo();
        const tol = parseInt($('tm-tolerance')?.value || '30');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const targetR = pixel[0], targetG = pixel[1], targetB = pixel[2];
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = id.data;
        const w = canvas.width, h = canvas.height;

        if (TM.currentTool === 'magic-wand') {
          // Flood fill from click point
          const visited = new Uint8Array(w * h);
          const stack = [[x, y]];
          while (stack.length) {
            const [px, py] = stack.pop();
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            const idx = py * w + px;
            if (visited[idx]) continue;
            const pi = idx * 4;
            if (data[pi + 3] === 0) { visited[idx] = 1; continue; }
            const dr = data[pi] - targetR, dg = data[pi + 1] - targetG, db = data[pi + 2] - targetB;
            if (Math.sqrt(dr * dr + dg * dg + db * db) > tol) continue;
            visited[idx] = 1;
            data[pi + 3] = 0;
            stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
          }
        } else {
          // Global: remove color everywhere
          for (let i = 0; i < data.length; i += 4) {
            const dr = data[i] - targetR, dg = data[i + 1] - targetG, db = data[i + 2] - targetB;
            if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) data[i + 3] = 0;
          }
        }
        ctx.putImageData(id, 0, 0);
        TM.currentImg.dataURL = canvas.toDataURL('image/png');
        tmLog(`${TM.currentTool === 'magic-wand' ? 'سحر متصل' : 'سحر شامل'}: إزالة لون متصل`);
        return;
      }

      if (TM.currentTool === 'eraser' || TM.currentTool === 'restore') {
        TM.isDrawingCrop = true;
        TM.cropStart = { x, y };
        return;
      }

      if (TM.currentTool === 'crop' || TM.currentTool === 'crop-free') {
        TM.isDrawingCrop = true;
        TM.cropStart = { x, y };
        TM.freePath = [{ x, y }];
        const addBtn = $('tm-add-crop-btn');
        if (addBtn) addBtn.style.display = 'none';
        return;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!TM.isDrawingCrop || !TM.cropStart) return;
      const { x, y } = tmGetCanvasPos(e);
      TM.currentTool = tmGetCurrentTool();

      if (TM.currentTool === 'eraser' || TM.currentTool === 'restore') {
        const size = 20;
        tmSaveUndo();
        if (TM.currentTool === 'eraser') {
            ctx.clearRect(x - size / 2, y - size / 2, size, size);
        } else if (TM.currentTool === 'restore' && TM.originalCanvas) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.clearRect(x - size / 2, y - size / 2, size, size);
            ctx.drawImage(TM.originalCanvas, 0, 0);
            ctx.restore();
        }
        TM.currentImg.dataURL = canvas.toDataURL('image/png');
        return;
      }

      if (TM.currentTool === 'crop') {
        tmRedrawCanvas();
        ctx.strokeStyle = 'rgba(16,185,129,0.9)';
        ctx.lineWidth = 2 / TM.zoom;
        ctx.setLineDash([4, 4]);
        const w = x - TM.cropStart.x, h = y - TM.cropStart.y;
        ctx.strokeRect(TM.cropStart.x, TM.cropStart.y, w, h);
        ctx.setLineDash([]);
        TM.cropRect = { x: TM.cropStart.x, y: TM.cropStart.y, w, h };
        return;
      }

      if (TM.currentTool === 'crop-free') {
        TM.freePath.push({ x, y });
        tmRedrawCanvas();
        ctx.strokeStyle = 'rgba(167,139,250,0.9)';
        ctx.lineWidth = 2 / TM.zoom;
        ctx.beginPath();
        ctx.moveTo(TM.freePath[0].x, TM.freePath[0].y);
        TM.freePath.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    });

    canvas.addEventListener('mouseup', () => {
      TM.isDrawingCrop = false;
      const tool = tmGetCurrentTool();
      if (tool === 'crop' && TM.cropRect && Math.abs(TM.cropRect.w) > 5 && Math.abs(TM.cropRect.h) > 5) {
        const addBtn = $('tm-add-crop-btn');
        if (addBtn) addBtn.style.display = 'flex';
      }
      if (tool === 'crop-free' && TM.freePath.length > 3) {
        const addBtn = $('tm-add-crop-btn');
        if (addBtn) addBtn.style.display = 'flex';
      }
    });
  }

  // ── Add Crop to Queue ──
  const addCropBtn = $('tm-add-crop-btn');
  if (addCropBtn) {
    addCropBtn.addEventListener('click', () => {
      const tool = tmGetCurrentTool();
      if (!canvas || !ctx) return;
      const tmpCanvas = document.createElement('canvas');
      const tmpCtx = tmpCanvas.getContext('2d');

      if (tool === 'crop' && TM.cropRect) {
        const r = TM.cropRect;
        const rx = Math.min(r.x, r.x + r.w), ry = Math.min(r.y, r.y + r.h);
        const rw = Math.abs(r.w), rh = Math.abs(r.h);
        tmpCanvas.width = rw; tmpCanvas.height = rh;
        const imgData = ctx.getImageData(rx, ry, rw, rh);
        tmpCtx.putImageData(imgData, 0, 0);
      } else if (tool === 'crop-free' && TM.freePath.length > 2) {
        tmpCanvas.width = canvas.width; tmpCanvas.height = canvas.height;
        tmpCtx.save();
        tmpCtx.beginPath();
        tmpCtx.moveTo(TM.freePath[0].x, TM.freePath[0].y);
        TM.freePath.forEach(p => tmpCtx.lineTo(p.x, p.y));
        tmpCtx.closePath();
        tmpCtx.clip();
        tmpCtx.drawImage(canvas, 0, 0);
        tmpCtx.restore();
      } else return;

      const newDataURL = tmpCanvas.toDataURL('image/png');
      const newName = `crop_${Date.now()}_${TM.imageQueue.length + 1}.png`;
      const newItem = { name: newName, dataURL: newDataURL, file: null };
      TM.imageQueue.push(newItem);
      STUDIO.step2Files.push({ name: newName, dataURL: newDataURL, status: '' });
      tmRenderQueueGrid();
      tmUpdateQueueInfo();
      tmLog(`✂️ تم فصل جزء كصورة جديدة: ${newName}`);
      addCropBtn.style.display = 'none';
      TM.cropRect = null; TM.freePath = [];
      showToast('✅ تم فصل الجزء كصورة للطابور!');
    });
  }

  // ── Skip current preview ──
  const skipBtn = $('tm-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (TM.imageQueue.length === 0) return;
      const removed = TM.imageQueue.shift();
      const si = STUDIO.step2Files.findIndex(f => f.name === removed.name);
      if (si > -1) STUDIO.step2Files.splice(si, 1);
      tmLog(`⏭️ تم تخطي: ${removed.name}`);
      if (TM.imageQueue.length > 0) {
        tmShowPreview(TM.imageQueue[0]);
      } else {
        const prev = $('tm-preview-section');
        if (prev) prev.style.display = 'none';
      }
      tmRenderQueueGrid();
      tmUpdateQueueInfo();
    });
  }

  // ── Undo ──
  const undoBtn = $('tm-undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (TM.undoStack.length === 0) { showToast('⚠️ لا يوجد شيء للاسترجاع'); return; }
      const prev = TM.undoStack.pop();
      if (ctx && canvas) {
        ctx.putImageData(prev, 0, 0);
        TM.currentImg.dataURL = canvas.toDataURL('image/png');
      }
      tmLog('↩️ تم الاسترجاع');
    });
  }

  // ── Zoom ──
  const zoomInBtn = $('tm-zoom-in-btn');
  const zoomOutBtn = $('tm-zoom-out-btn');
  const zoomResetBtn = $('tm-zoom-reset-btn');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => { TM.zoom = Math.min(TM.zoom + 0.25, 4); applyZoom(); });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { TM.zoom = Math.max(TM.zoom - 0.25, 0.25); applyZoom(); });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { TM.zoom = 1; applyZoom(); });
  initWorkspaceDragPan();

  // ── BG Toggle ──
  const bgBlack = $('tm-bg-black-btn');
  const bgWhite = $('tm-bg-white-btn');
  const bgTrans = $('tm-bg-trans-btn');
  const previewContainer = $('tm-preview-container');
  function tmSetBg(mode) {
    TM.bgMode = mode;
    if (!previewContainer) return;
    if (mode === 'black') previewContainer.style.background = '#111';
    else if (mode === 'white') previewContainer.style.background = '#fff';
    else previewContainer.style.background = 'repeating-conic-gradient(#808080 0% 25%, #fff 0% 50%) 0 0 / 16px 16px';
    [bgBlack, bgWhite, bgTrans].forEach(b => { if (b) b.style.borderWidth = '1px'; });
    const activeBtn = mode === 'black' ? bgBlack : mode === 'white' ? bgWhite : bgTrans;
    if (activeBtn) activeBtn.style.borderWidth = '3px';
  }
  if (bgBlack) bgBlack.addEventListener('click', () => tmSetBg('black'));
  if (bgWhite) bgWhite.addEventListener('click', () => tmSetBg('white'));
  if (bgTrans) bgTrans.addEventListener('click', () => tmSetBg('trans'));
  tmSetBg('black');

  // ── Tolerance Slider ──
  const tolSlider = $('tm-tolerance');
  const tolVal = $('tm-tol-val');
  if (tolSlider && tolVal) {
    tolSlider.addEventListener('input', () => {
      TM.magicTolerance = parseInt(tolSlider.value);
      tolVal.textContent = tolSlider.value;
    });
  }

  // ── Tool label highlight ──
  document.querySelectorAll('input[name="tm-preview-tool"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.tm-tool-label').forEach(l => {
        l.style.background = 'rgba(0,0,0,0.2)';
        l.style.borderColor = 'rgba(139,92,246,0.6)';
      });
      if (radio.checked) {
        radio.parentElement.style.background = 'rgba(139,92,246,0.2)';
        radio.parentElement.style.borderColor = '#8b5cf6';
      }
      TM.currentTool = radio.value;
      const addBtn = $('tm-add-crop-btn');
      if (addBtn) addBtn.style.display = 'none';
    });
  });

  // ── Queue/History Tabs ──
  const tabQueue = $('tm-tab-queue');
  const tabHistory = $('tm-tab-history');
  const queueSection = $('tm-queue-section');
  const historySection = $('tm-history-section');
  if (tabQueue) tabQueue.addEventListener('click', () => {
    if (queueSection) queueSection.style.display = 'block';
    if (historySection) historySection.style.display = 'none';
    tabQueue.style.borderBottomColor = '#10B981';
    tabQueue.style.color = '#10B981';
    if (tabHistory) { tabHistory.style.borderBottomColor = 'transparent'; tabHistory.style.color = 'var(--text-muted)'; }
  });
  if (tabHistory) tabHistory.addEventListener('click', () => {
    if (queueSection) queueSection.style.display = 'none';
    if (historySection) historySection.style.display = 'block';
    tabHistory.style.borderBottomColor = '#10B981';
    tabHistory.style.color = '#10B981';
    if (tabQueue) { tabQueue.style.borderBottomColor = 'transparent'; tabQueue.style.color = 'var(--text-muted)'; }
    tmLoadHistory();
  });

  function tmLoadHistory() {
    const listEl = $('tm-history-list');
    if (!listEl) return;
    chrome.storage.local.get('tmHistory', data => {
      const history = data.tmHistory || [];
      if (history.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">لا يوجد سجل بعد</div>';
        return;
      }
      // Only keep last 10 for performance and display
      listEl.innerHTML = history.slice(-10).reverse().map(item =>
        `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; background:var(--surface1); margin-bottom:4px; border-radius:8px;">
          <img src="${item.thumb || item.dataURL}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border); background:#000;">
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
            <div style="font-size:10px;color:var(--text-muted); opacity:0.7;">${item.date || ''}</div>
          </div>
          <a href="${item.dataURL}" download="${item.name}" style="background:var(--primary); color:white; width:28px; height:28px; display:flex; align-items:center; justify-center:center; border-radius:50%; text-decoration:none; font-size:14px; box-shadow:0 3px 6px rgba(0,0,0,0.2);">⬇️</a>
        </div>`
      ).join('');
    });
  }

  const clearQueueBtn = $('tm-clear-queue-btn');
  if (clearQueueBtn) clearQueueBtn.addEventListener('click', () => {
    TM.imageQueue = [];
    STUDIO.step2Files = [];
    tmRenderQueueGrid();
    tmUpdateQueueInfo();
    const prev = $('tm-preview-section');
    if (prev) prev.style.display = 'none';
    showToast('🗑️ تم تفريغ الطابور');
  });

  const clearHistoryBtn = $('tm-clear-history-btn');
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.remove('tmHistory', () => {
      tmLoadHistory();
      showToast('🗑️ تم مسح السجل');
    });
  });

  // ── UPSCALE TO 5000x5000 ──
  // ── UPSCALE TO 5000x5500 ──
  function tmUpscaleTo5K(dataURL) {
    return new Promise(resolve => {
      const TARGET_W = 5000;
      const TARGET_H = 5500;
      const img = new Image();
      img.onload = () => {
      // If already 5000x5500 or larger, skip
      if (img.width >= TARGET_W && img.height >= TARGET_H) {
          resolve(dataURL);
          return;
        }
        const c = document.createElement('canvas');
        c.width = TARGET_W;
        c.height = TARGET_H;
        const ctx2 = c.getContext('2d');
        // Transparent background (for PNG)
        ctx2.clearRect(0, 0, TARGET_W, TARGET_H);
        // High quality scaling
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = 'high';
        // Calculate scale to fit inside 5000x5500 while maintaining aspect ratio
        const scale = Math.min(TARGET_W / img.width, TARGET_H / img.height);
        const newW = Math.round(img.width * scale);
        const newH = Math.round(img.height * scale);
        // Center the image on canvas
        const offsetX = Math.round((TARGET_W - newW) / 2);
        const offsetY = Math.round((TARGET_H - newH) / 2);
        ctx2.drawImage(img, offsetX, offsetY, newW, newH);
        resolve(c.toDataURL('image/png'));
      };
      img.src = dataURL;
    });
  }

  // ── MAIN PROCESSING BUTTON ──
  const startBtn = $('tm-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (TM.isProcessing || TM.imageQueue.length === 0) return;
      TM.isProcessing = true;
      TM.processedResults = [];
      STUDIO.step2Results = [];

      const progressWrap = $('tm-progress-container');
      if (progressWrap) progressWrap.style.display = 'block';

      startBtn.disabled = true;
      startBtn.style.opacity = '0.6';
      startBtn.innerHTML = '<div class="spinner-small" style="margin-left:8px;"></div> جاري المعالجة...';

      const useAI = document.querySelector('input[name="tm-bg-detect"]:checked')?.value === 'ai';
      const geminiKey = $('central-gemini-key')?.value || '';
      const removalMode = $('tm-removal-mode')?.value || 'auto';
      const total = TM.imageQueue.length;
      tmLog(`🚀 بدء معالجة ${total} صور | الوضع: ${useAI ? 'Gemini AI' : 'يدوي'}`);

      for (let i = 0; i < total; i++) {
        const item = TM.imageQueue[i];
        tmLog(`⏳ (${i + 1}/${total}) ${item.name}`);
        tmSetProgress(i, total);

        try {
          let processed;
          if (useAI && geminiKey) {
            processed = await studioRemoveBgWithAI(item.dataURL, geminiKey);
          } else if (TM.pickedColor) {
            processed = await studioFloodFillRemove(item.dataURL, TM.pickedColor.r, TM.pickedColor.g, TM.pickedColor.b, TM.magicTolerance);
          } else {
            processed = await studioRemoveBgLocal(item.dataURL);
          }

          // Upscale to 5000x5000 for TeePublic
          tmLog(`📐 تكبير إلى 5000×5000: ${item.name}`);
          processed = await tmUpscaleTo5K(processed);

          TM.processedResults.push({ name: item.name, dataURL: processed });
          STUDIO.step2Results.push({ name: item.name, dataURL: processed, status: '✅' });

          // Save to history (Optimized: Max 10 items, no massive 5K images in history list if possible)
          chrome.storage.local.get('tmHistory', data => {
            let hist = data.tmHistory || [];
            // To prevent bloat, we store a smaller version or just metadata if it's too large
            // But for now, let's just limit the count strictly to 10
            hist.push({
              name: item.name,
              dataURL: processed, // Still stored for download but only 10 items total
              date: new Date().toLocaleDateString('ar-EG')
            });
            if (hist.length > 10) hist = hist.slice(-10);
            chrome.storage.local.set({ tmHistory: hist });
          });

          tmLog(`✅ تمت: ${item.name}`);
        } catch (err) {
          tmLog(`❌ خطأ في: ${item.name}: ${err.message}`);
          TM.processedResults.push({ name: item.name, dataURL: item.dataURL });
          STUDIO.step2Results.push({ name: item.name, dataURL: item.dataURL, status: '⚠️' });
        }

        tmSetProgress(i + 1, total);
        await new Promise(r => setTimeout(r, 100));
      }

      TM.isProcessing = false;
      tmSetProgress(total, total);
      startBtn.innerHTML = '✅ اكتملت المعالجة!';
      startBtn.style.opacity = '1';

      // Enable download + next step
      const dlBtn = $('studio-teemaster-download-btn');
      if (dlBtn) {
        dlBtn.style.display = 'flex';
        dlBtn.onclick = () => {
          TM.processedResults.forEach((item, i) => {
            setTimeout(() => {
              const a = document.createElement('a');
              a.href = item.dataURL;
              const blob = studioDataURLtoBlob(item.dataURL);
              const url = URL.createObjectURL(blob);
              a.href = url;
              a.download = `tm_${item.name.replace(/\.[^.]+$/, '')}.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, i * 300);
          });
          showToast(`📥 جاري تحميل ${TM.processedResults.length} صورة...`);
        };
      }

      const toStep3Btn = $('studio-to-step3-btn');
      if (toStep3Btn) toStep3Btn.disabled = false;

      STUDIO.step3Files = STUDIO.step2Results.map(item => ({ ...item, customName: null }));
      studioUpdateCounts();
      showToast(`🎉 اكتملت معالجة ${total} صورة في TeeMaster Pro!`);
      tmLog(`🎉 اكتمل! ${TM.processedResults.length} صورة جاهزة`);
    });
  }

  // ── Expose addFiles so STUDIO can push files when coming from Step 1 ──
  window.tmAddFilesFromStudio = function (filesArr) {
    TM.imageQueue = [...filesArr];
    STUDIO.step2Files = [...filesArr];

    // Sync to Stage 1 (Library)
    filesArr.forEach(item => {
      const exists = STUDIO.step1Files.some(f => f.name === item.name);
      if (!exists) STUDIO.step1Files.push({ ...item });
    });

    const removeFn1 = (idx) => {
      STUDIO.step1Files.splice(idx, 1);
      studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
      studioUpdateStep1UI(); studioUpdateCounts();
    };
    studioRenderGrid(STUDIO.grid1, STUDIO.step1Files, removeFn1);
    studioUpdateStep1UI();

    if (TM.imageQueue.length > 0) tmShowPreview(TM.imageQueue[0]);
    tmRenderQueueGrid();
    tmUpdateQueueInfo();
    const qSec = $('tm-queue-section');
    if (qSec) qSec.style.display = 'block';
  };

  tmLog('⚡ TeeMaster Pro 5K جاهز');
}

// ══════════════════════════════════════════════════════
//  STUDIO GEMINI HUB (MULTI-TAB)
// ══════════════════════════════════════════════════════
const STUDIO_GEMINI = {
  show() {
    chrome.windows.create({
      url: 'https://gemini.google.com/gem/6bc2d8e9f911',
      type: 'popup',
      width: 900,
      height: 700
    });
  },
  init() {
    // Simplified trigger handler
  }
};
