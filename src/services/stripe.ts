// src/services/stripe.ts
// ─────────────────────────────────────────────────────────────
// ALL Stripe Terminal SDK logic lives here.
// Screens never import from @stripe/stripe-terminal-react-native
// directly — they go through usePayment hook only.
// ─────────────────────────────────────────────────────────────
import api from './api';

// ── Connection token provider ──────────────────────────────────
// Passed directly to StripeTerminalProvider in App.tsx
export const fetchConnectionToken = async (): Promise<string> => {
  const data = await api.getConnectionToken();
  return data.secret;
};

// ── Type for the hooks object from useStripeTerminal() ─────────
// We keep this loose so stripe SDK version differences don't break us
type StripeHooks = {
  discoverReaders:            (config: object) => Promise<void>;
  connectLocalMobileReader:   (config: object) => Promise<{ reader?: unknown; error?: { message: string } }>;
  collectPaymentMethod:       (config: object) => Promise<{ paymentIntent?: unknown; error?: { message: string } }>;
  processPayment:             (intent: unknown) => Promise<{ paymentIntent?: unknown; error?: { message: string } }>;
  cancelCollectPaymentMethod: () => Promise<void>;
  disconnectReader:           () => Promise<void>;
  discoveredReaders:          unknown[];
};

// ── Service methods ────────────────────────────────────────────
export const stripeService = {

  /**
   * Discover readers.
   * simulated: true  → works in emulator/dev without real hardware
   * simulated: false → requires physical NFC-enabled Android device
   */
  discoverReaders: async (hooks: StripeHooks): Promise<void> => {
    await hooks.discoverReaders({
      discoveryMethod: 'localMobile',
      simulated: true, // ← set false for production
    });
  },

  /**
   * Connect to the first discovered reader.
   */
  connectReader: async (
    hooks: StripeHooks,
    reader: unknown,
  ): Promise<unknown> => {
    const { reader: connected, error } = await hooks.connectLocalMobileReader({
      reader,
      locationId: 'your_stripe_location_id', // ← replace with real ID
    });
    if (error) { throw new Error(error.message); }
    return connected;
  },

  /**
   * Collect payment method (tap card / NFC).
   */
  collectPayment: async (
    hooks: StripeHooks,
    clientSecret: string,
  ): Promise<unknown> => {
    const { paymentIntent, error } = await hooks.collectPaymentMethod({
      paymentIntentClientSecret: clientSecret,
    });
    if (error) { throw new Error(error.message); }
    return paymentIntent;
  },

  /**
   * Process (confirm) the collected payment.
   */
  processPayment: async (
    hooks: StripeHooks,
    paymentIntent: unknown,
  ): Promise<unknown> => {
    const { paymentIntent: processed, error } = await hooks.processPayment(paymentIntent);
    if (error) { throw new Error(error.message); }
    return processed;
  },

  /**
   * Cancel an in-progress collection.
   */
  cancelCollect: async (hooks: StripeHooks): Promise<void> => {
    await hooks.cancelCollectPaymentMethod();
  },

  /**
   * Disconnect reader after payment completes.
   */
  disconnectReader: async (hooks: StripeHooks): Promise<void> => {
    await hooks.disconnectReader();
  },
};

export default stripeService;