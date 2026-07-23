// ══════════════════════════════════════════════════════
//  ████████  COMMON UTILS MODULE  ████████
// ══════════════════════════════════════════════════════

export function showToast(msg, ms = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), ms);
}

export function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = document.getElementById('tab-' + name);
    const panel = document.getElementById('panel-' + name);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
    chrome.storage.local.set({ activeTab: name });
}

export function parseNiches(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    return el.value.split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);
}

export function copyList(key, label) {
    chrome.storage.local.get(key, d => {
        const arr = d[key] || [];
        if (arr.length === 0) return showToast(`⚠️ القائمة ${label} فارغة`);
        navigator.clipboard.writeText(arr.join('\n'));
        showToast(`✅ تم نسخ ${arr.length} نيتش من ${label}`);
    });
}

export function exportTxt(content, filename) {
    const text = Array.isArray(content) ? content.join('\n') : content;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderList(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<div class="empty-msg">لا توجد نتائج</div>';
        return;
    }
    container.innerHTML = list.map(n => `
    <div class="result-item" style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px;">
      <span style="font-size:11px;">${n}</span>
      <i class="fa-regular fa-copy" style="cursor:pointer; opacity:0.5;" onclick="navigator.clipboard.writeText('${n.replace(/'/g, "\\'")}'); showToast('✅ تم النسخ')"></i>
    </div>
  `).join('');
}
