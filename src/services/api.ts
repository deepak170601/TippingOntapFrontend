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
    // refreshOnce() throwing and refreshOnce() resolving false used to mean
    // the same thing here: log the merchant out. They are not the same thing.
    // A thrown error means the /auth/refresh call itself never got a clean
    // answer — no connection, a timeout, or the backend's machine waking from
    // Fly's min_machines_running = 0 taking a moment — none of which says
    // anything about whether the refresh token is still good. Only a real
    // 401 from that endpoint says that, and api.refresh() below now returns
    // false for exactly that case and only that case. So a thrown error here
    // surfaces as an ordinary failed request, session left alone, rather than
    // clearing a merchant's session because their train went through a tunnel.
    const refreshed = await refreshOnce();
    if (refreshed) { return request<T>(method, path, body, true, true); }
    // Reached the backend, and it said the refresh token itself is invalid or
    // expired — this is the one case a global logout is correct.
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
  // Formatted for display by the backend — "Jun 17, 2029" and "7:00 PM".
  date:          string;
  time?:         string;

  // The same two values machine-readable, local wall-clock, no zone:
  // "2029-06-17" and "19:00". Added for the reminder scheduler, which cannot
  // compute with the display strings above. See src/services/notifications.ts.
  dateIso?:      string;
  timeIso?:      string;
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

// ── Stripe Connect status ─────────────────────────────────────

// One thing Stripe is waiting for. `label` is already written for the merchant
// by the backend — Stripe's own value is a dotted field path like
// "individual.verification.document", which is carried in `code` for support
// and logging. Render label, never code.
export interface ConnectRequirement {
  code:  string;
  label: string;
}

// Why a previous submission was rejected. `reason` is Stripe's own end-user
// wording, e.g. "The document could not be read. Please upload a clearer photo."
export interface ConnectRequirementError {
  requirement: string;
  code:        string;
  reason:      string;
}

/**
 * Credentials for one embedded-onboarding session.
 *
 * The publishable key comes from the backend rather than app config on purpose:
 * it is mode-specific, and the app has no way to know whether the server is on
 * test or live keys. Hardcoding it here is how the two drift apart.
 */
export interface ConnectSession {
  clientSecret:   string;
  publishableKey: string;
}

export interface ConnectStatus {
  onboardingComplete:    boolean;
  chargesEnabled:        boolean;
  payoutsEnabled:        boolean;
  canCollectTips:        boolean;
  applicationFeePercent: number;
  minTipAmount:          number;   // cents
  maxTipAmount:          number;   // cents

  // What Stripe still needs. An empty list with pendingReview true is the
  // opposite situation from an empty list with everything enabled: it means
  // the merchant has submitted everything and Stripe is reviewing it, so the
  // right thing to tell them is to wait, not to go looking for a form.
  currentlyDue:      ConnectRequirement[];
  hasPastDue:        boolean;
  pendingReview:     boolean;
  disabledReason:    string | null;
  currentDeadline:   string | null;   // ISO date
  requirementErrors: ConnectRequirementError[];
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
  // intent: 'signup' asks the backend to REFUSE a number that already has an
  // account, with a 409, instead of treating it as a login. Only the sign-up
  // screen should pass it. The login screen must not — this is the same endpoint
  // login uses, and refusing a known number there would lock everyone out.
  sendPhoneOtp: (phoneNumber: string, intent?: 'signup') =>
    request<{ message: string }>('POST', '/auth/send-phone-otp', { phoneNumber, intent }),

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
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) { return false; }

    try {
      const data = await request<AuthResponse>('POST', '/auth/refresh', { refreshToken });
      await storage.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (err) {
      // POST /auth/refresh answers a genuinely invalid or expired refresh
      // token with 401 (AuthController.cs) — that is the only failure this
      // catches into `false`, because it is the only one that actually means
      // "this session is over". Everything else — no connection, a timed-out
      // request, a 502/503 while the backend's machine is waking up, a 429 —
      // used to be caught here too and treated exactly like an invalid token,
      // which force-logged a merchant out over a network hiccup rather than
      // anything about their session. Those now rethrow, so the request()
      // caller above sees an ordinary failure and the session stays intact.
      if (err instanceof ApiError && err.status === 401) { return false; }
      throw err;
    }
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

  // TEMPORARY — test mode only, see SIMULATED_PAYMENTS_ENABLED in config/env.
  // Creates and confirms the charge server-side with Stripe's test card, so no
  // reader, no NFC and no Terminal SDK are involved. Returns an intent awaiting
  // capture, exactly like createPaymentIntent, so the caller finishes through
  // the same capturePaymentIntent above and the tip is recorded identically.
  simulatePaymentIntent: (amountCents: number, eventId: string) =>
    request<PaymentIntentData>('POST', '/simulate_payment_intent', { amount: amountCents, eventId }, true),

  // ── Stripe Connect ─────────────────────────────────────────────
  // Two ways into onboarding, and both are load-bearing.
  //
  // createConnectSession backs the embedded component, which keeps the merchant
  // inside the app. getOnboardingLink is the browser redirect it replaced — kept
  // because it is what runs when the component cannot load, and because builds
  // already in merchants' hands still call it.
  createConnectSession: () =>
    request<ConnectSession>('POST', '/connect/session', null, true),

  getOnboardingLink: () =>
    request<{ url: string }>('POST', '/connect/onboard', null, true),

  // The three onboarding flags are not interchangeable:
  //   canCollectTips     — gate the tip flow on this. Stripe enables charges as
  //                        soon as identity clears, which is often the same day.
  //   payoutsEnabled     — gate withdrawing on this. Arrives later, after the
  //                        bank account is verified separately.
  //   onboardingComplete — both of the above. The last state to arrive, and the
  //                        wrong thing to make someone wait for before earning.
  getConnectStatus: () =>
    request<ConnectStatus>('GET', '/connect/status', null, true),

  getConnectBalance: () =>
    request<{
      available:      number;   // cents
      pending:        number;   // cents
      payoutsEnabled: boolean;  // false → money is held, not lost
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