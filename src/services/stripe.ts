// src/services/stripe.ts
// ─────────────────────────────────────────────────────────────
// Connection token provider for StripeTerminalProvider (App.tsx).
//
// Tokens are now minted on the *caller's connected account*, so a
// secret is valid for exactly one merchant. Never cache it here —
// always fetch fresh, and let the SDK manage its own lifetime.
//
// All other Terminal SDK logic lives in hooks/usePayment.ts.
// ─────────────────────────────────────────────────────────────
import api from './api';

export const fetchConnectionToken = async (): Promise<string> => {
  const data = await api.getConnectionToken();
  return data.secret;
};

export default fetchConnectionToken;
