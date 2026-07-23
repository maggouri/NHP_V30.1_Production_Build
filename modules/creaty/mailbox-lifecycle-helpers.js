/**
 * EP-301C/301D client helpers — shared between UI (ESM) and tests.
 */
export const JOURNEY_STEPS = [
  { id: 'LOGIN', labelAr: 'تسجيل الدخول', labelEn: 'Login' },
  { id: 'CHOOSE_DOMAIN', labelAr: 'اختيار النطاق', labelEn: 'Domain' },
  { id: 'CREATE_MAILBOX', labelAr: 'إنشاء البريد', labelEn: 'Create' },
  { id: 'VALIDATION', labelAr: 'التحقق', labelEn: 'Validate' },
  { id: 'MAILBOX_CREATED', labelAr: 'تم الإنشاء', labelEn: 'Created' },
  { id: 'CONNECTION_SETTINGS', labelAr: 'إعداد الاتصال', labelEn: 'Connection' },
  { id: 'READY', labelAr: 'جاهز', labelEn: 'Ready' },
];

const ERROR_MESSAGES_AR = {
  AUTH_REQUIRED: 'يلزم تسجيل الدخول — أدخل User ID ورمز الوصول في إعدادات البريد.',
  AUTH_INVALID: 'بيانات الدخول غير صالحة — راجع User ID ورمز الوصول.',
  DOMAIN_REQUIRED: 'اختر نطاقاً للبريد قبل المتابعة.',
  DOMAIN_NOT_ALLOWED: 'النطاق المختار غير مسموح — اختر نطاقاً من القائمة.',
  DOMAIN_INVALID: 'صيغة النطاق غير صحيحة.',
  DOMAIN_NOT_SET: 'لم يتم اختيار نطاق — ارجع لخطوة اختيار النطاق.',
  MAILBOX_CREATE_FAILED: 'تعذر إنشاء البريد — تحقق من بيانات الاتصال وحاول مجدداً.',
  MAILBOX_DOMAIN_MISMATCH: 'عنوان البريد يجب أن ينتهي بالنطاق المختار.',
  MAILBOX_VALIDATION_FAILED: 'البيانات المُرجعة من الخادم غير مكتملة — حاول مرة أخرى.',
  MAILBOX_NOT_CREATED: 'أنشئ البريد أولاً قبل التحقق.',
  MAILBOX_INVALID: 'بيانات البريد غير صالحة — أنشئ بريداً جديداً.',
  MAILBOX_NOT_FOUND: 'البريد لم يظهر بعد في المكتبة — جارٍ الانتظار، يمكنك إعادة المحاولة.',
  VALIDATION_REMOTE_ERROR: 'تعذر الاتصال بالخادم أثناء التحقق — تحقق من الشبكة.',
  VALIDATION_REQUIRED: 'أكمل التحقق قبل متابعة إعداد الاتصال.',
  CONNECTION_VERIFY_FAILED: 'فشل التحقق من الاتصال — راجع User ID ورمز الوصول.',
  CONNECTION_NOT_VERIFIED: 'تحقق من الاتصال قبل إتمام الإعداد.',
  WORKFLOW_NOT_FOUND: 'انتهت جلسة الإعداد — ابدأ من جديد.',
  FORBIDDEN: 'لا تملك صلاحية لهذا الإجراء.',
  ROLE_UI_BLOCKED: 'واجهة إعداد البريد متاحة للمستخدمين والمسؤولين فقط — مسار المشرف للاسترداد عبر الخدمة.',
  NETWORK: 'تعذر الاتصال بخادم Creaty — تأكد أن السيرفر يعمل على المنفذ 3020.',
};

export const MAILBOX_LIFECYCLE_ACTIONS = {
  LIST_DOMAINS: 'list_domains',
  CREATE_WORKFLOW: 'create_workflow',
  CHANGE_DOMAIN: 'change_domain',
  READ_WORKFLOW: 'read_workflow',
  CREATE_MAILBOX: 'create_mailbox',
  VALIDATE_MAILBOX: 'validate_mailbox',
  CONNECTION_READ: 'connection_read',
  CONNECTION_VERIFY: 'connection_verify',
  MARK_READY: 'mark_ready',
  RESET_WORKFLOW: 'reset_workflow',
  RECOVER: 'recover',
};

const ROLE_LABELS_AR = {
  User: 'مستخدم',
  Admin: 'مسؤول',
  Supervisor: 'مشرف (خدمة)',
};

export function canMutateMailboxLifecycle(role) {
  return role === 'User' || role === 'Admin';
}

export function canUseMailboxLifecycleUi(role) {
  return canMutateMailboxLifecycle(role);
}

/** INT-006 Wave 3 (C2) — derive UI capabilities from EmailCore session role (no Creaty :3020 session). */
export function buildLifecycleCapabilitiesForRole(role) {
  const normalizedRole = String(role || '').trim();
  const caps = {};
  Object.values(MAILBOX_LIFECYCLE_ACTIONS).forEach((action) => {
    caps[action] = canPerformLifecycleAction(normalizedRole, action);
  });
  caps.canUseUi = canUseMailboxLifecycleUi(normalizedRole);
  caps.canCrossWorkflowRead = normalizedRole === 'Admin' || normalizedRole === 'Supervisor';
  return caps;
}

export function canPerformLifecycleAction(role, action) {
  const normalizedRole = String(role || '').trim();
  switch (String(action || '').trim()) {
    case MAILBOX_LIFECYCLE_ACTIONS.LIST_DOMAINS:
      return normalizedRole === 'User' || normalizedRole === 'Admin' || normalizedRole === 'Supervisor';
    case MAILBOX_LIFECYCLE_ACTIONS.CREATE_WORKFLOW:
    case MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN:
    case MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX:
    case MAILBOX_LIFECYCLE_ACTIONS.VALIDATE_MAILBOX:
    case MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_READ:
    case MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_VERIFY:
    case MAILBOX_LIFECYCLE_ACTIONS.MARK_READY:
    case MAILBOX_LIFECYCLE_ACTIONS.RESET_WORKFLOW:
      return canMutateMailboxLifecycle(normalizedRole);
    case MAILBOX_LIFECYCLE_ACTIONS.RECOVER:
      return normalizedRole === 'Supervisor';
    default:
      return false;
  }
}

export function resolveRoleLabelAr(role) {
  return ROLE_LABELS_AR[String(role || '').trim()] || '—';
}

const NEXT_ACTION_HINTS_AR = {
  provide_credentials: 'افتح تبويب Email Library وأدخل بيانات الاتصال.',
  sync_credentials: 'احفظ بيانات الاتصال من جديد ثم أعد المحاولة.',
  choose_domain: 'اختر نطاقاً من القائمة.',
  choose_allowed_domain: 'اختر نطاقاً مسموحاً من القائمة.',
  fix_mailbox_email: 'صحّح عنوان البريد ليتطابق مع النطاق.',
  verify_emailcore_credentials: 'تحقق من User ID ورمز الوصول.',
  retry_validation: 'اضغط «إعادة التحقق».',
  validate_mailbox: 'اضغط «التحقق من البريد».',
  verify_connection: 'اضغط «التحقق من الاتصال».',
  create_new_workflow: 'اضغط «بدء إعداد جديد».',
  create_mailbox: 'أنشئ البريد أولاً.',
};

export function mapLifecycleError(envelope = {}, fallback = '') {
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

export function validateManualMailboxInput(email, domainName) {
  const normalized = String(email || '').trim().toLowerCase();
  const domain = String(domainName || '').trim().toLowerCase();
  if (!normalized) return { ok: false, message: 'أدخل عنوان البريد.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, message: 'صيغة البريد غير صحيحة.' };
  }
  const emailDomain = normalized.split('@')[1] || '';
  if (domain && emailDomain !== domain) {
    return { ok: false, message: `يجب أن ينتهي البريد بـ @${domain}` };
  }
  return { ok: true, email: normalized };
}

export function validateGenerateCount(raw) {
  const count = Number(raw);
  if (!Number.isFinite(count) || count < 1 || count > 10) {
    return { ok: false, message: 'العدد يجب أن يكون بين 1 و 10.' };
  }
  return { ok: true, count: Math.floor(count) };
}

export function resolveStepIndex(stepId) {
  const idx = JOURNEY_STEPS.findIndex((s) => s.id === stepId);
  return idx >= 0 ? idx : 0;
}

export function resolveVisibleStep(workflowStep, authReady) {
  if (!authReady) return 'LOGIN';
  return String(workflowStep || 'CHOOSE_DOMAIN').trim() || 'CHOOSE_DOMAIN';
}

/** INT-006 Wave 2 (B3) — chrome.storage keys for mailbox lifecycle workflow binding. */
export const MAILBOX_LIFECYCLE_STORAGE_KEYS = Object.freeze({
  workflowId: 'creaty_mailbox_lifecycle_workflow_id',
  workflowOwnerUserId: 'creaty_mailbox_lifecycle_workflow_owner_user_id',
});

/**
 * INT-006 Wave 2 (B3) — clear stale workflow when Extension userId changes or mismatches owner.
 */
export function shouldClearStaleMailboxWorkflow({ authUserId, storedOwnerUserId, workflowOwnerUserId } = {}) {
  const auth = String(authUserId || '').trim();
  if (!auth) return false;
  const storedOwner = String(storedOwnerUserId || '').trim();
  if (storedOwner && storedOwner !== auth) return true;
  const workflowOwner = String(workflowOwnerUserId || '').trim();
  if (workflowOwner && workflowOwner !== auth) return true;
  return false;
}
