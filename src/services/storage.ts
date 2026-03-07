// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id:       string;
  fullName: string;
  email:    string;
}

const KEYS = {
  ACCESS_TOKEN:  'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER:          'auth_user',
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

  clearAll: async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      KEYS.ACCESS_TOKEN,
      KEYS.REFRESH_TOKEN,
      KEYS.USER,
    ]);
  },
};

export default storage;