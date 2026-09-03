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
    withConstants({ Brand: 'samsung', Manufacturer: 'samsung', Model: 'SM-G991B' });
    const d = getDeviceSummary();
    expect(d.brand).toBe('samsung');
    expect(d.model).toBe('SM-G991B');
  });

  it('reports the Android version a person recognises, and the API level', () => {
    // "Android 14" is what the merchant will say; API 34 is what decides
    // whether Tap to Pay is even eligible on the handset.
    withConstants({ Brand: 'samsung', Model: 'SM-G991B', Release: '14', Version: 34 });
    expect(getDeviceSummary().os).toBe('Android 14 (API 34)');
  });

  it('prefers Brand over Manufacturer where they differ', () => {
    // A Redmi Note reports Manufacturer "Xiaomi" but Brand "Redmi". Redmi is
    // what is printed on the handset and what the merchant will say.
    withConstants({ Brand: 'Redmi', Manufacturer: 'Xiaomi', Model: '22111317I' });
    expect(getDeviceSummary().brand).toBe('Redmi');
  });

  it('falls back to Manufacturer when Brand is blank', () => {
    withConstants({ Brand: '', Manufacturer: 'Zebra', Model: 'TC21' });
    expect(getDeviceSummary().brand).toBe('Zebra');
  });

  it('falls back to Unknown rather than throwing when a key is missing', () => {
    // Platform.constants is typed loosely and varies by OS version. A support
    // sheet that crashes instead of sending is worse than one saying "Unknown".
    withConstants({});
    const d = getDeviceSummary();
    expect(d.brand).toBe('Unknown');
    expect(d.model).toBe('Unknown');
  });

  it('treats blank and non-primitive values as Unknown', () => {
    // Numbers are accepted on purpose — Version (the API level) arrives as
    // one. Blanks and anything structured do not.
    withConstants({ Brand: '   ', Manufacturer: '', Model: { junk: true } });
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
