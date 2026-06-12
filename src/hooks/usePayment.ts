// src/hooks/usePayment.ts
import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
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

const MOCK_MODE = true;

const usePayment = () => {
  const stripeHooks = useStripeTerminal();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const paymentIntentIdRef              = useRef<string | null>(null);

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
      // 1. Check NFC before anything else
      setPaymentState('checking_nfc');
      await checkNfc();

      // 2. Discover phone's NFC reader
      setPaymentState('discovering');
      await stripeHooks.discoverReaders({
        discoveryMethod: 'tapToPay',
        simulated:       false,
      });

      // 3. Connect
      setPaymentState('connecting');
      const reader = stripeHooks.discoveredReaders?.[0];
      if (!reader) { throw new Error('No NFC reader found on this device.'); }

      const { error: connectError } = await stripeHooks.connectReader({
        reader,
        locationId:      'tml_GeLpGAsDjiphcT',
        discoveryMethod: 'tapToPay',
      });
      if (connectError) { throw new Error(connectError.message); }

      // 4. Create PaymentIntent on backend
      const intentData = await api.createPaymentIntent(amountCents, eventId);
      paymentIntentIdRef.current = intentData.id;

      // 5. Collect — customer taps card here
      setPaymentState('collecting');
      const { paymentIntent: collected, error: collectError } =
        await stripeHooks.collectPaymentMethod({
          paymentIntent: intentData as any,
        });
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
  }, [stripeHooks]);

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