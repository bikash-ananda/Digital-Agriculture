import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.user);
    return response.data.user;
  };

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('da:unauthorized', onUnauthorized);
    refresh().catch(() => setUser(null)).finally(() => setLoading(false));
    return () => window.removeEventListener('da:unauthorized', onUnauthorized);
  }, []);

  const login = async (email, password) => {
    // Keep the legacy field during rollout: older API builds validate `username`.
    const loginId = String(email || '').trim().toLowerCase();
    const response = await api.post('/auth/login', { email: loginId, username: loginId, password });
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); }
    finally { setUser(null); }
  };

  const can = (permission) => !!user?.permissions?.includes(permission);

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh, can }}>{children}</AuthContext.Provider>;
}
