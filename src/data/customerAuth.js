/**
 * Customer authentication API contract for the VELVET storefront.
 *
 * No customer-auth endpoints are wired in this frontend today.
 * When the platform exposes them, point VITE_CUSTOMER_AUTH_API (or reuse the
 * storefront API origin) at the host that serves these routes.
 *
 * Expected endpoints (adjust paths to match the real platform contract):
 * - POST   {base}/api/customer/auth/login     { email, password } → { token, customer }
 * - POST   {base}/api/customer/auth/logout    (Bearer) → 204
 * - GET    {base}/api/customer/auth/me        (Bearer) → { customer }
 * - POST   {base}/api/customer/auth/register  { email, password, name? } → { token, customer }
 */

import { platformContentConfig } from './platformContent.js';

export function getCustomerAuthConfig(env = import.meta.env || {}) {
  const explicit = String(env.VITE_CUSTOMER_AUTH_API || '').trim().replace(/\/$/, '');
  if (explicit) {
    return { enabled: true, apiUrl: explicit, source: 'VITE_CUSTOMER_AUTH_API' };
  }
  const platform = platformContentConfig(env);
  // Platform content API alone is not customer auth — keep auth disabled until
  // an explicit customer-auth base URL (or dedicated endpoints) exist.
  return {
    enabled: false,
    apiUrl: platform.apiUrl || '',
    source: 'none',
  };
}

export function isCustomerAuthConfigured(env = import.meta.env || {}) {
  return getCustomerAuthConfig(env).enabled;
}

/**
 * Attempt login against a real customer-auth API when configured.
 * Never invents users or returns a fake success session.
 */
export async function loginCustomer({ email, password }, env = import.meta.env || {}) {
  const config = getCustomerAuthConfig(env);
  if (!config.enabled) {
    return {
      ok: false,
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Customer authentication API is not configured for this storefront.',
    };
  }

  const response = await fetch(`${config.apiUrl}/api/customer/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.message || payload?.error || '';
    } catch {
      detail = '';
    }
    return {
      ok: false,
      code: 'AUTH_FAILED',
      status: response.status,
      message: detail || 'Unable to sign in with those credentials.',
    };
  }

  const payload = await response.json();
  return {
    ok: true,
    token: payload.token || payload.accessToken || null,
    customer: payload.customer || payload.user || null,
  };
}
