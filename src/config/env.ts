// src/config/env.ts
// ─────────────────────────────────────────────────────────────
// The one place a backend host is chosen. api.ts reads from here and
// nothing else in the app hardcodes a URL.
//
// __DEV__ is injected by the bundler and is false in release builds, so a
// shipped binary always takes `production` however this file is left — a
// development host cannot reach the Play Store by accident.
// ─────────────────────────────────────────────────────────────
declare const __DEV__: boolean;

export type EnvName = 'development' | 'production';

export interface AppEnv {
  name:       EnvName;
  apiBaseUrl: string;
}

const production: AppEnv = {
  name:       'production',
  apiBaseUrl: 'https://tippingontapbackend.fly.dev',
};

// There is no separate staging backend yet, so development points at the
// same host. When one exists, change this one line — that is the entire
// reason the seam is here.
//
// Until then every `yarn android` on every machine talks to the same
// backend a shipped build does. Once that backend holds live Stripe keys,
// a tap from a debug build is a real charge on a real card. The warning
// below fires on every dev launch so this is never a surprise.
// See STRIPE_LIVE_CUTOVER.md.
const development: AppEnv = {
  name:       'development',
  apiBaseUrl: 'https://tippingontapbackend.fly.dev',
};

const env: AppEnv = __DEV__ ? development : production;

export const isProduction = env.name === 'production';

// ─────────────────────────────────────────────────────────────
// TEMPORARY — simulated payments
//
// Shows a Real/Test toggle on the tip screen. In Test the whole money path
// runs without the NFC radio: a real PaymentIntent, a real application fee, a
// real capture, a real tip row. It exists so the ledger can be verified on a
// device that cannot do Tap to Pay.
//
// Set this to false to remove the toggle. That is the entire off switch, and
// it is deliberately not tied to __DEV__ — the whole point is to be able to
// test a release APK on a real phone.
//
// What actually stops this becoming a live-mode hole is one thing, on the
// server: POST /simulate_payment_intent refuses outright unless the backend's
// Stripe key is sk_test_ (StripeController.cs, "── The gate ──"). The app
// cannot reach real money by flipping this flag, because the endpoint behind
// it will not answer under live keys.
//
// This block previously claimed the safeguard was Stripe declining to attach a
// simulated *reader* to a live connection token. That was true when the
// simulation drove the Terminal SDK, and stopped being true when it was
// rewritten to charge server-side — usePayment.ts now calls
// api.simulatePaymentIntent() and never touches Terminal at all. Recorded
// because a safeguard someone believes in but that no longer exists is what
// gets a flag like this shipped enabled.
//
// None of which is a reason to ship with it on.
// ─────────────────────────────────────────────────────────────
export const SIMULATED_PAYMENTS_ENABLED = true;

if (SIMULATED_PAYMENTS_ENABLED) {
  // Warns in release builds too, on purpose — a debug-only warning would go
  // unseen in exactly the build where leaving this on would matter.
  console.warn(
    '[env] SIMULATED_PAYMENTS_ENABLED is true — the tip screen shows a test '
    + 'payment button. Set it to false in src/config/env.ts before release.',
  );
}

if (__DEV__) {
  console.log(`[env] development build → ${env.apiBaseUrl}`);

  if (env.apiBaseUrl === production.apiBaseUrl) {
    console.warn(
      '[env] this debug build is pointed at the PRODUCTION backend. ' +
      'After the live-key cutover every tap here charges a real card. ' +
      'Set development.apiBaseUrl in src/config/env.ts to a staging host.',
    );
  }
}

export default env;
