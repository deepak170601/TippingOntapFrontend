// src/utils/deviceInfo.ts
//
// Brand and model of the handset, and deliberately nothing else.
//
// Support needs this to answer "it does not work on my phone" — a Tap to Pay
// failure is very often a specific device rather than the app. Two strings are
// enough to know that.
//
// Read from Platform.constants rather than by adding react-native-device-info.
// The dependency would bring a native module, a clean rebuild and a much wider
// surface, to return the two fields React Native already hands us on Android.
//
// What is NOT collected, on purpose: Android's constants also expose Serial
// and Fingerprint, which are device identifiers rather than device
// descriptions. They are exactly the sort of thing that ends up in a support
// inbox forever, and they answer no question support is asking. Brand and
// model describe the hardware; a serial identifies the person holding it.
import { Platform } from 'react-native';

export interface DeviceSummary {
  /** e.g. "samsung" — manufacturer as the OS reports it. */
  brand: string;
  /** e.g. "SM-G991B" — the marketing name is not exposed without a lookup. */
  model: string;
  /** "Android 14" / "iOS 17.2" — the OS, not the hardware. */
  os: string;
}

const UNKNOWN = 'Unknown';

// Platform.constants is typed loosely and its keys differ per platform, so
// every read is guarded. A support message with "Unknown" in it is still
// useful; one that crashed the sheet before sending is not.
const read = (key: string): string => {
  try {
    const constants = Platform.constants as Record<string, unknown> | undefined;
    const value = constants?.[key];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
};

// Platform.Version is a plain value on a device, but it is a getter over
// Platform.constants in some environments — so it throws exactly where the
// guarded reads below do not. Wrapped for the same reason they are: a support
// sheet that cannot describe the handset is a worse outcome than one that says
// "Unknown", and a crash here happens on the screen a stuck merchant is
// already stuck on.
const osVersion = (): string => {
  try {
    return String(Platform.Version);
  } catch {
    return UNKNOWN;
  }
};

export const getDeviceSummary = (): DeviceSummary => {
  if (Platform.OS === 'android') {
    return {
      // Brand before Manufacturer: they differ on exactly the devices where
      // it matters — a Redmi Note reports Manufacturer "Xiaomi" but Brand
      // "Redmi", and Redmi is what the merchant will say on the phone and
      // what is printed on the handset. Manufacturer is the fallback because
      // Brand is occasionally blank on white-label hardware.
      brand: read('Brand') !== UNKNOWN ? read('Brand') : read('Manufacturer'),
      model: read('Model'),
      os:    `Android ${osVersion()}`,
    };
  }

  // iOS exposes neither brand nor model through Platform.constants — there is
  // no equivalent without a native module. Naming Apple is honest rather than
  // clever: the brand genuinely is known, the model genuinely is not.
  return {
    brand: 'Apple',
    model: UNKNOWN,
    os:    `iOS ${osVersion()}`,
  };
};

/** One line for a support message: "samsung SM-G991B · Android 14". */
export const formatDevice = (d: DeviceSummary): string =>
  `${d.brand} ${d.model} · ${d.os}`;

export default getDeviceSummary;
