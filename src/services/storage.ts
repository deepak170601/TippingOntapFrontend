// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id:       string;
  fullName: string;
  email:    string;
}

// What GET /connect/status last told us. Cached because AppNavigator decides
// which half of the app to mount from canCollectTips, and that flag is not in
// the login payload — without a stored value every cold start would flash the
// onboarding screen at a merchant who finished onboarding weeks ago.
//
// A hint, never truth: refreshed on launch and on resume, and every endpoint it
// guards re-checks server-side regardless.
export interface ConnectSnapshot {
  canCollectTips: boolean;
  payoutsEnabled: boolean;
}

const KEYS = {
  ACCESS_TOKEN:  'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER:          'auth_user',
  CONNECT:       'auth_connect_status',
} as const;

export const storage = {
  saveTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    await AsyncStorage.multiSet([
      [KEYS.ACCESS_TOKEN,  accessToken],
      [KEYS.REFRESH_TOKEN, refreshToken],
    ]);
  },

  getAccessToken: async (): Promise<string | null> =>
    AsyncStorage.getItem(KEYS.ACCESS_TOKEN),

  getRefreshToken: async (): Promise<string | null> =>
    AsyncStorage.getItem(KEYS.REFRESH_TOKEN),

  saveUser: async (user: User): Promise<void> => {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  getUser: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  },

  saveConnectStatus: async (status: ConnectSnapshot): Promise<void> => {
    await AsyncStorage.setItem(KEYS.CONNECT, JSON.stringify(status));
  },

  getConnectStatus: async (): Promise<ConnectSnapshot | null> => {
    const raw = await AsyncStorage.getItem(KEYS.CONNECT);
    if (!raw) { return null; }
    try {
      return JSON.parse(raw) as ConnectSnapshot;
    } catch {
      return null;   // corrupt entry is the same as no entry
    }
  },

  // Must include CONNECT: these flags are scoped to one merchant's Stripe
  // account, so leaving them behind at logout would let the next merchant to
  // sign in on this device inherit the previous one's onboarding state.
  clearAll: async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      KEYS.ACCESS_TOKEN,
      KEYS.REFRESH_TOKEN,
      KEYS.USER,
      KEYS.CONNECT,
    ]);
  },
};

export default storage;