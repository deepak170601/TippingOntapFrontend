// jest.setup.js
// ─────────────────────────────────────────────────────────────
// Native modules have no implementation under Jest. Everything stubbed
// here is pulled in at import time by App.tsx or the tree below it, so
// without these the suite dies during module resolution before a single
// assertion runs.
// ─────────────────────────────────────────────────────────────

// ── Mocks the packages ship themselves ───────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Note the `.default`: this package hangs its whole mock off the default
// export, so without it the named imports (SafeAreaProvider) come back
// undefined and React fails with "Element type is invalid".
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// ── Stripe Terminal ──────────────────────────────────────────
// No official mock, and the published SDK cannot be imported under Jest
// at all: lib/commonjs/logger/index.js requires '../../package.json',
// which resolves to lib/package.json — a file the tarball does not
// contain (the compiled output kept the src/-relative path). Mocking the
// module sidesteps that, and a native payment SDK could not run here
// regardless.
jest.mock('@stripe/stripe-terminal-react-native', () => ({
  StripeTerminalProvider: ({ children }) => children,
  requestNeededAndroidPermissions: jest.fn().mockResolvedValue(true),
  useStripeTerminal: () => ({
    initialize:             jest.fn().mockResolvedValue({}),
    discoverReaders:        jest.fn().mockResolvedValue({}),
    connectReader:          jest.fn().mockResolvedValue({}),
    disconnectReader:       jest.fn().mockResolvedValue({}),
    clearCachedCredentials: jest.fn().mockResolvedValue({}),
    getLocations:           jest.fn().mockResolvedValue({ locations: [] }),
    retrievePaymentIntent:  jest.fn().mockResolvedValue({}),
    collectPaymentMethod:   jest.fn().mockResolvedValue({}),
    confirmPaymentIntent:   jest.fn().mockResolvedValue({}),
    setSimulatedCard:       jest.fn().mockResolvedValue({}),
  }),
}));

// ── NFC ──────────────────────────────────────────────────────
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    isSupported:    jest.fn().mockResolvedValue(true),
    isEnabled:      jest.fn().mockResolvedValue(true),
    start:          jest.fn().mockResolvedValue(undefined),
    goToNfcSetting: jest.fn().mockResolvedValue(undefined),
  },
}));
