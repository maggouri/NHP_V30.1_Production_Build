// ══════════════════════════════════════════════════════
//  ████████  LIBRARY (LOCAL & CLOUD) MODULE  ████████
// ══════════════════════════════════════════════════════

export function initLibraryModule(helpers) {
    const { showToast, designQueue, renderQueue, saveQueueToStorage, autoSyncCloudData } = helpers;

    // --- 1. Cloud GitHub Library ---
    const container = document.getElementById('library-container');
    if (container && typeof GitHubSync !== 'undefined') {
        // refreshLibrary logic...
        window.refreshLibrary = async () => {
            try {
                const files = await GitHubSync.fetchLibrary();
                if (files.length === 0) {
                    container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">المكتبة فارغة حالياً</div>';
                    return;
                }
                container.innerHTML = files.map(file => `
          <div class="library-item" title="${file.name}" data-git-url="${file.git_url}" data-path="${file.path}" data-sha="${file.sha}">
            <input type="checkbox" class="lib-item-checkbox" data-git-url="${file.git_url}" data-name="${file.name}">
            <img src="${file.download_url}" loading="lazy">
            <button class="lib-delete-btn" title="حذف من السحابة">✕</button>
          </div>
        `).join('');

                // Bulk UI and Event Listeners logic...
                setupCloudLibListeners(helpers);
            } catch (e) {
                console.error('Library Load Error:', e);
            }
        };
    }

    // --- 2. Local Workspace Library ---
    const localContainer = document.getElementById('local-library-container');
    const btnRefreshLocal = document.getElementById('btn-refresh-local-lib');
    const btnAddToLocal = document.getElementById('btn-add-to-local-lib');
    const btnLocalBulkImport = document.getElementById('btn-local-lib-bulk-import');
    const selectAllLocal = document.getElementById('local-lib-select-all');

    if (btnRefreshLocal) {
        btnRefreshLocal.addEventListener('click', () => refreshLocalLibrary(helpers));
    }

    if (selectAllLocal) {
        selectAllLocal.addEventListener('change', () => {
            localContainer.querySelectorAll('.local-lib-item-checkbox').forEach(cb => cb.checked = selectAllLocal.checked);
            updateLocalLibBulkUI();
        });
    }

    if (btnAddToLocal) {
        btnAddToLocal.addEventListener('click', async () => {
            if (!window.workspaceHandle) return showToast('⚠️ يرجى تفعيل المجلد المحلي أولاً');
            if (!designQueue || designQueue.length === 0) return showToast('⚠️ طابور التصاميم فارغ');

            showToast('⏳ جاري إضافة التصاميم للمجلد المحلي...');
            let addedCount = 0;
            try {
                for (const design of designQueue) {
                    const byteCharacters = atob(design.base64);
                    const byteArray = new Uint8Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
                    const blob = new Blob([byteArray], { type: 'image/png' });
                    const fileName = design.file.name || `design_${Date.now()}.png`;
                    const fileHandle = await window.workspaceHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    addedCount++;
                }
                showToast(`✅ تم إضافة ${addedCount} تصميماً للمجلد بنجاح`);
                refreshLocalLibrary(helpers);
            } catch (err) { showToast('❌ حدث خطأ أثناء الحفظ المحلي: ' + err.message); }
        });
    }

    if (btnLocalBulkImport) {
        btnLocalBulkImport.addEventListener('click', async () => {
            const selected = localContainer.querySelectorAll('.local-lib-item-checkbox:checked');
            if (selected.length === 0) return;
            showToast(`⏳ جاري استيراد ${selected.length} تصميماً...`);
            let imported = 0;
            try {
                for (const cb of selected) {
                    const name = cb.dataset.name;
                    const handle = await window.workspaceHandle.getFileHandle(name);
                    const file = await handle.getFile();
                    const base64 = await new Promise(r => {
                        const reader = new FileReader();
                        reader.onload = () => r(reader.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    designQueue.push({ id: 'local_' + Date.now() + Math.random(), file: { name, type: file.type }, base64, status: 'idle', meta: null });
                    imported++;
                }
                renderQueue();
                document.getElementById('seo-queue-container')?.classList.remove('hidden');
                saveQueueToStorage();
                showToast('✅ تم الاستيراد بنجاح');
                if (selectAllLocal) selectAllLocal.checked = false;
                updateLocalLibBulkUI();
            } catch (err) { showToast('❌ فشل الاستيراد: ' + err.message); }
        });
    }
}

async function refreshLocalLibrary(helpers) {
    const container = document.getElementById('local-library-container');
    if (!container) return;
    if (!window.workspaceHandle) {
        container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">يرجى تفعيل المجلد المحلي أولاً</div>';
        return;
    }
    try {
        const permission = await window.workspaceHandle.queryPermission();
        if (permission !== 'granted') {
            container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">يرجى السماح بالصلاحية للمجلد المحلي</div>';
            return;
        }
        container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">⏳ جاري جلب الصور المحلية...</div>';
        const files = [];
        for await (const entry of window.workspaceHandle.values()) if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) files.push(entry);
        if (files.length === 0) {
            container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">المجلد المحلي لا يحتوي على صور حالياً</div>';
            return;
        }
        files.sort((a, b) => a.name.localeCompare(b.name));
        container.innerHTML = '';
        for (const fileHandle of files) {
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);
            const item = document.createElement('div');
            item.className = 'library-item';
            item.title = fileHandle.name;
            item.innerHTML = `<input type="checkbox" class="local-lib-item-checkbox" data-name="${fileHandle.name}"><img src="${url}" loading="lazy"><button class="local-lib-delete-btn" title="حذف من الجهاز">✕</button>`;

            const img = item.querySelector('img');
            img.onload = () => URL.revokeObjectURL(url);

            item.onclick = (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                const cb = item.querySelector('.local-lib-item-checkbox');
                cb.checked = !cb.checked;
                updateLocalLibBulkUI();
            };

            item.querySelector('.local-lib-item-checkbox').onchange = updateLocalLibBulkUI;
            item.querySelector('.local-lib-delete-btn').onclick = async (e) => {
                e.stopPropagation();
                if (!confirm(`حذف ${fileHandle.name}؟`)) return;
                try { await window.workspaceHandle.removeEntry(fileHandle.name); item.remove(); updateLocalLibBulkUI(); } catch (err) { helpers.showToast('❌ فشل الحذف'); }
            };
            container.appendChild(item);
        }
    } catch (e) { console.error('Local Lib Error:', e); }
}

function updateLocalLibBulkUI() {
    const btn = document.getElementById('btn-local-lib-bulk-import');
    const container = document.getElementById('local-library-container');
    if (!btn || !container) return;
    const checked = container.querySelectorAll('.local-lib-item-checkbox:checked').length;
    btn.style.display = checked > 0 ? 'flex' : 'none';
}

function setupCloudLibListeners(helpers) {
    const { showToast, designQueue, renderQueue, saveQueueToStorage } = helpers;
    const container = document.getElementById('library-container');
    const selectAll = document.getElementById('lib-select-all');
    const bulkBtn = document.getElementById('btn-lib-bulk-import');

    const updateBulkUI = () => {
        const checked = container.querySelectorAll('.lib-item-checkbox:checked').length;
        if (bulkBtn) bulkBtn.style.display = checked > 0 ? 'flex' : 'none';
        if (selectAll) selectAll.checked = checked === container.querySelectorAll('.lib-item-checkbox').length && checked > 0;
    };

    container.querySelectorAll('.library-item').forEach(item => {
        const cb = item.querySelector('.lib-item-checkbox');
        if (cb) cb.onchange = updateBulkUI;

        item.onclick = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            if (cb) { cb.checked = !cb.checked; updateBulkUI(); }
        };

        item.querySelector('.lib-delete-btn').onclick = async (e) => {
            e.stopPropagation();
            if (!confirm('حذف من السحابة؟')) return;
            const path = item.getAttribute('data-path');
            const sha = item.getAttribute('data-sha');
            item.style.opacity = '0.3';
            const res = await GitHubSync.deleteFile(path, sha);
            if (res && res.success) { item.remove(); updateBulkUI(); } else { showToast('❌ فشل الحذف'); item.style.opacity = '1'; }
        };
    });

    if (selectAll) selectAll.onclick = () => {
        container.querySelectorAll('.lib-item-checkbox').forEach(cb => cb.checked = selectAll.checked);
        updateBulkUI();
    };

    if (bulkBtn) bulkBtn.onclick = async () => {
        const selected = container.querySelectorAll('.lib-item-checkbox:checked');
        if (selected.length === 0) return;
        showToast(`⏳ جاري استيراد ${selected.length} تصاميماً سحابياً...`);
        const promises = Array.from(selected).map(async (cb) => {
            const gitUrl = cb.getAttribute('data-git-url');
            const name = cb.getAttribute('data-name').split('_').slice(1).join('_') || 'design.png';
            return new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'github_download', url: gitUrl, token: GitHubSync.config.token }, (res) => {
                    if (res && res.success && res.data?.content) {
                        designQueue.push({ id: 'lib_' + Date.now() + Math.random(), file: { name, type: 'image/png' }, base64: res.data.content.replace(/\n/g, ''), status: 'idle', meta: null });
                        resolve(true);
                    } else resolve(false);
                });
            });
        });
        await Promise.all(promises);
        renderQueue();
        document.getElementById('seo-queue-container')?.classList.remove('hidden');
        saveQueueToStorage();
        showToast('✅ تم استيراد الكل بنجاح');
    };
}
