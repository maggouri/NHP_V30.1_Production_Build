import {
  resolveEmailCoreAuth,
  emailcoreApiRequest,
  fetchMailboxLifecycleSession,
} from './emailcore-library.js';
import { buildLifecycleCapabilitiesForRole } from './mailbox-lifecycle-helpers.js';

function asText(value) {
  return String(value || '').trim();
}

function normalizeDomain(domain = {}) {
  return {
    id: asText(domain.id),
    name: asText(domain.name).toLowerCase(),
    status: asText(domain.status).toLowerCase(),
    isVerified: !!domain.isVerified,
  };
}

function isEligibleDomain(domain = {}) {
  return asText(domain.status).toLowerCase() === 'enabled' && !!domain.isVerified;
}

function buildAvailability(domains = []) {
  const normalized = domains.map((row) => normalizeDomain(row)).filter((row) => !!row.name);
  const eligible = normalized.filter((row) => isEligibleDomain(row));
  return {
    domains: normalized,
    eligibleDomains: eligible,
    summary: {
      total: normalized.length,
      enabled: normalized.filter((row) => row.status === 'enabled').length,
      verified: normalized.filter((row) => row.isVerified).length,
      eligible: eligible.length,
    },
  };
}

function mapEmailCoreRegistryError(err) {
  const msg = asText(err?.message || err);
  if (/401|Invalid CREATY|token missing|غير صالح/i.test(msg)) {
    return { code: 'AUTH_INVALID', message: msg };
  }
  if (/403|Forbidden|Admin role required|صلاحية/i.test(msg)) {
    return { code: 'FORBIDDEN', message: msg };
  }
  if (/404|not found/i.test(msg)) {
    return { code: 'DOMAIN_REGISTRY_UNAVAILABLE', message: msg, retryable: true };
  }
  if (/network|failed to fetch|connect|connection/i.test(msg)) {
    return { code: 'NETWORK', message: msg, retryable: true };
  }
  return { code: 'DOMAIN_REGISTRY_UNAVAILABLE', message: msg || 'تعذر الاتصال بـ EmailCore', retryable: true };
}

export async function fetchDomainRegistrySnapshot() {
  const auth = await resolveEmailCoreAuth();
  if (!auth.userId || !auth.token) {
    return { ok: false, error: { code: 'AUTH_REQUIRED' } };
  }
  try {
    const [sessionData, registryData] = await Promise.all([
      fetchMailboxLifecycleSession(),
      emailcoreApiRequest('/mailbox-lifecycle/domain-registry'),
    ]);
    const role = asText(sessionData.role);
    const availability = buildAvailability(Array.isArray(registryData.domains) ? registryData.domains : []);
    return {
      ok: true,
      ssot: 'emailcore',
      source: 'emailcore',
      role,
      capabilities: buildLifecycleCapabilitiesForRole(role),
      ...availability,
    };
  } catch (err) {
    return { ok: false, error: mapEmailCoreRegistryError(err) };
  }
}

export function deriveDomainAvailability(domains = []) {
  return buildAvailability(domains);
}
