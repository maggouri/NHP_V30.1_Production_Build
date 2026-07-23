'use strict';

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

function deriveDomainAvailability(domains = []) {
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

module.exports = {
  normalizeDomain,
  isEligibleDomain,
  deriveDomainAvailability,
};
