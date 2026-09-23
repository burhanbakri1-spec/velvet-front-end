/**
 * Shared storefront API client for the iGroup platform.
 *
 * All customer-facing API calls (auth, favorites, orders, reviews, addresses)
 * go through this helper so tenant headers and the Bearer token are attached
 * consistently. The API origin is the same one used for platform content
 * (VITE_IGROUP_API_URL); a legacy VITE_CUSTOMER_AUTH_API override is still
 * honoured for auth calls only.
 */

import { platformContentConfig } from './platformContent.js';

export const CUSTOMER_TOKEN_KEY = 'velvet-customer-token';

export function getStorefrontApiConfig(env = import.meta.env || {}) {
  const platform = platformContentConfig(env);
  return {
    apiUrl: String(platform.apiUrl || '').replace(/\/$/, ''),
    companyId: String(platform.companyId || ''),
    siteId: String(platform.siteId || ''),
  };
}

/** Auth is available when the API origin + tenant headers are configured. */
export function isStorefrontApiConfigured(env = import.meta.env || {}) {
  const config = getStorefrontApiConfig(env);
  return Boolean(config.apiUrl && config.companyId && config.siteId);
}

export function getStoredToken() {
  try {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(CUSTOMER_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    else window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}

/** Tenant headers + optional Bearer token (falls back to the stored token). */
export function buildTenantHeaders(token = '') {
  const config = getStorefrontApiConfig();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (config.companyId) headers['X-Company-Id'] = config.companyId;
  if (config.siteId) headers['X-Site-Id'] = config.siteId;
  const authToken = token || getStoredToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

/**
 * Fetch against the storefront API origin with tenant headers + Bearer token.
 * Throws when the API origin is not configured so callers never hit a bare
 * relative URL by accident.
 */
export async function storefrontFetch(path, { method = 'GET', body, token, headers = {} } = {}) {
  const config = getStorefrontApiConfig();
  if (!config.apiUrl) {
    throw new Error('Storefront API is not configured for this storefront.');
  }
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: { ...buildTenantHeaders(token), ...headers },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return response;
}

/** Parse a JSON response defensively; returns null when the body is empty. */
export async function parseJsonResponse(response) {
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Normalize an error response into a friendly message. */
export async function readErrorDetail(response) {
  const payload = await parseJsonResponse(response);
  return String(payload?.message || payload?.error || '').trim();
}