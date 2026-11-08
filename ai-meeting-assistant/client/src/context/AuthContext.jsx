import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TOKEN_KEY } from '../services/api.js';
import * as authService from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }

    authService.getCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));

    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const establishSession = useCallback((response) => {
    localStorage.setItem(TOKEN_KEY, response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login: async (credentials) => establishSession(await authService.login(credentials)),
    register: async (details) => establishSession(await authService.register(details)),
    logout,
  }), [user, isLoading, logout, establishSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
