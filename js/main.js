/**
 * NICHE HUNTER PRO - MAIN ENTRY POINT
 * Initializes all modules and sets up global event listeners.
 */

import { debounce, showToast } from './utils.js';
import { switchTab, initCommonUI } from './ui.js';
import { initTrendModule } from './modules/trend.js';
import { initUSPTOModule, updateUSPTO } from './modules/uspto.js';
import { initTeePublicModule, updateTeePublic } from './modules/teepublic.js';
import { initSeoModule as initSEOModule } from '../modules/seo/seo.js';
import { initAuthModule, updateAuthUI } from './modules/auth.js';

// Setup global message listener
chrome.runtime.onMessage.addListener((req, sender) => {
    if (req.action === 'u_status' || req.action === 'u_tick') {
        updateUSPTO(req);
    } else if (req.action === 'tp_status' || req.action === 'tp_tick') {
        updateTeePublic(req);
    } else if (req.action === 'lib_refresh') {
        if (window.refreshLibrary) window.refreshLibrary();
    }
});

// Setup Cloud Sync Debounce
const backgroundSyncData = debounce(async (data) => {
    chrome.storage.local.get(['cloudSyncEnabled'], async (store) => {
        if (store.cloudSyncEnabled === false) return;

        if (typeof window.GitHubSync !== 'undefined' && window.GitHubSync.hasValidToken && window.GitHubSync.hasValidToken()) {
            try {
                chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], async (res) => {
                    const fullData = {
                        savedDesignQueue: res.savedDesignQueue || [],
                        ap_accounts: res.ap_accounts || [],
                        teepublic_manager_data: res.teepublic_manager_data || null,
                        usptoHistory: res.usptoHistory || {}
                    };
                    await window.GitHubSync.syncData(fullData);
                    console.log('Seamless Cloud Sync completed.');
                });
            } catch (e) {
                console.error('Cloud Sync failed:', e);
            }
        }
    });
}, 3000);

export async function autoSyncCloudData() {
    const store = await new Promise(r => chrome.storage.local.get(['cloudSyncEnabled'], r));
    if (store.cloudSyncEnabled === false) return;

    if (typeof window.GitHubSync === 'undefined' || typeof window.AuthManager === 'undefined') return;
    const user = await window.AuthManager.getCurrentUser();
    if (!user) return;

    console.log('🔄 Seamless Sync: Checking for cloud updates...');
    const cloudData = await window.GitHubSync.getData();
    if (!cloudData) return;

    chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], (local) => {
        let hasNewData = false;
        const update = {};

        // 1. Sync Designs
        if (cloudData.savedDesignQueue && cloudData.savedDesignQueue.length > 0) {
            const mergedQueue = [...(local.savedDesignQueue || [])];
            cloudData.savedDesignQueue.forEach(cloudItem => {
                if (!mergedQueue.some(localItem => localItem.id === cloudItem.id)) {
                    mergedQueue.push(cloudItem);
                    hasNewData = true;
                }
            });
            if (hasNewData) update.savedDesignQueue = mergedQueue;
        }

        // 2. Sync USPTO History
        if (cloudData.usptoHistory) {
            const mergedHistory = { ...(local.usptoHistory || {}), ...cloudData.usptoHistory };
            if (JSON.stringify(mergedHistory) !== JSON.stringify(local.usptoHistory)) {
                update.usptoHistory = mergedHistory;
                hasNewData = true;
            }
        }

        if (hasNewData) {
            chrome.storage.local.set(update, () => {
                console.log('✨ Seamless Sync: Local state updated from cloud.');
                showToast('🔄 تم مزامنة بيانات حسابك سحابياً');

                // Refresh UIs
                chrome.storage.local.get(null, (data) => {
                    updateUSPTO(data);
                    updateTeePublic(data);
                });
            });
        }
    });
}

// Make globally available
window.autoSyncCloudData = autoSyncCloudData;

function initApp() {
    console.log("NHP: Initializing App...");

    // Check Mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'tab') {
        document.body.classList.add('full-page');
        const expandBtn = document.getElementById('btnExpand');
        if (expandBtn) expandBtn.style.display = 'none';
    }

    // Restore Active Tab
    chrome.storage.local.get(['activeTab'], (res) => {
        const allowed = ['trend', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'admin', 'lab'];
        const active = allowed.includes(res.activeTab) ? res.activeTab : 'trend';
        switchTab(active);
    });

    // Init Modules
    try { initCommonUI(); } catch (e) { console.error('UI Init Failed:', e); }
    try { initTrendModule(); } catch (e) { console.error('Trend Init Failed:', e); }
    try { initUSPTOModule(); } catch (e) { console.error('USPTO Init Failed:', e); }
    try { initTeePublicModule(); } catch (e) { console.error('TeePublic Init Failed:', e); }
    try { initSEOModule(); } catch (e) { console.error('SEO Init Failed:', e); }
    try { initAuthModule(); } catch (e) { console.error('Auth Init Failed:', e); }

    // Start initial sync
    setTimeout(autoSyncCloudData, 1000); // Small delay to let GitHubSync/AuthManager init on window

    chrome.storage.local.get(null, (data) => {
        updateUSPTO(data);
        updateTeePublic(data);
        updateAuthUI();
    });

    // Real-time UI updates from background processes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(null, (data) => {
                updateUSPTO(data);
                updateTeePublic(data);
            });
        }
    });

    // Cloud Sync Toggle Listener
    const cloudSyncToggle = document.getElementById('toggle-cloud-sync');
    if (cloudSyncToggle) {
        chrome.storage.local.get(['cloudSyncEnabled'], (res) => {
            cloudSyncToggle.checked = res.cloudSyncEnabled !== false;
        });
        cloudSyncToggle.addEventListener('change', () => {
            const isEnabled = cloudSyncToggle.checked;
            chrome.storage.local.set({ cloudSyncEnabled: isEnabled }, () => {
                showToast(isEnabled ? '✅ تم تفعيل المزامنة السحابية' : '⚠️ تم تعطيل المزامنة السحابية');
                if (isEnabled) autoSyncCloudData();
            });
        });
    }
}

// Global bootstrap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
