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

  // Selecting the Custom tile clears any preset; typing in it keeps the tile
  // selected but only counts as a real amount once it parses to something
  // payable — the Tap to Pay button below stays disabled on "0", "", or ".".
  const selectCustom = (): void => {
    setCustomSelected(true);
    setSelectedCents(null);
  };

  const onCustomChange = (text: string): void => {
    setCustomText(text);
    const dollars = parseFloat(text);
    setSelectedCents(Number.isFinite(dollars) && dollars > 0
      ? Math.round(dollars * 100)
      : null);
  };

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
          <Text style={styles.promptSub}>Pick an amount or enter your own</Text>

          {/* ── Merchant's presets, plus Custom ────────────── */}
          <View style={styles.tipGrid}>
            {tipOptions.map((cents, i) => {
              const active = !customSelected && selectedCents === cents;
              return (
                <TouchableOpacity
                  key={`${cents}-${i}`}
                  style={[styles.tipBtn, active && styles.tipBtnActive]}
                  onPress={() => { setCustomSelected(false); setSelectedCents(cents); }}
                  activeOpacity={0.85}
                >
                  {active && (
                    <View style={styles.tipBtnCheck}>
                      <Text style={styles.tipBtnCheckText}>✓</Text>
                    </View>
                  )}
                  <Text style={styles.tipBtnCoin}>🪙</Text>
                  <Text style={[styles.tipBtnText, active && styles.tipBtnTextActive]}>
                    {fmt(cents)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.tipBtn,
                styles.tipBtnCustom,
                customSelected && styles.tipBtnActive,
              ]}
              onPress={selectCustom}
              activeOpacity={0.85}
            >
              {customSelected && (
                <View style={styles.tipBtnCheck}>
                  <Text style={styles.tipBtnCheckText}>✓</Text>
                </View>
              )}
              <Text style={styles.tipBtnCoin}>✏️</Text>
              <Text style={[styles.tipBtnText, customSelected && styles.tipBtnTextActive]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          {customSelected && (
            <View style={styles.customRow}>
              <Text style={styles.customCurrency}>$</Text>
              <TextInput
                style={styles.customInput}
                value={customText}
                onChangeText={onCustomChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colours.textSecondary}
                autoFocus
              />
            </View>
          )}

          {tipOptions.length === 0 && !customSelected && (
            <Text style={styles.noPresetsHint}>
              This event has no preset amounts — tap Custom to enter one.
            </Text>
          )}

          <View style={styles.spacer} />

          {/* ── Tap to Pay ──────────────────────────────── */}
          <TouchableOpacity
            style={[styles.payBtn, selectedCents === null && styles.payBtnDisabled]}
            onPress={() => handleTap(false)}
            disabled={selectedCents === null || submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.payBtnIcon}>💳</Text>
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
                Test mode only — no reader or NFC, but the charge, fee and
                payout are real
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
  spacer: { flex: 1 },
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
  tipBtnCheck: {
    position:        'absolute',
    top:             spacing.xs,
    right:           spacing.xs,
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: colours.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  tipBtnCheckText: {
    fontSize:   11,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

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
  noPresetsHint: {
    marginTop:  spacing.md,
    fontSize:   fontSizes.sm,
    color:      colours.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },

  payBtn: {
    flexDirection:   'row',
    backgroundColor: colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.lg,
    ...shadows.blue,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnIcon:     { fontSize: fontSizes.lg, marginRight: spacing.sm },
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
