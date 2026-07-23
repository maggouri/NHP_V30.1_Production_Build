// ══════════════════════════════════════════════════════
//  ████████  SYNC MODULE (VERSION 2.0 - MODULAR)  ████████
// ══════════════════════════════════════════════════════

let browserSessionId = Math.random().toString(36).substr(2, 9);
let lastSmartSyncTime = 0;
let smartSyncInterval = null;
const SYNC_FILE_NAME = 'nhp_smart_sync.json';

export function initSyncModule(helpers) {
    const { showToast, renderQueue, loadAPAccounts, NC_INIT } = helpers;

    // Cloud Sync Toggle Initialization
    const cloudSyncToggle = document.getElementById('toggle-cloud-sync');
    if (cloudSyncToggle) {
        chrome.storage.local.get(['cloudSyncEnabled'], (res) => {
            cloudSyncToggle.checked = res.cloudSyncEnabled !== false;
        });
        cloudSyncToggle.addEventListener('change', () => {
            const isEnabled = cloudSyncToggle.checked;
            chrome.storage.local.set({ cloudSyncEnabled: isEnabled }, () => {
                showToast(isEnabled ? '✅ تم تفعيل المزامنة السحابية' : '⚠️ تم تعطيل المزامنة السحابية الذكية');
                if (isEnabled) autoSyncCloudData(helpers);
            });
        });
    }

    // Smart Sync Toggle Initialization
    const toggleSmartSync = document.getElementById('toggle-smart-sync');
    if (toggleSmartSync) {
        chrome.storage.local.get(['smartSyncEnabled'], (res) => {
            let enabled = res.smartSyncEnabled;
            if (typeof enabled === 'undefined') {
                enabled = true;
                chrome.storage.local.set({ smartSyncEnabled: true });
            }
            toggleSmartSync.checked = !!enabled;
            if (enabled) startSmartSyncPolling(helpers);
        });

        toggleSmartSync.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            chrome.storage.local.set({ smartSyncEnabled: enabled });
            if (enabled) {
                startSmartSyncPolling(helpers);
                showToast('🔄 تم تفعيل المزامنة الذكية');
            } else {
                stopSmartSyncPolling();
                showToast('⏸ تم إيقاف المزامنة الذكية');
            }
        });
    }

    // Unified Hybrid Sync: delegated to popup.js (single channel — avoids duplicate I/O).
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && typeof window.NHP_scheduleUnifiedSync === 'function') {
            window.NHP_scheduleUnifiedSync(changes);
        }
    });

    window.NHP_writeSmartSyncFile = writeSmartSyncFile;
    window.NHP_backgroundSyncData = () => backgroundSyncData({});

    // Run Auto-Sync on Launch
    setTimeout(() => autoSyncCloudData(helpers), 1500);
}

function debounce(func, wait) {
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

const backgroundSyncData = debounce(async (data) => {
    chrome.storage.local.get(['cloudSyncEnabled'], async (store) => {
        if (store.cloudSyncEnabled === false) return;

        if (typeof GitHubSync !== 'undefined' && GitHubSync.config.token !== 'YOUR_GITHUB_TOKEN') {
            try {
                chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], async (res) => {
                    const fullData = {
                        savedDesignQueue: res.savedDesignQueue || [],
                        ap_accounts: res.ap_accounts || [],
                        teepublic_manager_data: res.teepublic_manager_data || null,
                        usptoHistory: res.usptoHistory || {}
                    };
                    await GitHubSync.syncData(fullData);
                    console.log('Seamless Cloud Sync completed (Designs, Accounts, Notes, USPTO).');
                });
            } catch (e) {
                console.error('Cloud Sync failed:', e);
            }
        }
    });
}, 3000);

export async function autoSyncCloudData(helpers) {
    const { showToast, renderQueue, loadAPAccounts, NC_INIT } = helpers;
    const store = await new Promise(r => chrome.storage.local.get(['cloudSyncEnabled'], r));
    if (store.cloudSyncEnabled === false) return;

    if (typeof GitHubSync === 'undefined') return;
    const user = await AuthManager.getCurrentUser();
    if (!user) return;

    console.log('🔄 Seamless Sync: Checking for cloud updates...');
    const cloudData = await GitHubSync.getData();
    if (!cloudData) return;

    chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], (local) => {
        let hasNewData = false;
        const update = {};

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

        if (cloudData.ap_accounts && cloudData.ap_accounts.length > 0) {
            const mergedAccs = [...(local.ap_accounts || [])];
            cloudData.ap_accounts.forEach(cloudAcc => {
                if (!mergedAccs.some(localAcc => localAcc.email === cloudAcc.email)) {
                    mergedAccs.push(cloudAcc);
                    hasNewData = true;
                }
            });
            if (hasNewData) update.ap_accounts = mergedAccs;
        }

        if (cloudData.teepublic_manager_data) {
            const localNotes = local.teepublic_manager_data?.niches || [];
            const cloudNotes = cloudData.teepublic_manager_data?.niches || [];
            if (cloudNotes.length > localNotes.length) {
                update.teepublic_manager_data = cloudData.teepublic_manager_data;
                hasNewData = true;
            }
        }

        if (cloudData.usptoHistory) {
            const localHistory = local.usptoHistory || {};
            const cloudHistory = cloudData.usptoHistory;
            let historyChanged = false;
            for (const key in cloudHistory) {
                if (!localHistory[key]) {
                    localHistory[key] = cloudHistory[key];
                    historyChanged = true;
                }
            }
            if (historyChanged) {
                update.usptoHistory = localHistory;
                hasNewData = true;
            }
        }

        if (hasNewData) {
            chrome.storage.local.set(update, () => {
                console.log('✨ Seamless Sync: Local state updated from cloud.');
                showToast('🔄 تم مزامنة بيانات حسابك سحابياً بنجاح');
                if (update.savedDesignQueue && renderQueue) renderQueue();
                if (update.ap_accounts && loadAPAccounts) loadAPAccounts({ ap_accounts: update.ap_accounts });
                if (update.teepublic_manager_data && typeof NC_INIT === 'function') NC_INIT();
            });
        }
    });
}

function startSmartSyncPolling(helpers) {
    stopSmartSyncPolling();
    smartSyncInterval = setInterval(() => pollSmartSyncFile(helpers), 5000);
}

function stopSmartSyncPolling() {
    if (smartSyncInterval) {
        clearInterval(smartSyncInterval);
        smartSyncInterval = null;
    }
}

async function pollSmartSyncFile(helpers) {
    if (!window.workspaceHandle) return;
    try {
        const fileHandle = await window.workspaceHandle.getFileHandle(SYNC_FILE_NAME, { create: false });
        const file = await fileHandle.getFile();
        if (file.lastModified <= lastSmartSyncTime) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.sourceId === browserSessionId) {
            lastSmartSyncTime = file.lastModified;
            return;
        }
        console.log('🔄 Smart Sync: New data detected from another instance');
        mergeSmartSyncData(data, helpers);
        lastSmartSyncTime = file.lastModified;
    } catch (e) {
        if (e.name !== 'NotFoundError') console.error('Smart Sync Poll Error:', e);
    }
}

function mergeSmartSyncData(data, helpers) {
    const { renderQueue, loadAPAccounts, NC_INIT, showToast } = helpers;
    chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data'], (res) => {
        const currentQueue = res.savedDesignQueue || [];
        const currentAccs = res.ap_accounts || [];
        const currentNoteData = res.teepublic_manager_data || { niches: [], doneHistory: [], history: [] };
        let hasChanges = false;

        const newQueue = [...currentQueue];
        if (data.designs) {
            data.designs.forEach(item => {
                if (!newQueue.some(i => i.id === item.id)) { newQueue.push(item); hasChanges = true; }
            });
        }
        const newAccs = [...currentAccs];
        if (data.accounts) {
            data.accounts.forEach(acc => {
                if (!newAccs.some(a => a.email === acc.email)) { newAccs.push(acc); hasChanges = true; }
            });
        }
        const newNoteData = { ...currentNoteData };
        if (data.notes) {
            if (data.notes.niches) {
                data.notes.niches.forEach(n => {
                    if (!newNoteData.niches.some(en => en.text.toLowerCase() === n.text.toLowerCase())) {
                        newNoteData.niches.push(n); hasChanges = true;
                    }
                });
            }
            if (data.notes.doneHistory) {
                const mergedDone = [...new Set([...(newNoteData.doneHistory || []), ...data.notes.doneHistory])];
                if (mergedDone.length !== (newNoteData.doneHistory || []).length) {
                    newNoteData.doneHistory = mergedDone; hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            chrome.storage.local.set({
                savedDesignQueue: newQueue,
                ap_accounts: newAccs,
                teepublic_manager_data: newNoteData
            }, () => {
                if (renderQueue) renderQueue();
                if (loadAPAccounts) loadAPAccounts({ ap_accounts: newAccs });
                if (typeof NC_INIT === 'function') NC_INIT();
                showToast('✨ تم تحديث البيانات تلقائياً من المجلد المحلي');
            });
        }
    });
}

async function writeSmartSyncFile() {
    if (!window.workspaceHandle) return;
    chrome.storage.local.get(['smartSyncEnabled'], async (res) => {
        if (res.smartSyncEnabled === false) return;
        try {
            chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data'], async (res) => {
                const syncData = {
                    designs: res.savedDesignQueue || [],
                    accounts: res.ap_accounts || [],
                    notes: res.teepublic_manager_data || null,
                    sourceId: browserSessionId,
                    timestamp: new Date().toISOString()
                };
                const fileHandle = await window.workspaceHandle.getFileHandle(SYNC_FILE_NAME, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(syncData, null, 2));
                await writable.close();
                const file = await fileHandle.getFile();
                lastSmartSyncTime = file.lastModified;
            });
        } catch (e) {
            console.error('Smart Sync Write Error:', e);
        }
    });
}
