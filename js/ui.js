/**
 * NICHE HUNTER PRO - UI MANAGER
 * Handles tab switching, common UI buttons, and general startup.
 */

import { showToast } from './utils.js';

export function switchTab(name) {
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

// Make globally available for scripts that haven't been modularized yet
window.switchTab = switchTab;

export function initCommonUI() {
    // Pro Upgrade Btn
    document.getElementById('proUpgradeBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://maggouriverse.gumroad.com/l/yjgby' });
    });

    // Expand to Tab Mode Btn
    document.getElementById('btnExpand').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=tab') });
    });

    // Update Popup Btn
    document.getElementById('btnUpdatePopup')?.addEventListener('click', () => {
        location.reload();
    });

    // Reset All Data Btn
    document.getElementById('btnResetAll')?.addEventListener('click', () => {
        if (confirm('⚠️ هل أنت متأكد من أنك تريد مسح كافة البيانات وإعادة التعيين بشكل كامل؟\nلا يمكن التراجع عن هذه العملية.')) {
            chrome.storage.local.clear(() => {
                showToast('🔄 تم مسح كافة البيانات، جاري إعادة التشغيل...');
                setTimeout(() => location.reload(), 1500);
            });
        }
    });

    // Performance Mode Toggle (New Feature Idea)
    const perfToggle = document.getElementById('toggle-performance-mode');
    if (perfToggle) {
        chrome.storage.local.get(['performanceMode'], (res) => {
            perfToggle.checked = res.performanceMode === true;
            if (perfToggle.checked) document.body.classList.add('low-perf');
        });
        perfToggle.addEventListener('change', () => {
            chrome.storage.local.set({ performanceMode: perfToggle.checked }, () => {
                if (perfToggle.checked) document.body.classList.add('low-perf');
                else document.body.classList.remove('low-perf');
                showToast(perfToggle.checked ? '⚡ تم تفعيل وضع الاستهلاك المنخفض' : '🚀 تم العودة للوضع عالي الأداء');
            });
        });
    }

    // Tab Switching Init
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.id.replace('tab-', '');
            if (tabName) switchTab(tabName);
        });
    });
}

// Ensure function is globally available
window.switchTab = switchTab;
