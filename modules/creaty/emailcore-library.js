import {
  escapeHtml,
  renderEmailBodyMarkup,
  formatMessageDate,
  buildReplySubject,
  buildQuotedReplyBody,
  stripHtml,
  detectTextDirection,
} from './emailcore-mail-render.js';

export const EMAILCORE_KEYS = {
  apiBase: 'emailcore_creaty_api_base',
  userId: 'emailcore_creaty_user_id',
  token: 'emailcore_creaty_token',
  sessionToken: 'emailcore_session_token',
  sessionUserId: 'emailcore_session_user_id',
  sessionUsername: 'emailcore_session_username',
  sessionRole: 'emailcore_session_role',
  sessionExpiresAt: 'emailcore_session_expires_at',
};
/** INT-006 Wave 1 — EmailCore SSOT path for Creaty connection state (transport-agnostic). */
export const CREATY_CONNECTION_HEALTH_PATH = '/connection-health';
/** INT-006 P1 — Extension → EmailCore heartbeat bridge path. */
export const CREATY_HEARTBEAT_PATH = '/heartbeat';
/** INT-007 Wave 1 — EmailCore SSOT path for AI settings bridge (token-scoped PULL). */
export const AI_SETTINGS_BRIDGE_PATH = '/ai-settings';
/** INT-006 Wave 3 (C2) — EmailCore SSOT path for mailbox lifecycle identity (Admin + Extension). */
export const MAILBOX_LIFECYCLE_SESSION_PATH = '/mailbox-lifecycle/session';
const KEYS = EMAILCORE_KEYS;
const DEFAULT_API_BASE = 'https://emailcore.app';
let messagesCache = [];
let sessionsCache = [];
let expandedMessageId = null;
let composeMode = 'new';
let composeReplyMessage = null;
const $ = (id) => document.getElementById(id);

export function normalizeEmailCoreApiBase(value = DEFAULT_API_BASE) {
  let base = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
  try {
    const url = new URL(base);
    if (url.hostname === 'www.emailcore.app') url.hostname = 'emailcore.app';
    base = url.origin;
  } catch (_) {
    /* keep raw */
  }
  return base;
}

function formatEmailCoreError(data = {}, status = 0) {
  const raw = String(data.error || data.message || '').trim();
  if (status === 401) {
    return raw || 'جلسة EmailCore غير صالحة — سجّل الدخول من مركز الإدارة → التكاملات';
  }
  if (status === 404) {
    if (/cannot post/i.test(raw)) {
      return 'مسار الإرسال غير متوفّر على الخادم — انشر آخر نسخة من EmailCore على emailcore.app';
    }
    return raw || 'المسار غير موجود على الخادم (404)';
  }
  if (status === 400) return raw || 'طلب غير صالح — تحقق من الحقول';
  if (status === 409) return raw || 'تعارض في البيانات';
  if (status >= 500) return raw || `خطأ في الخادم (HTTP ${status})`;
  return raw || `خطأ EmailCore (HTTP ${status || 'unknown'})`;
}

async function emailcoreFetchViaBackground({ apiBase, userId, token, sessionToken, path, method = 'GET', body }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'EMAILCORE_CREATY_API',
      apiBase,
      userId,
      token: sessionToken || token,
      sessionToken: sessionToken || token,
      path,
      method,
      body,
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'فشل طلب EmailCore'));
        return;
      }
      resolve(response.data);
    });
  });
}

function configFromStorage(stored = {}) {
  const sessionToken = String(stored[KEYS.sessionToken] || '').trim();
  const sessionUserId = String(stored[KEYS.sessionUserId] || '').trim();
  if (sessionToken && sessionUserId) {
    return {
      apiBase: normalizeEmailCoreApiBase(stored[KEYS.apiBase]),
      userId: sessionUserId,
      sessionToken,
      role: String(stored[KEYS.sessionRole] || 'member').trim(),
      username: String(stored[KEYS.sessionUsername] || '').trim(),
    };
  }
  return {
    apiBase: normalizeEmailCoreApiBase(stored[KEYS.apiBase]),
    userId: String(stored[KEYS.userId] || '').trim(),
    token: String(stored[KEYS.token] || '').trim(),
  };
}

export async function resolveEmailCoreAuth() {
  const stored = await chrome.storage.local.get(Object.values(KEYS));
  return configFromStorage(stored);
}

export async function hasEmailCoreCredentials() {
  const auth = await resolveEmailCoreAuth();
  return !!(auth.userId && (auth.sessionToken || auth.token));
}

const HEARTBEAT_SESSION_VALIDATE_MS = 30000;
let heartbeatSessionUserIdCache = { userId: '', checkedAt: 0 };

function authCredential(auth = {}) {
  return String(auth.sessionToken || auth.token || '').trim();
}

/** INT-006 P1 fix — ensure extension storage userId matches EmailCore session SSOT before heartbeat POST. */
export async function validateEmailCoreHeartbeatAuth() {
  const auth = await resolveEmailCoreAuth();
  if (!auth.userId || !authCredential(auth)) {
    return { ok: false, reason: 'missing_credentials' };
  }
  const storedUserId = String(auth.userId).trim();
  const now = Date.now();
  if (
    heartbeatSessionUserIdCache.userId
    && (now - heartbeatSessionUserIdCache.checkedAt) < HEARTBEAT_SESSION_VALIDATE_MS
  ) {
    if (String(heartbeatSessionUserIdCache.userId) !== storedUserId) {
      return {
        ok: false,
        reason: 'userId_mismatch_session',
        detail: `storage=${storedUserId} session=${heartbeatSessionUserIdCache.userId}`,
      };
    }
    return { ok: true, auth };
  }
  try {
    const session = await fetchMailboxLifecycleSession();
    const sessionUserId = String(session.userId || '').trim();
    heartbeatSessionUserIdCache = { userId: sessionUserId, checkedAt: now };
    if (sessionUserId && sessionUserId !== storedUserId) {
      return {
        ok: false,
        reason: 'userId_mismatch_session',
        detail: `storage=${storedUserId} session=${sessionUserId}`,
      };
    }
    return { ok: true, auth };
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[Creaty heartbeat] session SSOT check skipped:', err?.message || err);
    }
    return { ok: true, auth };
  }
}

export function clearHeartbeatSessionUserIdCache() {
  heartbeatSessionUserIdCache = { userId: '', checkedAt: 0 };
}

/** INT-006 Wave 3 (C2) — read identity session from EmailCore SSOT (same path as Web Admin). */
export async function fetchMailboxLifecycleSession() {
  const data = await emailcoreApiRequest(MAILBOX_LIFECYCLE_SESSION_PATH);
  return {
    ok: data?.ok !== false,
    role: String(data?.role || '').trim(),
    userId: String(data?.userId || '').trim(),
    source: String(data?.source || 'emailcore').trim(),
    ssot: String(data?.ssot || 'emailcore').trim(),
  };
}

/** INT-006 Wave 1 — read Creaty connection state from EmailCore SSOT (no client localhost probe). */
export async function fetchCreatyConnectionHealth() {
  const data = await emailcoreApiRequest(CREATY_CONNECTION_HEALTH_PATH);
  const conn = data?.connection || {};
  return {
    ok: data?.ok === true,
    online: !!conn.online,
    phase: String(conn.phase || 'IDLE').toUpperCase(),
    queueLength: Number(conn.queueLength) || 0,
    currentEmail: String(conn.currentEmail || '').trim(),
    lastHeartbeat: conn.lastHeartbeat || null,
    connected: conn.connected === true,
    stale: conn.stale === true,
    source: String(conn.source || 'heartbeat'),
    owner: String(conn.owner || 'emailcore'),
  };
}

/** INT-006 P1 — post local Creaty probe truth to EmailCore heartbeat store. */
export async function postCreatyHeartbeat({ connected, phase, queueLength, timestamp } = {}) {
  const authCheck = await validateEmailCoreHeartbeatAuth();
  if (!authCheck.ok) {
    const detail = authCheck.detail ? ` (${authCheck.detail})` : '';
    throw new Error(`${authCheck.reason}${detail}`);
  }
  return emailcoreApiRequest(CREATY_HEARTBEAT_PATH, {
    method: 'POST',
    body: {
      connected: !!connected,
      timestamp: timestamp || new Date().toISOString(),
      ...(phase ? { phase: String(phase).toUpperCase() } : {}),
      ...(queueLength != null ? { queueLength: Number(queueLength) || 0 } : {}),
    },
  });
}

export function isEmailCoreManagedEmail(email = '') {
  return String(email || '').trim().toLowerCase().endsWith('@emailcore.app');
}

function isLikelyLocalSessionId(sessionId, email = '') {
  const sid = String(sessionId || '').trim();
  if (!sid) return true;
  if (/^acc_/i.test(sid)) return true;
  const em = String(email || '').trim().toLowerCase();
  if (em && sid.toLowerCase() === em) return true;
  return false;
}

export async function emailcoreApiRequest(path, options = {}) {
  const auth = await resolveEmailCoreAuth();
  const credential = authCredential(auth);
  if (!auth.userId || !credential) throw new Error('سجّل الدخول من مركز الإدارة → التكاملات');
  const method = String(options.method || 'GET').toUpperCase();
  const apiPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;

  if (method !== 'GET' && typeof chrome?.runtime?.sendMessage === 'function') {
    try {
      return await emailcoreFetchViaBackground({
        apiBase: auth.apiBase,
        userId: auth.userId,
        sessionToken: auth.sessionToken,
        token: credential,
        path: apiPath,
        method,
        body: options.body,
      });
    } catch (bgErr) {
      const msg = String(bgErr?.message || bgErr);
      if (!/receiving end does not exist|could not establish connection/i.test(msg)) throw bgErr;
    }
  }

  const url = new URL(`${auth.apiBase}/api/creaty${apiPath}`);
  url.searchParams.set('userId', auth.userId);
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (auth.sessionToken) {
    headers['x-extension-session'] = auth.sessionToken;
  } else {
    headers['x-creaty-token'] = credential;
  }
  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body: options.body ? JSON.stringify({ ...options.body, userId: auth.userId }) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatEmailCoreError(data, response.status));
  return data;
}

/** GET /api/creaty/* with token+userId query (matches creaty-handlers creatyFetch). */
export async function emailcoreCreatyGet(pathAndQuery) {
  const auth = await resolveEmailCoreAuth();
  const credential = authCredential(auth);
  if (!auth.userId || !credential) throw new Error('سجّل الدخول من مركز الإدارة → التكاملات');
  const path = String(pathAndQuery || '').startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const url = new URL(`${auth.apiBase}/api/creaty${path}`);
  url.searchParams.set('userId', auth.userId);
  const headers = { Accept: 'application/json' };
  if (auth.sessionToken) {
    headers['x-extension-session'] = auth.sessionToken;
  } else {
    url.searchParams.set('token', credential);
    headers['x-creaty-token'] = credential;
  }
  const response = await fetch(url.toString(), { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatEmailCoreError(data, response.status));
  return data;
}

/** Fresh account row from EmailCore library or pipeline-phase (same sources as account import). */
export async function fetchEmailCoreAccountRemote(account = {}) {
  const email = String(account.email || account.display_email || '').trim().toLowerCase();
  const sessionId = String(account.emailcoreSessionId || account.sessionId || account.id || '').trim();
  const remoteSessionId = isLikelyLocalSessionId(sessionId, email) ? '' : sessionId;

  try {
    const data = await emailcoreApiRequest('/library/sessions');
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    let hit = remoteSessionId ? sessions.find((s) => String(s.id) === remoteSessionId) : null;
    if (!hit && email) {
      hit = sessions.find((s) => String(s.display_email || s.email || '').trim().toLowerCase() === email);
    }
    if (hit) return { source: 'library', session: hit };
  } catch (_) {
    /* fall through to pipeline-phase */
  }

  if (!email && !remoteSessionId) return null;
  const q = new URLSearchParams();
  if (remoteSessionId) q.set('sessionId', remoteSessionId);
  if (email) q.set('email', email);
  try {
    const data = await emailcoreCreatyGet(`/pipeline-phase?${q.toString()}`);
    if (data && typeof data === 'object' && Object.keys(data).length) {
      return { source: 'pipeline', session: data };
    }
  } catch (_) {
    return null;
  }
  return null;
}

function status(message, level = '') {
  const el = $('creaty-emailcore-status');
  if (!el) return;
  el.textContent = message;
  el.className = `creaty-store-hint${level ? ` creaty-store-hint--${level}` : ''}`;
}

async function request(path, options = {}) {
  return emailcoreApiRequest(path, options);
}

function renderSessions(sessions = []) {
  sessionsCache = sessions;
  const tbody = $('creaty-emailcore-sessions');
  if (!tbody) return;
  tbody.innerHTML = sessions.length ? sessions.map((session) => {
    const email = escapeHtml(session.display_email || session.email || '');
    return `<tr><td dir="ltr">${email}</td><td>${Number(session.message_count) || 0}</td><td>${escapeHtml(session.teepublic_status || 'normal')}</td><td><button class="creaty-row-action-btn creaty-row-action-btn--primary" data-emailcore-add="${escapeHtml(session.id)}" data-email="${email}" type="button" style="margin-inline-end: 4px; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.25); color: #34d399; padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">إضافة</button><button class="creaty-row-action-btn creaty-row-action-btn--danger" data-emailcore-delete="${escapeHtml(session.id)}" data-email="${email}" type="button" style="padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">حذف</button></td></tr>`;
  }).join('') : '<tr><td colspan="4">لا توجد حسابات بعد.</td></tr>';
}

function messagePreviewText(message = {}) {
  const text = String(message.body_text || '').trim() || stripHtml(message.body_html || '');
  return text.slice(0, 180);
}

function renderMessageCard(message) {
  const id = String(message.id || '');
  const expanded = expandedMessageId === id;
  const code = escapeHtml(message.verificationCode || '');
  const recipient = escapeHtml(message.recipient_addr || message.session_email || '');
  const fromAddr = escapeHtml(message.from_addr || '');
  const subject = escapeHtml(message.subject || '(بدون عنوان)');
  const date = escapeHtml(formatMessageDate(message.received_at));
  const preview = escapeHtml(messagePreviewText(message));
  const dir = detectTextDirection(`${message.subject || ''}\n${message.body_text || ''}`);
  const bodyMarkup = expanded ? `
    <div class="creaty-emailcore-message__body">
      <div class="creaty-emailcore-message__from" dir="ltr">${fromAddr} → ${recipient}</div>
      ${renderEmailBodyMarkup(message)}
      <div class="creaty-emailcore-message__actions">
        <button type="button" class="creaty-btn creaty-btn--primary creaty-btn--compact" data-emailcore-reply="${escapeHtml(id)}">رد</button>
        ${code ? `<button type="button" class="creaty-btn creaty-btn--ghost creaty-btn--compact" data-copy-code="${code}">نسخ الكود ${code}</button>` : ''}
      </div>
    </div>` : (preview ? `<div class="creaty-emailcore-message__preview" dir="${dir}">${preview}</div>` : '');

  return `<article class="creaty-emailcore-message${expanded ? ' creaty-emailcore-message--expanded' : ''}" data-message-id="${escapeHtml(id)}">
    <div class="creaty-emailcore-message__header" role="button" tabindex="0" data-emailcore-toggle="${escapeHtml(id)}" aria-expanded="${expanded ? 'true' : 'false'}">
      <span class="creaty-emailcore-badge">${escapeHtml(message.category || 'Other')}</span>
      <div class="creaty-emailcore-message__meta">
        <div class="creaty-emailcore-message__subject" dir="${dir}">${subject}</div>
        <div class="creaty-emailcore-message__from" dir="ltr">${fromAddr || recipient}</div>
      </div>
      <span class="creaty-emailcore-message__date">${date}</span>
    </div>
    ${bodyMarkup}
  </article>`;
}

function renderMessages() {
  const root = $('creaty-emailcore-messages');
  if (!root) return;
  const category = $('creaty-emailcore-category')?.value || 'all';
  const rows = category === 'all' ? messagesCache : messagesCache.filter((item) => item.category === category);
  if (!rows.some((item) => String(item.id) === expandedMessageId)) expandedMessageId = null;
  root.innerHTML = rows.length
    ? rows.map((message) => renderMessageCard(message)).join('')
    : '<p class="creaty-emailcore-body-empty">لا توجد رسائل في هذا التصنيف.</p>';
  root.querySelectorAll('.creaty-emailcore-html-frame').forEach((frame) => {
    frame.addEventListener('load', () => {
      try {
        const doc = frame.contentDocument;
        const height = Math.min(360, Math.max(120, (doc?.body?.scrollHeight || 0) + 16));
        frame.style.height = `${height}px`;
      } catch (_) { /* sandbox */ }
    });
  });
}

function populateComposeFromSelect(selectedSessionId = '') {
  const select = $('creaty-emailcore-compose-from');
  if (!select) return;
  const options = sessionsCache.map((session) => {
    const address = escapeHtml(session.display_email || session.email || '');
    const selected = String(session.id) === String(selectedSessionId) ? ' selected' : '';
    return `<option value="${escapeHtml(session.id)}"${selected}>${address}</option>`;
  });
  select.innerHTML = options.length
    ? `<option value="">— اختر المرسل —</option>${options.join('')}`
    : '<option value="">لا توجد حسابات نشطة</option>';
  select.disabled = !options.length;
}

function openComposeDialog({ mode = 'new', message = null } = {}) {
  const dialog = $('creaty-emailcore-compose-dialog');
  if (!dialog) return;
  composeMode = mode;
  composeReplyMessage = message;
  const title = $('creaty-emailcore-compose-title');
  const toEl = $('creaty-emailcore-compose-to');
  const subjectEl = $('creaty-emailcore-compose-subject');
  const bodyEl = $('creaty-emailcore-compose-body');

  populateComposeFromSelect(message?.session_id || message?.sessionId || '');

  if (mode === 'reply' && message) {
    if (title) title.textContent = 'رد على الرسالة';
    if (toEl) toEl.value = String(message.from_addr || '').trim();
    if (subjectEl) subjectEl.value = buildReplySubject(message.subject);
    if (bodyEl) bodyEl.value = buildQuotedReplyBody(message);
  } else {
    if (title) title.textContent = 'رسالة جديدة';
    if (toEl) toEl.value = '';
    if (subjectEl) subjectEl.value = '';
    if (bodyEl) bodyEl.value = '';
  }

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', 'open');
}

function closeComposeDialog() {
  const dialog = $('creaty-emailcore-compose-dialog');
  if (!dialog) return;
  composeMode = 'new';
  composeReplyMessage = null;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

async function sendComposeForm() {
  const fromSessionId = Number($('creaty-emailcore-compose-from')?.value);
  const to = String($('creaty-emailcore-compose-to')?.value || '').trim();
  const subject = String($('creaty-emailcore-compose-subject')?.value || '').trim();
  const body = String($('creaty-emailcore-compose-body')?.value || '').trim();
  if (!fromSessionId) throw new Error('اختر عنوان المرسل');
  if (!to) throw new Error('أدخل عنوان المستلم');
  if (!subject) throw new Error('أدخل موضوع الرسالة');
  if (!body) throw new Error('أدخل نص الرسالة');

  if (composeMode === 'reply' && composeReplyMessage?.id) {
    return emailcoreApiRequest(`/library/messages/${encodeURIComponent(composeReplyMessage.id)}/reply`, {
      method: 'POST',
      body: { fromSessionId, sessionId: composeReplyMessage.session_id, to, subject, body },
    });
  }

  return emailcoreApiRequest('/library/compose/send', {
    method: 'POST',
    body: { fromSessionId, to, subject, body },
  });
}

export async function refreshEmailCoreLibrary({ silent = false } = {}) {
  if (!$('creaty-emailcore-api')) return;
  try {
    if (!silent) status('جاري الاتصال بـ EmailCore…', 'busy');
    const [accounts, messages] = await Promise.all([request('/library/sessions'), request('/library/messages?limit=100')]);
    renderSessions(accounts.sessions || []);
    sessionsCache = accounts.sessions || [];
    messagesCache = messages.messages || [];
    renderMessages();
    status(`متصل: ${accounts.count || 0} حساب و ${messages.count || 0} رسالة`, 'ok');
  } catch (error) {
    if (!silent) status(error.message || String(error), 'err');
  }
}

async function withBusy(button, task) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { await task(); } catch (error) { status(error.message || String(error), 'err'); }
  finally { if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); } }
}

async function addSessionToAccounts(session) {
  const email = String(session.display_email || session.email || '').trim();
  if (!email) return { success: false, error: 'empty_email' };

  // Load existing accounts
  const data = await new Promise(resolve => {
    chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts'], resolve);
  });

  const currentList = data.ap_accounts_teepublic || data.ap_accounts || [];

  // Check duplicate
  if (currentList.some(acc => String(acc.email).trim().toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'duplicate' };
  }

  const password = session.password || session.pass || 'TeePass123!';
  const proxy = session.proxy || '';
  const firstName = session.firstName || session.first_name || '';
  const lastName = session.lastName || session.last_name || '';
  const displayName = firstName ? `${firstName} ${lastName}`.trim() : '';
  const storeName = displayName || (email.split('@')[0] + "_Store");

  const sessionId = String(session.id || '').trim();
  const newAcc = {
    id: 'acc_' + Math.random().toString(36).substr(2, 9),
    email,
    pass: password,
    emailcoreSource: true,
    emailcoreSessionId: sessionId || undefined,
    sessionId: sessionId || undefined,
    proxy,
    quota: 50,
    dailyLimit: 50,
    nicheMapping: 'all',
    displayName,
    storeName,
    groupId: '',
    category: 'active',
    verified: true,
    selected: true,
    sourceType: 'creaty',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  currentList.push(newAcc);

  await new Promise(resolve => {
    chrome.storage.local.set({
      ap_accounts_teepublic: currentList,
      ap_accounts: currentList
    }, resolve);
  });

  return { success: true, account: newAcc };
}

async function handleAddAllAsCreaty() {
  if (!sessionsCache || sessionsCache.length === 0) {
    return alert('⚠️ لا توجد حسابات لإضافتها.');
  }

  let addedCount = 0;
  let skippedCount = 0;

  for (const session of sessionsCache) {
    const res = await addSessionToAccounts(session);
    if (res.success) {
      addedCount++;
    } else if (res.error === 'duplicate') {
      skippedCount++;
    }
  }

  alert(`📊 ملخص الإضافة التلقائية:\n------------------------\n✅ تمت إضافة: ${addedCount} حساب\n⚠️ مكررات تم تخطيها: ${skippedCount}`);
}

export async function initEmailCoreLibrary() {
  const stored = await chrome.storage.local.get(Object.values(KEYS));
  const auth = configFromStorage(stored);
  const statusEl = $('creaty-emailcore-status');
  if (statusEl) {
    if (auth.sessionToken || auth.token) {
      const roleLabel = auth.role === 'admin' ? 'مدير' : 'مستخدم';
      statusEl.textContent = auth.username
        ? `✅ متصل: ${auth.username} (${roleLabel}) — الربط من مركز الإدارة → التكاملات`
        : '✅ متصل — الربط من مركز الإدارة → التكاملات';
    } else {
      statusEl.textContent = '⚠️ غير متصل — سجّل الدخول من مركز الإدارة → التكاملات';
    }
  }
  $('creaty-emailcore-generate')?.addEventListener('click', (event) => withBusy(event.currentTarget, async () => {
    await request('/library/sessions/generate', { method: 'POST', body: { count: Number($('creaty-emailcore-count')?.value) || 1 } });
    await refreshEmailCoreLibrary();
  }));
  $('creaty-emailcore-create-custom')?.addEventListener('click', (event) => withBusy(event.currentTarget, async () => {
    await request('/library/sessions/manual', { method: 'POST', body: { email: $('creaty-emailcore-custom')?.value?.trim() } });
    await refreshEmailCoreLibrary();
  }));
  $('creaty-emailcore-add-all-creaty')?.addEventListener('click', (event) => {
    void withBusy(event.currentTarget, handleAddAllAsCreaty);
  });
  $('creaty-emailcore-sessions')?.addEventListener('click', (event) => {
    const addBtn = event.target.closest('[data-emailcore-add]');
    if (addBtn) {
      const sessionId = addBtn.dataset.emailcoreAdd;
      const session = sessionsCache.find(s => String(s.id) === sessionId);
      if (!session) return;
      void withBusy(addBtn, async () => {
        const res = await addSessionToAccounts(session);
        if (res.success) {
          status(`✅ تم إضافة الحساب ${session.email} كـ CREATY`, 'ok');
        } else if (res.error === 'duplicate') {
          status(`⚠️ الحساب ${session.email} موجود بالفعل!`, 'err');
        }
      });
      return;
    }

    const deleteBtn = event.target.closest('[data-emailcore-delete]');
    if (deleteBtn) {
      if (!confirm(`حذف البريد ${deleteBtn.dataset.email} نهائياً؟`)) return;
      void withBusy(deleteBtn, async () => {
        await request(`/library/sessions/${encodeURIComponent(deleteBtn.dataset.emailcoreDelete)}`, { method: 'DELETE' });
        await refreshEmailCoreLibrary();
      });
      return;
    }
  });
  $('creaty-emailcore-messages')?.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('[data-copy-code]');
    if (copyBtn) {
      event.stopPropagation();
      await navigator.clipboard.writeText(copyBtn.dataset.copyCode);
      status(`تم نسخ الكود ${copyBtn.dataset.copyCode}`, 'ok');
      return;
    }

    const replyBtn = event.target.closest('[data-emailcore-reply]');
    if (replyBtn) {
      event.stopPropagation();
      const message = messagesCache.find((item) => String(item.id) === String(replyBtn.dataset.emailcoreReply));
      if (message) openComposeDialog({ mode: 'reply', message });
      return;
    }

    const toggleBtn = event.target.closest('[data-emailcore-toggle]');
    if (!toggleBtn || event.target.closest('button,a,input,textarea,select,label')) return;
    const nextId = String(toggleBtn.dataset.emailcoreToggle || '');
    expandedMessageId = expandedMessageId === nextId ? null : nextId;
    renderMessages();
  });

  $('creaty-emailcore-messages')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const toggleBtn = event.target.closest('[data-emailcore-toggle]');
    if (!toggleBtn) return;
    event.preventDefault();
    const nextId = String(toggleBtn.dataset.emailcoreToggle || '');
    expandedMessageId = expandedMessageId === nextId ? null : nextId;
    renderMessages();
  });

  $('creaty-emailcore-compose-open')?.addEventListener('click', () => openComposeDialog({ mode: 'new' }));
  $('creaty-emailcore-compose-close')?.addEventListener('click', () => closeComposeDialog());
  $('creaty-emailcore-compose-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeComposeDialog();
  });
  $('creaty-emailcore-compose-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const button = $('creaty-emailcore-compose-send');
    void withBusy(button, async () => {
      const wasReply = composeMode === 'reply';
      await sendComposeForm();
      closeComposeDialog();
      await refreshEmailCoreLibrary({ silent: true });
      status(wasReply ? 'تم إرسال الرد بنجاح' : 'تم إرسال الرسالة بنجاح', 'ok');
    });
  });

  $('creaty-emailcore-category')?.addEventListener('change', () => {
    expandedMessageId = null;
    renderMessages();
  });
  if (stored[KEYS.userId] && stored[KEYS.token]) void refreshEmailCoreLibrary({ silent: true });
}