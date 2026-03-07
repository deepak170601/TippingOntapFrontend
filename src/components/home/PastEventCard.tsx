// src/components/home/PastEventCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import type { Event } from '../../services/api';

interface Props { event: Event; }

const PastEventCard = ({ event }: Props): React.JSX.Element => {
  const tipsFormatted = ((event.totalTips ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{event.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.date}>{event.date}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.tipsLabel}>TIPS</Text>
        <Text style={styles.tipsAmount}>{tipsFormatted}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderWidth:     1,
    borderColor:     colours.border,
    ...shadows.subtle,
  },
  left:       { flex: 1, marginRight: spacing.base },
  name:       { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.textPrimary, marginBottom: spacing.xs },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaIcon:   { fontSize: 12 },
  date:       { fontSize: fontSizes.sm, color: colours.textSecondary },
  right:      { alignItems: 'flex-end' },
  tipsLabel:  { fontSize: fontSizes.xs, color: colours.textSecondary, fontWeight: fontWeights.bold, letterSpacing: 0.8, marginBottom: 2 },
  tipsAmount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.success },
});

export default React.memo(PastEventCard);