// __tests__/validateEmail.test.ts
import { isPlausibleEmail } from '../src/utils/validateEmail';

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isPlausibleEmail('keerban@gmail.com')).toBe(true);
    expect(isPlausibleEmail('first.last+tag@example.co.uk')).toBe(true);
  });

  it('rejects the specific typo class that broke Stripe account creation', () => {
    // Caught live on 2026-08-30: this passed the old `.includes('@')` check,
    // reached Stripe two steps later, and broke account creation with no way
    // for the merchant to fix it short of re-registering.
    expect(isPlausibleEmail('keerban@@gmail.com')).toBe(false);
  });

  it('rejects addresses with no domain dot', () => {
    expect(isPlausibleEmail('keerban@gmail')).toBe(false);
  });

  it('rejects addresses with no @ at all', () => {
    expect(isPlausibleEmail('keerban.gmail.com')).toBe(false);
  });

  it('rejects blank and whitespace-only input', () => {
    expect(isPlausibleEmail('')).toBe(false);
    expect(isPlausibleEmail('   ')).toBe(false);
  });
});
