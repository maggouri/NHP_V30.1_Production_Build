/**
 * NICHE HUNTER PRO - UTILS MODULE
 * Common helper functions used across the extension.
 */

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function showToast(msg, ms = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), ms);
}

// Make globally available if needed by non-module scripts
window.showToast = showToast;

export function parseNiches(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    return el.value
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);
}

export function renderList(arr, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!arr || arr.length === 0) {
        el.innerHTML = '<div class="empty-msg">لا توجد نتائج</div>';
        return;
    }

    el.innerHTML = '';
    arr.forEach((n, i) => {
        const div = document.createElement('div');
        div.className = 'card-item animate-scale-in';
        div.title = n;

        let badge = '';
        if (containerId === 'u-safeList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">SAFE</span>';
        if (containerId === 'u-bannedList') badge = '<span style="background:var(--banned); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">BANNED</span>';
        if (containerId === 'tp-excelList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">EXCELLENT</span>';
        if (containerId === 'tp-medList') badge = '<span style="background:var(--warning); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">AVERAGE</span>';

        div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i + 1}. ${n}</span>
        ${badge}
      </div>
    `;

        div.addEventListener('click', () => {
            navigator.clipboard.writeText(n).then(() => showToast(`✅ تم نسخ: ${n}`));
        });
        el.appendChild(div);
    });
    // Auto-scroll to bottom of list to see newest results if scrolling
    el.scrollTop = el.scrollHeight;
}

export function exportTxt(data, filename) {
    const content = Array.isArray(data) ? data.join('\n') : data;
    if (!content) { showToast('⚠️ لا توجد بيانات للتصدير'); return; }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('📥 تم التصدير بنجاح!');
}

export function copyList(storageKey, label) {
    chrome.storage.local.get(storageKey, d => {
        const arr = d[storageKey] || [];
        if (!arr.length) { showToast('⚠️ القائمة فارغة'); return; }
        navigator.clipboard.writeText(arr.join('\n'))
            .then(() => showToast(`✅ تم نسخ ${label} !`));
    });
}

export function formatNiches(inputId, countId) {
    const el = document.getElementById(inputId);
    if (!el) return;

    let text = el.value;

    // Step 1: CamelCase Split
    text = text.replace(/([a-z])([A-Z])/g, '$1\n$2');

    // Step 2: Cleanup
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Step 3: De-duplicate
    const seen = new Set();
    const unique = lines.filter(line => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    el.value = unique.join('\n');
    el.dispatchEvent(new Event('input'));
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = unique.length;
    showToast(`✅ تم تنظيم ${unique.length} نيتش!`);
}

export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

export async function createThumbnail(base64, maxWidth = 100) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compressed JPEG for thumb
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/png;base64,${base64}`;
    });
}

// Ensure functions are globally available
window.showToast = showToast;
window.debounce = debounce;
window.parseNiches = parseNiches;
window.renderList = renderList;
window.exportTxt = exportTxt;
window.copyList = copyList;
window.formatNiches = formatNiches;
window.fileToBase64 = fileToBase64;
window.createThumbnail = createThumbnail;
