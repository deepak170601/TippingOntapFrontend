// src/screens/payment/ResultScreen.tsx
// Params: { success: boolean, amountCents: number, errorMessage?: string }
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing, ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PaymentStackParamList } from '../../navigation/PaymentNavigator';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows, letterSpacing,
} from '../../theme';

type Props = NativeStackScreenProps<PaymentStackParamList, 'Result'>;

const ResultScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const { success, amountCents, errorMessage } = route.params;

  // ── Animations ─────────────────────────────────────────────
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(30)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Icon pops in
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, friction: 4, tension: 90, useNativeDriver: true,
      }),
      // Content slides up
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Shimmer loop on success card
    if (success) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const formattedAmount = (amountCents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'}
      />

      {/* Soft background tint */}
      <View style={[
        styles.bgTint,
        { backgroundColor: success ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.04)' },
      ]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <Animated.View style={[
          styles.iconWrap,
          { transform: [{ scale: scaleAnim }] },
        ]}>
          <View style={[
            styles.iconOuter,
            success ? styles.iconOuterSuccess : styles.iconOuterFail,
          ]}>
            <View style={[
              styles.iconInner,
              success ? styles.iconInnerSuccess : styles.iconInnerFail,
            ]}>
              <Text style={styles.iconEmoji}>
                {success ? '✓' : '✕'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Title + amount */}
        <Animated.View style={[
          styles.titleWrap,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          <Text style={[
            styles.title,
            success ? styles.titleSuccess : styles.titleFail,
          ]}>
            {success ? 'Payment Successful!' : 'Payment Failed'}
          </Text>

          {success ? (
            <Text style={styles.amount}>{formattedAmount}</Text>
          ) : (
            <Text style={styles.errorMsg}>
              {errorMessage ?? 'Something went wrong. Please try again.'}
            </Text>
          )}
        </Animated.View>

        {/* Details card */}
        <Animated.View style={[
          styles.card,
          success && styles.cardSuccess,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          {success ? (
            <>
              <ResultRow icon="🎉" label="Status"    value="Tip Received"  valueColour={colours.success} />
              <View style={styles.rowDivider} />
              <ResultRow icon="💰" label="Amount"    value={formattedAmount} />
              <View style={styles.rowDivider} />
              <ResultRow icon="📧" label="Receipt"   value="Sent to merchant" />
              <View style={styles.rowDivider} />
              <ResultRow icon="🔒" label="Secured"   value="Stripe Terminal" />
            </>
          ) : (
            <>
              <ResultRow icon="❌" label="Status"   value="Declined"       valueColour={colours.error} />
              <View style={styles.rowDivider} />
              <ResultRow icon="💳" label="Amount"   value={formattedAmount} />
              <View style={styles.rowDivider} />
              <ResultRow icon="💡" label="Tip"      value="Check card & try again" />
            </>
          )}
        </Animated.View>

        {/* Shimmer line on success */}
        {success && (
          <Animated.View style={[
            styles.shimmerLine,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 1, 0.3],
              }),
            },
          ]} />
        )}

        {/* Action buttons */}
        <Animated.View style={[
          styles.buttonsWrap,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          {success ? (
            <>
              {/* Primary CTA */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.replace('Amount', { event: route.params as any })}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>💵  Make Another Payment</Text>
              </TouchableOpacity>

              {/* Secondary */}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.getParent()?.navigate('Main')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => navigation.replace('Amount', { event: route.params as any })}
                activeOpacity={0.85}
              >
                <Text style={styles.retryBtnText}>🔄  Try Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.getParent()?.navigate('Main')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Text style={styles.footer}>
          {success
            ? '🎊 Thank you for your tip!'
            : '🔒 No charges were made to your card'}
        </Text>
      </ScrollView>
    </View>
  );
};

// ── Helper component ───────────────────────────────────────────
const ResultRow = ({
  icon, label, value, valueColour,
}: {
  icon: string; label: string; value: string; valueColour?: string;
}) => (
  <View style={styles.resultRow}>
    <Text style={styles.rowIcon}>{icon}</Text>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueColour ? { color: valueColour } : null]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  bgTint:    { ...StyleSheet.absoluteFillObject },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },

  // Icon
  iconWrap:          { marginBottom: spacing.xl },
  iconOuter:         { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  iconOuterSuccess:  { backgroundColor: 'rgba(34,197,94,0.1)',  borderWidth: 2, borderColor: 'rgba(34,197,94,0.25)' },
  iconOuterFail:     { backgroundColor: 'rgba(239,68,68,0.1)',  borderWidth: 2, borderColor: 'rgba(239,68,68,0.25)' },
  iconInner:         { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  iconInnerSuccess:  { backgroundColor: colours.success, shadowColor: colours.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  iconInnerFail:     { backgroundColor: colours.error,   shadowColor: colours.error,   shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  iconEmoji:         { fontSize: 52, color: colours.white, fontWeight: fontWeights.bold },

  // Title
  titleWrap:    { alignItems: 'center', marginBottom: spacing.xl },
  title:        { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, textAlign: 'center', marginBottom: spacing.sm },
  titleSuccess: { color: colours.success },
  titleFail:    { color: colours.error },
  amount:       { fontSize: 44, fontWeight: fontWeights.extraBold, color: colours.textPrimary, letterSpacing: -1 },
  errorMsg:     { fontSize: fontSizes.base, color: colours.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Card
  card: {
    width: '100%', backgroundColor: colours.surface,
    borderRadius: radius.lg, padding: spacing.base,
    marginBottom: spacing.lg, ...shadows.card,
    borderWidth: 1, borderColor: colours.border,
  },
  cardSuccess: { borderColor: 'rgba(34,197,94,0.2)' },

  // Result rows
  resultRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowIcon:    { fontSize: 18, marginRight: spacing.md, width: 26 },
  rowLabel:   { flex: 1, fontSize: fontSizes.sm, color: colours.textSecondary, fontWeight: fontWeights.medium },
  rowValue:   { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.textPrimary },
  rowDivider: { height: 1, backgroundColor: colours.border, marginVertical: 2 },

  // Shimmer
  shimmerLine: {
    width: '60%', height: 2,
    backgroundColor: colours.accent,
    borderRadius: 1,
    marginBottom: spacing.lg,
  },

  // Buttons
  buttonsWrap:    { width: '100%', gap: spacing.sm, marginBottom: spacing.lg },
  primaryBtn:     { backgroundColor: colours.accent, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', elevation: 3, shadowColor: colours.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
  primaryBtnText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.primary, letterSpacing: letterSpacing.wide },
  retryBtn:       { backgroundColor: colours.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', elevation: 2 },
  retryBtnText:   { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white, letterSpacing: letterSpacing.wide },
  secondaryBtn:   { borderWidth: 1.5, borderColor: colours.border, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textSecondary },

  footer: { fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center' },
});

export default ResultScreen;