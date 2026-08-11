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
}

interface PaymentResult {
  success:          boolean;
  error?:           string;
  paymentIntentId?: string;
}

// Fakes the whole flow with timers and never contacts the backend, so
// no tip is recorded and earnings stay flat. UI-only work; leave false.
const MOCK_MODE = false;

// false = real Tap to Pay against the phone's NFC hardware. Works in
// Stripe test mode on a supported device (Android 11+), so you can tap a
// real contactless card and it will not be charged.
// true  = Stripe's simulated reader: no card, no tap, runs on an emulator.
// Either way the PaymentIntent is real, so the backend records the tip.
const SIMULATED_READER = false;

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

  // ── Mock payment ───────────────────────────────────────────
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

  // ── Real payment ───────────────────────────────────────────
  const runRealPayment = useCallback(async (
    { amountCents, eventId }: StartPaymentArgs,
  ): Promise<PaymentResult> => {
    setErrorMessage('');

    try {
      // 1. Check NFC before anything else — skipped when simulating,
      //    since emulators have no NFC and would fail here.
      if (!SIMULATED_READER) {
        setPaymentState('checking_nfc');
        await checkNfc();
      }

      // 2. Discover phone's NFC reader
      setPaymentState('discovering');
      discoveredRef.current = [];
      await stripeHooks.discoverReaders({
        discoveryMethod: 'tapToPay',
        simulated:       SIMULATED_READER,
      });

      // 3. Connect
      setPaymentState('connecting');
      const reader = await waitForReader();

      const locationId = await resolveLocationId();

      const { error: connectError } = await stripeHooks.connectReader({
        reader,
        locationId,
        discoveryMethod: 'tapToPay',
      });
      if (connectError) { throw new Error(connectError.message); }

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

      // 5. Collect — customer taps card here
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
    if (MOCK_MODE) { return runMockPayment(); }
    return runRealPayment(args);
  }, [runMockPayment, runRealPayment]);

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