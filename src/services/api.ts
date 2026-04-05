// src/services/api.ts
import storage from './storage';

const BASE_URL = 'http://10.81.248.76:5203';

interface RequestBody {
  [key: string]: unknown;
}

const request = async <T>(
  method:       string,
  path:         string,
  body:         RequestBody | null = null,
  requiresAuth: boolean = false,
  isRetry:      boolean = false,
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = await storage.getAccessToken();
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
  }

  const options: RequestInit = { method, headers };
  if (body) { options.body = JSON.stringify(body); }

  // ── Log outgoing request ───────────────────────────────────
  console.log(`🚀 [API] ${method} ${path}`, body ? JSON.stringify(body, null, 2) : '');

  // ── Network errors ─────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error('Cannot reach server. Check your connection.');
  }

  // ── 401 refresh flow ───────────────────────────────────────
  if (response.status === 401 && requiresAuth && !isRetry) {
    const refreshed = await api.refresh();
    if (refreshed) { return request<T>(method, path, body, true, true); }
    throw new Error('SESSION_EXPIRED');
  }

  // ── Parse response ─────────────────────────────────────────
  let data: T & {
    message?: string;
    title?:   string;
    errors?:  Record<string, string[]>;
  };

  try {
    data = await response.json();
  } catch {
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  // ── Log response ───────────────────────────────────────────
  console.log(`${response.ok ? '✅' : '❌'} [API] ${response.status} ${path}`, JSON.stringify(data, null, 2));

  // ── Extract error message ──────────────────────────────────
  if (!response.ok) {
    if (data.message) { throw new Error(data.message); }
    if (data.errors) {
      const firstField = Object.values(data.errors)[0];
      const firstMsg   = Array.isArray(firstField) ? firstField[0] : null;
      if (firstMsg) { throw new Error(firstMsg); }
    }
    if (data.title) { throw new Error(data.title); }
    throw new Error(`Request failed (${response.status})`);
  }

  return data;
};

// ── Auth ──────────────────────────────────────────────────────
// Change to:
export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  user: {
    id:           string;
    firstName:    string;
    lastName:     string;
    fullName:     string;
    email:        string;
    phoneNumber:  string;
    companyName?: string;
    address1?:    string;
    address2?:    string;
    city?:        string;
    state?:       string;
    zip?:         string;
  };
}

// ── Events ────────────────────────────────────────────────────
export interface Event {
  id:            string;
  name:          string;
  date:          string;
  time?:         string;
  location:      string;
  description?:  string;
  tipOptions:    number[];
  status:        'upcoming' | 'active' | 'past';
  tipsCollected: number;
  totalAmount:   number;
  startedAt?:    string;
  endedAt?:      string;
}

export interface EventsResponse {
  upcoming: Event[];
  active:   Event[];
  past:     Event[];
}

// ── Stats / Wallet ────────────────────────────────────────────
export interface HomeStats { totalProfit: number; }

export interface DailyEarning {
  date:     string;
  total:    number;
  tipCount: number;
}

export interface WalletData {
  totalAllTime: number;
  days:         DailyEarning[];
}

// ── Terminal ──────────────────────────────────────────────────
export interface ConnectionToken   { secret: string; }
export interface PaymentIntentData { id: string; clientSecret: string; }

// ── Phone OTP verify response ─────────────────────────────────
export interface VerifyPhoneResponse {
  newUser:       boolean;
  phoneNumber?:  string;
  accessToken?:  string;
  refreshToken?: string;
  expiresIn?:    number;
  user?:         AuthResponse['user'];
}

export const api = {

  // ── Auth — Phone OTP ────────────────────────────────────────
  sendPhoneOtp: (phoneNumber: string) =>
    request<{ message: string }>('POST', '/auth/send-phone-otp', { phoneNumber }),

  verifyPhoneOtp: (phoneNumber: string, code: string) =>
    request<VerifyPhoneResponse>('POST', '/auth/verify-phone-otp', { phoneNumber, code }),

  // ── Auth — Email OTP ─────────────────────────────────────────
  sendEmailOtp: (email: string) =>
    request<{ message: string }>('POST', '/auth/send-email-otp', { email }),

  verifyEmailOtp: (email: string, code: string) =>
    request<{ message: string }>('POST', '/auth/verify-email-otp', { email, code }),

  // ── Auth — Register ───────────────────────────────────────────
  register: (body: {
    phoneNumber:  string;
    firstName:    string;
    lastName:     string;
    email:        string;
    address1:     string;
    city:         string;
    state:        string;
    zip:          string;
    address2?:    string;
    companyName?: string;
    ein?:         string;
  }) => request<AuthResponse>('POST', '/auth/register', body),

  // ── Auth — Refresh / Logout ───────────────────────────────────
  refresh: async (): Promise<boolean> => {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) { return false; }
      const data = await request<AuthResponse>('POST', '/auth/refresh', { refreshToken });
      await storage.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch { return false; }
  },

  logout: async (): Promise<void> => {
    try {
      const refreshToken = await storage.getRefreshToken();
      await request('POST', '/auth/logout', { refreshToken }, true);
    } catch { /* always clear local */ }
    await storage.clearAll();
  },

  // ── Events ──────────────────────────────────────────────────
  getEvents: () =>
    request<EventsResponse>('GET', '/events', null, true),

  createEvent: (body: {
    name:         string;
    date:         string;
    time?:        string;
    location:     string;
    description?: string;
    tipOptions:   number[];
  }) => request<Event>('POST', '/events', body, true),

  startEvent: (eventId: string) =>
    request<void>('POST', `/events/${eventId}/start`, null, true),

  endEvent: (eventId: string) =>
    request<void>('POST', `/events/${eventId}/end`, null, true),

  // ── Tips ────────────────────────────────────────────────────
  getEventTips: (eventId: string) =>
    request<{ totalAmount: number; tipsCollected: number }>('GET', `/events/${eventId}/tips`, null, true),

  // ── Stats / Wallet ──────────────────────────────────────────
  getHomeStats: () =>
    request<HomeStats>('GET', '/stats/home', null, true),

  getWallet: () =>
    request<WalletData>('GET', '/wallet', null, true),

  // ── Stripe Terminal ─────────────────────────────────────────
  getConnectionToken: () =>
    request<ConnectionToken>('POST', '/connection_token', null, true),

  createPaymentIntent: (amountCents: number, eventId: string) =>
    request<PaymentIntentData>('POST', '/create_payment_intent', { amount: amountCents, eventId }, true),

  capturePaymentIntent: (paymentIntentId: string, eventId: string) =>
    request<void>('POST', '/capture_payment_intent', { paymentIntentId, eventId }, true),
};

export default api;