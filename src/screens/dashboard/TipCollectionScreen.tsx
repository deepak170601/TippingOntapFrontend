// src/screens/dashboard/TipCollectionScreen.tsx
//
// The screen a customer actually looks at while an event is running: the tip
// amounts the merchant chose when they created the event, and nothing else.
//
// There is no "Tap to Pay" button. Picking an amount IS the action — tapping a
// preset starts the charge immediately, and typing a custom amount then
// pressing Done on the keypad does the same. A confirm step here does not
// protect anyone from anything: nobody taps $5 by accident, and every real
// mistake (wrong amount, changed their mind) is a card that was never
// presented, not a payment that has to be undone. A second tap only added a
// second thing to get right under a customer's eyes.
//
// ActiveEventScreen is still in the tree and still works — it is the merchant's
// view of an event, with running totals, the earnings breakdown and End Event.
// That is the wrong thing to hand to a stranger who is standing there with a
// card out, which is why this exists as a separate screen rather than as a mode
// of that one.
//
// No bottom tab bar. The phone gets handed across a counter on this screen;
// a tab bar is a door into the merchant's earnings and settings.
//
// The merchant's presets sit alongside a Custom tile so a customer who wants
// to type their own amount can, without that being the only option on an
// event the merchant set up with none.
//
// Progress is reported as what the customer has to do, not as what the SDK is
// doing. "Looking for reader" and "Connecting to reader" are true and useless:
// nobody tipping five dollars needs to know a Terminal reader was discovered.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Modal, ActivityIndicator, TextInput, Animated,
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

  // Custom is its own tile in the grid, selected the same way a preset is.
  // Text held separately in dollars-as-typed; parsed to cents only when it
  // actually needs to become the selected amount.
  const [customSelected, setCustomSelected] = useState<boolean>(false);
  const [customText,     setCustomText]     = useState<string>('');

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
    setCustomSelected(false);
    setCustomText('');
  }, []);

  useEffect(() => {
    if (outcome === null) { return; }
    const timer = setTimeout(clearOutcome, RESULT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [outcome, clearOutcome]);

  // Selecting the Custom tile only opens the input — typing an amount is not
  // itself the confirmation, since a customer keying in "12" one digit at a
  // time cannot be charged $1 then have it corrected to $12. Committing the
  // amount happens in onCustomSubmit below, once.
  const selectCustom = (): void => {
    setCustomSelected(true);
    setCustomText('');
  };

  // Cents if customText currently parses to a chargeable amount, else null.
  // Recomputed rather than kept in state — the text is the only source of
  // truth, so there is nothing to let drift out of sync with it.
  const parsedCustomCents = (): number | null => {
    const dollars = parseFloat(customText);
    return Number.isFinite(dollars) && dollars > 0
      ? Math.round(dollars * 100)
      : null;
  };

  // ── Take the tip ───────────────────────────────────────────
  //
  // Takes the amount as an argument rather than reading selectedCents from
  // state, because the two moments this is called — a preset tap, a keypad
  // submit — both know the exact amount they mean at the instant of the call,
  // and a state read one tick later is exactly the kind of gap a fast second
  // tap turns into a race.
  //
  // No navigation on either branch. Success and failure both land on the same
  // overlay over this screen, which then clears itself — so the merchant never
  // has to hand the phone back, tap Done, and hand it forward again.
  const handleTap = async (amountCents: number, simulated: boolean = false): Promise<void> => {
    if (submitting) { return; }

    setSelectedCents(amountCents);
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

  // Fires on the keypad's Done/Go key. Silently does nothing on an amount
  // that has not parsed yet — Android's decimal-pad can fire this on a stray
  // keypress on some devices, and a no-op is the only safe response to a
  // submit with nothing to submit.
  const onCustomSubmit = (simulated: boolean = false): void => {
    const cents = parsedCustomCents();
    if (cents === null) { return; }
    handleTap(cents, simulated);
  };

  // What the customer should be doing, in three states rather than five.
  // 'collecting' is the only one that asks anything of them.
  // The simulated path never reaches 'collecting' — there is no card to hold up
  // to anything, the backend charges a test card directly — so it gets its own
  // label rather than borrowing one that describes a tap.
  const phaseLabel = simulating
    ? 'Charging a test card…'
    : paymentState === 'processing'
      ? 'Completing payment…'
      : paymentState === 'collecting'
        ? 'Hold the card near the top of the phone'
        : 'Getting ready…';

  const overlayVisible = submitting || outcome !== null;

  // Pop the result circle in rather than let it appear flat with the rest of
  // the card. Same spring TipResultScreen uses for its check mark, so a
  // successful tip reads consistently wherever it is shown.
  const resultScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (outcome === null) { resultScale.setValue(0); return; }
    Animated.spring(resultScale, {
      toValue: 1, friction: 4, tension: 110, useNativeDriver: true,
    }).start();
  }, [outcome, resultScale]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header — same layered-gradient trick as the earnings card on
          ActiveEventScreen, since this app has no gradient library installed */}
      <View style={styles.header}>
        <View style={styles.headerGradientA} />
        <View style={styles.headerGradientB} />

        <View style={[styles.headerRow, { paddingTop: topInset + spacing.sm }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            disabled={submitting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{event.name}</Text>
            {event.location ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>📍 {event.location}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight} />
        </View>
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
      ) : (
        <View style={styles.body}>
          <Text style={styles.prompt}>Choose a tip</Text>
          <Text style={styles.promptSub}>
            {SIMULATED_PAYMENTS_ENABLED
              ? 'Tap an amount to charge it — long-press for a test charge'
              : 'Tap an amount to charge it'}
          </Text>

          {/* ── Merchant's presets, plus Custom — tapping one charges it
              immediately. There is nothing to confirm afterward: the tap
              itself is the confirmation. Disabled once a charge is already in
              flight, so a second tap during the overlay cannot start a second
              one. Long-press exists only for the temporary simulated path
              below, and only while it is switched on. */}
          <View style={styles.tipGrid}>
            {tipOptions.map((cents, i) => (
              <TouchableOpacity
                key={`${cents}-${i}`}
                style={styles.tipBtn}
                onPress={() => { setCustomSelected(false); handleTap(cents); }}
                onLongPress={SIMULATED_PAYMENTS_ENABLED
                  ? () => { setCustomSelected(false); handleTap(cents, true); }
                  : undefined}
                disabled={submitting}
                activeOpacity={0.6}
              >
                <Text style={styles.tipBtnCoin}>🪙</Text>
                <Text style={styles.tipBtnText}>{fmt(cents)}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.tipBtn,
                styles.tipBtnCustom,
                customSelected && styles.tipBtnActive,
              ]}
              onPress={selectCustom}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.tipBtnCoin}>✏️</Text>
              <Text style={[styles.tipBtnText, customSelected && styles.tipBtnTextActive]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Custom amount — Done on the keypad charges it. The inline ✓
              is a deliberate second way in, not a second step: Android's
              decimal-pad keyboard does not reliably expose a submit key on
              every device, so onSubmitEditing alone would leave some
              customers with a filled-in amount and no way to send it. */}
          {customSelected && (
            <View style={styles.customRow}>
              <Text style={styles.customCurrency}>$</Text>
              <TextInput
                style={styles.customInput}
                value={customText}
                onChangeText={setCustomText}
                onSubmitEditing={() => onCustomSubmit()}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder="0.00"
                placeholderTextColor={colours.textSecondary}
                editable={!submitting}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.customConfirm, parsedCustomCents() === null && styles.customConfirmDisabled]}
                onPress={() => onCustomSubmit()}
                onLongPress={SIMULATED_PAYMENTS_ENABLED ? () => onCustomSubmit(true) : undefined}
                disabled={parsedCustomCents() === null || submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.customConfirmText}>✓</Text>
              </TouchableOpacity>
            </View>
          )}

          {tipOptions.length === 0 && !customSelected && (
            <Text style={styles.noPresetsHint}>
              This event has no preset amounts — tap Custom to enter one.
            </Text>
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
              <Animated.View style={[
                styles.resultCircle,
                outcome.success ? styles.resultSuccess : styles.resultFail,
                { transform: [{ scale: resultScale }] },
              ]}>
                <Text style={styles.resultIcon}>{outcome.success ? '✓' : '✕'}</Text>
              </Animated.View>

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

  // Two overlaid tints rather than a flat fill — the same trick
  // ActiveEventScreen's earnings card uses, since no gradient library is
  // installed. overflow hidden keeps the diagonal patch from spilling past
  // the header's own rounded bottom corners.
  header: {
    overflow:        'hidden',
    backgroundColor: colours.primary,
    borderBottomLeftRadius:  radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadows.blue,
  },
  headerGradientA: { ...StyleSheet.absoluteFillObject, backgroundColor: colours.primaryLight },
  headerGradientB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colours.primaryDark,
    opacity:         0.55,
    borderTopLeftRadius: radius.xl * 2,
  },
  headerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom:      spacing.lg,
  },
  backBtn:     { padding: spacing.xs },
  backArrow:   { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    textAlign:  'center',
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize:  fontSizes.xs,
    color:     'rgba(255,255,255,0.8)',
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
  prompt: {
    fontSize:   fontSizes.xxl,
    fontWeight: fontWeights.extraBold,
    color:      colours.textPrimary,
    textAlign:  'center',
    marginTop:  spacing.xl,
  },
  promptSub: {
    fontSize:     fontSizes.sm,
    color:        colours.textSecondary,
    textAlign:    'center',
    marginTop:    spacing.xs,
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
    borderColor:     colours.borderBlue,
    borderRadius:    radius.lg,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    backgroundColor: colours.surface,
    position:        'relative',
    ...shadows.card,
  },
  tipBtnCustom: { borderStyle: 'dashed' },
  tipBtnActive: {
    backgroundColor: colours.primary,
    borderColor:     colours.primary,
    ...shadows.blue,
  },
  tipBtnCoin: {
    fontSize:     fontSizes.lg,
    marginBottom: spacing.xs,
  },
  tipBtnText: {
    fontSize:   fontSizes.xxl,
    fontWeight: fontWeights.extraBold,
    color:      colours.primary,
  },
  tipBtnTextActive: { color: colours.white },

  customRow: {
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       2,
    borderColor:       colours.primary,
    borderRadius:      radius.lg,
    paddingHorizontal: spacing.lg,
    marginTop:         spacing.md,
    backgroundColor:   colours.surface,
    ...shadows.card,
  },
  customCurrency: {
    fontSize:    fontSizes.xxl,
    fontWeight:  fontWeights.extraBold,
    color:       colours.primary,
    marginRight: spacing.sm,
  },
  customInput: {
    flex:            1,
    fontSize:        fontSizes.xxl,
    fontWeight:      fontWeights.extraBold,
    color:           colours.textPrimary,
    paddingVertical: spacing.lg,
  },
  // The reliable way to submit a custom amount — see the comment above the
  // TextInput on why onSubmitEditing alone is not enough on Android.
  customConfirm: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colours.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      spacing.sm,
  },
  customConfirmDisabled: { backgroundColor: colours.border },
  customConfirmText: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  noPresetsHint: {
    marginTop:  spacing.md,
    fontSize:   fontSizes.sm,
    color:      colours.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
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
