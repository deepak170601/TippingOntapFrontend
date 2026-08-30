// src/utils/formatPhone.ts
//
// Progressive US phone formatting for a controlled TextInput: "(123) 456-7890"
// as it is typed, not just at submit time. Every screen that collects a phone
// number already strips it back to bare digits before sending anything to the
// backend (see e164Phone() in LoginScreen, the `+1${cleaned}` calls in
// RegisterScreen) — this only changes what the customer sees while typing.
//
// Recomputed from raw digits on every keystroke rather than tracked
// incrementally, which is what lets the same function handle both typing and
// backspacing correctly: React Native hands a controlled TextInput's
// onChangeText the whole new string either way, so re-deriving from digits is
// simpler and cannot drift from what is on screen.
export const formatUsPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const len = digits.length;

  if (len === 0) { return ''; }
  if (len < 4)    { return `(${digits}`; }
  if (len < 7)    { return `(${digits.slice(0, 3)}) ${digits.slice(3)}`; }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default formatUsPhone;
