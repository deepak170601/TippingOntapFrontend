// src/screens/dashboard/ActiveEventScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, TextInput,
  Animated, Easing, Alert, RefreshControl,
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
import BottomTabBar from '../../components/BottomTabBar';
import api from '../../services/api';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'ActiveEvent'>;

interface TipPreset {
  label: string;
  cents: number | null;
}

// ── Tip presets built from event.tipOptions ────────────────────
// (built inside component — see below)

const MERCHANT_FEE_PERCENT = 5;

const ActiveEventScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const topInset   = useTopInset();
  const route      = useRoute<RouteType>();
  const event      = route.params?.event ?? {
    id: 'demo', name: "Sarah's Birthday Party",
    date: 'Feb 28, 2026', location: 'New York',
    tipOptions: [100, 200],
    status: 'active' as const,
    tipsCollected: 0,
    totalAmount: 0,
  };

  const { startPayment, paymentState, statusMessage } = usePayment();

  // ── Real stats from API ────────────────────────────────────
  const [totalTipsCollected, setTotalTipsCollected] = useState<number>(event.totalAmount ?? 0);
  const [numberOfTips,       setNumberOfTips]       = useState<number>(event.tipsCollected ?? 0);
  const [refreshing,         setRefreshing]         = useState<boolean>(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.getEventTips(event.id) as {
        totalAmount:   number;
        tipsCollected: number;
      };
      setTotalTipsCollected(res.totalAmount   ?? 0);
      setNumberOfTips(      res.tipsCollected ?? 0);
    } catch (err) {
      console.error('ActiveEvent stats error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [event.id]);

  // Load on mount + reload after each successful payment
  useEffect(() => { loadStats(); }, [loadStats]);

  // Reload stats when payment succeeds
  useEffect(() => {
    if (paymentState === 'success') { loadStats(); }
  }, [paymentState, loadStats]);

  // ── Build tip presets from event.tipOptions ────────────────
  const TIP_PRESETS: TipPreset[] = [
    ...(event.tipOptions ?? []).map(cents => ({
      label: `$${(cents / 100).toFixed(0)} Tip`,
      cents,
    })),
    { label: 'Custom', cents: null },
  ];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customAmount,  setCustomAmount]  = useState<string>('');
  const [isProcessing,  setIsProcessing]  = useState<boolean>(false);

  // ── Coin spin animations ───────────────────────────────────
  const coinSpin1 = useRef(new Animated.Value(0)).current;
  const coinSpin2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = (anim: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1, duration,
          easing:  Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    spin(coinSpin1, 2400);
    spin(coinSpin2, 1800);
  }, []);

  const spinInterpolate = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ── Tip amount logic ───────────────────────────────────────
  const getSelectedCents = (): number | null => {
    if (selectedIndex === null) { return null; }
    const preset = TIP_PRESETS[selectedIndex];
    if (!preset.cents) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? null : Math.round(parsed * 100);
    }
    return preset.cents;
  };

  const selectedCents = getSelectedCents();
  const isCustom      = selectedIndex === TIP_PRESETS.length - 1;
  const canTip        = selectedCents !== null && selectedCents > 0;

  const handleTip = async (): Promise<void> => {
    if (!canTip || !selectedCents) { return; }

    // The backend rejects a non-active event at *capture* time — after the
    // card has already been charged. Catch it here, before anyone taps.
    if (event.status !== 'active') {
      Alert.alert(
        'Event Not Active',
        'Start this event before collecting tips.',
      );
      return;
    }

    setIsProcessing(true);
    try {
      // chargesEnabled is what gates taking money; payoutsEnabled only gates
      // withdrawal. This call also nudges the backend into provisioning the
      // Terminal location before resolveLocationId needs it.
      const status = await api.getConnectStatus();
      if (!status.chargesEnabled) {
        Alert.alert(
          'Payment Setup Incomplete',
          'Finish your payment setup before collecting tips.',
        );
        return;
      }

      const result = await startPayment({ amountCents: selectedCents, eventId: event.id });
      if (result.success) {
        navigation.navigate('TipResult', {
          success:     true,
          amountCents: selectedCents,
          eventName:   event.name,
        });
      } else {
        Alert.alert('Payment Failed', result.error ?? 'Please try again.');
      }
    } catch (err) {
      Alert.alert(
        'Payment Failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ── End Event with confirmation ────────────────────────────
const [isEnding, setIsEnding] = useState<boolean>(false);

const handleEndEvent = (): void => {
  Alert.alert(
    'End This Event?',
    `"${event.name}" will be moved to Past Events and you will stop accepting tips for it. This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Event',
        style: 'destructive',
        onPress: async () => {
          setIsEnding(true);
          try {
            await api.endEvent(event.id);
            Alert.alert(
              'Event Ended',
              `"${event.name}" is now in your Past Events.`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } catch (err) {
            Alert.alert(
              'Could Not End Event',
              err instanceof Error ? err.message : 'Please try again.'
            );
          } finally {
            setIsEnding(false);
          }
        },
      },
    ]
  );
};

  // ── Earnings calc — uses real live values ──────────────────
  const totalTips   = totalTipsCollected / 100;
  const fee         = totalTips * (MERCHANT_FEE_PERCENT / 100);
  const finalAmount = totalTips - fee;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Event</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStats(); }}
            colors={[colours.primary]}
          />
        }
      >
        {/* ── Event name row ────────────────────────────── */}
        <View style={styles.eventNameRow}>
          <TouchableOpacity style={styles.arrowBtn}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>
          <TouchableOpacity style={styles.arrowBtn}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Date + status ─────────────────────────────── */}
        <View style={styles.statusRow}>
          <Text style={styles.eventDate}>{event.date}</Text>
          <View style={styles.statusDivider} />
          <Text style={styles.statusLabel}>Status: </Text>
          <Text style={styles.statusActive}>Active</Text>
        </View>

        {/* ── Tip Me ────────────────────────────────────── */}
        <View style={styles.tipMeRow}>
          <Text style={styles.tipMeText}>Tip Me</Text>
          <Animated.Text style={[styles.coinEmoji, { transform: [{ rotate: spinInterpolate(coinSpin1) }] }]}>🪙</Animated.Text>
          <Animated.Text style={[styles.coinEmoji, { transform: [{ rotate: spinInterpolate(coinSpin2) }] }]}>🪙</Animated.Text>
        </View>

        {/* ── Tip preset buttons — dynamic from event ───── */}
        <View style={styles.tipButtonsRow}>
          {TIP_PRESETS.map((preset, i) => (
            <TouchableOpacity
              key={`${preset.label}-${i}`}
              style={[styles.tipBtn, selectedIndex === i && styles.tipBtnSelected]}
              onPress={() => { setSelectedIndex(i); setCustomAmount(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tipBtnText, selectedIndex === i && styles.tipBtnTextSelected]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Custom amount input ───────────────────────── */}
        {isCustom && (
          <View style={styles.customWrap}>
            <Text style={styles.customLabel}>Enter amount</Text>
            <View style={styles.customInputRow}>
              <Text style={styles.customCurrency}>$</Text>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colours.textSecondary}
                autoFocus
              />
            </View>
          </View>
        )}

        {/* ── Tap to Pay button ─────────────────────────── */}
        {canTip && (
          <TouchableOpacity
            style={[styles.payBtn, isProcessing && styles.payBtnDisabled]}
            onPress={handleTip}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Text style={styles.payBtnText}>
              {isProcessing ? statusMessage : `Tap to Pay  ${fmt((selectedCents ?? 0) / 100)}`}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* ── Stats — real data ─────────────────────────── */}
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>Total Tips Collected :</Text>
          <Text style={styles.statValue}>{fmt(totalTips)}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statLabel}>Number of Tips :</Text>
          <Text style={styles.statValue}>{numberOfTips}</Text>
        </View>

        {/* ── Earnings Summary card — real data ─────────── */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsGradientA} />
          <View style={styles.earningsGradientB} />
          <View style={styles.earningsInner}>
            <Text style={styles.earningsTitle}>Earnings Summary</Text>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Event Earnings :</Text>
              <Text style={styles.earningsValue}>{fmt(totalTips)}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Merchant Fee ({MERCHANT_FEE_PERCENT}%) :</Text>
              <Text style={[styles.earningsValue, { color: colours.error }]}>-{fmt(fee)}</Text>
            </View>
            <View style={styles.finalRow}>
              <Text style={styles.finalLabel}>Final Amount :</Text>
              <Text style={styles.finalValue}>{fmt(finalAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
      {/* ── End Event button ──────────────────────────── */}
        <TouchableOpacity
          style={[styles.endEventBtn, isEnding && styles.endEventBtnDisabled]}
          onPress={handleEndEvent}
          disabled={isEnding}
          activeOpacity={0.85}
        >
          <Text style={styles.endEventBtnText}>
            {isEnding ? 'Ending…' : 'End Event'}
          </Text>
        </TouchableOpacity>
      <BottomTabBar />
    </View>
    
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  backBtn:     { padding: spacing.xs },
  backArrow:   { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  headerRight: { width: 32 },

  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.base },

  eventNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  arrowBtn:     { padding: spacing.sm },
  arrowText:    { fontSize: 28, color: colours.primary, fontWeight: fontWeights.bold },
  eventName:    { flex: 1, fontSize: fontSizes.xl, fontWeight: fontWeights.extraBold, color: colours.textPrimary, textAlign: 'center' },

  statusRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  eventDate:    { fontSize: fontSizes.sm, color: colours.textSecondary },
  statusDivider:{ width: 1, height: 14, backgroundColor: colours.border },
  statusLabel:  { fontSize: fontSizes.sm, color: colours.textSecondary },
  statusActive: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.success },

  tipMeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tipMeText:  { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, color: colours.textPrimary },
  coinEmoji:  { fontSize: 24 },

  tipButtonsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  tipBtn: {
    flex:            1,
    minWidth:        70,
    borderWidth:     1.5,
    borderColor:     colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    backgroundColor: colours.surface,
  },
  tipBtnSelected:     { backgroundColor: colours.primary },
  tipBtnText:         { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary },
  tipBtnTextSelected: { color: colours.white },

  customWrap:     { marginBottom: spacing.md },
  customLabel:    { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: spacing.xs },
  customInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colours.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colours.surface },
  customCurrency: { fontSize: fontSizes.lg, color: colours.primary, fontWeight: fontWeights.bold, marginRight: spacing.xs },
  customInput:    { flex: 1, fontSize: fontSizes.lg, color: colours.textPrimary, paddingVertical: spacing.md },

  payBtn:         { backgroundColor: colours.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...shadows.blue },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText:     { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },

  divider: { height: 1, backgroundColor: colours.border, marginVertical: spacing.md },

  statsRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  statLabel:  { fontSize: fontSizes.base, color: colours.textPrimary },
  statValue:  { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary },

  earningsCard:      { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.md, ...shadows.blue },
  earningsGradientA: { ...StyleSheet.absoluteFillObject, backgroundColor: colours.primaryLight },
  earningsGradientB: { ...StyleSheet.absoluteFillObject, backgroundColor: colours.primaryDark, opacity: 0.6, borderTopLeftRadius: radius.xl * 2 },
  earningsInner:     { padding: spacing.base },
  earningsTitle:     { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white, textAlign: 'center', marginBottom: spacing.md },
  earningsRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  earningsLabel:     { fontSize: fontSizes.base, color: 'rgba(255,255,255,0.8)' },
  earningsValue:     { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },
  finalRow:          { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colours.white, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  finalLabel:        { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.primary },
  finalValue:        { fontSize: fontSizes.base, fontWeight: fontWeights.extraBold, color: colours.primary },

  bottomPad: { height: spacing.xxxl },

  endEventBtn: {
    borderWidth:     1.5,
    borderColor:     colours.error,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.lg,
    backgroundColor: colours.surface,
  },
  endEventBtnDisabled: { opacity: 0.6 },
  endEventBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.error,
  },
});

export default ActiveEventScreen;