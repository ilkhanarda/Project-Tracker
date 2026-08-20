import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '@/lib/api';
import { sessionStorage } from '@/lib/session-storage';

import {
  getCurrentUserRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
} from './api';
import type { LoginValues, RegisterValues, User } from './types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (values: LoginValues) => Promise<void>;
  register: (values: RegisterValues) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const token = await sessionStorage.get();

      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await getCurrentUserRequest();
        if (isMounted) setUser(response.user);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await sessionStorage.remove();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(values: LoginValues) {
    const response = await loginRequest(values);
    await sessionStorage.set(response.session.token);
    setUser(response.user);
  }

  async function register(values: RegisterValues) {
    const response = await registerRequest(values);
    await sessionStorage.set(response.session.token);
    setUser(response.user);
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      await sessionStorage.remove();
      setUser(null);
    }
  }

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
