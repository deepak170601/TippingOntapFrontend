// src/context/AuthContext.tsx
import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';
import storage, { ConnectSnapshot } from '../services/storage';
import { cancelAllEventReminders } from '../services/notifications';
import api, { AuthResponse, ConnectStatus } from '../services/api';
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
  updateUser:             (updated: Partial<User>) => void;

  // ── Stripe Connect state ────────────────────────────────
  // Whether this merchant may take a card right now. Stripe turns charges on
  // as soon as identity clears and payouts on later, once the bank account is
  // verified — so this goes true well before onboarding is "complete", and it
  // is what the app should gate the tip flow on.
  canCollectTips:  boolean;

  // Whether they can move money out. False with canCollectTips true is the
  // normal middle state, not an error: tips are landing in a Stripe balance
  // the merchant cannot withdraw yet. Something must say so on screen.
  payoutsEnabled:  boolean;

  // The platform commission the backend actually charges. Null until the first
  // status refresh lands — render nothing rather than falling back to a
  // hardcoded rate, which is how the app previously came to display a fee that
  // no longer had to match what was charged.
  applicationFeePercent: number | null;

  // The last full GET /connect/status response, including what Stripe is
  // waiting for. Held in memory only — the persisted snapshot deliberately
  // keeps just the two flags, because requirements change as the merchant acts
  // on them and a cached list would send someone to re-upload a document they
  // already fixed. Null until the first refresh of this session lands.
  connectStatus: ConnectStatus | null;

  // Re-reads GET /connect/status. Returns the full response so a caller that
  // needs to branch on the result does not have to wait for a re-render.
  refreshConnectStatus: () => Promise<ConnectStatus | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]    = useState<User | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [connect,   setConnect] = useState<ConnectSnapshot | null>(null);
  const [status,    setStatus]  = useState<ConnectStatus | null>(null);

  // ── Restore session on app launch ─────────────────────────
  // The cached Connect snapshot is restored alongside the user so the very
  // first render already knows which half of the app to mount. Refreshing it
  // from the network happens after, in the effect below — blocking launch on
  // a request would mean a merchant with no signal never gets past the
  // spinner, and the cached answer is right nearly every time.
  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      try {
        const token = await storage.getAccessToken();
        if (!token) { return; }
        const refreshed = await api.refresh();
        if (refreshed) {
          const [storedUser, storedConnect] = await Promise.all([
            storage.getUser(),
            storage.getConnectStatus(),
          ]);
          setUser(storedUser as User | null);
          setConnect(storedConnect);
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
    // Reminders are scheduled on the device, not scoped to a session, so they
    // would happily fire for the previous merchant's events at whoever signs in
    // next. Cancelled before the session state clears, while we still own them.
    await cancelAllEventReminders();
    setUser(null);
    setConnect(null);   // scoped to one Stripe account — never outlive the session
    setStatus(null);
  }, []);

  // ── Global SESSION_EXPIRED handler ────────────────────────
  // api.ts calls this whenever refresh fails — clears session
  // and shows a single alert. AppNavigator reacts automatically.
  useEffect(() => {
    registerSessionExpiredHandler(async () => {
      await storage.clearAll();
      setUser(null);
      setConnect(null);
      setStatus(null);
      Alert.alert(
        'Session Expired',
        'Please sign in again to continue.',
      );
    });
  }, []);

  // ── Connect status ────────────────────────────────────────
  const refreshConnectStatus = useCallback(async (): Promise<ConnectStatus | null> => {
    try {
      const fresh = await api.getConnectStatus();

      // Full response in memory, minimal snapshot to disk. Requirements are
      // deliberately not persisted: they change as the merchant acts on them,
      // and a stale list would tell someone to re-upload a document they have
      // already fixed.
      setStatus(fresh);

      const snapshot: ConnectSnapshot = {
        canCollectTips:        fresh.canCollectTips,
        payoutsEnabled:        fresh.payoutsEnabled,
        applicationFeePercent: fresh.applicationFeePercent,
      };

      setConnect(snapshot);
      storage.saveConnectStatus(snapshot);

      // onboardingComplete lives on the user object and is the flag the rest of
      // the app still reads for "fully finished". Keep it in step here so the
      // two cannot disagree after a refresh.
      setUser(prev => {
        if (!prev || prev.onboardingComplete === fresh.onboardingComplete) { return prev; }
        const updated = { ...prev, onboardingComplete: fresh.onboardingComplete };
        storage.saveUser(updated);
        return updated;
      });

      return fresh;
    } catch {
      // Offline, or the call failed. Keep whatever we had — a merchant who
      // could collect a minute ago should not be thrown back to onboarding
      // because a status poll timed out.
      return null;
    }
  }, []);

  // Refresh on sign-in and whenever the app returns to the foreground. Between
  // those two, a merchant who finishes verification in the Stripe browser flow
  // sees the app catch up on its own when they switch back to it.
  const isAuthenticated = !!user;
  const refreshRef = useRef(refreshConnectStatus);
  refreshRef.current = refreshConnectStatus;

  useEffect(() => {
    if (!isAuthenticated) { return; }

    refreshRef.current();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { refreshRef.current(); }
    });

    return () => sub.remove();
  }, [isAuthenticated]);

  const loginWithTokens = useCallback(async (
    accessToken:  string,
    refreshToken: string,
    userData:     AuthResponse['user'],
  ): Promise<void> => {
    await storage.saveTokens(accessToken, refreshToken);
    await storage.saveUser(userData as User);
    setUser(userData as User);
  }, []);

  // NOTE: updateOnboardingStatus(complete) used to live here and is gone.
  // It set onboarding state locally from whatever the caller believed, which
  // is the pattern this change replaces — the only source of truth for these
  // flags is Stripe, read through GET /connect/status. Use
  // refreshConnectStatus() instead; it updates onboardingComplete too.

  // ── Generic user update (used by ProfileScreen) ───────────
  const updateUser = useCallback((patch: Partial<User>): void => {
    setUser(prev => {
      if (!prev) { return prev; }
      const updated = { ...prev, ...patch };
      storage.saveUser(updated);
      return updated;
    });
  }, []);

  // Falling back to onboardingComplete matters: a merchant who finished
  // onboarding long ago has that flag on their user object but no cached
  // Connect snapshot until the first refresh lands. Without the fallback,
  // every such merchant would be bounced to the onboarding screen for the
  // second or two it takes — a regression introduced by the very change meant
  // to let people in sooner. Fully onboarded implies charges are on, so the
  // fallback can only ever be too generous by that margin, and the endpoints
  // themselves re-check regardless.
  const canCollectTips = connect?.canCollectTips ?? user?.onboardingComplete ?? false;
  const payoutsEnabled = connect?.payoutsEnabled ?? user?.onboardingComplete ?? false;

  // No fallback here, deliberately. The two flags above degrade to a sensible
  // guess because being wrong costs a screen transition; a wrong fee is shown
  // to the merchant as fact and does not match what was charged.
  const applicationFeePercent = connect?.applicationFeePercent ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      loginWithTokens,
      logout,
      updateUser,
      canCollectTips,
      payoutsEnabled,
      applicationFeePercent,
      connectStatus: status,
      refreshConnectStatus,
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