import { createContext, useContext, useMemo, useState } from 'react';
import { isCustomerAuthConfigured, loginCustomer } from '../data/customerAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const authConfigured = isCustomerAuthConfigured();

  const value = useMemo(() => ({
    customer,
    token,
    isAuthenticated: Boolean(customer && token),
    authConfigured,
    async login(credentials) {
      const result = await loginCustomer(credentials);
      if (result.ok && result.customer) {
        setCustomer(result.customer);
        setToken(result.token || 'session');
      }
      return result;
    },
    logout() {
      setCustomer(null);
      setToken(null);
    },
  }), [authConfigured, customer, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
