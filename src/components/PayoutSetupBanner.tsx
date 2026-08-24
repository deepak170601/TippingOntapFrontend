// src/components/PayoutSetupBanner.tsx
//
// Shown while a merchant can collect tips but cannot withdraw them — the state
// between Stripe enabling charges (identity verified) and enabling payouts
// (bank account verified).
//
// This banner is why gating the app on charges_enabled instead of
// onboardingComplete is safe. Without it a merchant taps ten cards, opens the
// wallet, sees nothing they can withdraw and no explanation, and reasonably
// concludes the money went missing. That is a worse outcome than the signup
// delay the change removes.
//
// Deliberately not dismissible. The condition it describes persists until the
// merchant acts on it, so a banner they can swipe away is one they will have
// forgotten by the time it matters.
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
  colours, fontSizes, fontWeights, spacing, radius,
} from '../theme';

const PayoutSetupBanner = (): React.JSX.Element | null => {
  const { canCollectTips, payoutsEnabled } = useAuthContext();

  const [held,    setHeld]    = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error,   setError]   = useState<string | null>(null);

  const visible = canCollectTips && !payoutsEnabled;

  // Refetch on focus rather than on mount: this sits on tabs that stay mounted,
  // so a tip taken on another screen would otherwise never show up here.
  useFocusEffect(
    useCallback(() => {
      if (!visible) { return; }

      let cancelled = false;

      (async () => {
        try {
          const balance = await api.getConnectBalance();
          if (!cancelled) {
            setHeld((balance.available ?? 0) + (balance.pending ?? 0));
          }
        } catch {
          // The amount is a nicety; the message is the point. Never let a failed
          // balance call hide the reason the merchant cannot withdraw.
          if (!cancelled) { setError('balance unavailable'); }
        }
      })();

      return () => { cancelled = true; };
    }, [visible]),
  );

  const handleFinishSetup = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.getOnboardingLink();
      await Linking.openURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not open setup. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!visible) { return null; }

  const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Text style={styles.icon}>🏦</Text>
        <View style={styles.copy}>
          <Text style={styles.title}>Add a bank account to withdraw</Text>

          <Text style={styles.body}>
            {held !== null && held > 0
              ? `You're collecting tips normally and ${fmt(held)} is being held safely in your Stripe balance. `
              : "You're collecting tips normally and they're being held safely in your Stripe balance. "}
            Verify a bank account to move the money out.
          </Text>

          {error !== null && error !== 'balance unavailable' && (
            <Text style={styles.error}>{error}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleFinishSetup}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator size="small" color={colours.textOnBlue} />
          : <Text style={styles.buttonText}>Finish payment setup</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor:   colours.surface,
    borderRadius:      radius.md,
    borderLeftWidth:   4,
    borderLeftColor:   colours.warning,
    padding:           spacing.md,
    marginBottom:      spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  icon: {
    fontSize:    fontSizes.lg,
    marginRight: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize:     fontSizes.md,
    fontWeight:   fontWeights.bold,
    color:        colours.textPrimary,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize:   fontSizes.sm,
    color:      colours.textSecondary,
    lineHeight: 20,
  },
  error: {
    fontSize:  fontSizes.sm,
    color:     colours.error,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colours.primary,
    borderRadius:    radius.sm,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    marginTop:       spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color:      colours.textOnBlue,
    fontSize:   fontSizes.md,
    fontWeight: fontWeights.semiBold,
  },
});

export default PayoutSetupBanner;
