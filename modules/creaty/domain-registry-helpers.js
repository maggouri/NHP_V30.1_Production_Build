/**
 * EP-302C — Domain registry admin UI helpers (ESM).
 * Thin client: validation + Arabic error mapping only — no business logic.
 */
/** Creaty :3020 paths — legacy mailbox-lifecycle mount (not used by Quick Access after INT-002). */
export const DOMAIN_REGISTRY_API = Object.freeze({
  SESSION: '/api/mailbox-lifecycle/session',
  REGISTRY_LIST: '/api/mailbox-lifecycle/domain-registry',
  REGISTRY_ITEM: '/api/mailbox-lifecycle/domain-registry/',
  DOMAINS_READ: '/api/mailbox-lifecycle/domains',
});

/** EmailCore SSOT paths — consumed via emailcoreApiRequest (/api/creaty prefix). */
export const EMAILCORE_DOMAIN_REGISTRY_API = Object.freeze({
  SESSION: '/mailbox-lifecycle/session',
  REGISTRY_LIST: '/mailbox-lifecycle/domain-registry',
  REGISTRY_ITEM: '/mailbox-lifecycle/domain-registry/',
  DOMAINS_READ: '/mailbox-lifecycle/domains',
});

export const DOMAIN_REGISTRY_ACTIONS = Object.freeze({
  VERIFY: 'verify',
  UNVERIFY: 'unverify',
  ENABLE: 'enable',
  DISABLE: 'disable',
  DEPRECATE: 'deprecate',
});

const ERROR_MESSAGES_AR = {
  AUTH_REQUIRED: 'يلزم تسجيل الدخول — أدخل User ID ورمز الوصول في إعدادات البريد.',
  AUTH_INVALID: 'بيانات الدخول غير صالحة — راجع User ID ورمز الوصول.',
  FORBIDDEN: 'لا تملك صلاحية إدارة النطاقات — يتطلب دور مسؤول.',
  DOMAIN_INVALID: 'صيغة النطاق غير صحيحة — استخدم أحرفاً لاتينية صغيرة ونقطة.',
  DOMAIN_DUPLICATE: 'النطاق موجود مسبقاً في السجل — عدّل السجل الحالي.',
  DOMAIN_NOT_FOUND: 'النطاق غير موجود — حدّث القائمة.',
  DOMAIN_NOT_VERIFIED: 'لا يمكن التفعيل قبل إكمال التحقق — أكمل التحقق أولاً.',
  DOMAIN_LAST_ACTIVE: 'لا يمكن تعطيل آخر نطاق مفعّل — فعّل نطاقاً آخر أولاً.',
  DOMAIN_REGISTRY_UNAVAILABLE: 'تعذر الوصول إلى سجل النطاقات — أعد المحاولة.',
  DOMAIN_STATUS_INVALID: 'حالة النطاق غير مدعومة.',
  DOMAIN_TRANSITION_INVALID: 'انتقال الحالة غير مسموح لهذا النطاق.',
  NETWORK: 'تعذر الاتصال بخادم Creaty — تأكد أن السيرفر يعمل على المنفذ 3020.',
};

const NEXT_ACTION_HINTS_AR = {
  login_as_admin: 'سجّل الدخول بحساب مسؤول (Admin).',
  complete_verification: 'اضغط «تحقق» على النطاق قبل التفعيل.',
  enable_another_domain_first: 'فعّل نطاقاً بديلاً ثم عطّل هذا النطاق.',
  refresh_registry: 'اضغط «تحديث» لإعادة تحميل السجل.',
  fix_domain_input: 'صحّح اسم النطاق (مثال: example.com).',
  retry_registry_read: 'أعد المحاولة بعد التأكد من تشغيل Creaty Server.',
  retry_registry_write: 'أعد المحاولة — قد يكون الملف مقفلاً مؤقتاً.',
  provide_credentials: 'افتح تبويب Email Library وأدخل بيانات الاتصال.',
};

const STATUS_LABELS_AR = {
  enabled: 'مفعّل',
  disabled: 'معطّل',
  deprecated: 'مهمل',
};

const DOMAIN_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function canManageDomainRegistry(role) {
  return String(role || '').trim() === 'Admin';
}

export function resolveDomainStatusLabelAr(status) {
  return STATUS_LABELS_AR[String(status || '').trim()] || '—';
}

export function resolveDomainVerifiedLabelAr(isVerified) {
  return isVerified ? 'مُتحقق' : 'غير مُتحقق';
}

export function validateDomainNameInput(raw) {
  const name = String(raw || '').trim().toLowerCase();
  if (!name) return { ok: false, message: 'أدخل اسم النطاق.' };
  if (name.length > 253) return { ok: false, message: 'اسم النطاق طويل جداً.' };
  if (!DOMAIN_NAME_RE.test(name)) {
    return { ok: false, message: 'صيغة النطاق غير صحيحة (مثال: example.com).' };
  }
  return { ok: true, name };
}

export function mapDomainRegistryError(envelope = {}, fallback = '') {
  const code = String(envelope.code || '').trim();
  const message = String(envelope.message || fallback || '').trim();
  const userText = ERROR_MESSAGES_AR[code] || message || 'حدث خطأ غير متوقع.';
  const nextAction = String(envelope.nextAction || '').trim();
  const hint = NEXT_ACTION_HINTS_AR[nextAction] || '';
  return {
    code,
    message: userText,
    hint,
    recoverable: envelope.recoverable !== false,
    retryable: !!envelope.retryable,
    nextAction,
  };
}

export function sortDomainsForDisplay(domains = []) {
  return [...domains].sort((a, b) => {
    const statusOrder = { enabled: 0, disabled: 1, deprecated: 2 };
    const sa = statusOrder[String(a?.status)] ?? 9;
    const sb = statusOrder[String(b?.status)] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}
