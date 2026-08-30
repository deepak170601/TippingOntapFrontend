// __tests__/formatPhone.test.ts
import { formatUsPhone } from '../src/utils/formatPhone';

describe('formatUsPhone', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatUsPhone('')).toBe('');
    expect(formatUsPhone('5')).toBe('(5');
    expect(formatUsPhone('555')).toBe('(555');
    expect(formatUsPhone('5551')).toBe('(555) 1');
    expect(formatUsPhone('5551234')).toBe('(555) 123-4');
    expect(formatUsPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('ignores non-digit characters already in the string', () => {
    // React Native hands onChangeText the already-formatted previous value
    // plus the new keystroke, so the input to this function is not always
    // bare digits.
    expect(formatUsPhone('(555) 123-4567')).toBe('(555) 123-4567');
  });

  it('caps at 10 digits regardless of how many are typed', () => {
    expect(formatUsPhone('55512345678888')).toBe('(555) 123-4567');
  });

  it('recomputes correctly after a backspace', () => {
    // "(555) 123-4567" with the last digit removed
    expect(formatUsPhone('(555) 123-456')).toBe('(555) 123-456');
  });
});
