// ══════════════════════════════════════════════════════
//  TAB MANAGEMENT
// ══════════════════════════════════════════════════════

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('tab-' + name);
  const panel = document.getElementById('panel-' + name);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');

  // Save active tab
  chrome.storage.local.set({ activeTab: name });

  // Focus specific panels or elements if needed
  if (name === 'teepublic') {
    const input = document.getElementById('tp-niches');
    if (input && !input.value) input.focus();
  }
}

// Make globally accessible
window.switchTab = switchTab;

document.addEventListener('DOMContentLoaded', () => {
  // Attach event listeners to all tab buttons
  document.getElementById('tab-trend')?.addEventListener('click', () => switchTab('trend'));
  document.getElementById('tab-uspto')?.addEventListener('click', () => switchTab('uspto'));
  document.getElementById('tab-teepublic')?.addEventListener('click', () => switchTab('teepublic'));
  document.getElementById('tab-seo')?.addEventListener('click', () => switchTab('seo'));
  document.getElementById('tab-note')?.addEventListener('click', () => switchTab('note'));
  document.getElementById('tab-lab')?.addEventListener('click', () => switchTab('lab'));
  document.getElementById('tab-autopilot')?.addEventListener('click', () => switchTab('autopilot'));
  document.getElementById('tab-studio')?.addEventListener('click', () => switchTab('studio'));
  document.getElementById('tab-admin')?.addEventListener('click', () => switchTab('admin'));

  // Restore active tab on load
  chrome.storage.local.get(['activeTab'], (res) => {
    const allowed = ['trend', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'admin', 'lab'];
    const active = allowed.includes(res.activeTab) ? res.activeTab : 'trend';
    switchTab(active);
  });
});
