// src/utils/validateEmail.ts
//
// Practical, not RFC 5322 — this exists to catch the typo class that gets a
// Stripe account rejected (a doubled @, a missing domain), not to be a
// spec-complete validator. Mirrors StripeConnectService.IsPlausibleEmail on
// the backend; kept as a separate small check rather than shared across
// languages, since a one-line regex is not worth a cross-repo dependency.
//
// Existed as `email.includes('@')` before, which let "user@@gmail.com"
// through — caught live on 2026-08-30, when it reached Stripe two steps
// later during Complete Setup and broke account creation with no way for the
// merchant to fix it short of re-registering. Catching it here, while the
// address is still an editable form field, is a form-entry cost; catching it
// after an OTP has already been verified against it is a stuck account.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const isPlausibleEmail = (email: string): boolean =>
  EMAIL_PATTERN.test(email.trim());

export default isPlausibleEmail;
