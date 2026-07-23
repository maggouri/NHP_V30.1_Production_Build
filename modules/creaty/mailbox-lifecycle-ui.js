/**
 * EP-301C — Mailbox lifecycle wizard (Login → Domain → Create → Ready)
 * Consumes /api/mailbox-lifecycle/* on Creaty server (3020).
 */
import { resolveEmailCoreAuth, normalizeEmailCoreApiBase, fetchCreatyConnectionHealth, fetchMailboxLifecycleSession, EMAILCORE_KEYS } from './emailcore-library.js';
import { fetchDomainRegistrySnapshot } from './domain-source-service.js';
import {
  JOURNEY_STEPS,
  MAILBOX_LIFECYCLE_ACTIONS,
  MAILBOX_LIFECYCLE_STORAGE_KEYS,
  mapLifecycleError,
  validateManualMailboxInput,
  validateGenerateCount,
  resolveStepIndex,
  resolveVisibleStep,
  canUseMailboxLifecycleUi,
  canPerformLifecycleAction,
  resolveRoleLabelAr,
  shouldClearStaleMailboxWorkflow,
  buildLifecycleCapabilitiesForRole,
} from './mailbox-lifecycle-helpers.js';

export {
  JOURNEY_STEPS,
  MAILBOX_LIFECYCLE_ACTIONS,
  MAILBOX_LIFECYCLE_STORAGE_KEYS,
  mapLifecycleError,
  validateManualMailboxInput,
  validateGenerateCount,
  resolveStepIndex,
  resolveVisibleStep,
  canUseMailboxLifecycleUi,
  canPerformLifecycleAction,
  resolveRoleLabelAr,
  shouldClearStaleMailboxWorkflow,
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CREATY_SERVER_PORT = Number(globalThis.NhpRuntimeConfig?.PORTS?.creaty) || 3020;
const CREATY_SERVER_BASE = `http://127.0.0.1:${CREATY_SERVER_PORT}`;
const STORAGE_WORKFLOW_KEY = MAILBOX_LIFECYCLE_STORAGE_KEYS.workflowId;
const STORAGE_WORKFLOW_OWNER_KEY = MAILBOX_LIFECYCLE_STORAGE_KEYS.workflowOwnerUserId;

let uiHelpers = {};
let workflowId = '';
let workflow = null;
let domains = [];
let domainListHint = '';
let connection = null;
let loading = false;
let lastError = null;
let wired = false;
let identityGuardWired = false;
let sessionRole = '';
let sessionCapabilities = null;

async function readStoredWorkflowBinding() {
  if (typeof chrome?.storage?.local?.get !== 'function') {
    return { workflowId: '', ownerUserId: '' };
  }
  const data = await chrome.storage.local.get([STORAGE_WORKFLOW_KEY, STORAGE_WORKFLOW_OWNER_KEY]);
  return {
    workflowId: String(data[STORAGE_WORKFLOW_KEY] || '').trim(),
    ownerUserId: String(data[STORAGE_WORKFLOW_OWNER_KEY] || '').trim(),
  };
}

async function readStoredWorkflowId() {
  const binding = await readStoredWorkflowBinding();
  return binding.workflowId;
}

async function persistWorkflowId(id, ownerUserId = '') {
  workflowId = String(id || '').trim();
  const owner = String(ownerUserId || '').trim();
  if (typeof chrome?.storage?.local?.set === 'function') {
    const payload = { [STORAGE_WORKFLOW_KEY]: workflowId };
    if (owner) payload[STORAGE_WORKFLOW_OWNER_KEY] = owner;
    await chrome.storage.local.set(payload);
  }
}

async function clearStoredWorkflowId() {
  workflowId = '';
  workflow = null;
  connection = null;
  if (typeof chrome?.storage?.local?.remove === 'function') {
    await chrome.storage.local.remove([STORAGE_WORKFLOW_KEY, STORAGE_WORKFLOW_OWNER_KEY]);
  }
}

/** INT-006 Wave 2 (B3) — drop workflow binding when EmailCore userId no longer matches. */
async function clearStaleWorkflowIfNeeded(authUserId, { storedOwnerUserId = '', workflowOwnerUserId = '' } = {}) {
  if (!shouldClearStaleMailboxWorkflow({ authUserId, storedOwnerUserId, workflowOwnerUserId })) {
    return false;
  }
  await clearStoredWorkflowId();
  return true;
}

async function lifecycleFetch(path, { method = 'GET', body } = {}) {
  const auth = await resolveEmailCoreAuth();
  if (!auth.userId || !auth.token) {
    return { ok: false, status: 401, data: { ok: false, code: 'AUTH_REQUIRED', message: 'Missing credentials' } };
  }
  const url = new URL(`${CREATY_SERVER_BASE}${path}`);
  if (method === 'GET') {
    url.searchParams.set('userId', auth.userId);
    if (body?.apiBase) url.searchParams.set('apiBase', body.apiBase);
  }
  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        'content-type': 'application/json',
        'x-creaty-token': auth.token,
      },
      body: method === 'GET' ? undefined : JSON.stringify({
        ...(body || {}),
        userId: auth.userId,
      }),
    });
  } catch (_) {
    return {
      ok: false,
      status: 0,
      data: { ok: false, code: 'NETWORK', message: 'Network error', recoverable: true, retryable: true },
    };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function canUiAction(action) {
  if (!canUseMailboxLifecycleUi(sessionRole)) return false;
  if (sessionCapabilities && Object.prototype.hasOwnProperty.call(sessionCapabilities, action)) {
    return !!sessionCapabilities[action];
  }
  return canPerformLifecycleAction(sessionRole, action);
}

function renderRoleBanner() {
  const el = $('creaty-mbl-role-banner');
  if (!el) return;
  if (!sessionRole) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  const tone = sessionRole === 'Admin' ? 'admin' : 'user';
  el.className = `creaty-mbl-role-banner creaty-mbl-role-banner--${tone}`;
  el.innerHTML = `
    <span class="creaty-mbl-role-banner__label">الصلاحية:</span>
    <strong>${escapeHtml(resolveRoleLabelAr(sessionRole))}</strong>
    ${sessionRole === 'Admin' ? '<span class="creaty-mbl-role-banner__hint">يمكنك مراجعة سير عمل المستخدمين</span>' : ''}
  `;
}

function renderSupervisorBlockedPanel() {
  const root = $('creaty-col2-panel-mailbox-setup');
  if (!root) return;
  const panels = root.querySelectorAll('.creaty-mbl-panel');
  panels.forEach((panel) => { panel.hidden = true; });
  let blocked = $('creaty-mbl-panel-blocked');
  if (!blocked) {
    blocked = document.createElement('section');
    blocked.id = 'creaty-mbl-panel-blocked';
    blocked.className = 'creaty-mbl-panel creaty-mbl-panel--active';
    root.querySelector('.creaty-mbl-panels')?.appendChild(blocked);
  }
  blocked.hidden = false;
  blocked.classList.add('creaty-mbl-panel--active');
  blocked.innerHTML = `
    <h3 class="creaty-mbl-panel-title">صلاحية غير مدعومة في الواجهة</h3>
    <p class="creaty-mbl-panel-desc">${escapeHtml(mapLifecycleError({ code: 'ROLE_UI_BLOCKED' }).message)}</p>
  `;
  renderRoleBanner();
}

async function loadSessionContext() {
  const auth = await resolveEmailCoreAuth();
  if (!auth.userId || !auth.token) {
    sessionRole = '';
    sessionCapabilities = null;
    return { ok: false, data: { ok: false, code: 'AUTH_REQUIRED', message: 'Missing credentials' } };
  }
  try {
    const sessionData = await fetchMailboxLifecycleSession();
    if (!sessionData.ok || !sessionData.role) {
      sessionRole = '';
      sessionCapabilities = null;
      return { ok: false, data: { ok: false, code: 'AUTH_INVALID', message: 'Unable to resolve session from EmailCore' } };
    }
    sessionRole = sessionData.role;
    sessionCapabilities = buildLifecycleCapabilitiesForRole(sessionRole);
    renderRoleBanner();
    return { ok: true, data: { role: sessionRole, userId: sessionData.userId, ssot: sessionData.ssot } };
  } catch (err) {
    sessionRole = '';
    sessionCapabilities = null;
    const message = String(err?.message || err || 'Session fetch failed');
    if (/401|غير صالح|Invalid/i.test(message)) {
      return { ok: false, data: { ok: false, code: 'AUTH_INVALID', message } };
    }
    if (/403|Forbidden|صلاحية/i.test(message)) {
      return { ok: false, data: { ok: false, code: 'FORBIDDEN', message } };
    }
    return { ok: false, data: { ok: false, code: 'NETWORK', message, recoverable: true, retryable: true } };
  }
}

/** INT-006 Wave 3 (R9) — refresh identity from EmailCore SSOT before privileged mutations. */
async function ensureFreshSessionContext() {
  const session = await loadSessionContext();
  if (!session.ok) return session;
  const auth = await resolveEmailCoreAuth();
  if (session.data?.userId && auth.userId && session.data.userId !== auth.userId) {
    sessionRole = '';
    sessionCapabilities = null;
    return {
      ok: false,
      data: {
        ok: false,
        code: 'AUTH_INVALID',
        message: 'تعارض في الهوية — زامن بيانات الاتصال من لوحة الإدارة',
        nextAction: 'sync_credentials',
      },
    };
  }
  return session;
}

function setLoading(active, label = '') {
  loading = active;
  const el = $('creaty-mbl-loading');
  if (el) {
    el.hidden = !active;
    el.textContent = active ? (label || 'جارٍ التنفيذ…') : '';
  }
  document.querySelectorAll('.creaty-mbl-root button, .creaty-mbl-root input, .creaty-mbl-root select')
    .forEach((node) => {
      if (node.id === 'creaty-mbl-reset') return;
      if (loading) node.setAttribute('disabled', 'disabled');
      else node.removeAttribute('disabled');
    });
}

function setError(envelope) {
  lastError = envelope ? mapLifecycleError(envelope) : null;
  const box = $('creaty-mbl-error');
  if (!box) return;
  if (!lastError?.message) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <strong>${escapeHtml(lastError.message)}</strong>
    ${lastError.hint ? `<p class="creaty-mbl-error-hint">${escapeHtml(lastError.hint)}</p>` : ''}
    ${lastError.retryable ? '<button type="button" class="creaty-btn creaty-btn--ghost creaty-btn--compact" id="creaty-mbl-retry">إعادة المحاولة</button>' : ''}
  `;
  $('creaty-mbl-retry')?.addEventListener('click', () => {
    setError(null);
    void refreshMailboxLifecycleUi();
  });
}

function setStatus(text, tone = 'info') {
  const el = $('creaty-mbl-status');
  if (!el) return;
  el.className = `creaty-mbl-status creaty-mbl-status--${tone}`;
  el.textContent = text || '';
}

function renderStepper(currentStepId, authReady) {
  const nav = $('creaty-mbl-stepper');
  if (!nav) return;
  const visible = resolveVisibleStep(currentStepId, authReady);
  const currentIdx = resolveStepIndex(visible);
  nav.innerHTML = JOURNEY_STEPS.map((step, idx) => {
    let stateClass = 'creaty-mbl-step';
    if (idx < currentIdx) stateClass += ' creaty-mbl-step--done';
    else if (idx === currentIdx) stateClass += ' creaty-mbl-step--active';
    return `
      <li class="${stateClass}" aria-current="${idx === currentIdx ? 'step' : 'false'}">
        <span class="creaty-mbl-step__num">${idx + 1}</span>
        <span class="creaty-mbl-step__label">${escapeHtml(step.labelAr)}</span>
      </li>
    `;
  }).join('');
}

function renderAuthStep(auth) {
  const panel = $('creaty-mbl-panel-login');
  if (!panel) return;
  const ready = !!(auth?.userId && auth?.token);
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">تسجيل الدخول</h3>
    <p class="creaty-mbl-panel-desc">تحقق من بيانات الاتصال قبل بدء إعداد البريد.</p>
    <dl class="creaty-mbl-summary">
      <div><dt>User ID</dt><dd dir="ltr">${ready ? escapeHtml(auth.userId) : '—'}</dd></div>
      <div><dt>حالة الاتصال</dt><dd>${ready ? '<span class="creaty-mbl-pill creaty-mbl-pill--ok">متصل</span>' : '<span class="creaty-mbl-pill creaty-mbl-pill--warn">غير مكتمل</span>'}</dd></div>
    </dl>
    ${ready ? '' : '<p class="creaty-mbl-hint">افتح تبويب Email Library وأدخل User ID ورمز الوصول، ثم احفظ الاتصال.</p>'}
    <div class="creaty-mbl-actions">
      <button type="button" id="creaty-mbl-open-emailcore" class="creaty-btn creaty-btn--ghost">فتح إعدادات البريد</button>
    ${ready && canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN) ? '<button type="button" id="creaty-mbl-continue-domain" class="creaty-btn creaty-btn--primary">متابعة — اختيار النطاق</button>' : ''}
    ${ready && !canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN) ? '<p class="creaty-mbl-hint">لا تملك صلاحية متابعة إعداد البريد.</p>' : ''}
    </div>
  `;
  $('creaty-mbl-open-emailcore')?.addEventListener('click', () => {
    document.querySelector('[data-creaty-col2-tab="store"]')?.click();
  });
  $('creaty-mbl-continue-domain')?.addEventListener('click', () => {
    void goToDomainStep();
  });
}

function renderDomainStep() {
  const panel = $('creaty-mbl-panel-domain');
  if (!panel) return;
  const options = domains.length
    ? domains.map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('')
    : '<option value="">— لا توجد نطاقات —</option>';
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">اختيار النطاق</h3>
    <p class="creaty-mbl-panel-desc">حدد النطاق الذي سيُستخدم لعنوان البريد الجديد.</p>
    <div class="creaty-field">
      <label for="creaty-mbl-domain-select">النطاق</label>
      <select id="creaty-mbl-domain-select" class="creaty-input creaty-select" dir="ltr">${options}</select>
      ${domainListHint ? `<p class="creaty-mbl-hint">${escapeHtml(domainListHint)}</p>` : ''}
    </div>
    <div class="creaty-mbl-actions">
      ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_WORKFLOW) ? '<button type="button" id="creaty-mbl-start-workflow" class="creaty-btn creaty-btn--primary">تأكيد النطاق والمتابعة</button>' : '<p class="creaty-mbl-hint">لا تملك صلاحية بدء إعداد البريد.</p>'}
    </div>
  `;
  $('creaty-mbl-start-workflow')?.addEventListener('click', () => { void startWorkflow(); });
}

function renderCreateStep() {
  const panel = $('creaty-mbl-panel-create');
  if (!panel) return;
  const domain = workflow?.domain?.name || '';
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">إنشاء البريد</h3>
    <p class="creaty-mbl-panel-desc">النطاق المختار: <strong dir="ltr">${escapeHtml(domain)}</strong></p>
    <div class="creaty-mbl-create-grid">
      <section class="creaty-mbl-card">
        <h4>توليد تلقائي</h4>
        <div class="creaty-field">
          <label for="creaty-mbl-generate-count">العدد</label>
          <input type="number" id="creaty-mbl-generate-count" class="creaty-input" min="1" max="10" value="1">
        </div>
        <button type="button" id="creaty-mbl-generate" class="creaty-btn creaty-btn--primary" ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX) ? '' : 'hidden'}>توليد بريد</button>
      </section>
      <section class="creaty-mbl-card">
        <h4>بريد مخصص</h4>
        <div class="creaty-field">
          <label for="creaty-mbl-manual-email">العنوان</label>
          <input type="email" id="creaty-mbl-manual-email" class="creaty-input" dir="ltr" placeholder="name@${escapeHtml(domain)}" ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX) ? '' : 'disabled'}>
        </div>
        <button type="button" id="creaty-mbl-manual" class="creaty-btn creaty-btn--ghost" ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX) ? '' : 'hidden'}>إنشاء البريد المخصص</button>
      </section>
    </div>
  `;
  $('creaty-mbl-generate')?.addEventListener('click', () => { void createGeneratedMailbox(); });
  $('creaty-mbl-manual')?.addEventListener('click', () => { void createManualMailbox(); });
}

function renderValidationStep() {
  const panel = $('creaty-mbl-panel-validation');
  if (!panel) return;
  const address = workflow?.mailbox?.address || '—';
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">التحقق من البريد</h3>
    <p class="creaty-mbl-panel-desc">جارٍ التأكد من ظهور البريد في المكتبة: <strong dir="ltr">${escapeHtml(address)}</strong></p>
    <div class="creaty-mbl-actions">
      ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.VALIDATE_MAILBOX) ? '<button type="button" id="creaty-mbl-validate" class="creaty-btn creaty-btn--primary">التحقق من البريد</button>' : '<p class="creaty-mbl-hint">لا تملك صلاحية التحقق.</p>'}
    </div>
  `;
  $('creaty-mbl-validate')?.addEventListener('click', () => { void validateMailbox(); });
}

function renderCreatedStep() {
  const panel = $('creaty-mbl-panel-created');
  if (!panel) return;
  const mb = workflow?.mailbox || {};
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">تم إنشاء البريد</h3>
    <dl class="creaty-mbl-summary creaty-mbl-summary--card">
      <div><dt>البريد</dt><dd dir="ltr">${escapeHtml(mb.address || '—')}</dd></div>
      <div><dt>النطاق</dt><dd dir="ltr">${escapeHtml(workflow?.domain?.name || '—')}</dd></div>
      <div><dt>معرّف الجلسة</dt><dd dir="ltr">${escapeHtml(mb.sessionId || '—')}</dd></div>
      <div><dt>الحالة</dt><dd>${escapeHtml(mb.status || '—')}</dd></div>
    </dl>
    <div class="creaty-mbl-actions">
      ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_READ) ? '<button type="button" id="creaty-mbl-to-connection" class="creaty-btn creaty-btn--primary">متابعة — إعداد الاتصال</button>' : ''}
    </div>
  `;
  $('creaty-mbl-to-connection')?.addEventListener('click', () => { void loadConnectionSettings(); });
}

function renderConnectionStep() {
  const panel = $('creaty-mbl-panel-connection');
  if (!panel) return;
  const conn = connection || workflow?.connection || {};
  const verified = !!conn.verified;
  panel.innerHTML = `
    <h3 class="creaty-mbl-panel-title">إعداد الاتصال</h3>
    <p class="creaty-mbl-panel-desc">بيانات الاتصال الجاهزة للاستخدام مع الأتمتة.</p>
    <dl class="creaty-mbl-summary creaty-mbl-summary--card">
      <div><dt>API URL</dt><dd dir="ltr">${escapeHtml(conn.apiBase || '—')}</dd></div>
      <div><dt>User ID</dt><dd dir="ltr">${escapeHtml(conn.userId || '—')}</dd></div>
      <div><dt>البريد</dt><dd dir="ltr">${escapeHtml(conn.mailboxAddress || workflow?.mailbox?.address || '—')}</dd></div>
      <div><dt>التحقق</dt><dd>${verified ? '<span class="creaty-mbl-pill creaty-mbl-pill--ok">تم التحقق</span>' : '<span class="creaty-mbl-pill creaty-mbl-pill--warn">لم يُتحقق بعد</span>'}</dd></div>
    </dl>
    <div class="creaty-mbl-actions">
      ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_VERIFY) ? `<button type="button" id="creaty-mbl-verify-connection" class="creaty-btn creaty-btn--primary">${verified ? 'إعادة التحقق' : 'التحقق من الاتصال'}</button>` : ''}
      ${verified && canUiAction(MAILBOX_LIFECYCLE_ACTIONS.MARK_READY) ? '<button type="button" id="creaty-mbl-finish" class="creaty-btn creaty-btn--ghost">إتمام الإعداد</button>' : ''}
    </div>
  `;
  $('creaty-mbl-verify-connection')?.addEventListener('click', () => { void verifyConnectionSettings(); });
  $('creaty-mbl-finish')?.addEventListener('click', () => { void markWorkflowReady(); });
}

function renderReadyStep() {
  const panel = $('creaty-mbl-panel-ready');
  if (!panel) return;
  const mb = workflow?.mailbox || {};
  panel.innerHTML = `
    <div class="creaty-mbl-ready-banner" role="status">
      <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
      <div>
        <h3 class="creaty-mbl-panel-title">البريد جاهز للاستخدام</h3>
        <p class="creaty-mbl-panel-desc">يمكنك الآن استخدام <strong dir="ltr">${escapeHtml(mb.address || '')}</strong> في التسجيل والجدولة.</p>
      </div>
    </div>
    <ul class="creaty-mbl-next-steps">
      <li>افتح تبويب Email Library لمراجعة الرسائل.</li>
      <li>استخدم البريد في تدفق التسجيل والتفعيل.</li>
      <li>يمكنك بدء إعداد بريد جديد في أي وقت.</li>
    </ul>
    <div class="creaty-mbl-actions">
      <button type="button" id="creaty-mbl-open-library" class="creaty-btn creaty-btn--primary">فتح مكتبة البريد</button>
      ${canUiAction(MAILBOX_LIFECYCLE_ACTIONS.RESET_WORKFLOW) ? '<button type="button" id="creaty-mbl-reset" class="creaty-btn creaty-btn--ghost">بدء إعداد جديد</button>' : ''}
    </div>
  `;
  $('creaty-mbl-open-library')?.addEventListener('click', () => {
    document.querySelector('[data-creaty-col2-tab="store"]')?.click();
  });
  $('creaty-mbl-reset')?.addEventListener('click', () => { void resetWorkflow(); });
}

function showPanel(stepId) {
  $('creaty-mbl-panel-blocked')?.setAttribute('hidden', 'hidden');
  const panels = {
    LOGIN: 'creaty-mbl-panel-login',
    CHOOSE_DOMAIN: 'creaty-mbl-panel-domain',
    CREATE_MAILBOX: 'creaty-mbl-panel-create',
    VALIDATION: 'creaty-mbl-panel-validation',
    MAILBOX_CREATED: 'creaty-mbl-panel-created',
    CONNECTION_SETTINGS: 'creaty-mbl-panel-connection',
    READY: 'creaty-mbl-panel-ready',
  };
  Object.entries(panels).forEach(([step, id]) => {
    const el = $(id);
    if (!el) return;
    const active = step === stepId;
    el.hidden = !active;
    el.classList.toggle('creaty-mbl-panel--active', active);
  });
}

async function renderAll(auth) {
  const authReady = !!(auth?.userId && auth?.token);
  const step = authReady ? resolveVisibleStep(workflow?.step, true) : 'LOGIN';
  renderStepper(step, authReady);
  renderAuthStep(auth);
  if (authReady) {
    renderDomainStep();
    renderCreateStep();
    renderValidationStep();
    renderCreatedStep();
    renderConnectionStep();
    renderReadyStep();
  }
  showPanel(step);
}

async function goToDomainStep() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ تحميل النطاقات…');
  try {
    const snapshot = await fetchDomainRegistrySnapshot();
    if (!snapshot.ok) {
      setError(snapshot.error);
      return;
    }
    domains = Array.isArray(snapshot.eligibleDomains) ? snapshot.eligibleDomains : [];
    domainListHint = '';
    if (!domains.length) {
      if ((Number(snapshot.summary?.total) || 0) === 0) {
        domainListHint = 'لا توجد نطاقات مسجلة بعد.';
      } else {
        domainListHint = 'توجد نطاقات لكن لا يوجد نطاق مؤهل حالياً (مفعل + متحقق).';
      }
    }
    if (snapshot.role) sessionRole = String(snapshot.role).trim();
    if (snapshot.capabilities) sessionCapabilities = snapshot.capabilities;
    renderRoleBanner();
    workflow = workflow || { step: 'CHOOSE_DOMAIN' };
    showPanel('CHOOSE_DOMAIN');
    renderDomainStep();
    renderStepper('CHOOSE_DOMAIN', true);
    setStatus('اختر النطاق المناسب.', 'info');
  } finally {
    setLoading(false);
  }
}

async function startWorkflow() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_WORKFLOW)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  const select = $('creaty-mbl-domain-select');
  const domain = String(select?.value || '').trim();
  if (!domain) {
    setError({ code: 'DOMAIN_REQUIRED', message: 'Domain required' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ بدء الإعداد…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch('/api/mailbox-lifecycle/workflows', {
      method: 'POST',
      body: { domain, apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    await persistWorkflowId(workflow?.id, auth.userId);
    showPanel('CREATE_MAILBOX');
    renderCreateStep();
    renderStepper('CREATE_MAILBOX', true);
    setStatus('تم اختيار النطاق — أنشئ البريد الآن.', 'success');
    uiHelpers.showToast?.('تم اختيار النطاق', 'success');
  } finally {
    setLoading(false);
  }
}

async function createGeneratedMailbox() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  const check = validateGenerateCount($('creaty-mbl-generate-count')?.value);
  if (!check.ok) {
    setError({ code: 'MAILBOX_INVALID', message: check.message, recoverable: true });
    return;
  }
  if (!workflowId) {
    setError({ code: 'WORKFLOW_NOT_FOUND', message: 'No workflow' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ توليد البريد…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/generate`, {
      method: 'POST',
      body: { count: check.count, apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    showPanel('VALIDATION');
    renderValidationStep();
    renderStepper('VALIDATION', true);
    setStatus('تم إنشاء البريد — جارٍ التحقق…', 'success');
    uiHelpers.showToast?.('تم إنشاء البريد', 'success');
    await validateMailbox(true);
  } finally {
    setLoading(false);
  }
}

async function createManualMailbox() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  const domain = workflow?.domain?.name || '';
  const check = validateManualMailboxInput($('creaty-mbl-manual-email')?.value, domain);
  if (!check.ok) {
    setError({ code: 'MAILBOX_DOMAIN_MISMATCH', message: check.message, recoverable: true });
    return;
  }
  if (!workflowId) {
    setError({ code: 'WORKFLOW_NOT_FOUND', message: 'No workflow' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ إنشاء البريد…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/manual`, {
      method: 'POST',
      body: { email: check.email, apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    showPanel('VALIDATION');
    renderValidationStep();
    renderStepper('VALIDATION', true);
    setStatus('تم إنشاء البريد — جارٍ التحقق…', 'success');
    uiHelpers.showToast?.('تم إنشاء البريد', 'success');
    await validateMailbox(true);
  } finally {
    setLoading(false);
  }
}

async function validateMailbox(auto = false) {
  if (!auto) {
    const session = await ensureFreshSessionContext();
    if (!session.ok) {
      setError(session.data);
      return;
    }
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.VALIDATE_MAILBOX)) {
    if (!auto) setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  if (!workflowId) {
    setError({ code: 'WORKFLOW_NOT_FOUND', message: 'No workflow' });
    return;
  }
  if (!auto) setError(null);
  setLoading(true, auto ? 'جارٍ التحقق التلقائي…' : 'جارٍ التحقق…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/validate`, {
      method: 'POST',
      body: { apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      if (res.data?.retryable) setStatus('البريد لم يظهر بعد — يمكنك إعادة المحاولة.', 'warn');
      return;
    }
    workflow = res.data.workflow;
    showPanel('CONNECTION_SETTINGS');
    renderCreatedStep();
    renderConnectionStep();
    renderStepper('CONNECTION_SETTINGS', true);
    setStatus('تم التحقق — أكمل إعداد الاتصال.', 'success');
    uiHelpers.showToast?.('تم التحقق من البريد', 'success');
    await loadConnectionSettings(true);
  } finally {
    setLoading(false);
  }
}

async function loadConnectionSettings(silent = false) {
  if (!workflowId) return;
  if (!silent) setLoading(true, 'جارٍ تحميل إعدادات الاتصال…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/connection`, {
      method: 'GET',
      body: { apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      if (!silent) setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    connection = res.data.connection;
    showPanel('CONNECTION_SETTINGS');
    renderConnectionStep();
    renderStepper('CONNECTION_SETTINGS', true);
    if (!silent) setStatus('راجع إعدادات الاتصال ثم تحقق.', 'info');
  } finally {
    if (!silent) setLoading(false);
  }
}

async function verifyConnectionSettings() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_VERIFY)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  if (!workflowId) {
    setError({ code: 'WORKFLOW_NOT_FOUND', message: 'No workflow' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ التحقق من الاتصال…');
  try {
    const auth = await resolveEmailCoreAuth();
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/connection/verify`, {
      method: 'POST',
      body: { apiBase: normalizeEmailCoreApiBase(auth.apiBase) },
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    connection = res.data.connection;
    renderConnectionStep();
    setStatus('تم التحقق من الاتصال.', 'success');
    uiHelpers.showToast?.('تم التحقق من الاتصال', 'success');
  } finally {
    setLoading(false);
  }
}

async function markWorkflowReady() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.MARK_READY)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  if (!workflowId) {
    setError({ code: 'WORKFLOW_NOT_FOUND', message: 'No workflow' });
    return;
  }
  setError(null);
  setLoading(true, 'جارٍ إتمام الإعداد…');
  try {
    const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}/ready`, {
      method: 'POST',
      body: {},
    });
    if (!res.ok || res.data?.ok === false) {
      setError(res.data);
      return;
    }
    workflow = res.data.workflow;
    showPanel('READY');
    renderReadyStep();
    renderStepper('READY', true);
    setStatus('البريد جاهز للاستخدام.', 'success');
    uiHelpers.showToast?.('البريد جاهز', 'success');
  } finally {
    setLoading(false);
  }
}

async function loadExistingWorkflow() {
  const auth = await resolveEmailCoreAuth();
  const binding = await readStoredWorkflowBinding();
  if (!binding.workflowId) return false;

  if (await clearStaleWorkflowIfNeeded(auth.userId, { storedOwnerUserId: binding.ownerUserId })) {
    return false;
  }

  workflowId = binding.workflowId;
  const res = await lifecycleFetch(`/api/mailbox-lifecycle/workflows/${workflowId}`);
  if (!res.ok || res.data?.ok === false) {
    if (res.data?.code === 'FORBIDDEN' || res.status === 403) {
      await clearStoredWorkflowId();
      return false;
    }
    await clearStoredWorkflowId();
    return false;
  }
  workflow = res.data.workflow;
  if (await clearStaleWorkflowIfNeeded(auth.userId, {
    storedOwnerUserId: binding.ownerUserId,
    workflowOwnerUserId: workflow?.ownerUserId,
  })) {
    return false;
  }
  if (auth.userId && workflow?.id) {
    await persistWorkflowId(workflow.id, auth.userId);
  }
  if (workflow?.connection) connection = workflow.connection;
  return true;
}

/**
 * INT-003 visual-QA fix: CHOOSE_DOMAIN must always hydrate from Domain Source Service.
 * Previously only workflow-resume paths called goToDomainStep(); fresh auth / no-workflow
 * rendered an empty select while Quick Registry correctly showed summary.total.
 */
async function ensureDomainPickerHydrated(authReady) {
  if (!authReady) return;
  const step = resolveVisibleStep(workflow?.step, true);
  if (step === 'CHOOSE_DOMAIN' && !domains.length) {
    await goToDomainStep();
  }
}

async function resetWorkflow() {
  const session = await ensureFreshSessionContext();
  if (!session.ok) {
    setError(session.data);
    return;
  }
  if (!canUiAction(MAILBOX_LIFECYCLE_ACTIONS.RESET_WORKFLOW)) {
    setError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return;
  }
  await clearStoredWorkflowId();
  domains = [];
  domainListHint = '';
  lastError = null;
  setError(null);
  setStatus('');
  const auth = await resolveEmailCoreAuth();
  await renderAll(auth);
  await ensureDomainPickerHydrated(!!(auth?.userId && auth?.token));
  uiHelpers.showToast?.('تم بدء إعداد جديد', 'info');
}

export async function refreshMailboxLifecycleUi() {
  const root = $('creaty-col2-panel-mailbox-setup');
  if (!root || root.hidden) return;
  setLoading(true, 'جارٍ التحديث…');
  try {
    const auth = await resolveEmailCoreAuth();
    const authReady = !!(auth.userId && auth.token);
    if (authReady) {
      const session = await loadSessionContext();
      if (session.ok && !canUseMailboxLifecycleUi(sessionRole)) {
        renderSupervisorBlockedPanel();
        return;
      }
      if (!session.ok && session.data?.code === 'FORBIDDEN') {
        setError(session.data);
        return;
      }
    }
    if (workflowId || (await loadExistingWorkflow())) {
      await renderAll(auth);
      const step = resolveVisibleStep(workflow?.step, authReady);
      showPanel(step);
    } else {
      await renderAll(auth);
    }
    await ensureDomainPickerHydrated(authReady);
    renderRoleBanner();
  } finally {
    setLoading(false);
  }
}

function wireMailboxLifecycleUi() {
  if (wired) return;
  wired = true;
  $('creaty-mbl-refresh')?.addEventListener('click', () => { void refreshMailboxLifecycleUi(); });
}

/** INT-006 Wave 2 (B3) — clear workflow when Extension EmailCore userId changes in storage. */
function wireMailboxLifecycleIdentityGuard() {
  if (identityGuardWired) return;
  if (typeof chrome?.storage?.onChanged?.addListener !== 'function') return;
  identityGuardWired = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[EMAILCORE_KEYS.userId] && !changes[EMAILCORE_KEYS.token]) return;
    void (async () => {
      const auth = await resolveEmailCoreAuth();
      const binding = await readStoredWorkflowBinding();
      if (!binding.workflowId) return;
      if (await clearStaleWorkflowIfNeeded(auth.userId, { storedOwnerUserId: binding.ownerUserId })) {
        await renderAll(auth);
      }
    })();
  });
}

export async function initMailboxLifecycleUi(helpers = {}) {
  uiHelpers = helpers;
  wireMailboxLifecycleUi();
  wireMailboxLifecycleIdentityGuard();
  try {
    const health = await fetchCreatyConnectionHealth();
    if (health.online) {
      setStatus('خدمة إعداد البريد متاحة.', 'info');
    }
  } catch (_) {
    /* offline — banner handled by Creaty panel SSOT */
  }
  await refreshMailboxLifecycleUi();
}

export function activateMailboxLifecycleTab() {
  document.querySelector('[data-creaty-col2-tab="mailbox-setup"]')?.click();
}
