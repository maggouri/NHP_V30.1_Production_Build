/**
 * EP-302C / AR-09 — Domain registry Quick Access (Creaty client only).
 * Full admin UI lives on EmailCore Web Admin (#domain-registry).
 * Read-only preview via public EP-302B APIs — no duplicate CRUD.
 */
import { resolveEmailCoreAuth, normalizeEmailCoreApiBase } from './emailcore-library.js';
import { resolveRoleLabelAr } from './mailbox-lifecycle-helpers.js';
import { fetchDomainRegistrySnapshot } from './domain-source-service.js';
import {
  EMAILCORE_DOMAIN_REGISTRY_API,
  canManageDomainRegistry,
  mapDomainRegistryError,
} from './domain-registry-helpers.js';

export {
  EMAILCORE_DOMAIN_REGISTRY_API,
  canManageDomainRegistry,
  mapDomainRegistryError,
};

const $ = (id) => document.getElementById(id);

let sessionRole = '';
let previewCount = 0;
let eligiblePreviewCount = 0;
let wired = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveWebAdminDomainUrl() {
  const apiBase = normalizeEmailCoreApiBase($('creaty-emailcore-api')?.value || 'https://emailcore.app');
  return `${apiBase}/admin#domain-registry`;
}

function updateNavVisibility() {
  const show = canManageDomainRegistry(sessionRole);
  const tabBtn = $('creaty-col2-tab-domain-registry');
  if (tabBtn) {
    tabBtn.hidden = !show;
    tabBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  const navBtn = $('creaty-admin-nav-domain-registry');
  if (navBtn) {
    navBtn.hidden = !show;
    navBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
}

function setStatus(text, tone = 'info') {
  const el = $('creaty-dreg-status');
  if (!el) return;
  el.className = `creaty-dreg-status creaty-dreg-status--${tone}`;
  el.textContent = text || '';
}

function setError(envelope) {
  const box = $('creaty-dreg-error');
  if (!box) return;
  if (!envelope) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const mapped = mapDomainRegistryError(envelope);
  box.hidden = false;
  box.innerHTML = `<strong>${escapeHtml(mapped.message)}</strong>${mapped.hint ? `<p class="creaty-dreg-error-hint">${escapeHtml(mapped.hint)}</p>` : ''}`;
}

function renderQuickAccessPanel() {
  const root = $('creaty-dreg-content');
  if (!root) return;
  const adminUrl = resolveWebAdminDomainUrl();
  root.innerHTML = `
    <section class="creaty-dreg-quick" aria-label="Domain registry quick access">
      <div class="creaty-dreg-quick__card">
        <h3 class="creaty-dreg-panel-title">إدارة النطاقات — وصول سريع</h3>
        <p class="creaty-dreg-panel-desc">
          الإدارة الكاملة لسجل النطاقات تتم من <strong>لوحة EmailCore Web Admin</strong> (AR-09).
          Creaty يعرض معاينة فقط — بدون تكرار واجهة الإدارة.
        </p>
        <div class="creaty-dreg-quick__stats" id="creaty-dreg-quick-stats">
          ${previewCount ? `<span class="creaty-dreg-pill creaty-dreg-pill--ok">${previewCount} نطاق في السجل</span>` : '<span class="creaty-dreg-hint">—</span>'}
          ${previewCount ? `<span class="creaty-dreg-pill">${eligiblePreviewCount} نطاق مؤهل لإعداد البريد</span>` : ''}
          ${sessionRole ? `<span class="creaty-dreg-pill">الصلاحية: ${escapeHtml(resolveRoleLabelAr(sessionRole))}</span>` : ''}
        </div>
        <div class="creaty-dreg-actions creaty-dreg-quick__actions">
          <a href="${escapeHtml(adminUrl)}" target="_blank" rel="noopener noreferrer" class="creaty-btn creaty-btn--primary" id="creaty-dreg-open-admin">
            <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
            فتح في لوحة الإدارة
          </a>
          <button type="button" id="creaty-dreg-refresh-preview" class="creaty-btn creaty-btn--ghost">تحديث المعاينة</button>
        </div>
        <p class="creaty-dreg-hint creaty-dreg-quick__hint" dir="ltr">${escapeHtml(adminUrl)}</p>
      </div>
    </section>
  `;
  $('creaty-dreg-refresh-preview')?.addEventListener('click', () => { void refreshDomainRegistryUi(); });
}

function renderBlockedPanel() {
  const root = $('creaty-dreg-content');
  if (!root) return;
  root.innerHTML = `
    <section class="creaty-dreg-blocked">
      <h3 class="creaty-dreg-panel-title">صلاحية غير كافية</h3>
      <p class="creaty-dreg-panel-desc">${escapeHtml(mapDomainRegistryError({ code: 'FORBIDDEN' }).message)}</p>
      <p class="creaty-dreg-hint">يمكنك متابعة إعداد البريد من تبويب «إعداد البريد».</p>
    </section>
  `;
}

async function loadSessionContext() {
  const snapshot = await fetchDomainRegistrySnapshot();
  if (!snapshot.ok) {
    sessionRole = '';
    updateNavVisibility();
    return { ok: false, data: snapshot.error };
  }
  sessionRole = String(snapshot.role || '').trim();
  updateNavVisibility();
  return { ok: true, data: snapshot };
}

async function loadPreviewCount() {
  const snapshot = await fetchDomainRegistrySnapshot();
  if (!snapshot.ok) {
    previewCount = 0;
    eligiblePreviewCount = 0;
    return false;
  }
  previewCount = Number(snapshot.summary?.total) || 0;
  eligiblePreviewCount = Number(snapshot.summary?.eligible) || 0;
  return true;
}

export async function refreshDomainRegistryUi() {
  const panel = $('creaty-col2-panel-domain-registry');
  if (!panel || panel.hidden) return;

  const loadingEl = $('creaty-dreg-loading');
  if (loadingEl) {
    loadingEl.hidden = false;
    loadingEl.textContent = 'جارٍ التحديث…';
  }

  try {
    const auth = await resolveEmailCoreAuth();
    if (!auth.userId || !auth.token) {
      setError({ code: 'AUTH_REQUIRED' });
      setStatus('أكمل بيانات الاتصال في Email Library.', 'warn');
      $('creaty-dreg-content').innerHTML = '';
      return;
    }

    const session = await loadSessionContext();
    if (!session.ok) {
      setError(session.data);
      $('creaty-dreg-content').innerHTML = '';
      return;
    }

    if (!canManageDomainRegistry(sessionRole)) {
      setError(null);
      setStatus('');
      renderBlockedPanel();
      return;
    }

    setError(null);
    await loadPreviewCount();
    renderQuickAccessPanel();
    setStatus('استخدم «فتح في لوحة الإدارة» لإدارة النطاقات بالكامل.', 'info');
  } finally {
    if (loadingEl) {
      loadingEl.hidden = true;
      loadingEl.textContent = '';
    }
  }
}

function wireQuickAccessUi() {
  if (wired) return;
  wired = true;
  $('creaty-dreg-refresh')?.addEventListener('click', () => { void refreshDomainRegistryUi(); });
}

export async function syncDomainRegistryAccess() {
  const auth = await resolveEmailCoreAuth();
  if (!auth.userId || !auth.token) {
    sessionRole = '';
    updateNavVisibility();
    return { ok: false, code: 'AUTH_REQUIRED' };
  }
  return loadSessionContext();
}

export async function initDomainRegistryUi(_helpers = {}) {
  wireQuickAccessUi();
  await syncDomainRegistryAccess();
}

export function activateDomainRegistryTab() {
  document.querySelector('[data-creaty-col2-tab="domain-registry"]')?.click();
}

export function openDomainRegistryInWebAdmin() {
  const url = resolveWebAdminDomainUrl();
  globalThis.open(url, '_blank', 'noopener,noreferrer');
}
