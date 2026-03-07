// src/components/home/UpcomingEventCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import type { Event } from '../../services/api';

interface Props { event: Event; }

const UpcomingEventCard = ({ event }: Props): React.JSX.Element => (
  <View style={styles.card}>
    {/* Left accent bar */}
    <View style={styles.accentBar} />

    <View style={styles.content}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⏰ UPCOMING</Text>
        </View>
        <Text style={styles.dateChip}>{event.date}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>{event.name}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaIcon}>📍</Text>
        <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.card,
  },
  accentBar: {
    width: 4,
    backgroundColor: colours.accent,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: colours.accentLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colours.accent,
    letterSpacing: 0.8,
  },
  dateChip: {
    fontSize: fontSizes.xs,
    color: colours.textSecondary,
    fontWeight: fontWeights.medium,
  },
  name: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaIcon: { fontSize: 13 },
  metaText: {
    fontSize: fontSizes.sm,
    color: colours.textSecondary,
    flex: 1,
  },
});

export default React.memo(UpcomingEventCard);