/**
 * First-party storefront analytics for the iGroup platform.
 *
 * Sends funnel events to the platform's public ingest endpoint
 * (`POST {VITE_IGROUP_API_URL}/api/storefront/analytics/visitor`) so the
 * CPanel Growth → Analytics → Behavior page (storefront funnel + campaign
 * performance) reflects real storefront activity for this tenant.
 *
 * Contract (verified against api/src/routes/analyticsPublic.js):
 * - Headers: X-Company-Id + X-Site-Id (tenant + site scope).
 * - Body: { sessionKey, eventType, path, productId, attribution }.
 * - eventType is one of pageview / product_view / add_to_cart /
 *   remove_from_cart / initiate_checkout. `purchase` is intentionally NOT
 *   sent here: the platform order API records it after a confirmed order.
 * - attribution is the first-touch UTM set captured on entry (campaign
 *   labels + referrer hostname only — no PII is stored or sent).
 *
 * Requests are fire-and-forget: a network failure never blocks the UI.
 */

import { getStorefrontApiConfig } from '../data/apiClient.js';

const SESSION_KEY = 'epStorefrontAnalyticsSessionKey';
const ATTRIBUTION_KEY = 'epStorefrontAttribution';

/** Standard campaign URL parameters captured on storefront entry. */
const ATTRIBUTION_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const SUPPORTED_EVENT_TYPES = ['pageview', 'product_view', 'add_to_cart', 'remove_from_cart', 'initiate_checkout'];

const VALUE_LIMIT = 200;

/**
 * Duplicate-suppression windows in milliseconds. React re-runs effects on
 * StrictMode mounts and can replay state updaters, so one user action may be
 * observed twice within a few milliseconds. Consecutive pageviews are deduped
 * by path instead of by time (see below).
 */
const DEDUPE_WINDOWS = Object.freeze({
  product_view: 1000,
  add_to_cart: 500,
  remove_from_cart: 500,
  initiate_checkout: 1500,
});

const RECENT_EVENT_PRUNE_MS = 1500;
const RECENT_EVENT_LIMIT = 400;

let memorySessionKey = '';
let memoryAttribution = null;
let lastPageviewPath = '';
const recentEvents = new Map();

function isDuplicateWithin(key, windowMs) {
  const now = Date.now();
  if (recentEvents.size > RECENT_EVENT_LIMIT) {
    for (const [seenKey, seenAt] of recentEvents) {
      if (now - seenAt > RECENT_EVENT_PRUNE_MS) recentEvents.delete(seenKey);
    }
  }
  const lastSeenAt = recentEvents.get(key);
  recentEvents.set(key, now);
  return lastSeenAt !== undefined && now - lastSeenAt < windowMs;
}

function createSessionKey() {
  try {
    return globalThis.crypto?.randomUUID?.() || '';
  } catch {
    return '';
  }
}

/** Opaque client-generated session id shared by funnel events and orders. */
export function getStorefrontSessionKey() {
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      const generated = createSessionKey();
      if (generated) localStorage.setItem(SESSION_KEY, generated);
      return generated;
    } catch {
      // Storage unavailable (private mode); fall through to memory.
    }
  }
  if (!memorySessionKey) memorySessionKey = createSessionKey();
  return memorySessionKey;
}

function referrerHostname() {
  const raw = typeof document !== 'undefined' ? String(document.referrer || '') : '';
  if (!raw) return '';
  try {
    return String(new URL(raw).hostname || '').toLowerCase().slice(0, 300);
  } catch {
    return '';
  }
}

function captureFromLocation() {
  if (typeof window === 'undefined' || !window.location) return {};
  let params;
  try {
    params = new URLSearchParams(String(window.location.search || ''));
  } catch {
    return {};
  }
  const captured = {};
  for (const field of ATTRIBUTION_FIELDS) {
    const value = String(params.get(field) || '').trim().slice(0, VALUE_LIMIT);
    if (value) captured[field] = value;
  }
  const host = referrerHostname();
  if (host) captured.referrer = host;
  return captured;
}

function readStoredAttribution() {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(ATTRIBUTION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      }
    } catch {
      // Storage unavailable or corrupt value: fall through.
    }
  }
  return memoryAttribution || {};
}

function writeStoredAttribution(attribution) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
      return;
    } catch {
      // Fall through to memory when storage is unavailable.
    }
  }
  memoryAttribution = attribution;
}

/**
 * First-touch campaign attribution for this browser: values captured on entry
 * win; later UTM parameters only fill fields that were still empty.
 */
export function getStorefrontAttribution() {
  const stored = readStoredAttribution();
  const merged = { ...captureFromLocation(), ...stored };
  if (JSON.stringify(merged) !== JSON.stringify(stored)) writeStoredAttribution(merged);
  return merged;
}

/**
 * Fire-and-forget ingestion of one storefront funnel event. Returns null when
 * tracking is not applicable (unsupported event, missing configuration, a
 * duplicate consecutive pageview, or a repeated action inside its dedupe
 * window); otherwise returns the in-flight fetch.
 */
export function trackPlatformEvent(eventType, { path = '', productId = '' } = {}, env) {
  if (!SUPPORTED_EVENT_TYPES.includes(eventType)) return null;
  if (typeof fetch !== 'function') return null;

  const config = getStorefrontApiConfig(env);
  if (!config.apiUrl || !config.companyId || !config.siteId) return null;

  const sessionKey = getStorefrontSessionKey();
  if (!sessionKey) return null;

  const currentPath = typeof window !== 'undefined' ? String(window.location?.pathname || '') : '';
  const resolvedPath = String(path || currentPath || '');

  // SPA remounts (StrictMode, state flips) must not double-count a pageview.
  if (eventType === 'pageview') {
    if (resolvedPath && resolvedPath === lastPageviewPath) return null;
    lastPageviewPath = resolvedPath || lastPageviewPath;
  }

  // One event per real action: replays of the same product/action (effect
  // re-runs, updater re-invocations, double clicks) inside the window are
  // counted once.
  const dedupeWindow = DEDUPE_WINDOWS[eventType];
  if (dedupeWindow && isDuplicateWithin(`${eventType}:${resolvedPath}:${productId}`, dedupeWindow)) return null;

  return fetch(`${config.apiUrl}/api/storefront/analytics/visitor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Id': config.companyId,
      'X-Site-Id': config.siteId,
    },
    body: JSON.stringify({
      sessionKey,
      eventType,
      path: resolvedPath,
      productId: String(productId || ''),
      attribution: getStorefrontAttribution(),
    }),
    keepalive: true,
  }).catch(() => {});
}

/** Test-only reset of module-level session/attribution/pageview state. */
export function _resetPlatformAnalyticsForTests() {
  memorySessionKey = '';
  memoryAttribution = null;
  lastPageviewPath = '';
  recentEvents.clear();
}
