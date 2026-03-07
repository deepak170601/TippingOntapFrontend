// src/hooks/useAuth.ts
// ─────────────────────────────────────────────────────────────
// Convenience wrapper around AuthContext.
// Any screen that needs auth actions uses this hook —
// never calls AuthContext directly.
// ─────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { useAuthContext } from '../context/AuthContext';

interface UseAuthReturn {
  user:            { id: string; fullName: string; email: string } | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  errorMsg:        string;
  clearError:      () => void;
  login:           (email: string, password: string) => Promise<boolean>;
  signup:          (fullName: string, email: string, password: string) => Promise<boolean>;
  logout:          () => Promise<void>;
}

const useAuth = (): UseAuthReturn => {
  const {
    login:   contextLogin,
    signup:  contextSignup,
    logout:  contextLogout,
    user,
    isAuthenticated,
  } = useAuthContext();

  const [isLoading, setLoading]  = useState<boolean>(false);
  const [errorMsg,  setErrorMsg] = useState<string>('');

  const login = useCallback(async (
    email: string, password: string,
  ): Promise<boolean> => {
    setLoading(true);
    setErrorMsg('');
    try {
      await contextLogin(email, password);
      return true;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [contextLogin]);

  const signup = useCallback(async (
    fullName: string, email: string, password: string,
  ): Promise<boolean> => {
    setLoading(true);
    setErrorMsg('');
    try {
      await contextSignup(fullName, email, password);
      return true;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign up failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [contextSignup]);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await contextLogout();
    } finally {
      setLoading(false);
    }
  }, [contextLogout]);

  const clearError = useCallback(() => setErrorMsg(''), []);

  return {
    user,
    isAuthenticated,
    isLoading,
    errorMsg,
    clearError,
    login,
    signup,
    logout,
  };
};

export default useAuth;