// src/hooks/usePayment.ts
import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import type { Reader } from '@stripe/stripe-terminal-react-native';
import api from '../services/api';

export type PaymentState =
  | 'idle'
  | 'checking_nfc'
  | 'discovering'
  | 'connecting'
  | 'collecting'
  | 'processing'
  | 'success'
  | 'failed';

interface StartPaymentArgs {
  amountCents: number;
  eventId:     string;

  /**
   * Run against Stripe's simulated reader instead of the NFC radio.
   *
   * Only the card-reading half is faked. Everything downstream is the real
   * thing — the PaymentIntent is created by our backend with its real
   * application_fee_amount, it is confirmed and captured against Stripe, and
   * the tip is recorded. That is what makes it useful for checking credits,
   * debits and commissions on a device that cannot do Tap to Pay.
   *
   * Test mode only. Stripe refuses to connect a simulated reader when the
   * connection token came from a live secret key.
   */
  simulated?:  boolean;
}

// Which card the simulated reader presents. 4242… always succeeds; swap in one
// of the decline numbers from the DISABLED block below to exercise a failure.
const SIMULATED_CARD = '4242424242424242';

interface PaymentResult {
  success:          boolean;
  error?:           string;
  paymentIntentId?: string;
}

// ── PRODUCTION ────────────────────────────────────────────────
// Every test-only path in this file is commented out. What runs is the
// real one: real NFC hardware, a real tap, a real PaymentIntent against
// whichever Stripe account the connection token is scoped to. Point the
// backend at live keys and this moves real money.
//
// The disabled blocks are kept verbatim rather than deleted so that going
// back to a bench build is a matter of uncommenting, not of rewriting from
// memory. Each is marked DISABLED (test only) and there are four, in this
// order: the switches below, runMockPayment, the `simulated` flag passed to
// discoverReaders, and the setSimulatedCard call before step 5. The last
// two are one unit — a simulated card with `simulated: false` discovery
// connects to real hardware that then has no card to present.
//
// Nothing is gated on __DEV__ any more, so a debug build now takes exactly
// the same path as a release build. That is the point: what you tap on the
// bench is literally the shipped code. See STRIPE_LIVE_CUTOVER.md for the
// backend half of the cutover.
// ──────────────────────────────────────────────────────────────

/* DISABLED (test only) — mock + simulated-reader switches.

declare const __DEV__: boolean;

// Fakes the whole flow with timers and never contacts the backend, so no
// tip is recorded and earnings stay flat. UI-only work.
const MOCK_MODE_IN_DEV: boolean = false;
const MOCK_MODE = __DEV__ && MOCK_MODE_IN_DEV;

// false = real Tap to Pay against the phone's NFC hardware. Works in
// Stripe test mode on a supported device (Android 11+), so a real
// contactless card can be tapped and will not be charged.
// true  = Stripe's simulated reader: no card and no tap needed, but the
// NFC check still runs, so it wants a real phone with NFC switched on.
// Either way the PaymentIntent is real, so the backend records the tip.
//
// Simulated readers exist only in test mode: a connection token minted
// from a live secret key refuses to connect one.
const SIMULATE_READER_IN_DEV: boolean = true;
const SIMULATED_READER = __DEV__ && SIMULATE_READER_IN_DEV;

// Which card the simulated reader presents. Read only when SIMULATED_READER
// is true; real hardware reads whatever is tapped. The failing cards are
// rejected at confirmPaymentIntent, not at collect, so they exercise the
// same path a real decline takes — down to ActiveEventScreen's alert.
const SIMULATED_CARDS = {
  visa:              '4242424242424242',
  visaDebit:         '4000056655665556',
  mastercard:        '5555555555554444',
  amex:              '378282246310005',
  declined:          '4000000000000002',
  insufficientFunds: '4000000000009995',
  lostCard:          '4000000000009987',
  expiredCard:       '4000000000000069',
  processingError:   '4000000000000119',
} as const;

const ACTIVE_SIMULATED_CARD: keyof typeof SIMULATED_CARDS = 'visa';

*/

const usePayment = () => {
  // Readers arrive via this callback, not as a return value of
  // discoverReaders — reading stripeHooks.discoveredReaders straight
  // after the await sees a stale closure and always looks empty.
  const discoveredRef = useRef<Reader.Type[]>([]);

  const stripeHooks = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => {
      discoveredRef.current = readers;
    },
  });

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const paymentIntentIdRef              = useRef<string | null>(null);

  // Tap to Pay must be attached to a Terminal Location that exists on
  // whichever Stripe account the connection token is scoped to. Look it
  // up at runtime — a hardcoded id breaks on every other account.
  // Returns only the signed-in merchant's locations, normally exactly one.
  // The backend provisions it lazily, so a merchant who just finished
  // onboarding can briefly come back empty — retry once before giving up.
  const resolveLocationId = useCallback(async (): Promise<string> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { locations, error } = await stripeHooks.getLocations({ limit: 10 });
      if (error) {
        throw new Error(`Could not load Terminal locations: ${error.message}`);
      }

      const id = locations?.[0]?.id;
      if (id) { return id; }

      if (attempt === 0) {
        await new Promise<void>(res => setTimeout(res, 1500));
      }
    }

    throw new Error(
      'Still setting up your payment location. Please try again in a moment.'
    );
  }, [stripeHooks]);

  // Poll the ref until discovery reports the device's own reader.
  const waitForReader = async (timeoutMs = 10000): Promise<Reader.Type> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const found = discoveredRef.current[0];
      if (found) { return found; }
      await new Promise<void>(res => setTimeout(res, 200));
    }
    throw new Error('No NFC reader found on this device.');
  };

  // ── NFC check ─────────────────────────────────────────────
  const checkNfc = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') { return true; }

    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        throw new Error('This device does not support NFC.');
      }

      await NfcManager.start();
      const enabled = await NfcManager.isEnabled();

      if (!enabled) {
        // Opens Android NFC settings so user can turn it on
        await NfcManager.goToNfcSetting();
        throw new Error('NFC is turned off. Please enable NFC and try again.');
      }

      return true;
    } catch (err) {
      throw err; // re-throw — handled in runRealPayment
    }
  };

  /* DISABLED (test only) — ── Mock payment ──────────────────────

  const runMockPayment = useCallback(async (): Promise<PaymentResult> => {
    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    setPaymentState('checking_nfc');
    await delay(600);

    setPaymentState('discovering');
    await delay(900);

    setPaymentState('connecting');
    await delay(700);

    setPaymentState('collecting');
    await delay(2200);

    setPaymentState('processing');
    await delay(1000);

    setPaymentState('success');
    return { success: true, paymentIntentId: 'mock_pi_demo_123' };
  }, []);

  */

  // ── Real payment ───────────────────────────────────────────
  const runRealPayment = useCallback(async (
    { amountCents, eventId, simulated = false }: StartPaymentArgs,
  ): Promise<PaymentResult> => {
    setErrorMessage('');

    try {
      // 1. Check NFC before anything else — step 5 reads the card through
      //    it, so a phone with NFC switched off should be told now rather
      //    than once a PaymentIntent already exists on the account.
      setPaymentState('checking_nfc');
      // A simulated reader presents its own card, so no NFC radio is involved.
      // Checking for one would reject exactly the devices this path exists for.
      if (!simulated) { await checkNfc(); }

      // 2. Make sure the SDK is actually up, then discover the phone's own
      //    reader. StripeTerminalInit starts initialization on login, but
      //    it is async and it has to reach the backend, so a merchant can
      //    arrive here before it lands — or after it failed outright, with
      //    nothing anywhere to retry it. Re-initializing on demand is what
      //    turns "payments are dead until you restart the app" into a
      //    one-tap recovery.
      //
      //    getIsInitialized() reads a live ref. The isInitialized boolean
      //    the hook also returns is captured in a memo that does not list
      //    the ref as a dependency, so it goes stale — do not use it.
      setPaymentState('discovering');

      if (!stripeHooks.getIsInitialized()) {
        const { error: initError } = await stripeHooks.initialize();
        if (initError) {
          throw new Error(`Payment system unavailable: ${initError.message}`);
        }
      }

      discoveredRef.current = [];

      // discoverReaders reports failure the same way every other SDK call
      // does, by resolving with { error }. Dropping it sends a real fault —
      // unsupported device, attestation refused, SDK not ready — down into
      // waitForReader, which polls for ten seconds and then blames the
      // hardware: "No NFC reader found on this device." Wrong diagnosis,
      // ten seconds late.
      //
      // The simulated branch discovers over bluetoothScan rather than a
      // simulated tapToPay reader. Tap to Pay discovery puts the device through
      // Google's attestation checks and wants the NFC hardware present, which
      // is the thing being worked around; a simulated bluetoothScan reader
      // needs no radio of any kind and runs on an emulator. The discovery
      // method has no bearing on the money — the PaymentIntent, the fee and the
      // capture are identical either way.
      const { error: discoverError } = simulated
        ? await stripeHooks.discoverReaders({
            discoveryMethod: 'bluetoothScan',
            simulated:       true,
          })
        : await stripeHooks.discoverReaders({
            discoveryMethod: 'tapToPay',
            // DISABLED (test only): simulated: SIMULATED_READER,
            simulated: false,
          });
      if (discoverError) { throw new Error(discoverError.message); }

      // 3. Connect
      setPaymentState('connecting');
      const reader = await waitForReader();

      const locationId = await resolveLocationId();

      const { error: connectError } = simulated
        ? await stripeHooks.connectReader({
            reader,
            locationId,
            discoveryMethod: 'bluetoothScan',
          })
        : await stripeHooks.connectReader({
            reader,
            locationId,
            discoveryMethod: 'tapToPay',
          });
      if (connectError) { throw new Error(connectError.message); }

      // Must come after connectReader — the simulated card is a property of the
      // connected reader, not of the SDK. Loud in the log on purpose: a
      // successful tap in logcat should never be mistaken for a real card read.
      if (simulated) {
        console.warn(
          `[payment] SIMULATED reader — presenting ${SIMULATED_CARD}; no real card is read`,
        );
        const { error: simCardError } = await stripeHooks.setSimulatedCard(SIMULATED_CARD);
        if (simCardError) { throw new Error(simCardError.message); }
      }

      // 4. Create PaymentIntent on backend
      const intentData = await api.createPaymentIntent(amountCents, eventId);
      paymentIntentIdRef.current = intentData.id;

      if (!intentData.clientSecret) {
        throw new Error('Backend did not return a client secret for this payment.');
      }

      // 4b. Hand the secret to the SDK and use the PaymentIntent it hands back.
      //     collect/confirm only accept the SDK's own object — it carries an
      //     internal sdkUuid that raw backend JSON does not have.
      const { paymentIntent: intent, error: retrieveError } =
        await stripeHooks.retrievePaymentIntent(intentData.clientSecret);
      if (retrieveError) { throw new Error(retrieveError.message); }

      // DISABLED (test only) — a simulated reader has no card to read, so it
      // has to be handed one. Must run after connectReader: the setting lives
      // on the connected reader, not on the SDK. Re-enable only together with
      // `simulated: true` on discoverReaders above.
      //
      // if (SIMULATED_READER) {
      //   // Loud on purpose: a tap that looks successful in logcat should
      //   // never be mistaken for one that actually read a card.
      //   console.warn(
      //     `[payment] SIMULATED reader — presenting "${ACTIVE_SIMULATED_CARD}"; no real card is read`,
      //   );
      //   const { error: simCardError } = await stripeHooks.setSimulatedCard(
      //     SIMULATED_CARDS[ACTIVE_SIMULATED_CARD],
      //   );
      //   if (simCardError) { throw new Error(simCardError.message); }
      // }

      // 5. Collect — customer taps their card against the phone here.
      setPaymentState('collecting');
      const { paymentIntent: collected, error: collectError } =
        await stripeHooks.collectPaymentMethod({ paymentIntent: intent! });
      if (collectError) { throw new Error(collectError.message); }

      // 6. Confirm
      setPaymentState('processing');
      const { paymentIntent: processed, error: processError } =
        await stripeHooks.confirmPaymentIntent({
          paymentIntent: collected!,
        });
      if (processError) { throw new Error(processError.message); }

      // 7. Capture on backend — also records the tip
      await api.capturePaymentIntent(processed!.id, eventId);

      setPaymentState('success');
      return { success: true, paymentIntentId: processed!.id };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed.';
      setPaymentState('failed');
      setErrorMessage(message);
      return { success: false, error: message };

    } finally {
      try { await stripeHooks.disconnectReader(); } catch { /* silent */ }
    }
  }, [stripeHooks, resolveLocationId]);

  // ── Public: start payment ──────────────────────────────────
  const startPayment = useCallback(async (
    args: StartPaymentArgs,
  ): Promise<PaymentResult> => {
    // DISABLED (test only): if (MOCK_MODE) { return runMockPayment(); }
    return runRealPayment(args);
  }, [runRealPayment]);

  // ── Status messages ────────────────────────────────────────
  const STATUS_MESSAGES: Record<PaymentState, string> = {
    idle:         'Ready',
    checking_nfc: 'Checking NFC…',
    discovering:  'Looking for reader…',
    connecting:   'Connecting to reader…',
    collecting:   'Hold card near top of device',
    processing:   'Processing payment…',
    success:      'Payment successful!',
    failed:       errorMessage || 'Payment failed.',
  };

  const STEPS: { state: PaymentState; label: string }[] = [
    { state: 'checking_nfc', label: 'NFC'      },
    { state: 'discovering',  label: 'Find'     },
    { state: 'connecting',   label: 'Connect'  },
    { state: 'collecting',   label: 'Tap Card' },
    { state: 'processing',   label: 'Process'  },
  ];

  const currentStepIndex = STEPS.findIndex(s => s.state === paymentState);

  return {
    startPayment,
    paymentState,
    statusMessage: STATUS_MESSAGES[paymentState],
    errorMessage,
    STEPS,
    currentStepIndex,
    isActive: ['checking_nfc', 'discovering', 'connecting', 'collecting', 'processing'].includes(paymentState),
  };
};

export default usePayment;
