// src/context/AuthContext.tsx
import React, {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import { Alert } from 'react-native';
import storage from '../services/storage';
import api, { AuthResponse } from '../services/api';
import { registerSessionExpiredHandler } from '../services/api';

export interface User {
  id:                 string;
  firstName:          string;
  lastName:           string;
  fullName:           string;
  email:              string;
  phoneNumber:        string;
  onboardingComplete: boolean;
  companyName?:       string;
  ein?:               string;
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
  updateOnboardingStatus: (complete: boolean) => void;
  updateUser:             (updated: Partial<User>) => void;
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

  const logout = useCallback(async (): Promise<void> => {
    await api.logout();
    setUser(null);
  }, []);

  // ── Global SESSION_EXPIRED handler ────────────────────────
  // api.ts calls this whenever refresh fails — clears session
  // and shows a single alert. AppNavigator reacts automatically.
  useEffect(() => {
    registerSessionExpiredHandler(async () => {
      await storage.clearAll();
      setUser(null);
      Alert.alert(
        'Session Expired',
        'Please sign in again to continue.',
      );
    });
  }, []);

  const loginWithTokens = useCallback(async (
    accessToken:  string,
    refreshToken: string,
    userData:     AuthResponse['user'],
  ): Promise<void> => {
    await storage.saveTokens(accessToken, refreshToken);
    await storage.saveUser(userData as User);
    setUser(userData as User);
  }, []);

  // ── Persist onboarding status to AsyncStorage ─────────────
  const updateOnboardingStatus = useCallback((complete: boolean): void => {
    setUser(prev => {
      if (!prev) { return prev; }
      const updated = { ...prev, onboardingComplete: complete };
      storage.saveUser(updated);
      return updated;
    });
  }, []);

  // ── Generic user update (used by ProfileScreen) ───────────
  const updateUser = useCallback((patch: Partial<User>): void => {
    setUser(prev => {
      if (!prev) { return prev; }
      const updated = { ...prev, ...patch };
      storage.saveUser(updated);
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      loginWithTokens,
      logout,
      updateOnboardingStatus,
      updateUser,
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