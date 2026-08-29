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
    // usePayment gates on getIsInitialized(), not the memoised boolean.
    isInitialized:          true,
    getIsInitialized:       jest.fn().mockReturnValue(true),
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

// ── Stripe Connect embedded components ───────────────────────
// Same problem as the Terminal SDK above, reached by a longer path:
// StripeOnboardingModal imports @stripe/stripe-react-native, PayoutSetupBanner
// imports that, HomeScreen imports that, and App.tsx pulls in the lot. The
// package registers a TurboModule at import time, which throws under Jest
// before any test runs.
//
// ConnectComponentsProvider passes children straight through so the tree below
// it still mounts. ConnectAccountOnboarding renders nothing, which is the
// honest shape for a native full-screen modal in this environment.
jest.mock('@stripe/stripe-react-native', () => ({
  ConnectComponentsProvider: ({ children }) => children,
  ConnectAccountOnboarding:  () => null,
  loadConnectAndInitialize:  jest.fn(() => ({ update: jest.fn() })),
}));

// Pulled in by the Stripe SDK for its authenticated screens, never rendered
// directly by our code.
jest.mock('react-native-webview', () => ({ WebView: () => null }));

// ── Notifee ──────────────────────────────────────────────────
// Same class of problem as the Stripe SDKs above: the module reaches for its
// native side at import time, and AuthContext -> notifications.ts pulls it into
// every test that mounts App. Every method resolves to the shape the real one
// returns so services/notifications.ts takes its normal path rather than its
// catch blocks.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel:              jest.fn().mockResolvedValue('event-reminders'),
    requestPermission:          jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getNotificationSettings:    jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createTriggerNotification:  jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds:  jest.fn().mockResolvedValue([]),
    cancelTriggerNotifications: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance:   { HIGH: 4 },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  RepeatFrequency:     { NONE: -1 },
  TriggerType:         { TIMESTAMP: 0 },
  AlarmType:           { SET_AND_ALLOW_WHILE_IDLE: 1 },
}));
