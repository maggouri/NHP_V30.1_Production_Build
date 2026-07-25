/**
 * Admin Setup / التهيئة — step-by-step presentation wizard.
 */
const WIZARD_STEPS = [
    { id: 1, key: 'requirements', labelAr: 'المتطلبات', labelEn: 'Requirements' },
    { id: 2, key: 'data', labelAr: 'البيانات', labelEn: 'Data' },
    { id: 3, key: 'extension', labelAr: 'الإضافة', labelEn: 'Extension' },
    { id: 4, key: 'native', labelAr: 'Native', labelEn: 'Native' },
    { id: 5, key: 'services', labelAr: 'الخدمات', labelEn: 'Services' },
    { id: 6, key: 'ready', labelAr: 'جاهز', labelEn: 'Ready' }
];
const I18N = {
    advancedTools: { ar: 'أدوات متقدمة', en: 'Advanced Tools' },
    setupLog: { ar: 'سجل التهيئة', en: 'Setup Log' },
    logLead: { ar: 'سجل أحداث التهيئة في هذه الجلسة — مساعدة للتشخيص، وليس قفلاً.', en: 'Session setup events — diagnostic help, not a lock.' },
    logEmpty: { ar: 'لا توجد إدخالات بعد — نفّذ إجراءً أو حدّث الحالة لملء السجل.', en: 'No entries yet — run an action or refresh status to fill the log.' },
    helpBanner: {
        ar: 'التهيئة مساعدة اختيارية — الفحص قد يفشل حتى مع وجود الأدوات. يمكنك التأكيد والمتابعة أو القفز لأي خطوة.',
        en: 'Setup is optional help — detection can fail even when tools are installed. Acknowledge and continue, or jump to any step.'
    },
    ackTools: {
        ar: 'لديّ هذه الأدوات على جهازي — المتابعة مسموحة حتى لو فشل الفحص',
        en: 'I have these tools on my machine — continue is allowed even if detection fails'
    },
    step1Title: { ar: 'المتطلبات', en: 'Requirements' },
    step1Lead: {
        ar: 'فحص اختياري لـ Chrome و Node.js — قد يفشل الكشف حتى وهما مثبتان. أكّد يدوياً وتابع بحرية.',
        en: 'Optional Chrome/Node check — detection can fail even when installed. Acknowledge manually and continue freely.'
    },
    chromeHint: { ar: 'متصفح Chrome لتحميل الإضافة (مساعدة فقط)', en: 'Chrome browser to load the extension (help only)' },
    nodeHint: { ar: 'لتشغيل السيرفرات المحلية (مساعدة فقط)', en: 'To run local servers (help only)' },
    downloadChrome: { ar: 'تحميل Chrome', en: 'Download Chrome' },
    downloadNode: { ar: 'تحميل Node.js', en: 'Download Node.js' },
    step2Title: { ar: 'مجلد NHP_DATA', en: 'NHP_DATA folder' },
    step2Lead: { ar: 'أنشئ مجلد البيانات بجانب App Root لتخزين السجلات والإعدادات.', en: 'Create the data folder next to App Root for logs and settings.' },
    techDetails: { ar: 'تفاصيل تقنية', en: 'Technical details' },
    createData: { ar: 'إنشاء NHP_DATA', en: 'Create NHP_DATA' },
    openFolder: { ar: 'فتح المجلد', en: 'Open folder' },
    step3Title: { ar: 'تحميل الإضافة', en: 'Load extension' },
    step3Lead: { ar: 'حمّل الإضافة غير المعبأة في Chrome من مجلد App Root.', en: 'Load the unpacked extension in Chrome from App Root.' },
    extStep1: { ar: 'افتح chrome://extensions', en: 'Open chrome://extensions' },
    extStep2: { ar: 'فعّل Developer mode', en: 'Enable Developer mode' },
    extStep3: { ar: 'Load unpacked → اختر App Root', en: 'Load unpacked → select App Root' },
    copyPath: { ar: 'نسخ المسار', en: 'Copy path' },
    confirmExt: { ar: 'تم تحميل الإضافة', en: 'Extension loaded' },
    step4Title: { ar: 'Native Messaging', en: 'Native Messaging' },
    step4Lead: { ar: 'سجّل المضيف المحلي للتواصل بين الإضافة والسيرفرات.', en: 'Register the local host for extension ↔ server communication.' },
    registerNative: { ar: 'تسجيل Native', en: 'Register Native' },
    verifyNative: { ar: 'تحقق', en: 'Verify' },
    openManifest: { ar: 'موقع الملف', en: 'Open manifest' },
    step5Title: { ar: 'الخدمات', en: 'Services' },
    step5Lead: { ar: 'شغّل السيرفرات المحلية (8 خدمات).', en: 'Start local servers (8 services).' },
    showAllServices: { ar: 'عرض كل الخدمات', en: 'Show all services' },
    startAll: { ar: 'تشغيل الكل', en: 'Start all' },
    stopAll: { ar: 'إيقاف الكل', en: 'Stop all' },
    restartAll: { ar: 'إعادة التشغيل', en: 'Restart all' },
    checkPorts: { ar: 'فحص المنافذ', en: 'Check ports' },
    openLauncher: { ar: 'مجلد launcher', en: 'Open launcher folder' },
    step6Title: { ar: 'اكتملت التهيئة!', en: 'Setup complete!' },
    step6Lead: { ar: 'جهازك جاهز للعمل مع NHP — أو تابع لاحقاً متى شئت.', en: 'Your device is ready for NHP — or continue later anytime.' },
    goHome: { ar: 'الصفحة الرئيسية', en: 'Home' },
    goAdmin: { ar: 'مركز الإدارة', en: 'Admin Center' },
    copyReport: { ar: 'نسخ التقرير', en: 'Copy report' },
    restartWizard: { ar: 'إعادة المعالج', en: 'Restart wizard' },
    prev: { ar: 'السابق', en: 'Previous' },
    next: { ar: 'متابعة', en: 'Continue' },
    skipNow: { ar: 'تخطي الآن', en: 'Skip for now' },
    softHint: { ar: 'اختياري — يمكنك المتابعة أو التخطي', en: 'Optional — you can continue or skip' },
    advancedLead: { ar: 'تشغيل ملفات launcher مباشرة (FIRST_RUN، START_ALL، …)', en: 'Run launcher files directly (FIRST_RUN, START_ALL, …)' },
    firstRun: { ar: 'التشغيل الأول', en: 'First Run' },
    openLog: { ar: 'فتح السجل', en: 'Open log file' },
    clearView: { ar: 'مسح العرض', en: 'Clear view' },
    stepOf: { ar: 'الخطوة {n} من 6', en: 'Step {n} of 6' },
    subtitle: {
        ar: 'التهيئة مجال للمساعدة وليس للتعقيد — مرّ بحرية وتخطَّ ما تشاء',
        en: 'Setup is for help, not complexity — move freely and skip what you want'
    },
    title: { ar: '⚙️ التهيئة', en: '⚙️ Setup' },
    deviceReady: { ar: 'هذا الجهاز جاهز', en: 'This device is ready' },
    deviceReadyLead: { ar: 'حالة التهيئة تبدو مكتملة — يمكنك العودة لأي خطوة للمساعدة.', en: 'Setup looks complete — you can revisit any step for help.' },
    chromeOk: { ar: 'Chrome مثبت', en: 'Chrome installed' },
    chromeMissing: { ar: 'Chrome غير موجود (أو لم يُكتشف)', en: 'Chrome not found (or not detected)' },
    nodeOk: { ar: 'Node.js جاهز', en: 'Node.js ready' },
    nodeMissing: { ar: 'Node.js غير موجود (أو لم يُكتشف)', en: 'Node.js not found (or not detected)' },
    dataOk: { ar: 'NHP_DATA موجود', en: 'NHP_DATA exists' },
    dataMissing: { ar: 'NHP_DATA غير موجود', en: 'NHP_DATA missing' },
    nativeOk: { ar: 'Native مسجّل', en: 'Native registered' },
    nativeBad: { ar: 'Native غير مسجّل', en: 'Native not registered' },
    nativeStale: { ar: 'مسار Native قديم', en: 'Native path stale' },
    servicesOk: { ar: 'كل الخدمات تعمل', en: 'All services online' },
    servicesPartial: { ar: 'بعض الخدمات متوقفة', en: 'Some services offline' },
    extConfirmed: { ar: 'تم تأكيد تحميل الإضافة', en: 'Extension load confirmed' },
    extSkipped: { ar: 'تم تخطي خطوة الإضافة', en: 'Extension step skipped' },
    servicesSkipped: { ar: 'تم تخطي خطوة الخدمات', en: 'Services step skipped' },
    reqAcked: { ar: 'تم تأكيد وجود الأدوات يدوياً', en: 'Tools acknowledged manually' },
    run: { ar: 'تشغيل', en: 'Run' },
    copy: { ar: 'نسخ', en: 'Copy' },
    exists: { ar: 'موجود', en: 'exists' },
    missing: { ar: 'غير موجود', en: 'missing' },
    registering: { ar: 'جاري التسجيل…', en: 'Registering…' },
    needChromeNode: { ar: 'اختياري — أكّد الأدوات أو تابع', en: 'Optional — acknowledge tools or continue' },
    needData: { ar: 'اختياري — أنشئ NHP_DATA أو تخطَّ', en: 'Optional — create NHP_DATA or skip' },
    needExtConfirm: { ar: 'اختياري — أكّد أو تخطَّ', en: 'Optional — confirm or skip' },
    extLoadedOk: { ar: '✅ الإضافة محمّلة في Chrome', en: '✅ Extension loaded in Chrome' },
    extIdLabel: { ar: 'معرّف الإضافة', en: 'Extension ID' },
    extLoadedLead: { ar: 'أنت تعمل داخل الإضافة — لا حاجة لتحميلها يدوياً.', en: 'You are running inside the extension — no manual load needed.' },
    needNative: { ar: 'اختياري — سجّل Native أو تخطَّ', en: 'Optional — register Native or skip' },
    needServices: { ar: 'اختياري — شغّل الخدمات أو تخطَّ', en: 'Optional — start services or skip' }
};
let setupModuleInitialized = false;
let setupLastSnapshot = null;
let setupLogLines = [];
let setupShowToast = null;
let wizardCurrentStep = 1;
let wizardExtensionConfirmed = false;
let wizardExtensionSkipped = false;
let wizardServicesSkipped = false;
let wizardRequirementsAcked = false;
let wizardShowingCompleted = false;
let wizardTransitionLock = false;
let wizardRegisterLoading = false;
let wizardDirObserver = null;
let wizardOverlayHome = new Map();
function isExtensionContextLoaded() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) return true;
    } catch (_) { /* ignore */ }
    return typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
}
function getExtensionId() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) return chrome.runtime.id;
    } catch (_) { /* ignore */ }
    const match = typeof location !== 'undefined'
        ? location.href.match(/^chrome-extension:\/\/([^/]+)/)
        : null;
    return match ? match[1] : '';
}
function autoConfirmExtensionIfLoaded(options = {}) {
    if (!isExtensionContextLoaded()) return false;
    if (wizardExtensionConfirmed) return true;
    wizardExtensionConfirmed = true;
    wizardExtensionSkipped = false;
    if (!options.quiet) setupAppendLocalLog('AUTO extension loaded (chrome.runtime.id)');
    return true;
}
function setupIsRtl() {
    const root = document.getElementById('admin-setup-root');
    if (root?.getAttribute('dir')) return root.getAttribute('dir') === 'rtl';
    return document.documentElement.getAttribute('dir') !== 'ltr';
}
function setupT(ar, en) {
    return setupIsRtl() ? ar : en;
}
function setupI18n(key, vars = {}) {
    const entry = I18N[key];
    if (!entry) return key;
    let text = setupIsRtl() ? entry.ar : entry.en;
    Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
    });
    return text;
}
function applySetupI18n() {
    const root = document.getElementById('admin-setup-root');
    if (!root) return;
    root.setAttribute('dir', setupIsRtl() ? 'rtl' : 'ltr');
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        el.textContent = setupI18n(key);
    });
    const title = document.getElementById('wizard-title');
    const subtitle = document.getElementById('wizard-subtitle');
    if (title) title.textContent = setupI18n('title');
    if (subtitle) subtitle.textContent = setupI18n('subtitle');
    const ack = document.getElementById('wiz-req-ack');
    if (ack) ack.checked = wizardRequirementsAcked;
    renderSetupLogPreview();
    renderWizardStepper();
    updateWizardStepCounter();
    renderExtensionStepUI();
}
async function setupApi(endpoint, payload = {}) {
    return chrome.runtime.sendMessage({
        action: 'nhp_setup_api',
        endpoint,
        ...payload
    });
}
function renderSetupLogPreview() {
    const preview = document.getElementById('setup-log-preview');
    if (!preview) return;
    if (!setupLogLines.length) {
        preview.textContent = setupI18n('logEmpty');
        preview.classList.add('is-empty');
        return;
    }
    preview.textContent = setupLogLines.join('\n');
    preview.classList.remove('is-empty');
    preview.scrollTop = preview.scrollHeight;
}
function setupAppendLocalLog(line) {
    const ts = new Date().toISOString();
    setupLogLines.push(`[${ts}] ${line}`);
    if (setupLogLines.length > 200) setupLogLines.shift();
    renderSetupLogPreview();
}
async function setupRunLauncher(file, showToast) {
    setupAppendLocalLog(`RUN ${file}`);
    const res = await setupApi('run-launcher', { launcher: file });
    if (res?.success) {
        showToast?.(setupT(`✅ تم تشغيل ${file}`, `✅ Launched ${file}`));
    } else {
        showToast?.(setupT(`❌ ${res?.error || file}`, `❌ ${res?.error || file}`));
    }
    setupAppendLocalLog(res?.success ? `OK ${file}` : `FAIL ${file}: ${res?.error || ''}`);
    await setupRefreshStatus(showToast, { quiet: true });
    return res;
}
async function setupOpenPath(path, showToast) {
    if (!path) return;
    try {
        await chrome.runtime.sendMessage({
            action: 'nhp_setup_api',
            endpoint: 'append-log',
            message: `OPEN ${path}`
        });
    } catch (_) { /* ignore */ }
    try {
        await navigator.clipboard.writeText(path);
        showToast?.(setupT('📋 تم نسخ المسار — افتح Explorer يدوياً إن لزم', '📋 Path copied — open Explorer manually if needed'));
    } catch (_) {
        showToast?.(path);
    }
}
function isChromeRequirementMet(snapshot) {
    if (snapshot?.chrome?.found === true) return true;
    return isExtensionContextLoaded();
}
function isNodeRequirementMet(snapshot) {
    if (snapshot?.node?.found === true) return true;
    const services = snapshot?.services || [];
    return services.some((svc) => svc.online === true);
}
function getStepState(stepId, snapshot) {
    const snap = snapshot || setupLastSnapshot;
    if (!snap) return 'pending';
    switch (stepId) {
        case 1: {
            const ok = isNodeRequirementMet(snap) && isChromeRequirementMet(snap);
            if (ok) return 'complete';
            if (wizardRequirementsAcked) return 'warn';
            if (isNodeRequirementMet(snap) || isChromeRequirementMet(snap)) return 'warn';
            return 'fail';
        }
        case 2:
            return snap.dataRootExists ? 'complete' : 'fail';
        case 3:
            if (wizardExtensionConfirmed) return 'complete';
            if (wizardExtensionSkipped) return 'warn';
            return 'pending';
        case 4: {
            if (snap.native?.registered && !snap.native?.stale) return 'complete';
            if (snap.native?.stale) return 'warn';
            if (snap.native?.registered === false) return 'fail';
            return 'pending';
        }
        case 5: {
            if (wizardServicesSkipped) return 'warn';
            const services = snap.services || [];
            const online = services.filter((s) => s.online).length;
            if (services.length && online === services.length) return 'complete';
            if (online > 0) return 'warn';
            return 'pending';
        }
        case 6:
            return snap.overallState === 'ready' ? 'complete' : 'pending';
        default:
            return 'pending';
    }
}
function stepCanPass(stepId, snapshot) {
    const snap = snapshot || setupLastSnapshot;
    switch (stepId) {
        case 1:
            return (isNodeRequirementMet(snap) && isChromeRequirementMet(snap)) || wizardRequirementsAcked;
        case 2:
            return snap?.dataRootExists === true;
        case 3:
            return wizardExtensionConfirmed || wizardExtensionSkipped;
        case 4:
            return !!(snap?.native?.registered && !snap?.native?.stale);
        case 5: {
            if (wizardServicesSkipped) return true;
            const services = snap?.services || [];
            const online = services.filter((s) => s.online).length;
            return services.length > 0 && online === services.length;
        }
        case 6:
            return true;
        default:
            return false;
    }
}
function getContinueHint(stepId) {
    if (stepCanPass(stepId)) return '';
    switch (stepId) {
        case 1: return setupI18n('needChromeNode');
        case 2: return setupI18n('needData');
        case 3: return setupI18n('needExtConfirm');
        case 4: return setupI18n('needNative');
        case 5: return setupI18n('needServices');
        default: return setupI18n('softHint');
    }
}
function isSetupFullyReady(snapshot) {
    return snapshot?.overallState === 'ready';
}
function renderWizardStepper() {
    const nav = document.getElementById('wizard-stepper');
    if (!nav) return;
    nav.innerHTML = '';
    WIZARD_STEPS.forEach((step) => {
        const state = getStepState(step.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wizard-stepper-item';
        btn.dataset.step = String(step.id);
        btn.setAttribute('aria-label', setupT(step.labelAr, step.labelEn));
        if (state === 'complete') btn.classList.add('is-complete');
        if (step.id === wizardCurrentStep && !wizardShowingCompleted) btn.classList.add('is-current');
        if (state === 'warn') btn.classList.add('is-warn');
        if (state === 'fail') btn.classList.add('is-fail');
        const dotIcon = state === 'complete' ? '✅'
            : (state === 'fail' ? '❌' : (state === 'warn' ? '⚠️' : (step.id === wizardCurrentStep ? '●' : '○')));
        btn.innerHTML = `
            <span class="wizard-stepper-dot">${dotIcon}</span>
            <span class="wizard-stepper-label">${setupT(step.labelAr, step.labelEn)}</span>
        `;
        btn.addEventListener('click', () => {
            if (wizardShowingCompleted) {
                document.getElementById('wizard-completed-view')?.classList.add('wizard-hidden');
                document.getElementById('wizard-step-panel')?.classList.remove('wizard-hidden');
                wizardShowingCompleted = false;
            }
            goToWizardStep(step.id);
        });
        nav.appendChild(btn);
    });
}
function updateWizardStepCounter() {
    const el = document.getElementById('wizard-step-counter');
    const mobile = document.getElementById('wizard-stepper-mobile');
    const text = setupI18n('stepOf', { n: String(wizardCurrentStep) });
    if (el) el.textContent = text;
    if (mobile) {
        const step = WIZARD_STEPS.find((s) => s.id === wizardCurrentStep);
        mobile.textContent = `${text} — ${step ? setupT(step.labelAr, step.labelEn) : ''}`;
    }
}
function showWizardStepContent(stepId) {
    document.querySelectorAll('.wizard-step-content').forEach((el) => {
        el.classList.toggle('wizard-hidden', Number(el.dataset.step) !== stepId);
    });
}
async function goToWizardStep(stepId, options = {}) {
    if (wizardTransitionLock && !options.force) return;
    const target = Math.max(1, Math.min(6, stepId));
    if (target === wizardCurrentStep && !options.force) return;
    const panel = document.getElementById('wizard-step-panel');
    if (panel && !options.skipAnimation) {
        wizardTransitionLock = true;
        panel.classList.add('is-exiting');
        await new Promise((r) => setTimeout(r, 220));
        wizardCurrentStep = target;
        showWizardStepContent(target);
        panel.classList.remove('is-exiting');
        panel.classList.add('is-entering');
        requestAnimationFrame(() => {
            panel.classList.remove('is-entering');
            wizardTransitionLock = false;
        });
    } else {
        wizardCurrentStep = target;
        showWizardStepContent(target);
    }
    wizardShowingCompleted = false;
    document.getElementById('wizard-completed-view')?.classList.add('wizard-hidden');
    document.getElementById('wizard-step-panel')?.classList.remove('wizard-hidden');
    renderWizardStepper();
    updateWizardStepCounter();
    updateWizardNav();
    if (target === 3) renderExtensionStepUI();
}
function updateWizardNav() {
    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    const skipBtn = document.getElementById('btn-wizard-skip');
    const nav = document.querySelector('.wizard-nav');
    if (wizardShowingCompleted) {
        nav?.classList.add('wizard-hidden');
        return;
    }
    nav?.classList.remove('wizard-hidden');
    if (prevBtn) prevBtn.disabled = wizardCurrentStep <= 1;
    const canPass = stepCanPass(wizardCurrentStep);
    const hint = getContinueHint(wizardCurrentStep);
    if (nextBtn) {
        // Soft help: Continue is never hard-locked.
        nextBtn.disabled = wizardCurrentStep >= 6;
        nextBtn.title = hint || setupI18n('softHint');
        nextBtn.textContent = setupI18n('next');
        nextBtn.classList.toggle('wizard-hidden', wizardCurrentStep >= 6);
    }
    if (skipBtn) {
        const showSkip = wizardCurrentStep < 6 && !canPass;
        skipBtn.classList.toggle('wizard-hidden', !showSkip);
        skipBtn.textContent = setupI18n('skipNow');
    }
}
function showCompletedSummary(snapshot) {
    wizardShowingCompleted = true;
    document.getElementById('wizard-step-panel')?.classList.add('wizard-hidden');
    const view = document.getElementById('wizard-completed-view');
    view?.classList.remove('wizard-hidden');
    const title = document.getElementById('wizard-completed-title');
    const lead = document.getElementById('wizard-completed-lead');
    if (title) title.textContent = setupI18n('deviceReady');
    if (lead) lead.textContent = setupI18n('deviceReadyLead');
    renderChecklist(document.getElementById('wizard-completed-checklist'), snapshot);
    renderWizardStepper();
    updateWizardStepCounter();
    updateWizardNav();
}
function renderChecklist(container, snapshot) {
    if (!container) return;
    const snap = snapshot || setupLastSnapshot;
    const items = [];
    if (isChromeRequirementMet(snap)) items.push({ ok: true, text: setupI18n('chromeOk') });
    else items.push({ ok: false, text: setupI18n('chromeMissing') });
    if (isNodeRequirementMet(snap)) items.push({ ok: true, text: setupI18n('nodeOk') });
    else items.push({ ok: false, text: setupI18n('nodeMissing') });
    if (snap?.dataRootExists) items.push({ ok: true, text: setupI18n('dataOk') });
    else items.push({ ok: false, text: setupI18n('dataMissing') });
    if (snap?.native?.registered && !snap?.native?.stale) items.push({ ok: true, text: setupI18n('nativeOk') });
    else if (snap?.native?.stale) items.push({ ok: false, text: setupI18n('nativeStale') });
    else items.push({ ok: false, text: setupI18n('nativeBad') });
    const services = snap?.services || [];
    const online = services.filter((s) => s.online).length;
    if (services.length && online === services.length) items.push({ ok: true, text: setupI18n('servicesOk') });
    else items.push({ ok: false, text: setupI18n('servicesPartial') });
    if (wizardExtensionConfirmed) items.push({ ok: true, text: setupI18n('extConfirmed') });
    if (wizardExtensionSkipped) items.push({ ok: false, text: setupI18n('extSkipped') });
    if (wizardRequirementsAcked && !(isChromeRequirementMet(snap) && isNodeRequirementMet(snap))) {
        items.push({ ok: true, text: setupI18n('reqAcked') });
    }
    container.innerHTML = items.map((item) => `
        <div class="wizard-checklist-item">
            <span>${item.ok ? '✅' : '⚠️'}</span>
            <span>${item.text}</span>
        </div>
    `).join('');
}
function renderSetupServices(services = []) {
    const list = document.getElementById('setup-services-list');
    const summary = document.getElementById('wiz-services-summary');
    if (!list && !summary) return;
    const online = services.filter((s) => s.online).length;
    const total = services.length;
    const progressLabel = document.getElementById('wiz-services-progress-label');
    const progressFill = document.getElementById('wiz-services-progress-fill');
    if (progressLabel) progressLabel.textContent = `${online} / ${total}`;
    if (progressFill) progressFill.style.width = total ? `${(online / total) * 100}%` : '0%';
    const chipHtml = services.slice(0, 4).map((svc) => {
        const label = setupT(svc.labelAr || svc.labelEn, svc.labelEn || svc.labelAr);
        return `<span class="wizard-service-chip ${svc.online ? 'on' : 'off'}">${label}</span>`;
    }).join('');
    if (summary) {
        summary.innerHTML = chipHtml + (services.length > 4
            ? `<span class="wizard-service-chip">+${services.length - 4}</span>`
            : '');
    }
    if (list) {
        list.innerHTML = '';
        services.forEach((svc) => {
            const label = setupT(svc.labelAr || svc.labelEn, svc.labelEn || svc.labelAr);
            const chip = document.createElement('span');
            chip.className = `wizard-service-chip ${svc.online ? 'on' : 'off'}`;
            chip.textContent = `${label} :${svc.port}`;
            list.appendChild(chip);
        });
    }
}
function renderLauncherFiles(files = [], showToast) {
    const grid = document.getElementById('setup-launcher-files');
    if (!grid) return;
    grid.innerHTML = '';
    files.forEach((file) => {
        const card = document.createElement('div');
        card.className = 'wizard-file-card';
        const title = setupT(file.labelAr || file.file, file.labelEn || file.file);
        const existsLabel = file.exists === false
            ? setupI18n('missing')
            : (file.exists ? setupI18n('exists') : '—');
        card.innerHTML = `
            <div class="fname">${title}</div>
            <div class="fsub">${file.file} · ${existsLabel}</div>
            <div class="wizard-actions" style="margin-top:0">
                <button type="button" class="setup-file-run" data-file="${file.file}">${setupI18n('run')}</button>
                <button type="button" class="setup-file-copy" data-path="${file.path || ''}">${setupI18n('copy')}</button>
            </div>
        `;
        grid.appendChild(card);
    });
    grid.querySelectorAll('.setup-file-run').forEach((btn) => {
        btn.addEventListener('click', () => setupRunLauncher(btn.dataset.file, showToast));
    });
    grid.querySelectorAll('.setup-file-copy').forEach((btn) => {
        btn.addEventListener('click', () => setupOpenPath(btn.dataset.path, showToast));
    });
}
function setStatusPill(el, state, text) {
    if (!el) return;
    el.className = `status-pill ${state}`;
    el.textContent = text;
}
function renderExtensionStepUI(snapshot) {
    autoConfirmExtensionIfLoaded({ quiet: true });
    const loaded = wizardExtensionConfirmed || isExtensionContextLoaded();
    const manualSection = document.getElementById('wiz-ext-manual-section');
    const loadedBanner = document.getElementById('wiz-ext-loaded-banner');
    const extIdEl = document.getElementById('wiz-ext-id');
    const confirmBtn = document.getElementById('btn-setup-confirm-ext');
    const openExtBtn = document.getElementById('btn-setup-open-extensions');
    const stepLead = document.getElementById('wiz-ext-step-lead');
    if (manualSection) manualSection.classList.toggle('wizard-hidden', loaded);
    if (loadedBanner) loadedBanner.classList.toggle('wizard-hidden', !loaded);
    if (confirmBtn) confirmBtn.classList.toggle('wizard-hidden', loaded);
    if (openExtBtn) openExtBtn.classList.toggle('wizard-hidden', loaded);
    if (stepLead) {
        stepLead.textContent = loaded
            ? setupI18n('extLoadedLead')
            : setupI18n('step3Lead');
    }
    if (extIdEl) {
        const extId = getExtensionId();
        extIdEl.textContent = extId || '—';
    }
    setStatusPill(
        document.getElementById('wiz-ext-pill'),
        loaded ? 'ok' : 'warn',
        loaded ? setupI18n('extLoadedOk') : setupI18n('confirmExt')
    );
    renderWizardStepper();
    updateWizardNav();
}
function renderSetupSnapshot(snapshot) {
    setupLastSnapshot = snapshot;
    const chromeOk = isChromeRequirementMet(snapshot);
    const nodeOk = isNodeRequirementMet(snapshot);
    setStatusPill(
        document.getElementById('wiz-chrome-pill'),
        chromeOk ? 'ok' : 'bad',
        chromeOk ? setupI18n('chromeOk') : setupI18n('chromeMissing')
    );
    setStatusPill(
        document.getElementById('wiz-node-pill'),
        nodeOk ? 'ok' : 'bad',
        nodeOk ? setupI18n('nodeOk') : setupI18n('nodeMissing')
    );
    const dataOk = snapshot?.dataRootExists === true;
    setStatusPill(
        document.getElementById('wiz-data-pill'),
        dataOk ? 'ok' : 'bad',
        dataOk ? setupI18n('dataOk') : setupI18n('dataMissing')
    );
    const dataMsg = document.getElementById('wiz-data-message');
    if (dataMsg) {
        dataMsg.textContent = dataOk
            ? setupT('مجلد البيانات جاهز للاستخدام.', 'Data folder is ready.')
            : setupT('اضغط «إنشاء NHP_DATA» لإعداد المجلد.', 'Click "Create NHP_DATA" to set up the folder.');
    }
    const dataPath = document.getElementById('setup-data-path');
    if (dataPath) dataPath.textContent = snapshot?.dataRoot || setupT('غير معروف', 'Unknown');
    const appRootPath = document.getElementById('setup-app-root-path');
    if (appRootPath) appRootPath.textContent = snapshot?.appRoot || '—';
    renderExtensionStepUI(snapshot);
    const nativeOk = snapshot?.native?.registered && !snapshot?.native?.stale;
    const nativeStale = snapshot?.native?.stale;
    setStatusPill(
        document.getElementById('wiz-native-pill'),
        nativeOk ? 'ok' : (nativeStale ? 'warn' : 'bad'),
        nativeOk ? setupI18n('nativeOk') : (nativeStale ? setupI18n('nativeStale') : setupI18n('nativeBad'))
    );
    const nativeMsg = document.getElementById('wiz-native-message');
    if (nativeMsg) {
        if (nativeOk) nativeMsg.textContent = setupT('المضيف المحلي مسجّل ويعمل.', 'Local host is registered.');
        else if (nativeStale) nativeMsg.textContent = setupT('المسار قديم — أعد التسجيل.', 'Path is stale — re-register.');
        else nativeMsg.textContent = setupT('اضغط «تسجيل Native» للمتابعة.', 'Click "Register Native" to continue.');
    }
    const nativeDetail = document.getElementById('setup-native-detail');
    if (nativeDetail) {
        const lines = [];
        if (snapshot?.native?.registered) lines.push(setupT('مسجّل في Registry', 'Registered in Registry'));
        else lines.push(setupT('غير مسجّل', 'Not registered'));
        if (snapshot?.native?.stale) lines.push(setupT('⚠️ مسار قديم', '⚠️ Stale path'));
        if (snapshot?.native?.manifestPath) lines.push(snapshot.native.manifestPath);
        if (snapshot?.native?.error) lines.push(snapshot.native.error);
        nativeDetail.textContent = lines.join('\n') || '—';
    }
    renderSetupServices(snapshot?.services || []);
    const logPath = document.getElementById('setup-log-path');
    if (logPath) logPath.textContent = snapshot?.setupLogFile || 'NHP_DATA\\logs\\setup\\setup.log';
    const firstRunBtn = document.getElementById('btn-setup-first-run');
    // Soft help: First Run remains available; warn via toast if Node still undetected.
    if (firstRunBtn) firstRunBtn.disabled = false;
    const ack = document.getElementById('wiz-req-ack');
    if (ack) ack.checked = wizardRequirementsAcked;
    renderChecklist(document.getElementById('wizard-success-checklist'), snapshot);
    renderWizardStepper();
    updateWizardNav();
    // Do not auto-jump/trap the user on failing steps — setup is optional help.
    if (setupModuleInitialized && !wizardTransitionLock) {
        if (isSetupFullyReady(snapshot) && !wizardShowingCompleted && wizardCurrentStep < 6) {
            const stored = sessionStorage.getItem('nhp_wizard_force');
            if (!stored) {
                showCompletedSummary(snapshot);
            }
        }
    }
}
async function setupRefreshStatus(showToast, options = {}) {
    if (!options.quiet) setupAppendLocalLog(setupT('تحديث الحالة', 'Refresh status'));
    const snapshot = await setupApi('status', { forceRefresh: options.forceRefresh === true });
    if (!snapshot?.success) {
        showToast?.(setupT(`❌ ${snapshot?.error || 'فشل الفحص'}`, `❌ ${snapshot?.error || 'Status failed'}`));
        return null;
    }
    autoConfirmExtensionIfLoaded();
    renderSetupSnapshot(snapshot);
    const filesRes = await setupApi('launcher-files');
    if (filesRes?.success) renderLauncherFiles(filesRes.files || [], showToast);
    if (!options.quiet) setupAppendLocalLog(setupT('اكتمل التحديث', 'Refresh done'));
    return snapshot;
}
function mountWizardOverlay(overlay) {
    if (!overlay || !overlay.parentElement) return;
    if (!wizardOverlayHome.has(overlay.id)) {
        wizardOverlayHome.set(overlay.id, overlay.parentElement);
    }
    if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }
}
function restoreWizardOverlay(overlay) {
    if (!overlay) return;
    const home = wizardOverlayHome.get(overlay.id);
    if (home && overlay.parentElement !== home) {
        home.appendChild(overlay);
    }
}
function openAdvancedModal() {
    const overlay = document.getElementById('wizard-advanced-overlay');
    if (!overlay) return;
    mountWizardOverlay(overlay);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    setupAppendLocalLog('OPEN advanced tools');
}
function closeAdvancedModal() {
    const overlay = document.getElementById('wizard-advanced-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    restoreWizardOverlay(overlay);
}
function openLogDrawer() {
    const overlay = document.getElementById('wizard-log-overlay');
    if (!overlay) return;
    mountWizardOverlay(overlay);
    renderSetupLogPreview();
    const logPath = document.getElementById('setup-log-path');
    if (logPath) {
        logPath.textContent = setupLastSnapshot?.setupLogFile || 'NHP_DATA\\logs\\setup\\setup.log';
    }
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    setupAppendLocalLog('OPEN setup log panel');
    // Re-render after the open log entry so the panel shows content immediately.
    renderSetupLogPreview();
}
function closeLogDrawer() {
    const overlay = document.getElementById('wizard-log-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    restoreWizardOverlay(overlay);
}
async function copySetupReport(showToast) {
    const report = {
        at: new Date().toISOString(),
        snapshot: setupLastSnapshot,
        log: setupLogLines,
        wizard: {
            step: wizardCurrentStep,
            extensionConfirmed: wizardExtensionConfirmed,
            extensionSkipped: wizardExtensionSkipped,
            servicesSkipped: wizardServicesSkipped,
            requirementsAcked: wizardRequirementsAcked
        }
    };
    try {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        showToast?.(setupT('📋 تم نسخ التقرير', '📋 Report copied'));
    } catch (e) {
        showToast?.(e?.message || 'copy failed');
    }
}
function restartWizard() {
    sessionStorage.setItem('nhp_wizard_force', '1');
    wizardExtensionConfirmed = false;
    wizardExtensionSkipped = false;
    wizardServicesSkipped = false;
    wizardRequirementsAcked = false;
    wizardShowingCompleted = false;
    const ack = document.getElementById('wiz-req-ack');
    if (ack) ack.checked = false;
    autoConfirmExtensionIfLoaded({ quiet: true });
    goToWizardStep(1, { force: true, skipAnimation: true });
    document.getElementById('wizard-completed-view')?.classList.add('wizard-hidden');
    document.getElementById('wizard-step-panel')?.classList.remove('wizard-hidden');
    updateWizardNav();
}
function navigateToAdmin() {
    if (typeof window.NHP_switchAdminView === 'function') {
        window.NHP_switchAdminView('main');
    } else {
        window.location.hash = 'admin';
    }
}
function navigateToHome() {
    window.location.hash = '';
    const homeTab = document.querySelector('[data-tab="home"], #tab-home, .nav-home');
    homeTab?.click();
}
function markRequirementsAcked(checked) {
    wizardRequirementsAcked = !!checked;
    if (wizardRequirementsAcked) {
        setupAppendLocalLog('ACK tools available on machine');
    }
    renderWizardStepper();
    updateWizardNav();
}
function softSkipCurrentStep() {
    if (wizardCurrentStep === 1) {
        markRequirementsAcked(true);
        const ack = document.getElementById('wiz-req-ack');
        if (ack) ack.checked = true;
    } else if (wizardCurrentStep === 3) {
        wizardExtensionSkipped = true;
        setupAppendLocalLog('SKIP extension step');
    } else if (wizardCurrentStep === 5) {
        wizardServicesSkipped = true;
        setupAppendLocalLog('SKIP services step');
    } else {
        setupAppendLocalLog(`SKIP step ${wizardCurrentStep}`);
    }
    if (wizardCurrentStep < 6) goToWizardStep(wizardCurrentStep + 1);
}
function bindWizardNav(showToast) {
    document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
        if (wizardCurrentStep > 1) goToWizardStep(wizardCurrentStep - 1);
    });
    document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
        // Soft help: Continue always advances (no hard gate).
        if (wizardCurrentStep < 6) {
            if (wizardCurrentStep === 1 && !stepCanPass(1)) {
                markRequirementsAcked(true);
                const ack = document.getElementById('wiz-req-ack');
                if (ack) ack.checked = true;
            }
            setupAppendLocalLog(`CONTINUE step ${wizardCurrentStep} → ${wizardCurrentStep + 1}`);
            goToWizardStep(wizardCurrentStep + 1);
        }
    });
    document.getElementById('btn-wizard-skip')?.addEventListener('click', () => {
        softSkipCurrentStep();
    });
    document.getElementById('wiz-req-ack')?.addEventListener('change', (e) => {
        markRequirementsAcked(!!e.target?.checked);
    });
    document.getElementById('btn-setup-confirm-ext')?.addEventListener('click', () => {
        wizardExtensionConfirmed = true;
        wizardExtensionSkipped = false;
        setupAppendLocalLog('CONFIRM extension loaded');
        renderExtensionStepUI();
        showToast?.(setupT('✅ تم تأكيد تحميل الإضافة', '✅ Extension load confirmed'));
    });
    document.getElementById('btn-completed-restart')?.addEventListener('click', restartWizard);
    document.getElementById('btn-success-restart')?.addEventListener('click', restartWizard);
    document.getElementById('btn-completed-admin')?.addEventListener('click', navigateToAdmin);
    document.getElementById('btn-success-admin')?.addEventListener('click', navigateToAdmin);
    document.getElementById('btn-success-home')?.addEventListener('click', navigateToHome);
    document.getElementById('btn-completed-report')?.addEventListener('click', () => copySetupReport(showToast));
    document.getElementById('btn-success-report')?.addEventListener('click', () => copySetupReport(showToast));
    document.getElementById('btn-setup-advanced')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAdvancedModal();
    });
    document.getElementById('btn-advanced-close')?.addEventListener('click', closeAdvancedModal);
    document.getElementById('wizard-advanced-overlay')?.addEventListener('click', (e) => {
        if (e.target?.id === 'wizard-advanced-overlay') closeAdvancedModal();
    });
    document.getElementById('btn-setup-log-drawer')?.addEventListener('click', (e) => {
        e.preventDefault();
        openLogDrawer();
    });
    document.getElementById('btn-log-close')?.addEventListener('click', closeLogDrawer);
    document.getElementById('wizard-log-overlay')?.addEventListener('click', (e) => {
        if (e.target?.id === 'wizard-log-overlay') closeLogDrawer();
    });
    document.getElementById('btn-setup-clear-log-view')?.addEventListener('click', () => {
        setupLogLines = [];
        renderSetupLogPreview();
        showToast?.(setupT('تم مسح العرض', 'View cleared'));
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const logOpen = document.getElementById('wizard-log-overlay')?.classList.contains('is-open');
        const advOpen = document.getElementById('wizard-advanced-overlay')?.classList.contains('is-open');
        if (logOpen) closeLogDrawer();
        else if (advOpen) closeAdvancedModal();
    });
}
function bindSetupActions(showToast) {
    document.getElementById('btn-setup-refresh')?.addEventListener('click', () => {
        setupRefreshStatus(showToast, { forceRefresh: true });
    });
    document.getElementById('btn-setup-download-node')?.addEventListener('click', () => {
        const url = setupLastSnapshot?.downloads?.node || 'https://nodejs.org/';
        chrome.tabs.create({ url });
    });
    document.getElementById('btn-setup-download-chrome')?.addEventListener('click', () => {
        const url = setupLastSnapshot?.downloads?.chrome || 'https://www.google.com/chrome/';
        chrome.tabs.create({ url });
    });
    document.getElementById('btn-setup-init-data')?.addEventListener('click', async () => {
        setupAppendLocalLog('POST init-data');
        const res = await setupApi('init-data');
        showToast?.(res?.success
            ? setupT('✅ NHP_DATA جاهز', '✅ NHP_DATA ready')
            : setupT(`❌ ${res?.error || 'فشل'}`, `❌ ${res?.error || 'failed'}`));
        await setupRefreshStatus(showToast, { quiet: true });
    });
    document.getElementById('btn-setup-open-data')?.addEventListener('click', () => {
        setupOpenPath(setupLastSnapshot?.dataRoot, showToast);
    });
    document.getElementById('btn-setup-open-extensions')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions' });
    });
    document.getElementById('btn-setup-copy-app-root')?.addEventListener('click', async () => {
        const path = setupLastSnapshot?.appRoot || '';
        try {
            await navigator.clipboard.writeText(path);
            showToast?.(setupT('📋 تم نسخ App Root', '📋 App Root copied'));
        } catch (_) {
            showToast?.(path);
        }
    });
    document.getElementById('btn-setup-register-native')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (wizardRegisterLoading) return;
        wizardRegisterLoading = true;
        const prevText = btn.textContent;
        btn.disabled = true;
        btn.textContent = setupI18n('registering');
        setupAppendLocalLog('POST register-native');
        const res = await setupApi('register-native', { extensionId: chrome.runtime.id });
        showToast?.(res?.verified
            ? setupT('✅ Native Messaging مسجّل', '✅ Native Messaging registered')
            : setupT(`⚠️ ${res?.error || res?.registry?.error || 'تحقق يدوياً'}`, `⚠️ ${res?.error || res?.registry?.error || 'verify manually'}`));
        await setupRefreshStatus(showToast, { forceRefresh: true, quiet: true });
        btn.disabled = false;
        btn.textContent = prevText;
        wizardRegisterLoading = false;
    });
    document.getElementById('btn-setup-verify-native')?.addEventListener('click', async () => {
        const res = await chrome.runtime.sendMessage({ action: 'verify_nhp_native_host' });
        showToast?.(res?.success
            ? setupT('✅ Native يعمل', '✅ Native OK')
            : setupT(`❌ ${res?.nativeHost?.error || res?.error || ''}`, `❌ ${res?.nativeHost?.error || res?.error || ''}`));
        await setupRefreshStatus(showToast, { forceRefresh: true, quiet: true });
    });
    document.getElementById('btn-setup-open-native-manifest')?.addEventListener('click', () => {
        const p = setupLastSnapshot?.native?.manifestPath
            || (setupLastSnapshot?.appRoot ? `${setupLastSnapshot.appRoot}\\native-host\\com.nhp.server_launcher.json` : '');
        setupOpenPath(p, showToast);
    });
    document.getElementById('btn-setup-start-all')?.addEventListener('click', async () => {
        setupAppendLocalLog('POST start-all');
        const res = await setupApi('start-all');
        showToast?.(res?.success ? setupT('✅ START_ALL', '✅ START_ALL') : setupT(`❌ ${res?.error}`, `❌ ${res?.error}`));
        setTimeout(() => setupRefreshStatus(showToast, { quiet: true }), 5000);
    });
    document.getElementById('btn-setup-stop-all')?.addEventListener('click', async () => {
        await setupApi('stop-all');
        showToast?.(setupT('⏹ STOP_ALL', '⏹ STOP_ALL'));
        setTimeout(() => setupRefreshStatus(showToast, { quiet: true }), 2000);
    });
    document.getElementById('btn-setup-restart-all')?.addEventListener('click', async () => {
        await setupApi('restart-all');
        showToast?.(setupT('🔄 RESTART_ALL', '🔄 RESTART_ALL'));
        setTimeout(() => setupRefreshStatus(showToast, { quiet: true }), 5000);
    });
    document.getElementById('btn-setup-check-ports')?.addEventListener('click', () => {
        setupRunLauncher('CHECK_PORTS.cmd', showToast);
    });
    document.getElementById('btn-setup-open-launcher')?.addEventListener('click', () => {
        setupOpenPath(setupLastSnapshot?.launcherDir
            || (setupLastSnapshot?.appRoot ? `${setupLastSnapshot.appRoot}\\addon\\launcher` : ''), showToast);
    });
    document.getElementById('btn-setup-first-run')?.addEventListener('click', async () => {
        if (!isNodeRequirementMet(setupLastSnapshot) && !wizardRequirementsAcked) {
            showToast?.(setupT(
                '⚠️ لم يُكتشف Node.js — أكّد الأدوات إن كانت مثبتة، أو ثبّتها ثم أعد المحاولة',
                '⚠️ Node.js not detected — acknowledge tools if installed, or install then retry'
            ));
        }
        setupAppendLocalLog('POST first-run');
        const res = await setupApi('first-run', { extensionId: chrome.runtime.id });
        if (res?.blocked) {
            showToast?.(setupT(
                '⚠️ First Run لم يكتمل — راجع السجل أو أكّد Node يدوياً',
                '⚠️ First Run incomplete — check log or acknowledge Node manually'
            ));
        } else {
            showToast?.(res?.success
                ? setupT('✅ اكتمل First Run', '✅ First Run complete')
                : setupT('⚠️ First Run — راجع السجل', '⚠️ First Run — check log'));
        }
        if (Array.isArray(res?.report)) {
            res.report.forEach((row) => setupAppendLocalLog(`${row.ok ? 'OK' : 'FAIL'} ${row.step}: ${row.detail}`));
        }
        await setupRefreshStatus(showToast, { forceRefresh: true, quiet: true });
    });
    document.getElementById('btn-setup-copy-report')?.addEventListener('click', () => copySetupReport(showToast));
    document.getElementById('btn-setup-open-log')?.addEventListener('click', () => {
        setupOpenPath(setupLastSnapshot?.setupLogFile, showToast);
    });
}
function watchDirChanges() {
    if (wizardDirObserver) return;
    wizardDirObserver = new MutationObserver(() => {
        applySetupI18n();
    });
    wizardDirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
}
export async function initAdminSetupModule(helpers = {}) {
    if (setupModuleInitialized) {
        applySetupI18n();
        await setupRefreshStatus(helpers.showToast || setupShowToast, { forceRefresh: true });
        return;
    }
    setupModuleInitialized = true;
    setupShowToast = helpers.showToast || setupShowToast;
    const { showToast } = helpers;
    applySetupI18n();
    watchDirChanges();
    bindWizardNav(showToast);
    bindSetupActions(showToast);
    autoConfirmExtensionIfLoaded({ quiet: true });
    showWizardStepContent(1);
    renderWizardStepper();
    updateWizardStepCounter();
    updateWizardNav();
    renderSetupLogPreview();
    await setupRefreshStatus(showToast, { forceRefresh: true });
}
export function activateAdminSetupPanel() {
    applySetupI18n();
    setupRefreshStatus(typeof window.showToast === 'function' ? window.showToast : null, { forceRefresh: false }).catch(() => {});
}
window.NHP_activateAdminSetupPanel = activateAdminSetupPanel;
