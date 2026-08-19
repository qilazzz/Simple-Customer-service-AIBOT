import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  checkCustomerSession,
  loginCustomer as loginApi,
  logoutCustomer as logoutApi,
  registerCustomer as registerApi,
} from '../api/authApi';
import {
  clearCustomerSession,
  getStoredToken,
  getStoredUser,
  saveCustomerSession,
} from './customerAuthStorage';

const AuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const hydrateSession = useCallback(async () => {
    const storedToken = await getStoredToken();
    const storedUser = await getStoredUser();

    if (!storedToken) {
      setToken(null);
      setUser(null);
      return null;
    }

    try {
      const data = await checkCustomerSession(storedToken);
      if (!data.authenticated || !data.user) {
        await clearCustomerSession();
        setToken(null);
        setUser(null);
        return null;
      }

      await saveCustomerSession(storedToken, data.user);
      setToken(storedToken);
      setUser(data.user);
      return data.user;
    } catch {
      if (storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        return storedUser;
      }
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    hydrateSession().finally(() => setInitializing(false));
  }, [hydrateSession]);

  const login = useCallback(async (identifier, password) => {
    const data = await loginApi(identifier, password);
    await saveCustomerSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerApi(payload);
    await saveCustomerSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await logoutApi(token);
    }
    await clearCustomerSession();
    setToken(null);
    setUser(null);
  }, [token]);

  const getAuthHeaders = useCallback(
    (extra = {}) => {
      if (!token) return extra;
      return { ...extra, Authorization: `Bearer ${token}` };
    },
    [token],
  );

  const getAnalyticsUserId = useCallback(
    (guest = false) => {
      if (user?.user_id) return user.user_id;
      if (guest) return 'guest';
      return null;
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      initializing,
      login,
      register,
      logout,
      refreshSession: hydrateSession,
      getAuthHeaders,
      getAnalyticsUserId,
    }),
    [
      user,
      token,
      initializing,
      login,
      register,
      logout,
      hydrateSession,
      getAuthHeaders,
      getAnalyticsUserId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
}
