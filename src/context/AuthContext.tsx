// src/context/AuthContext.tsx
import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import storage from '../services/storage';
import api, { AuthResponse } from '../services/api';

interface User {
  id:       string;
  fullName: string;
  email:    string;
}

interface AuthContextType {
  user:            User | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  login:           (email: string, password: string) => Promise<User>;
  signup:          (fullName: string, email: string, password: string) => Promise<User>;
  logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]    = useState<User | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);

  // On app launch — restore session from storage
  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      try {
        const token = await storage.getAccessToken();
        if (!token) { return; }
        const refreshed = await api.refresh();
        if (refreshed) {
          const storedUser = await storage.getUser();
          setUser(storedUser);
        }
      } catch {
        await storage.clearAll();
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (
    email: string, password: string,
  ): Promise<User> => {
    const data: AuthResponse = await api.login(email, password);
    await storage.saveTokens(data.accessToken, data.refreshToken);
    await storage.saveUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (
    fullName: string, email: string, password: string,
  ): Promise<User> => {
    await api.signup(fullName, email, password);
    return login(email, password);
  }, [login]);

  const logout = useCallback(async (): Promise<void> => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      login, signup, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) { throw new Error('useAuthContext must be used within AuthProvider'); }
  return ctx;
};

export default AuthContext;