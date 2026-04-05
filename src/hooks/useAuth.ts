// src/hooks/useAuth.ts
import { useCallback } from 'react';
import { useAuthContext } from '../context/AuthContext';
import type { AuthResponse } from '../services/api';

interface UseAuthReturn {
  user:            ReturnType<typeof useAuthContext>['user'];
  isAuthenticated: boolean;
  isLoading:       boolean;
  loginWithTokens: (accessToken: string, refreshToken: string, user: AuthResponse['user']) => Promise<void>;
  logout:          () => Promise<void>;
}

const useAuth = (): UseAuthReturn => {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithTokens,
    logout,
  } = useAuthContext();

  return {
    user,
    isAuthenticated,
    isLoading,
    loginWithTokens,
    logout,
  };
};

export default useAuth;