// ══════════════════════════════════════════════════════
//  ████████  TEEPUBLIC AUTO-PILOT MODULE  ████████
// ══════════════════════════════════════════════════════

const AP = {
    email: document.getElementById('ap-email'),
    pass: document.getElementById('ap-pass'),
    proxy: document.getElementById('ap-proxy'),
    quota: document.getElementById('ap-quota'),
    nicheMap: document.getElementById('ap-niche-mapping'),
    addBtn: document.getElementById('ap-add-account'),
    list: document.getElementById('ap-accounts-list'),
    startBtn: document.getElementById('ap-start-btn'),
    designsPer: document.getElementById('ap-designs-per-account'),
    delay: document.getElementById('ap-delay'),
    progressPanel: document.getElementById('ap-status-panel'),
    progressBar: document.getElementById('ap-progress-bar'),
    progressText: document.getElementById('ap-progress-text'),
    progressPercent: document.getElementById('ap-progress-percent'),
    log: document.getElementById('ap-log'),
    proxyPool: document.getElementById('ap-proxy-pool'),
    autoRotate: document.getElementById('ap-auto-rotate'),
    togglePool: document.getElementById('toggle-proxy-pool'),
    poolWrap: document.getElementById('proxy-pool-wrap'),
    visualMode: document.getElementById('ap-visual-mode'),
    autoLogin: document.getElementById('ap-auto-login'),
    stopBtn: document.getElementById('ap-stop-btn'),
    // v13.0 — Ghost Server UI (سيتم حلها داخل initAutopilotModule بعد تحميل HTML)
    serverDot: null,
    serverStatusText: null,
    wakeupBtn: null,
    randomDistrib: null,
    editingId: null
};

// ══════════════════════════════════════════════════════
//  SERVER MONITOR — Ghost Server Status (ping /5s)
// ══════════════════════════════════════════════════════
let _serverMonitorTimer = null;

function setServerStatus(isOnline) {
    if (AP.serverDot) {
        AP.serverDot.style.background = isOnline
            ? 'radial-gradient(circle, #34d399, #059669)'
            : 'radial-gradient(circle, #f87171, #dc2626)';
        AP.serverDot.title = isOnline ? 'Ghost Server: Online ✅' : 'Ghost Server: Offline ❌';
    }
    if (AP.serverStatusText) {
        AP.serverStatusText.textContent = isOnline ? 'متصل' : 'غير متصل';
        AP.serverStatusText.style.color = isOnline ? '#34d399' : '#f87171';
    }
    if (AP.startBtn) {
        AP.startBtn.disabled = !isOnline;
        if (!isOnline) {
            AP.startBtn.title = '⚠️ Ghost Server غير متصل - شغّل السيرفر أولاً';
        } else {
            AP.startBtn.title = '';
        }
    }
}

function startServerMonitor() {
    if (_serverMonitorTimer) return;
    const check = async () => {
        try {
            const res = await fetch('http://127.0.0.1:3019/ping', {
                signal: AbortSignal.timeout(3000)
            });
            setServerStatus(res.ok);
        } catch {
            setServerStatus(false);
        }
    };
    check(); // فحص فوري عند البداية
    _serverMonitorTimer = setInterval(check, 5000);
}

function stopServerMonitor() {
    if (_serverMonitorTimer) { clearInterval(_serverMonitorTimer); _serverMonitorTimer = null; }
}

let autopilotAccounts = [];

export function apLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? 'var(--banned)' : (type === 'success' ? 'var(--safe)' : 'var(--text-muted)');
    const item = document.createElement('div');
    item.style.color = color;
    item.innerHTML = `<span style="opacity:0.5">[${time}]</span> ${msg}`;
    if (AP.log) AP.log.prepend(item);
}

export async function loadAPAccounts(existingData = null) {
    const res = existingData || await new Promise(r => chrome.storage.local.get(['ap_accounts', 'ap_proxy_pool', 'ap_auto_rotate', 'ap_visual_mode', 'ap_auto_login'], r));
    autopilotAccounts = res.ap_accounts || [];
    if (AP.proxyPool) AP.proxyPool.value = res.ap_proxy_pool || '';
    if (AP.autoRotate) AP.autoRotate.checked = res.ap_auto_rotate !== false;
    if (AP.visualMode) AP.visualMode.checked = res.ap_visual_mode !== false;
    if (AP.autoLogin) AP.autoLogin.checked = res.ap_auto_login !== false;
    renderAPAccounts();
}

function renderAPAccounts() {
    if (!AP.list) return;
    if (autopilotAccounts.length === 0) {
        AP.list.innerHTML = `<div class="text-center py-4 text-xs text-slate-500">لا توجد حسابات مضافة حالياً</div>`;
        return;
    }
    AP.list.innerHTML = autopilotAccounts.map((acc, index) => `
    <div class="flex items-center justify-between p-2 bg-surface2 border border-border rounded-lg user-select-none ap-acc-card" 
         draggable="true" data-index="${index}" data-id="${acc.id}" style="cursor: move;">
      <div class="flex items-center gap-2 overflow-hidden flex-1">
        <i class="fa-solid fa-grip-vertical text-[10px] text-slate-600 mr-1"></i>
        <input type="checkbox" class="ap-account-checkbox accent-primary" data-id="${acc.id}" ${acc.selected !== false ? 'checked' : ''} style="width:16px; height:16px;">
        <div class="truncate flex-1 cursor-pointer" onclick="this.previousElementSibling.click()">
          <div class="flex items-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full ${acc.verified ? 'bg-safe' : 'bg-warning'}"></div>
            <div class="text-[11px] font-bold text-white truncate">${acc.email}</div>
          </div>
          <div class="text-[9px] text-slate-400 font-mono flex items-center gap-1">
             <span class="text-primary">${acc.storeName || 'Store'}</span> 
             | <i class="fa-solid fa-list-ol text-[8px]"></i> Limit: ${acc.quota || 50}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="edit-ap-acc-btn text-slate-500 hover:text-primary p-1 px-2" data-id="${acc.id}">
          <i class="fa-solid fa-pen-to-square text-[10px]"></i>
        </button>
        <button class="remove-ap-acc-btn text-slate-500 hover:text-banned p-1 px-2" data-id="${acc.id}">
          <i class="fa-solid fa-trash-can text-[10px]"></i>
        </button>
      </div>
    </div>
  `).join('');
    setupAPDragDrop();
}

function setupAPDragDrop() {
    const cards = AP.list.querySelectorAll('.ap-acc-card');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.index);
            card.style.opacity = '0.4';
        });
        card.addEventListener('dragend', () => card.style.opacity = '1');
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(card.dataset.index);
            if (fromIndex !== toIndex) {
                const item = autopilotAccounts.splice(fromIndex, 1)[0];
                autopilotAccounts.splice(toIndex, 0, item);
                chrome.storage.local.set({ ap_accounts: autopilotAccounts }, renderAPAccounts);
            }
        });
    });
}

export function initAutopilotModule(helpers) {
    const { showToast, getDesignQueue } = helpers;

    // v13.0 — حل العناصر هنا بعد تحميل HTML الديناميكي
    AP.serverDot        = document.getElementById('ap-server-dot');
    AP.serverStatusText = document.getElementById('ap-server-status-text');
    AP.wakeupBtn        = document.getElementById('ap-wakeup-btn');
    AP.randomDistrib    = document.getElementById('ap-random-distribution');
    // تحديث باقي العناصر التي قد تتحمل ديناميكياً أيضاً
    AP.startBtn         = document.getElementById('ap-start-btn') || AP.startBtn;
    AP.stopBtn          = document.getElementById('ap-stop-btn')  || AP.stopBtn;
    AP.progressPanel    = document.getElementById('ap-status-panel') || AP.progressPanel;
    AP.progressBar      = document.getElementById('ap-progress-bar') || AP.progressBar;
    AP.progressPercent  = document.getElementById('ap-progress-percent') || AP.progressPercent;
    AP.progressText     = document.getElementById('ap-progress-text') || AP.progressText;
    AP.log              = document.getElementById('ap-log') || AP.log;

    loadAPAccounts();

    // v13.0 — تشغيل مراقب السيرفر فوراً بعد تهيئة عناصر DOM
    startServerMonitor();

    if (AP.togglePool) {
        AP.togglePool.addEventListener('click', () => {
            AP.poolWrap.classList.toggle('hidden');
            AP.togglePool.querySelector('i').classList.toggle('fa-chevron-up');
            AP.togglePool.querySelector('i').classList.toggle('fa-chevron-down');
        });
    }

    const saveProxySettings = () => {
        chrome.storage.local.set({
            ap_proxy_pool: AP.proxyPool.value,
            ap_auto_rotate: AP.autoRotate.checked,
            ap_visual_mode: AP.visualMode.checked,
            ap_auto_login: AP.autoLogin.checked
        });
    };

    if (AP.proxyPool) AP.proxyPool.addEventListener('input', saveProxySettings);
    if (AP.autoRotate) AP.autoRotate.addEventListener('change', saveProxySettings);
    if (AP.visualMode) AP.visualMode.addEventListener('change', saveProxySettings);
    if (AP.autoLogin) AP.autoLogin.addEventListener('change', saveProxySettings);

    if (AP.list) {
        AP.list.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-ap-acc-btn');
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                const acc = autopilotAccounts.find(a => a.id === id);
                if (acc) {
                    AP.email.value = acc.email || '';
                    AP.pass.value = acc.pass || '';
                    AP.proxy.value = acc.proxy || '';
                    AP.quota.value = acc.quota || 50;
                    if (AP.nicheMap) AP.nicheMap.value = acc.nicheMapping || 'all';
                    AP.editingId = id;
                    AP.addBtn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ التعديلات وتحديث الحساب';
                    AP.addBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
                    AP.email.focus();
                    AP.email.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    showToast('📝 وضع التعديل: قم بتغيير المعلومات واضغط حفظ');
                }
                return;
            }
            const delBtn = e.target.closest('.remove-ap-acc-btn');
            if (delBtn) {
                const id = delBtn.getAttribute('data-id');
                autopilotAccounts = autopilotAccounts.filter(a => a.id !== id);
                chrome.storage.local.set({ ap_accounts: autopilotAccounts }, renderAPAccounts);
                showToast('🗑️ تم إزالة الحساب من القائمة');
                return;
            }
            const checkbox = e.target.closest('.ap-account-checkbox');
            if (checkbox) {
                const id = checkbox.getAttribute('data-id');
                const acc = autopilotAccounts.find(a => a.id === id);
                if (acc) {
                    acc.selected = checkbox.checked;
                    chrome.storage.local.set({ ap_accounts: autopilotAccounts });
                }
            }
        });
    }

    if (AP.addBtn) {
        AP.addBtn.addEventListener('click', async () => {
            const email = AP.email.value.trim();
            const pass = AP.pass.value.trim();
            let proxy = AP.proxy.value.trim();
            const quota = AP.quota.value;
            const nicheMapping = AP.nicheMap.value;

            if (!email || !pass) return showToast('⚠️ يرجى إدخل البيانات كاملة');

            if (!proxy && AP.proxyPool.value) {
                const pool = AP.proxyPool.value.split('\n').map(p => p.trim()).filter(p => p);
                if (pool.length > 0) {
                    proxy = pool[Math.floor(Math.random() * pool.length)];
                    apLog(`🌐 تم تعيين بروكسي تلقائي من المخزن للحساب: ${email}`);
                }
            }

            AP.addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
            AP.addBtn.disabled = true;

            setTimeout(() => {
                const storeName = email.split('@')[0] + "_Store";
                if (AP.editingId) {
                    const accIndex = autopilotAccounts.findIndex(a => a.id === AP.editingId);
                    if (accIndex !== -1) {
                        autopilotAccounts[accIndex] = { ...autopilotAccounts[accIndex], email, pass, proxy, quota, nicheMapping, updatedAt: new Date().toISOString() };
                        showToast(`✅ تم تحديث بيانات المتجر بنجاح`);
                    }
                    AP.editingId = null;
                } else {
                    const newAcc = { id: Math.random().toString(36).substr(2, 9), email, pass, proxy, quota, nicheMapping, storeName, verified: true, addedAt: new Date().toISOString() };
                    autopilotAccounts.push(newAcc);
                    showToast(`✅ تم التحقق وإضافة متجر جديد: ${storeName}`);
                }
                chrome.storage.local.set({ ap_accounts: autopilotAccounts }, () => {
                    renderAPAccounts();
                    AP.email.value = ''; AP.pass.value = ''; AP.proxy.value = '';
                    AP.addBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> التحقق وحفظ الحساب المخصص';
                    AP.addBtn.style.background = ''; AP.addBtn.disabled = false;
                });
            }, 1000);
        });
    }

    if (AP.startBtn) {
        AP.startBtn.addEventListener('click', () => {
            const selectedAccounts = autopilotAccounts.filter(a => a.verified && a.selected !== false);
            const designs = getDesignQueue();
            if (selectedAccounts.length === 0) return showToast('⚠️ يرجى اختيار حساب واحد على الأقل من القائمة');
            if (designs.length === 0) return showToast('⚠️ القائمة فارغة! أضف تصاميم أولاً');

            const seoReadyDesigns = designs.filter(i => i.meta);
            if (seoReadyDesigns.length === 0) return showToast('⚠️ لم يتم توليد بيانات SEO لأي تصميم! يرجى تنفيذ التحليل الذكي في تبويب SEO AI أولاً.');

            if (seoReadyDesigns.length < designs.length) {
                if (!confirm(`سيتم رفع ${seoReadyDesigns.length} تصميم فقط (التي تحتوي على SEO). هل تريد المتابعة؟`)) return;
            }

            const actionType = document.querySelector('input[name="ap-action-type"]:checked')?.value || 'publish';
            const defaultColor = document.querySelector('input[name="seo-default-color"]:checked')?.value
                || document.querySelector('input[name="ap-default-color"]:checked')?.value
                || 'Black';

            // v13.0 — Ghost Server Edition Config
            const config = {
                accounts: selectedAccounts,
                countPer: parseInt(AP.designsPer?.value) || 5,
                delaySec: parseInt(AP.delay?.value) || 30,
                isVisual: AP.visualMode?.checked ?? false,
                actionType: actionType,
                defaultColor: defaultColor,
                isRandom: AP.randomDistrib?.checked ?? false // التوزيع العشوائي أو الدائري
            };

            if (AP.progressPanel) AP.progressPanel.classList.remove('hidden');
            AP.startBtn.disabled = true;
            if (AP.stopBtn) AP.stopBtn.classList.remove('hidden');
            if (AP.log) AP.log.innerHTML = '';

            const modeLabel = actionType === 'publish' ? 'نشر نهائي' : 'ملأ معلومات فقط';
            const distribLabel = config.isRandom ? 'عشوائي' : 'دائري';
            apLog(`🚀 Ghost Server | ${selectedAccounts.length} حسابات | وضع: ${modeLabel} | توزيع: ${distribLabel}`);

            chrome.runtime.sendMessage({ action: 'ap_start', data: config });
            showToast('🚀 Ghost Server انطلق! السيرفر يتولى العملية الآن.');
        });
    }

    // ── Wake Up Server Button ──
    if (AP.wakeupBtn) {
        AP.wakeupBtn.addEventListener('click', () => {
            apLog('🔌 جارٍ تشغيل Ghost Server...');
            showToast('⚡ جارٍ تشغيل Ghost Server...');

            // ✅ تفويض فتح البروتوكول للـ background.js لأنه يملك صلاحيات أكثر
            chrome.runtime.sendMessage({ action: 'wake_server' });

            // فحص بعد 6 ثواني والنافذة لا تزال مفتوحة
            setTimeout(async () => {
                try {
                    const res = await fetch('http://127.0.0.1:3000/ping', { signal: AbortSignal.timeout(3000) });
                    if (res.ok) {
                        setServerStatus(true);
                        apLog('✅ Ghost Server اتصل بنجاح!', 'success');
                        showToast('✅ Ghost Server جاهز!');
                    } else {
                        apLog('⚠️ السيرفر لم يستجب — انتظر قليلاً وحاول مجدداً', 'error');
                    }
                } catch {
                    apLog('❌ السيرفر لم يستجب بعد — تأكد من تثبيت البروتوكول أولاً', 'error');
                }
            }, 6000);
        });
    }

    if (AP.stopBtn) {
        AP.stopBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'ap_stop' });
            AP.stopBtn.classList.add('hidden');
            AP.startBtn.disabled = false;
            apLog('🛑 طلب إيقاف العملية يدوياً...');
        });
    }

    // Live Update Listener
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'ap_update') {
            if (msg.percent !== undefined) {
                AP.progressBar.style.width = `${msg.percent}%`;
                if (AP.progressPercent) AP.progressPercent.textContent = `${msg.percent}%`;
            }
            if (msg.current && msg.total) {
                AP.progressText.textContent = `${msg.current} / ${msg.total} Account`;
            }
            if (msg.log) apLog(msg.log, msg.type || 'info');
            if (msg.done) {
                AP.startBtn.disabled = false;
                if (AP.stopBtn) AP.stopBtn.classList.add('hidden');
                showToast('🎊 اكتملت جميع العمليات بنجاح!');
            }
        }
    });

    const btnExportAccs = document.getElementById('ap-export-accounts');
    if (btnExportAccs) {
        btnExportAccs.addEventListener('click', () => {
            if (autopilotAccounts.length === 0) return showToast('⚠️ لا توجد حسابات للتصدير');
            let content = "";
            autopilotAccounts.forEach(acc => {
                content += [acc.email || '', acc.pass || '', acc.proxy || 'no-proxy', acc.quota || 50, acc.storeName || 'Store'].join('|') + "\n";
            });
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `NHP_Accounts_${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            showToast('📤 تم تصدير الحسابات بصيغة TXT');
        });
    }

    const btnImportAccs = document.getElementById('ap-import-accounts');
    const importAccsInput = document.getElementById('ap-import-input');
    if (btnImportAccs) btnImportAccs.addEventListener('click', () => importAccsInput.click());
    if (importAccsInput) {
        importAccsInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    const lines = text.split(/\r?\n/).filter(line => line.trim());
                    const imported = [];
                    lines.forEach(line => {
                        const parts = line.split('|');
                        if (parts.length >= 2) {
                            imported.push({ id: Math.random().toString(36).substr(2, 9), email: parts[0].trim(), pass: parts[1].trim(), proxy: parts[2]?.trim() || '', quota: parts[3] ? parseInt(parts[3]) : 50, storeName: parts[4]?.trim() || 'Store', verified: true, addedAt: new Date().toISOString() });
                        }
                    });

                    chrome.storage.local.get(['ap_accounts'], (res) => {
                        const current = res.ap_accounts || [];
                        const merged = [...current];
                        let added = 0;
                        imported.forEach(acc => {
                            if (!merged.some(a => a.email.toLowerCase().trim() === acc.email.toLowerCase().trim())) {
                                merged.push(acc); added++;
                            }
                        });
                        chrome.storage.local.set({ ap_accounts: merged }, () => {
                            autopilotAccounts = merged; renderAPAccounts();
                            showToast(added > 0 ? `✅ تم استيراد ${added} حساب جديد بنجاح` : 'ℹ️ الحسابات موجودة بالفعل أو الملف فارغ');
                        });
                    });
                } catch (err) { showToast('❌ فشل الاستيراد'); }
                importAccsInput.value = '';
            };
            reader.readAsText(file);
        });
    }
}
