import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe } from '../api/wpcom';
import { queryClient } from '../lib/queryClient';
import type { WPComUser } from '../api/types';

interface AuthState {
  token: string | null;
  user: WPComUser | null;
  isLoading: boolean;
  isAuthed: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'cortex_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<WPComUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const login = useCallback(async (newToken: string) => {
    try {
      const me = await getMe(newToken);
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      throw new Error('Failed to authenticate');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  // Validate stored token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    let cancelled = false;
    getMe(stored)
      .then((me) => {
        if (!cancelled) {
          setToken(stored);
          setUser(me);
        }
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        isAuthed: !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
