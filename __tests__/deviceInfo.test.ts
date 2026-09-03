// __tests__/deviceInfo.test.ts
import { Platform } from 'react-native';
import { getDeviceSummary, formatDevice } from '../src/utils/deviceInfo';

describe('getDeviceSummary', () => {
  const originalConstants = Platform.constants;
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'constants', {
      value: originalConstants, configurable: true,
    });
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  // The RN jest preset reports Platform.OS as 'ios'. These cases are about the
  // Android branch, which is the only one that can read brand and model at all,
  // so the OS is set alongside the constants.
  const withConstants = (value: unknown): void => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'constants', { value, configurable: true });
  };

  it('reads brand and model from Platform.constants on Android', () => {
    withConstants({ Manufacturer: 'samsung', Model: 'SM-G991B' });
    const d = getDeviceSummary();
    expect(d.brand).toBe('samsung');
    expect(d.model).toBe('SM-G991B');
  });

  it('falls back to Unknown rather than throwing when a key is missing', () => {
    // Platform.constants is typed loosely and varies by OS version. A support
    // sheet that crashes instead of sending is worse than one saying "Unknown".
    withConstants({});
    const d = getDeviceSummary();
    expect(d.brand).toBe('Unknown');
    expect(d.model).toBe('Unknown');
  });

  it('treats blank and non-string values as Unknown', () => {
    withConstants({ Manufacturer: '   ', Model: 42 });
    const d = getDeviceSummary();
    expect(d.brand).toBe('Unknown');
    expect(d.model).toBe('Unknown');
  });

  it('survives Platform.constants being absent entirely', () => {
    withConstants(undefined);
    expect(() => getDeviceSummary()).not.toThrow();
    expect(getDeviceSummary().brand).toBe('Unknown');
  });
});

describe('formatDevice', () => {
  it('renders one readable line for a support message', () => {
    expect(formatDevice({ brand: 'samsung', model: 'SM-G991B', os: 'Android 14' }))
      .toBe('samsung SM-G991B · Android 14');
  });
});
