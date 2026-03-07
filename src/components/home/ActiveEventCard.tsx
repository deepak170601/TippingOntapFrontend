// src/components/home/ActiveEventCard.tsx
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import type { Event } from '../../services/api';

interface Props {
  event:      Event;
  onViewTips: () => void;
  onEndEvent: () => void;
}

const ActiveEventCard = ({ event, onViewTips, onEndEvent }: Props): React.JSX.Element => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.liveWrap}>
          <View style={styles.liveDotContainer}>
            <Animated.View style={[
              styles.liveDotPulse,
              { transform: [{ scale: pulseAnim }] },
            ]} />
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.liveText}>LIVE NOW</Text>
        </View>
        <Text style={styles.dateText}>{event.date}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>{event.name}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaIcon}>📍</Text>
        <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.viewBtn} onPress={onViewTips} activeOpacity={0.8}>
          <Text style={styles.viewBtnText}>💵  View Tips</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={onEndEvent} activeOpacity={0.8}>
          <Text style={styles.endBtnText}>⛔  End Event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    borderWidth:     1.5,
    borderColor:     'rgba(34,197,94,0.35)',
    ...shadows.card,
  },
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  liveDotContainer: {
    width: 10, height: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  liveDotPulse: {
    position:        'absolute',
    width: 10, height: 10,
    borderRadius:    5,
    backgroundColor: 'rgba(34,197,94,0.3)',
  },
  liveDot: {
    width: 7, height: 7,
    borderRadius:    4,
    backgroundColor: colours.success,
  },
  liveText: {
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.bold,
    color:         colours.success,
    letterSpacing: 1.2,
  },
  dateText: {
    fontSize:   fontSizes.xs,
    color:      colours.textSecondary,
    fontWeight: fontWeights.medium,
  },
  name: {
    fontSize:     fontSizes.lg,
    fontWeight:   fontWeights.bold,
    color:        colours.textPrimary,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.sm,
  },
  metaIcon: { fontSize: 13 },
  metaText: {
    fontSize: fontSizes.sm,
    color:    colours.textSecondary,
    flex:     1,
  },
  divider: {
    height:          1,
    backgroundColor: colours.border,
    marginVertical:  spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  viewBtn: {
    flex:            1,
    borderWidth:     1.5,
    borderColor:     colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
  },
  viewBtnText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.bold,
    color:      colours.primary,
  },
  endBtn: {
    flex:            1,
    backgroundColor: colours.error,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    elevation:       2,
  },
  endBtnText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
});

export default React.memo(ActiveEventCard);