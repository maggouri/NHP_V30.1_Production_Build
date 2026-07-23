// ══════════════════════════════════════════════════════
//  LOCAL DESIGN LIBRARY (STUDIO WORKSPACE) MODULE
// ══════════════════════════════════════════════════════

// Dependencies that will be passed from popup.js
let showToast;
let designQueue;
let renderQueue;
let saveQueueToStorage;
let S; // From seo.js, for S.queueContainer
let workspaceHandle; // This will be managed by the workspace module

// DOM Elements
const btnRefreshLocalLib = document.getElementById('btn-refresh-local-lib');
const btnAddToLocalLib = document.getElementById('btn-add-to-local-lib');
const btnLocalLibBulkImport = document.getElementById('btn-local-lib-bulk-import');
const localLibSelectAll = document.getElementById('local-lib-select-all');
const localLibContainer = document.getElementById('local-library-container');

async function refreshLocalLibrary() {
  if (!localLibContainer) return;
  if (!workspaceHandle) {
    localLibContainer.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">يرجى تفعيل المجلد المحلي أولاً من قسم الإعدادات</div>';
    return;
  }

  try {
    const permission = await workspaceHandle.queryPermission();
    if (permission !== 'granted') {
      localLibContainer.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">يرجى السماح بالصلاحية للمجلد المحلي</div>';
      return;
    }

    localLibContainer.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">⏳ جاري جلب الصور المحلية...</div>';

    const files = [];
    for await (const entry of workspaceHandle.values()) {
      if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) {
        files.push(entry);
      }
    }

    if (files.length === 0) {
      localLibContainer.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">المجلد المحلي لا يحتوي على صور حالياً</div>';
      return;
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    localLibContainer.innerHTML = '';

    for (const fileHandle of files) {
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);

      const item = document.createElement('div');
      item.className = 'library-item';
      item.title = fileHandle.name;
      item.innerHTML = `
        <input type="checkbox" class="local-lib-item-checkbox" data-name="${fileHandle.name}">
        <img src="${url}" loading="lazy">
        <button class="local-lib-delete-btn" title="حذف من الجهاز">✕</button>
      `;

      const img = item.querySelector('img');
      img.onload = () => URL.revokeObjectURL(url);

      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        const cb = item.querySelector('.local-lib-item-checkbox');
        cb.checked = !cb.checked;
        updateLocalLibBulkUI();
      });

      const cb = item.querySelector('.local-lib-item-checkbox');
      cb.addEventListener('change', updateLocalLibBulkUI);

      const delBtn = item.querySelector('.local-lib-delete-btn');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`هل أنت متأكد من حذف الملف "${fileHandle.name}" نهائياً من جهازك؟`)) return;
        try {
          await workspaceHandle.removeEntry(fileHandle.name);
          item.remove();
          updateLocalLibBulkUI();
        } catch (err) {
          showToast('❌ فشل الحذف: ' + err.message);
        }
      });

      localLibContainer.appendChild(item);
    }

  } catch (e) {
    console.error('Local Library Refresh Error:', e);
    localLibContainer.innerHTML = `<div class="empty-msg" style="grid-column: span 4; color: var(--banned);">خطأ في القراءة: ${e.message}</div>`;
  }
}

function updateLocalLibBulkUI() {
  if (!btnLocalLibBulkImport || !localLibContainer) return;
  const checkboxes = localLibContainer.querySelectorAll('.local-lib-item-checkbox');
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  btnLocalLibBulkImport.style.display = checked > 0 ? 'flex' : 'none';
  if (localLibSelectAll) localLibSelectAll.checked = checked === checkboxes.length && checkboxes.length > 0;
}

export function initStudioWorkspaceModule(helpers) {
    showToast = helpers.showToast;
    designQueue = helpers.designQueue;
    renderQueue = helpers.renderQueue;
    saveQueueToStorage = helpers.saveQueueToStorage;
    S = helpers.S;
    workspaceHandle = helpers.workspaceHandle;

    if (btnRefreshLocalLib) {
        btnRefreshLocalLib.addEventListener('click', refreshLocalLibrary);
    }

    if (localLibSelectAll) {
        localLibSelectAll.addEventListener('change', () => {
            if (localLibContainer) {
                localLibContainer.querySelectorAll('.local-lib-item-checkbox').forEach(cb => {
                    cb.checked = localLibSelectAll.checked;
                });
            }
            updateLocalLibBulkUI();
        });
    }

    if (btnAddToLocalLib) {
        btnAddToLocalLib.addEventListener('click', async () => {
            if (!workspaceHandle) return showToast('⚠️ يرجى تفعيل المجلد المحلي أولاً');
            if (!designQueue || designQueue.length === 0) return showToast('⚠️ طابور التصاميم فارغ');

            showToast('⏳ جاري إضافة التصاميم للمجلد المحلي...');
            let addedCount = 0;

            try {
                for (const design of designQueue) {
                    const byteCharacters = atob(design.base64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/png' });

                    const fileName = design.file.name || `design_${Date.now()}.png`;
                    const fileHandle = await workspaceHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    addedCount++;
                }
                showToast(`✅ تم إضافة ${addedCount} تصميماً للمجلد بنجاح`);
                refreshLocalLibrary();
            } catch (err) {
                showToast('❌ حدث خطأ أثناء الحفظ المحلي: ' + err.message);
            }
        });
    }

    if (btnLocalLibBulkImport) {
        btnLocalLibBulkImport.addEventListener('click', async () => {
            if (!localLibContainer) return;
            const selectedCbs = localLibContainer.querySelectorAll('.local-lib-item-checkbox:checked');
            if (selectedCbs.length === 0) return;

            showToast(`⏳ جاري استيراد ${selectedCbs.length} تصميماً...`);
            let imported = 0;

            try {
                for (const cb of selectedCbs) {
                    const fileName = cb.dataset.name;
                    const fileHandle = await workspaceHandle.getFileHandle(fileName);
                    const file = await fileHandle.getFile();

                    const reader = new FileReader();
                    const base64 = await new Promise((resolve) => {
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });

                    const newDesign = {
                        id: 'local_' + Date.now() + Math.random(),
                        file: { name: fileName, type: file.type },
                        base64: base64,
                        status: 'idle',
                        meta: null
                    };
                    designQueue.push(newDesign);
                    imported++;
                }

                renderQueue();
                if (S.queueContainer) S.queueContainer.classList.remove('hidden');
                saveQueueToStorage();
                showToast('✅ تم الاستيراد بنجاح');

                if (localLibSelectAll) localLibSelectAll.checked = false;
                localLibContainer.querySelectorAll('.local-lib-item-checkbox').forEach(cb => cb.checked = false);
                updateLocalLibBulkUI();

            } catch (err) {
                showToast('❌ فشل الاستيراد: ' + err.message);
            }
        });
    }

    // Initial call to set up the view
    refreshLocalLibrary();
    updateLocalLibBulkUI();
}

// This function must be called from outside when the workspace handle is available
export function setWorkspaceHandle(handle) {
    workspaceHandle = handle;
    refreshLocalLibrary();
}
