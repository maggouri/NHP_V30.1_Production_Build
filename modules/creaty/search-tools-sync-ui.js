/** Paint EmailCore Search Tools sync status into Trends / USPTO / Analysis headers. */

const META_KEY = 'nhpEmailCoreSearchToolsSyncMeta';
const LOCAL_ENABLED_KEY = 'nhpEmailCoreSearchToolsSyncEnabled';

function formatSyncWhen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

/**
 * Same gate as background / emailcore-handlers: local on + site not explicitly off.
 * When true, old TeePublic/Oracle auto-fetch must not run (CREATY sync replaces it).
 */
export function isCreatySearchToolsSyncReplacingOldTrends(localEnabled, meta = {}) {
  if (localEnabled === false) return false;
  if (meta.siteEnabled === false) return false;
  if (meta.trendsSkip === 'site_disabled' || meta.feedsSkip === 'site_disabled') return false;
  return true;
}

export function readCreatySearchToolsSyncReplacingOldTrends() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([LOCAL_ENABLED_KEY, META_KEY], (res) => {
        resolve(isCreatySearchToolsSyncReplacingOldTrends(
          res[LOCAL_ENABLED_KEY] !== false,
          res[META_KEY] || {}
        ));
      });
    } catch (_) {
      resolve(true);
    }
  });
}

function buildSyncLine(meta = {}, localEnabled = true) {
  if (localEnabled === false) {
    return 'مزامنة EmailCore: متوقفة محلياً (Admin) — الجلب القديم متاح';
  }
  if (meta.siteEnabled === false || meta.trendsSkip === 'site_disabled' || meta.feedsSkip === 'site_disabled') {
    return 'مزامنة EmailCore: متوقفة من الموقع — الجلب القديم متاح';
  }
  const parts = [];
  if (meta.trendsLastSuccessAt) {
    const src = meta.trendsSource ? ` · ${meta.trendsSource}` : '';
    parts.push(`ترندات ${formatSyncWhen(meta.trendsLastSuccessAt)}${src}`);
  }
  if (meta.feedsLastSuccessAt) {
    const branches = meta.branches || {};
    const badges = [];
    if (branches.safe?.ok) badges.push('Safe');
    if (branches.classified?.ok) badges.push('Classified');
    if (branches.designImages?.ok) badges.push('Images');
    if (branches.earlyRadar?.ok) badges.push('الرادار');
    const badgeTxt = badges.length ? ` [${badges.join(' · ')}]` : '';
    parts.push(`فروع ${formatSyncWhen(meta.feedsLastSuccessAt)}${badgeTxt}`);
  }
  if (meta.trendsLastError) parts.push(`خطأ ترندات: ${meta.trendsLastError}`);
  if (meta.feedsLastError) parts.push(`خطأ فروع: ${meta.feedsLastError}`);
  if (!parts.length) {
    return 'مزامنة EmailCore نشطة (بدل الجلب القديم) — بانتظار أول سحب (15د ترندات / 6س فروع)';
  }
  return `مزامنة EmailCore (بدل الجلب القديم): ${parts.join(' | ')}`;
}

export function paintSearchToolsSyncStatus(el) {
  if (!el) return;
  chrome.storage.local.get([META_KEY, LOCAL_ENABLED_KEY], (res) => {
    el.textContent = buildSyncLine(res[META_KEY] || {}, res[LOCAL_ENABLED_KEY] !== false);
  });
}

export function bindSearchToolsSyncStatus(el) {
  if (!el) return () => {};
  paintSearchToolsSyncStatus(el);
  const onChange = (changes, area) => {
    if (area !== 'local') return;
    if (changes[META_KEY] || changes[LOCAL_ENABLED_KEY]) {
      paintSearchToolsSyncStatus(el);
    }
  };
  chrome.storage.onChanged.addListener(onChange);
  return () => chrome.storage.onChanged.removeListener(onChange);
}
