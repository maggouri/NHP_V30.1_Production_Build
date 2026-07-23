export function getSingleNicheLabel(classification) {
  switch (String(classification || '').trim().toLowerCase()) {
    case 'excel':
      return 'ممتاز';
    case 'med':
      return 'متوسط';
    case 'sat':
      return 'مشبع';
    case 'emp':
    case 'unknown':
      return 'غير معروف';
    default:
      return 'غير معروف';
  }
}

export function buildSingleNicheSummaryText(result) {
  const niche = String(result?.niche || '').trim();
  const classification = getSingleNicheLabel(result?.classification || result?.score);
  const summary = result?.summary || {};
  const totalResults = summary.totalResults ?? '—';
  const maxPage = summary.maxPage ?? '—';
  const signals = summary.signals || {};
  const fromCount = signals.fromCount || '—';
  const fromPage = signals.fromPage || '—';
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const warningSuffix = warnings.length ? ` · تنبيهات: ${warnings.join(', ')}` : '';
  return `نiche: ${niche || '—'} · الحالة: ${classification} · نتائج: ${totalResults} · صفحات: ${maxPage} · إشارة العد: ${fromCount} · إشارة الصفحة: ${fromPage}${warningSuffix}`;
}
