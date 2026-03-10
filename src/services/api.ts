// src/services/api.ts
import storage from './storage';

const BASE_URL = 'http://192.168.1.5:5203';

interface RequestBody {
  [key: string]: unknown;
}

interface ErrorResponse {
  message?: string;
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

  // ── Network errors (no internet, server down) ──────────────
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

  // ── Parse response — handle non-JSON safely ────────────────
  let data: T & {
    message?: string;
    title?:   string;
    errors?:  Record<string, string[]>;
  };

  try {
    data = await response.json();
  } catch {
    // Response wasn't JSON (e.g. HTML 500 page)
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  // ── Extract error message if request failed ────────────────
  if (!response.ok) {
    // Priority 1 — standard { message: "..." }
    if (data.message) {
      throw new Error(data.message);
    }

    // Priority 2 — ASP.NET Core validation errors
    // { title: "...", errors: { Field: ["msg1", "msg2"] } }
    if (data.errors) {
      const firstField = Object.values(data.errors)[0];
      const firstMsg   = Array.isArray(firstField) ? firstField[0] : null;
      if (firstMsg) { throw new Error(firstMsg); }
    }

    // Priority 3 — ASP.NET title field
    if (data.title) {
      throw new Error(data.title);
    }

    // Fallback
    throw new Error(`Request failed (${response.status})`);
  }

  return data;
};


export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  user: {
    id:       string;
    fullName: string;
    email:    string;
  };
}

export interface SignupResponse {
  message: string;
}

export interface Event {
  id:         string;
  name:       string;
  date:       string;
  location:   string;
  totalTips?: number;
}

export interface EventsResponse {
  upcoming: Event[];
  active:   Event[];
  past:     Event[];
}

export interface HomeStats         { totalProfit: number; }
export interface ConnectionToken   { secret: string; }
export interface PaymentIntentData { id: string; clientSecret: string; }

export const api = {
  signup: (fullName: string, email: string, password: string) =>
    request<SignupResponse>('POST', '/auth/signup', { fullName, email, password }),

  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { email, password }),

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

  getEvents:    () => request<EventsResponse>('GET', '/events', null, true),
  getHomeStats: () => request<HomeStats>('GET', '/stats/home', null, true),
  endEvent:     (eventId: string) => request('POST', `/events/${eventId}/end`, null, true),

  getConnectionToken: () =>
    request<ConnectionToken>('POST', '/connection_token', null, true),

  createPaymentIntent: (amountCents: number, eventId: string) =>
    request<PaymentIntentData>('POST', '/create_payment_intent', { amount: amountCents, eventId }, true),

  capturePaymentIntent: (paymentIntentId: string) =>
    request('POST', '/capture_payment_intent', { paymentIntentId }, true),

  cancelPaymentIntent: (paymentIntentId: string) =>
    request('POST', '/cancel_payment_intent', { paymentIntentId }, true),
};

export default api;