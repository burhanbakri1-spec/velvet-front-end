import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchMe,
  isCustomerAuthConfigured,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  updateMe,
} from '../data/customerAuth';
import { getStoredToken, setStoredToken } from '../data/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [hydrating, setHydrating] = useState(false);
  const authConfigured = isCustomerAuthConfigured();

  // Hydrate the session from the persisted token on boot (GET /api/auth/me).
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) return undefined;
    let cancelled = false;
    setHydrating(true);
    fetchMe(stored)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.customer) {
          setCustomer(result.customer);
          setToken(stored);
        } else {
          // Expired/invalid token — clear it, never keep a fake session.
          setStoredToken('');
          setToken(null);
          setCustomer(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStoredToken('');
        setToken(null);
        setCustomer(null);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({
    customer,
    token,
    isAuthenticated: Boolean(customer && token),
    authConfigured,
    hydrating,
    async login(credentials) {
      const result = await loginCustomer(credentials);
      if (result.ok && result.customer) {
        setCustomer(result.customer);
        setToken(result.token || 'session');
        setStoredToken(result.token || '');
      }
      return result;
    },
    async register(details) {
      const result = await registerCustomer(details);
      if (result.ok && result.customer) {
        setCustomer(result.customer);
        setToken(result.token || 'session');
        setStoredToken(result.token || '');
      }
      return result;
    },
    async logout() {
      const current = token;
      setCustomer(null);
      setToken(null);
      setStoredToken('');
      if (current && current !== 'session') {
        try {
          await logoutCustomer(current);
        } catch {
          // Best-effort server logout; local session is already cleared.
        }
      }
    },
    async updateProfile(patch) {
      const result = await updateMe(patch, token);
      if (result.ok && result.customer) setCustomer(result.customer);
      return result;
    },
  }), [authConfigured, customer, hydrating, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}