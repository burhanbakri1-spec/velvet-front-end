/**
 * Customer authentication API contract for the VELVET storefront.
 *
 * Verified staging contract (iGroup platform, tenant headers required):
 * - POST   /api/auth/register { name, email, phone, password } → 201 { token, user }
 * - POST   /api/auth/login    { email, password } → 200 { token, user }
 * - POST   /api/auth/logout   (Bearer) → 200
 * - GET    /api/auth/me       (Bearer) → 200 user
 * - PATCH  /api/auth/me       (Bearer) { name?, phone?, ... } → 200 user
 *
 * The token is persisted in localStorage and the session is hydrated via
 * /api/auth/me on boot (see AuthContext). Auth is enabled when the platform
 * API origin + company/site tenant headers are configured; a legacy
 * VITE_CUSTOMER_AUTH_API override is still honoured for backward compatibility.
 */

import {
  getStorefrontApiConfig,
  isStorefrontApiConfigured,
  parseJsonResponse,
  readErrorDetail,
  storefrontFetch,
} from './apiClient.js';

export function getCustomerAuthConfig(env = import.meta.env || {}) {
  const explicit = String(env.VITE_CUSTOMER_AUTH_API || '').trim().replace(/\/$/, '');
  if (explicit) {
    return { enabled: true, apiUrl: explicit, source: 'VITE_CUSTOMER_AUTH_API' };
  }
  const platform = getStorefrontApiConfig(env);
  const enabled = isStorefrontApiConfigured(env);
  return {
    enabled,
    apiUrl: platform.apiUrl || '',
    source: enabled ? 'VITE_IGROUP_API_URL' : 'none',
  };
}

export function isCustomerAuthConfigured(env = import.meta.env || {}) {
  return getCustomerAuthConfig(env).enabled;
}

function authBase(env) {
  const config = getCustomerAuthConfig(env);
  return config.apiUrl;
}

function authHeaders(token = '') {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function authFetch(path, { method = 'POST', body, token, env } = {}) {
  const base = authBase(env);
  if (!base) {
    return {
      ok: false,
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Customer authentication API is not configured for this storefront.',
    };
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: authHeaders(token),
    body: body == null ? undefined : JSON.stringify(body),
  });
  return response;
}

/** True when authFetch returned the unconfigured sentinel (not a Response). */
function isUnconfiguredResponse(response) {
  return Boolean(response && typeof response === 'object' && response.code === 'AUTH_NOT_CONFIGURED');
}

function normalizeAuthResult(response, payload) {
  if (!response.ok) {
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: payload?.message || payload?.error || 'Unable to complete the request.',
    };
  }
  return {
    ok: true,
    token: payload?.token || payload?.accessToken || null,
    customer: payload?.customer || payload?.user || null,
  };
}

/**
 * Attempt login against the real customer-auth API when configured.
 * Never invents users or returns a fake success session.
 */
export async function loginCustomer({ email, password }, env = import.meta.env || {}) {
  const response = await authFetch('/api/auth/login', { body: { email, password }, env });
  if (isUnconfiguredResponse(response)) return response;
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: detail || 'Unable to sign in with those credentials.',
    };
  }
  const payload = await parseJsonResponse(response);
  return normalizeAuthResult(response, payload);
}

/** Register a new customer. Returns the same { token, user } shape as login. */
export async function registerCustomer({ name, email, phone, password }, env = import.meta.env || {}) {
  const response = await authFetch('/api/auth/register', {
    body: { name, email, phone, password },
    env,
  });
  if (isUnconfiguredResponse(response)) return response;
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: detail || 'Unable to create your account.',
    };
  }
  const payload = await parseJsonResponse(response);
  return normalizeAuthResult(response, payload);
}

/** Best-effort server-side logout. Callers clear local state regardless. */
export async function logoutCustomer(token, env = import.meta.env || {}) {
  const response = await authFetch('/api/auth/logout', { method: 'POST', token, env });
  if (isUnconfiguredResponse(response)) return response;
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to sign out.' };
  }
  return { ok: true };
}

/** Hydrate the current session from the server (Bearer token required). */
export async function fetchMe(token, env = import.meta.env || {}) {
  const response = await authFetch('/api/auth/me', { method: 'GET', token, env });
  if (isUnconfiguredResponse(response)) return response;
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: detail || 'Unable to load your account.',
    };
  }
  const payload = await parseJsonResponse(response);
  const user = payload?.customer || payload?.user || payload;
  return { ok: true, customer: user || null };
}

/** Update the current customer profile (name, phone, ...). */
export async function updateMe(patch, token, env = import.meta.env || {}) {
  const response = await authFetch('/api/auth/me', { method: 'PATCH', body: patch, token, env });
  if (isUnconfiguredResponse(response)) return response;
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: detail || 'Unable to update your profile.',
    };
  }
  const payload = await parseJsonResponse(response);
  const user = payload?.customer || payload?.user || payload;
  return { ok: true, customer: user || null };
}

/**
 * Address book helpers (Bearer required).
 * GET /api/addresses → list; POST /api/addresses { label, fullName, phone, city, address, notes? };
 * DELETE /api/addresses/:id.
 */
export async function fetchAddresses(token, env = import.meta.env || {}) {
  const response = await storefrontFetch('/api/addresses', { token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to load addresses.' };
  }
  const payload = await parseJsonResponse(response);
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.addresses) ? payload.addresses : []);
  return { ok: true, addresses: list };
}

export async function createAddress(address, token, env = import.meta.env || {}) {
  const response = await storefrontFetch('/api/addresses', { method: 'POST', body: address, token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to save the address.' };
  }
  const payload = await parseJsonResponse(response);
  return { ok: true, address: payload?.address || payload || null };
}

export async function deleteAddress(addressId, token, env = import.meta.env || {}) {
  const response = await storefrontFetch(`/api/addresses/${encodeURIComponent(addressId)}`, {
    method: 'DELETE',
    token,
  });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to delete the address.' };
  }
  return { ok: true };
}