// src/hooks/usePayment.ts
// ─────────────────────────────────────────────────────────────
// Orchestrates the full Stripe Terminal payment flow.
// TapScreen calls this — never touches stripe.ts or api.ts directly.
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import api from '../services/api';

// ── Payment states ─────────────────────────────────────────────
export type PaymentState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'collecting'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled';

interface StartPaymentArgs {
  amountCents: number;
  eventId:     string;
}

interface PaymentResult {
  success:          boolean;
  error?:           string;
  paymentIntentId?: string;
}

// ── Mock mode flag ─────────────────────────────────────────────
// Set true so payment flow works without real Stripe hardware.
// Flip to false in production.
const MOCK_MODE = true;

const usePayment = () => {
  const stripeHooks = useStripeTerminal();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const paymentIntentIdRef              = useRef<string | null>(null);

  // ── Mock payment — simulates full flow with delays ─────────────
  const runMockPayment = useCallback(async (): Promise<PaymentResult> => {
    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    setPaymentState('discovering');
    await delay(900);

    setPaymentState('connecting');
    await delay(700);

    setPaymentState('collecting');
    await delay(2200); // ← longest wait — user taps card here

    setPaymentState('processing');
    await delay(1000);

    setPaymentState('success');
    return { success: true, paymentIntentId: 'mock_pi_demo_123' };
  }, []);

const runRealPayment = useCallback(async (
  { amountCents, eventId }: StartPaymentArgs,
): Promise<PaymentResult> => {
  setPaymentState('discovering');
  setErrorMessage('');

  try {
    // 1. Discover — correct method name is 'tapToPay' not 'localMobile'
    await stripeHooks.discoverReaders({
      discoveryMethod: 'tapToPay',
      simulated: false,
    });

    // 2. Connect — correct method is connectReader not connectLocalMobileReader
    setPaymentState('connecting');
    const reader = stripeHooks.discoveredReaders?.[0];
    if (!reader) { throw new Error('No NFC reader found on this device.'); }

    const { reader: connected, error: connectError } =
      await stripeHooks.connectReader({
        reader,
        locationId: 'your_stripe_location_id',
        discoveryMethod: 'tapToPay'
      });
    if (connectError) { throw new Error(connectError.message); }

    // 3. Create PaymentIntent on backend
    const intentData = await api.createPaymentIntent(amountCents, eventId);
    paymentIntentIdRef.current = intentData.id;

    // 4. Collect — correct param is paymentIntent object not clientSecret string
    // setPaymentState('collecting');
    // const { paymentIntent: collected, error: collectError } =
    //   await stripeHooks.collectPaymentMethod({
    //     paymentIntent: {
    //       id: intentData.id,
    //       clientSecret: intentData.clientSecret,
    //       amount: 0,
    //       captureMethod: '',
    //       charges: [],
    //       created: '',
    //       currency: '',
    //       livemode: false,
    //       sdkUuid: ''
    //     },
    //   });
    // if (collectError) { throw new Error(collectError.message); }

    // Replace the collect step in runRealPayment:

// 4. Collect
setPaymentState('collecting');
const { paymentIntent: collected, error: collectError } =
  await stripeHooks.collectPaymentMethod({
    paymentIntent: intentData as any, // ← backend response shape matches, cast cleanly
  });
if (collectError) { throw new Error(collectError.message); }

    // 5. Confirm — correct param is { paymentIntent: collected }
    setPaymentState('processing');
    const { paymentIntent: processed, error: processError } =
      await stripeHooks.confirmPaymentIntent({
        paymentIntent: collected!,
      });
    if (processError) { throw new Error(processError.message); }

    // 6. Capture on backend
    await api.capturePaymentIntent(processed!.id);

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
}, [stripeHooks]);

  // ── Public: start payment ──────────────────────────────────────
  const startPayment = useCallback(async (
    args: StartPaymentArgs,
  ): Promise<PaymentResult> => {
    if (MOCK_MODE) { return runMockPayment(); }
    return runRealPayment(args);
  }, [runMockPayment, runRealPayment]);

  // ── Public: cancel payment ─────────────────────────────────────
  const cancelPayment = useCallback(async (): Promise<void> => {
    try {
      if (!MOCK_MODE) {
        await stripeHooks.cancelCollectPaymentMethod();
      }
      if (paymentIntentIdRef.current) {
        await api.cancelPaymentIntent(paymentIntentIdRef.current);
      }
    } catch { /* best-effort */ } finally {
      setPaymentState('cancelled');
      paymentIntentIdRef.current = null;
    }
  }, [stripeHooks]);

  // ── Status messages shown on TapScreen ────────────────────────
  const STATUS_MESSAGES: Record<PaymentState, string> = {
    idle:        'Ready to process',
    discovering: 'Looking for reader…',
    connecting:  'Connecting to reader…',
    collecting:  'Hold card near top of device',
    processing:  'Processing payment…',
    success:     'Payment successful!',
    failed:      errorMessage || 'Payment failed.',
    cancelled:   'Payment cancelled.',
  };

  // ── Step labels for progress indicator ────────────────────────
  const STEPS: { state: PaymentState; label: string }[] = [
    { state: 'discovering', label: 'Find Reader' },
    { state: 'connecting',  label: 'Connect'     },
    { state: 'collecting',  label: 'Tap Card'    },
    { state: 'processing',  label: 'Process'     },
  ];

  const currentStepIndex = STEPS.findIndex(s => s.state === paymentState);

  return {
    startPayment,
    cancelPayment,
    paymentState,
    statusMessage: STATUS_MESSAGES[paymentState],
    errorMessage,
    STEPS,
    currentStepIndex,
    isActive: ['discovering', 'connecting', 'collecting', 'processing'].includes(paymentState),
  };
};

export default usePayment;