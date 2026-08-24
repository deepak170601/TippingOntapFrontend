// src/services/api.ts
import storage from './storage';
import env from '../config/env';

// Chosen by build type in src/config/env.ts — never hardcode a host here.
const BASE_URL = env.apiBaseUrl;
const REQUEST_TIMEOUT_MS = 15000;

interface RequestBody {
  [key: string]: unknown;
}

export interface Payout {
  id:           string;
  amount:       number;   // cents
  currency:     string;
  status:       'paid' | 'pending' | 'in_transit' | 'failed' | 'canceled';
  arrivalDate?: string;
  createdAt:    string;
  failureCode?: string;
}

// ── Dev-only logging ────────────────────────────────────────────
declare const __DEV__: boolean;

const log = (...args: unknown[]) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(...args);
  }
};

const SENSITIVE_KEYS = ['accessToken', 'refreshToken', 'code'];

const sanitize = (body: unknown): unknown => {
  if (!body || typeof body !== 'object') return body;

  const copy = { ...(body as Record<string, unknown>) };

  for (const key of SENSITIVE_KEYS) {
    if (key in copy) { copy[key] = '***'; }
  }

  return copy;
};

// ── Error extraction ────────────────────────────────────────────
// The backend emits two envelope shapes:
//   controller validation → { "message": "..." }
//   middleware exceptions → { "code": "forbidden", "error": "..." }
// extractError below reads both; ApiError carries the status and code
// through so call sites can tell retryable failures from terminal ones.
interface ErrorShape {
  message?: string;
  error?:   string;
  code?:    string;
  title?:   string;
  errors?:  Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?:  string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.code   = code;
  }

  // Upstream Stripe failures and rate limiting are worth retrying;
  // validation and ownership errors are not.
  get isRetryable(): boolean {
    return this.status === 502
        || this.status === 429
        || this.code === 'stripe_error'
        || this.code === 'rate_limited';
  }
}

const extractError = (data: ErrorShape): string | null => {
  if (data.message) { return data.message; }
  if (data.error) { return data.error; }

  if (data.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first.length) { return first[0]; }
  }

  if (data.title) { return data.title; }

  return null;
};

// ── Auth header helper ──────────────────────────────────────────
const addAuthHeader = async (headers: Record<string, string>): Promise<void> => {
  const token = await storage.getAccessToken();
  if (token) { headers['Authorization'] = `Bearer ${token}`; }
};

// ── Prevent concurrent refresh requests ─────────────────────────
let refreshPromise: Promise<boolean> | null = null;

const refreshOnce = (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = api.refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// ── Session expiry callback ───────────────────────────────────
// AuthContext registers a handler here on mount. When refresh
// fails, api.ts invokes it to clear session state globally
// instead of every screen catching SESSION_EXPIRED itself.
type SessionExpiredHandler = () => void | Promise<void>;
let sessionExpiredHandler: SessionExpiredHandler | null = null;
export const registerSessionExpiredHandler = (fn: SessionExpiredHandler): void => {
  sessionExpiredHandler = fn;
};

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
    await addAuthHeader(headers);
  }

  const options: RequestInit = { method, headers };
  if (body) { options.body = JSON.stringify(body); }

  // ── Log outgoing request ───────────────────────────────────
  log(`🚀 [API] ${method} ${path}`, body ? JSON.stringify(sanitize(body), null, 2) : '');

  // ── Network errors / timeout ───────────────────────────────
  const url = new URL(path, BASE_URL).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw new Error('Cannot reach server. Check your connection.');
  } finally {
    clearTimeout(timeoutId);
  }

  // ── 401 refresh flow ───────────────────────────────────────
  if (response.status === 401 && requiresAuth && !isRetry) {
    const refreshed = await refreshOnce();
    if (refreshed) { return request<T>(method, path, body, true, true); }
    // Refresh failed — notify AuthContext to clear session globally
    if (sessionExpiredHandler) { await sessionExpiredHandler(); }
    throw new Error('SESSION_EXPIRED');
  }

  // ── Parse response (handles empty/204 bodies) ──────────────
  let data: T & ErrorShape;

  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : (undefined as unknown as T & ErrorShape);
  } catch {
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  // ── Log response ───────────────────────────────────────────
  log(`${response.ok ? '✅' : '❌'} [API] ${response.status} ${path}`, JSON.stringify(data, null, 2));

  // ── Extract error message ──────────────────────────────────
  if (!response.ok) {
    const shape = (data ?? {}) as ErrorShape;
    throw new ApiError(
      extractError(shape) ?? `Request failed (${response.status})`,
      response.status,
      shape.code,
    );
  }

  return data;
};

// ── Auth ──────────────────────────────────────────────────────
export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  user: {
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

  // ── Stripe Connect ─────────────────────────────────────────────
  getOnboardingLink: () =>
    request<{ url: string }>('POST', '/connect/onboard', null, true),

  getConnectStatus: () =>
    request<{
      onboardingComplete: boolean;
      chargesEnabled:     boolean;
      payoutsEnabled:     boolean;
    }>('GET', '/connect/status', null, true),

  getConnectBalance: () =>
    request<{
      available: number;  // cents
      pending:   number;  // cents
    }>('GET', '/connect/balance', null, true),

  withdraw: (amountCents?: number) =>
    request<{
      payoutId: string;
      message:  string;
    }>('POST', '/connect/withdraw', { amountCents: amountCents ?? null }, true),

    // ── Profile ─────────────────────────────────────────────────
getProfile: () =>
  request<AuthResponse['user'] & { ein?: string }>('GET', '/profile', null, true),

updateProfile: (body: {
  firstName:    string;
  lastName:     string;
  address1:     string;
  city:         string;
  state:        string;
  zip:          string;
  address2?:    string;
  companyName?: string;
  ein?:         string;
}) => request<AuthResponse['user'] & { ein?: string }>('PUT', '/profile', body, true),

// ── Payout history ──────────────────────────────────────────
getPayouts: (limit: number = 25) =>
  request<{ payouts: Payout[] }>('GET', `/connect/payouts?limit=${limit}`, null, true)
};

export default api;