/**
 * EmailCore billing bridge for Niche Hunter Pro.
 * Site Pricing is the commander (#pricing). No live checkout in the Ext.
 * Do not hardcode Stripe/Paddle secrets here.
 */
(function (global) {
  'use strict';

  const PRICING_URL = 'https://emailcore.app/admin#pricing';
  const PRICING_URL_ALT = 'https://nocochat.com/admin#pricing';

  /** Historical only — not opened by default CTAs anymore */
  const LEGACY_GUMROAD_URL = 'https://maggouriverse.gumroad.com/l/yjgby';

  function openPricingPage() {
    const url = PRICING_URL;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
      return;
    }
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  global.NhpBillingHooks = Object.freeze({
    pricingUrl: PRICING_URL,
    pricingUrlAlt: PRICING_URL_ALT,
    legacyGumroadUrl: LEGACY_GUMROAD_URL,
    checkoutEnabled: false,
    openPricingPage,
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
