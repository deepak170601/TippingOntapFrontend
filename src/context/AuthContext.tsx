// src/context/AuthContext.tsx
import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import storage from '../services/storage';
import api, { AuthResponse } from '../services/api';

// ── User type — updated to match new backend shape ────────────
export interface User {
  id:                 string;
  firstName:          string;
  lastName:           string;
  fullName:           string;
  email:              string;
  phoneNumber:        string;
  onboardingComplete: boolean;   // ← Goal 7
  companyName?:       string;
  address1?:          string;
  address2?:          string;
  city?:              string;
  state?:             string;
  zip?:               string;
}

interface AuthContextType {
  user:                   User | null;
  isLoading:              boolean;
  isAuthenticated:        boolean;
  loginWithTokens:        (accessToken: string, refreshToken: string, user: AuthResponse['user']) => Promise<void>;
  logout:                 () => Promise<void>;
  updateOnboardingStatus: (complete: boolean) => void;   // ← Goal 7
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]    = useState<User | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);

  // ── Restore session on app launch ─────────────────────────
  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      try {
        const token = await storage.getAccessToken();
        if (!token) { return; }
        const refreshed = await api.refresh();
        if (refreshed) {
          const storedUser = await storage.getUser();
          setUser(storedUser as User | null);
        } else {
          await storage.clearAll();
        }
      } catch {
        await storage.clearAll();
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // ── loginWithTokens — called after OTP verify or register ──
  const loginWithTokens = useCallback(async (
    accessToken:  string,
    refreshToken: string,
    userData:     AuthResponse['user'],
  ): Promise<void> => {
    await storage.saveTokens(accessToken, refreshToken);
    await storage.saveUser(userData);
    setUser(userData as User);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await api.logout();
    setUser(null);
  }, []);

  // ── updateOnboardingStatus — Goal 7 ───────────────────────
  const updateOnboardingStatus = useCallback((complete: boolean): void => {
    setUser(prev => prev ? { ...prev, onboardingComplete: complete } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      loginWithTokens,
      logout,
      updateOnboardingStatus,
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