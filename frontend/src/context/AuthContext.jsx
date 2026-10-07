import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    await api.post('/auth/login', { username, password });
    const r = await api.get('/auth/me');
    setUser(r.data.user);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const can = (permission) => !!user && user.permissions.includes(permission);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
