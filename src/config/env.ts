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
