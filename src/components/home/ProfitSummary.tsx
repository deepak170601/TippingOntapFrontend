// src/components/home/ProfitSummary.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

interface ProfitSummaryProps {
  totalProfit:   number; // in cents
  onViewHistory: () => void;
}

const ProfitSummary = ({ totalProfit, onViewHistory }: ProfitSummaryProps): React.JSX.Element => {
  const formatted = (totalProfit / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  return (
    <View style={styles.card}>
      {/* Gold accent top bar */}
      <View style={styles.accentBar} />

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>💰 EARNINGS</Text>
        </View>
        <TouchableOpacity onPress={onViewHistory} style={styles.historyBtn}>
          <Text style={styles.historyText}>View History →</Text>
        </TouchableOpacity>
      </View>

      {/* Amount */}
      <Text style={styles.label}>Total Profit</Text>
      <Text style={styles.amount}>{formatted}</Text>

      {/* Bottom decorative dots */}
      <View style={styles.dotsRow}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={[styles.dot, i < 3 && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    ...shadows.strong,
  },
  accentBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 4,
    backgroundColor: colours.accent,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  badge: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colours.accent,
    letterSpacing: 1,
  },
  historyBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  historyText: {
    fontSize: fontSizes.sm,
    color: colours.accent,
    fontWeight: fontWeights.semiBold,
  },
  label: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: fontWeights.medium,
    marginBottom: spacing.xs,
  },
  amount: {
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.extraBold,
    color: colours.white,
    letterSpacing: -1,
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  dot: {
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: 'rgba(245,166,35,0.5)',
  },
});

export default React.memo(ProfitSummary);