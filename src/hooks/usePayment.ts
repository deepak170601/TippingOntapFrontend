// src/hooks/usePayment.ts
// ─────────────────────────────────────────────────────────────
// Orchestrates the full Stripe Terminal payment flow.
// TapScreen calls this — never touches stripe.ts or api.ts directly.
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import stripeService from '../services/stripe';
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
  success:         boolean;
  error?:          string;
  paymentIntentId?: string;
}

// ── Mock mode flag ─────────────────────────────────────────────
// Set true so payment flow works without real Stripe hardware.
// Flip to false in production.
const MOCK_MODE = true;

const usePayment = () => {
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

  // ── Real Stripe Terminal payment flow ──────────────────────────
  const runRealPayment = useCallback(async (
    { amountCents, eventId }: StartPaymentArgs,
    stripeHooks: any,
  ): Promise<PaymentResult> => {
    setPaymentState('discovering');
    setErrorMessage('');

    try {
      // 1. Discover readers
      await stripeService.discoverReaders(stripeHooks);

      // 2. Connect first discovered reader
      setPaymentState('connecting');
      const reader = stripeHooks.discoveredReaders?.[0];
      if (!reader) { throw new Error('No reader found. Ensure device supports Tap to Pay.'); }
      await stripeService.connectReader(stripeHooks, reader);

      // 3. Create payment intent on backend
      const intentData = await api.createPaymentIntent(amountCents, eventId);
      paymentIntentIdRef.current = intentData.id;

      // 4. Collect payment method — user taps card here
      setPaymentState('collecting');
      const collected = await stripeService.collectPayment(
        stripeHooks,
        intentData.clientSecret,
      );

      // 5. Process (confirm) payment
      setPaymentState('processing');
      const processed = await stripeService.processPayment(stripeHooks, collected);

      // 6. Capture on backend
      await api.capturePaymentIntent((processed as { id: string }).id);

      setPaymentState('success');
      return { success: true, paymentIntentId: (processed as { id: string }).id };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed.';
      setPaymentState('failed');
      setErrorMessage(message);
      return { success: false, error: message };
    } finally {
      // Always try to disconnect reader
      try { await stripeService.disconnectReader(stripeHooks); } catch { /* silent */ }
    }
  }, []);

  // ── Public: start payment ──────────────────────────────────────
  const startPayment = useCallback(async (
    args: StartPaymentArgs,
    stripeHooks?: any,
  ): Promise<PaymentResult> => {
    if (MOCK_MODE) { return runMockPayment(); }
    if (!stripeHooks) { throw new Error('stripeHooks required in non-mock mode'); }
    return runRealPayment(args, stripeHooks);
  }, [runMockPayment, runRealPayment]);

  // ── Public: cancel payment ─────────────────────────────────────
  const cancelPayment = useCallback(async (stripeHooks?: any): Promise<void> => {
    try {
      if (!MOCK_MODE && stripeHooks) {
        await stripeService.cancelCollect(stripeHooks);
      }
      if (paymentIntentIdRef.current) {
        await api.cancelPaymentIntent(paymentIntentIdRef.current);
      }
    } catch { /* best-effort */ } finally {
      setPaymentState('cancelled');
      paymentIntentIdRef.current = null;
    }
  }, []);

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