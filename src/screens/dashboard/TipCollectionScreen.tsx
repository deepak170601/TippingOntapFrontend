// src/screens/dashboard/TipCollectionScreen.tsx
//
// The screen a customer actually looks at while an event is running: the tip
// amounts the merchant chose when they created the event, and one button to
// tap a card. Nothing else.
//
// ActiveEventScreen is still in the tree and still works — it is the merchant's
// view of an event, with running totals, the earnings breakdown and End Event.
// That is the wrong thing to hand to a stranger who is standing there with a
// card out, which is why this exists as a separate screen rather than as a mode
// of that one.
//
// Two deliberate omissions:
//
//   - No bottom tab bar. The phone gets handed across a counter on this screen;
//     a tab bar is a door into the merchant's earnings and settings.
//   - No custom amount. The presets are the whole point, and a custom amount
//     means a keyboard, which is the slowest thing that can happen at a till.
//
// Progress is reported as what the customer has to do, not as what the SDK is
// doing. "Looking for reader" and "Connecting to reader" are true and useless:
// nobody tipping five dollars needs to know a Terminal reader was discovered.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Modal, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import usePayment from '../../hooks/usePayment';
import api from '../../services/api';
import { SIMULATED_PAYMENTS_ENABLED } from '../../config/env';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'TipCollection'>;

// How long the ✓ / ✕ stays up before the screen resets itself for the next
// person in the queue. Tappable to dismiss sooner.
const RESULT_DISMISS_MS = 2600;

type Gate = 'checking' | 'ready' | 'blocked';

interface Outcome {
  success:     boolean;
  amountCents: number;
  error?:      string;

  // Shown on the result card. A tester who cannot tell a simulated success from
  // a real one will eventually mistake one for the other.
  simulated:   boolean;
}

const fmt = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const TipCollectionScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const topInset   = useTopInset();
  const route      = useRoute<RouteType>();
  const { event }  = route.params;

  const { startPayment, paymentState } = usePayment();

  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [submitting,    setSubmitting]    = useState<boolean>(false);
  const [simulating,    setSimulating]    = useState<boolean>(false);
  const [outcome,       setOutcome]       = useState<Outcome | null>(null);

  const [gate,        setGate]        = useState<Gate>('checking');
  const [gateMessage, setGateMessage] = useState<string>('');

  const tipOptions = event.tipOptions ?? [];

  // ── Can this event take money at all? ──────────────────────
  //
  // Checked once on mount rather than before every tap. The old screen called
  // /connect/status on every single payment, which put a network round trip
  // between the customer tapping the button and the reader waking up. Charges
  // do not get switched off mid-event, and if they somehow did the backend
  // refuses to create the PaymentIntent anyway.
  //
  // A failed status call does NOT block. A dropped request in the middle of a
  // live event should not take the till down, and a merchant who genuinely
  // cannot charge finds out one tap later from the real error.
  const checkGate = useCallback(async (): Promise<void> => {
    if (event.status !== 'active') {
      setGateMessage('Start this event before collecting tips.');
      setGate('blocked');
      return;
    }

    setGate('checking');
    try {
      const status = await api.getConnectStatus();
      if (!status.chargesEnabled) {
        setGateMessage('Finish your payment setup before collecting tips.');
        setGate('blocked');
        return;
      }
    } catch {
      // Fail open — see above.
    }
    setGate('ready');
  }, [event.status]);

  useEffect(() => { checkGate(); }, [checkGate]);

  // ── Reset for the next customer ────────────────────────────
  const clearOutcome = useCallback((): void => {
    setOutcome(null);
    setSelectedCents(null);
  }, []);

  useEffect(() => {
    if (outcome === null) { return; }
    const timer = setTimeout(clearOutcome, RESULT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [outcome, clearOutcome]);

  // ── Take the tip ───────────────────────────────────────────
  //
  // No navigation on either branch. Success and failure both land on the same
  // overlay over this screen, which then clears itself — so the merchant never
  // has to hand the phone back, tap Done, and hand it forward again.
  const handleTap = async (simulated: boolean = false): Promise<void> => {
    if (selectedCents === null || submitting) { return; }

    const amountCents = selectedCents;
    setSubmitting(true);
    setSimulating(simulated);
    try {
      const result = await startPayment({ amountCents, eventId: event.id, simulated });
      setOutcome({ success: result.success, amountCents, error: result.error, simulated });
    } catch (err) {
      setOutcome({
        success:     false,
        amountCents,
        error:       err instanceof Error ? err.message : undefined,
        simulated,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // What the customer should be doing, in three states rather than five.
  // 'collecting' is the only one that asks anything of them.
  const phaseLabel = paymentState === 'processing'
    ? 'Completing payment…'
    : paymentState === 'collecting'
      // Nothing to hold up to a simulated reader — it presents its own card.
      ? (simulating ? 'Presenting a test card…' : 'Hold the card near the top of the phone')
      : 'Getting ready…';

  const overlayVisible = submitting || outcome !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          disabled={submitting}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{event.name}</Text>
        <View style={styles.headerRight} />
      </View>

      {gate === 'blocked' ? (
        <View style={styles.centred}>
          <Text style={styles.blockedTitle}>Not collecting yet</Text>
          <Text style={styles.blockedBody}>{gateMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={checkGate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      ) : gate === 'checking' ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colours.primary} />
        </View>
      ) : tipOptions.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.blockedTitle}>No tip amounts</Text>
          <Text style={styles.blockedBody}>
            This event was created without any tip amounts, so there is nothing
            to offer here.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.prompt}>Choose a tip</Text>

          {/* ── Tip amounts, exactly as configured ──────── */}
          <View style={styles.tipGrid}>
            {tipOptions.map((cents, i) => {
              const active = selectedCents === cents;
              return (
                <TouchableOpacity
                  key={`${cents}-${i}`}
                  style={[styles.tipBtn, active && styles.tipBtnActive]}
                  onPress={() => setSelectedCents(cents)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tipBtnText, active && styles.tipBtnTextActive]}>
                    {fmt(cents)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.spacer} />

          {/* ── Tap to Pay ──────────────────────────────── */}
          <TouchableOpacity
            style={[styles.payBtn, selectedCents === null && styles.payBtnDisabled]}
            onPress={() => handleTap(false)}
            disabled={selectedCents === null || submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.payBtnText}>
              {selectedCents === null
                ? 'Tap to Pay'
                : `Tap to Pay  ${fmt(selectedCents)}`}
            </Text>
          </TouchableOpacity>

          {/* ── TEMPORARY: simulated payment ──────────────────
              Same money path with Stripe's simulated reader standing in for the
              NFC radio, so the ledger can be checked on a device that cannot do
              Tap to Pay. Everything after the card read is real: the
              PaymentIntent, the application fee, the capture and the tip row.
              Remove by setting SIMULATED_PAYMENTS_ENABLED false in
              src/config/env.ts. Styled to look like scaffolding, not a feature. */}
          {SIMULATED_PAYMENTS_ENABLED && (
            <TouchableOpacity
              style={[styles.simBtn, selectedCents === null && styles.payBtnDisabled]}
              onPress={() => handleTap(true)}
              disabled={selectedCents === null || submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.simBtnText}>🧪  Simulate Payment</Text>
              <Text style={styles.simBtnSub}>
                Test mode only — no card is read, but the charge, fee and payout
                are real
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Payment overlay: progress, then result ────────── */}
      <Modal
        visible={overlayVisible}
        transparent
        animationType="fade"
        // Swallow the Android back button mid-payment. Backing out of the
        // screen while a PaymentIntent is in flight leaves it uncaptured.
        onRequestClose={() => { if (outcome !== null) { clearOutcome(); } }}
      >
        <View style={styles.scrim}>
          {outcome === null ? (
            <View style={styles.overlayCard}>
              <ActivityIndicator size="large" color={colours.primary} />
              <Text style={styles.phaseText}>{phaseLabel}</Text>
              {selectedCents !== null && (
                <Text style={styles.phaseAmount}>{fmt(selectedCents)}</Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.overlayCard}
              onPress={clearOutcome}
              activeOpacity={1}
            >
              <View style={[
                styles.resultCircle,
                outcome.success ? styles.resultSuccess : styles.resultFail,
              ]}>
                <Text style={styles.resultIcon}>{outcome.success ? '✓' : '✕'}</Text>
              </View>

              <Text style={styles.resultTitle}>
                {outcome.success ? 'Payment successful' : 'Payment failed'}
              </Text>
              <Text style={styles.resultAmount}>{fmt(outcome.amountCents)}</Text>

              {outcome.simulated && (
                <Text style={styles.resultSimulated}>SIMULATED — no card was read</Text>
              )}

              {!outcome.success && outcome.error ? (
                <Text style={styles.resultError} numberOfLines={3}>{outcome.error}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.primary,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.md,
  },
  backBtn:     { padding: spacing.xs },
  backArrow:   { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle: {
    flex:       1,
    textAlign:  'center',
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  headerRight: { width: 32 },

  centred: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  blockedTitle: {
    fontSize:     fontSizes.lg,
    fontWeight:   fontWeights.bold,
    color:        colours.textPrimary,
    marginBottom: spacing.sm,
  },
  blockedBody: {
    fontSize:   fontSizes.sm,
    color:      colours.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop:         spacing.lg,
    borderWidth:       1.5,
    borderColor:       colours.primary,
    borderRadius:      radius.round,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryBtnText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.bold,
    color:      colours.primary,
  },

  body:   { flex: 1, padding: spacing.base },
  spacer: { flex: 1 },
  prompt: {
    fontSize:     fontSizes.xxl,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    textAlign:    'center',
    marginTop:    spacing.xl,
    marginBottom: spacing.xl,
  },

  tipGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            spacing.md,
  },
  tipBtn: {
    width:           '46%',
    minWidth:        130,
    borderWidth:     2,
    borderColor:     colours.primary,
    borderRadius:    radius.lg,
    paddingVertical: spacing.xl,
    alignItems:      'center',
    backgroundColor: colours.surface,
    ...shadows.card,
  },
  tipBtnActive:     { backgroundColor: colours.primary },
  tipBtnText: {
    fontSize:   fontSizes.xxl,
    fontWeight: fontWeights.extraBold,
    color:      colours.primary,
  },
  tipBtnTextActive: { color: colours.white },

  payBtn: {
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    marginBottom:    spacing.lg,
    ...shadows.blue,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  // Deliberately unlike every other button in the app — dashed, warning
  // coloured, no shadow. It should read as a tool left on the workbench.
  simBtn: {
    borderWidth:       1.5,
    borderStyle:       'dashed',
    borderColor:       colours.warning,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.base,
    alignItems:        'center',
    marginBottom:      spacing.lg,
    backgroundColor:   colours.surface,
  },
  simBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.warning,
  },
  simBtnSub: {
    marginTop:  spacing.xs,
    fontSize:   fontSizes.xs,
    color:      colours.textSecondary,
    textAlign:  'center',
    lineHeight: 15,
  },

  scrim: {
    flex:              1,
    backgroundColor:   colours.overlay,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  overlayCard: {
    width:             '100%',
    backgroundColor:   colours.surface,
    borderRadius:      radius.xxl,
    paddingVertical:   spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems:        'center',
    ...shadows.strong,
  },

  phaseText: {
    marginTop:  spacing.lg,
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.semiBold,
    color:      colours.textPrimary,
    textAlign:  'center',
  },
  phaseAmount: {
    marginTop: spacing.xs,
    fontSize:  fontSizes.sm,
    color:     colours.textSecondary,
  },

  resultCircle: {
    width:          96,
    height:         96,
    borderRadius:   48,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.lg,
  },
  resultSuccess: { backgroundColor: colours.success },
  resultFail:    { backgroundColor: colours.error   },
  resultIcon:    { fontSize: 50, color: colours.white, fontWeight: fontWeights.bold },
  resultTitle: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.textPrimary,
  },
  resultAmount: {
    marginTop:  spacing.xs,
    fontSize:   fontSizes.xxl,
    fontWeight: fontWeights.extraBold,
    color:      colours.textPrimary,
  },
  resultSimulated: {
    marginTop:     spacing.sm,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.bold,
    color:         colours.warning,
    letterSpacing: 0.5,
  },
  resultError: {
    marginTop:  spacing.md,
    fontSize:   fontSizes.sm,
    color:      colours.error,
    textAlign:  'center',
    lineHeight: 18,
  },
});

export default TipCollectionScreen;
