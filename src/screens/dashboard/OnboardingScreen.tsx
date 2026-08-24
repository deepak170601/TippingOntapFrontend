// src/screens/dashboard/OnboardingScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Linking, ActivityIndicator, Alert,
} from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import useTopInset from '../../hooks/useTopInset';

const OnboardingScreen = (): React.JSX.Element => {
  const { refreshConnectStatus } = useAuthContext();
  const topInset = useTopInset();

  const [loading,        setLoading]        = useState<boolean>(false);
  const [checking,       setChecking]       = useState<boolean>(false);
  const [error,          setError]          = useState<string | null>(null);
  const [statusMessage,  setStatusMessage]  = useState<string | null>(null);

  // ── "Complete Setup" — opens Stripe hosted onboarding ──────
  const handleCompleteSetup = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await api.getOnboardingLink();
      await Linking.openURL(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── "Check My Status" — polls Stripe for current state ─────
  const handleCheckStatus = async (): Promise<void> => {
    setChecking(true);
    setError(null);
    setStatusMessage(null);
    try {
      // Three outcomes now, not two, and the middle one is the whole point:
      // charges switch on when identity clears, payouts later when the bank
      // account is verified, and a merchant sitting between the two can
      // already earn. Telling them "not yet complete, finish in the browser"
      // was both wrong and discouraging at the exact moment they had become
      // able to take money.
      //
      // refreshConnectStatus updates AuthContext, so on either of the first two
      // branches AppNavigator swaps in the real app on its own.
      const status = await refreshConnectStatus();

      if (!status) {
        setStatusMessage('Could not reach Stripe just now. Please try again.');
      } else if (status.canCollectTips && status.payoutsEnabled) {
        setStatusMessage('Setup complete! Taking you to the app…');
      } else if (status.canCollectTips) {
        setStatusMessage(
          'You can start collecting tips now. Add a bank account when you get a ' +
          'moment so you can withdraw — your tips are held safely until then.',
        );
      } else {
        setStatusMessage('Setup not yet complete. Please finish in the browser.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header strip ────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <Text style={styles.headerTitle}>Tipping On The Go</Text>
      </View>

      {/* ── Main content ────────────────────────────────── */}
      <View style={styles.body}>

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>💳</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Set Up Your Payouts</Text>

        {/* Description */}
        <Text style={styles.description}>
          To receive tips directly to your bank account, complete a quick
          one-time setup with our payment partner, Stripe.
        </Text>
        <Text style={styles.timeNote}>This takes about 2 minutes.</Text>

        {/* ── Complete Setup button ────────────────────── */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleCompleteSetup}
          disabled={loading || checking}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colours.white} />
            : <Text style={styles.primaryBtnText}>Complete Setup</Text>}
        </TouchableOpacity>

        {/* ── Divider ──────────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Already completed?</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Check Status button ──────────────────────── */}
        <TouchableOpacity
          style={styles.checkBtn}
          onPress={handleCheckStatus}
          disabled={loading || checking}
          activeOpacity={0.7}
        >
          {checking
            ? <ActivityIndicator size="small" color={colours.primary} />
            : <Text style={styles.checkBtnText}>Check My Status</Text>}
        </TouchableOpacity>

        {/* ── Error message ────────────────────────────── */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️  {error}</Text>
          </View>
        ) : null}

        {/* ── Status message ───────────────────────────── */}
        {statusMessage ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

      </View>

      {/* ── Footer ──────────────────────────────────────── */}
      <Text style={styles.footer}>🔒 Secured by Stripe</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },

  header: {
    backgroundColor:   colours.primary,
    paddingBottom:     spacing.md,
    paddingHorizontal: spacing.base,
    alignItems:        'center',
  },
  headerTitle: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  body: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xxxl,
  },

  iconCircle: {
    width:           90,
    height:          90,
    borderRadius:    45,
    backgroundColor: colours.primaryLight + '22',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xl,
  },
  iconEmoji: { fontSize: 44 },

  title: {
    fontSize:     fontSizes.xxl,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    textAlign:    'center',
    marginBottom: spacing.md,
  },

  description: {
    fontSize:     fontSizes.base,
    color:        colours.textSecondary,
    textAlign:    'center',
    lineHeight:   24,
    marginBottom: spacing.sm,
  },

  timeNote: {
    fontSize:     fontSizes.sm,
    color:        colours.primary,
    fontWeight:   fontWeights.semiBold,
    textAlign:    'center',
    marginBottom: spacing.xl,
  },

  primaryBtn: {
    width:           '100%',
    backgroundColor: colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginBottom:    spacing.lg,
    ...shadows.blue,
  },
  btnDisabled:    { opacity: 0.6 },
  primaryBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  dividerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    width:          '100%',
    marginBottom:   spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colours.border },
  dividerText: {
    marginHorizontal: spacing.sm,
    fontSize:         fontSizes.sm,
    color:            colours.textSecondary,
  },

  checkBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom:    spacing.lg,
  },
  checkBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.semiBold,
    color:      colours.primary,
  },

  errorBox: {
    width:           '100%',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius:    radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colours.error,
    padding:         spacing.md,
    marginTop:       spacing.sm,
  },
  errorText: { color: colours.error, fontSize: fontSizes.sm },

  statusBox: {
    width:           '100%',
    backgroundColor: colours.success + '18',
    borderRadius:    radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colours.success,
    padding:         spacing.md,
    marginTop:       spacing.sm,
  },
  statusText: { color: colours.success, fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold },

  footer: {
    textAlign:     'center',
    fontSize:      fontSizes.xs,
    color:         colours.textSecondary,
    paddingBottom: spacing.xl,
  },
});

export default OnboardingScreen;