// src/screens/dashboard/UpcomingEventDetailScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import BottomTabBar from '../../components/BottomTabBar';
import api from '../../services/api';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'UpcomingEventDetail'>;

interface TipOption {
  label: string;
  cents: number | null;
}

const UpcomingEventDetailScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const topInset   = useTopInset();
  const route      = useRoute<RouteType>();
  const event      = route.params.event;

  // ── Build tip options from event — inside component so event is available ──
  const TIP_OPTIONS: TipOption[] = [
    ...(event.tipOptions ?? []).map(cents => ({
      label: `$${(cents / 100).toFixed(0)}`,
      cents,
    })),
    { label: 'Custom', cents: null },
  ];

  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [isStarting,  setIsStarting]  = useState<boolean>(false);

  const activeTipLabel = TIP_OPTIONS[selectedTip]?.label ?? 'Custom';

  // ── Start event ───────────────────────────────────────────
  const handleStartEvent = async (): Promise<void> => {
    setIsStarting(true);
    try {
      await api.startEvent(event.id);

      Alert.alert(
        '🎉 Event Started!',
        `"${event.name}" is now live.`,
        [
          {
            text: 'Go to Event',
            onPress: () => navigation.navigate('ActiveEvent', { event }),
          },
          {
            text: 'Stay Here',
            style: 'cancel',
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'Failed to Start',
        err instanceof Error ? err.message : 'Could not start event. Please try again.',
      );
    } finally {
      setIsStarting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Event info card ───────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.eventName}>{event.name}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{event.date}</Text>
            {event.time && (
              <>
                <View style={styles.metaDivider} />
                <Text style={styles.metaText}>{event.time}</Text>
              </>
            )}
          </View>

          {event.location ? (
            <Text style={styles.locationText}>📍 {event.location}</Text>
          ) : null}

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>UpComing</Text>
          </View>
        </View>

        {/* ── Tip Options card ──────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>TIP Options</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.tipButtonsRow}>
            {TIP_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={`${opt.label}-${i}`}
                style={[styles.tipBtn, selectedTip === i && styles.tipBtnSelected]}
                onPress={() => setSelectedTip(i)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tipBtnText, selectedTip === i && styles.tipBtnTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.activeTipText}>Active Tip: {activeTipLabel}</Text>
        </View>

        {/* ── Event Notes card ──────────────────────────── */}
        {event.description ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>Event Notes</Text>
              <View style={styles.sectionLine} />
            </View>
            <Text style={styles.notesText}>{event.description}</Text>
          </View>
        ) : null}

        {/* ── Start Event button ────────────────────────── */}
        <TouchableOpacity
          style={[styles.startBtn, isStarting && styles.startBtnDisabled]}
          onPress={handleStartEvent}
          disabled={isStarting}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>
            {isStarting ? 'Starting…' : 'Start Event'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colours.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  backBtn:         { padding: spacing.xs },
  backArrow:       { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle:     { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  headerRight:     { width: 32 },
  scrollContent:   { padding: spacing.base },
  card:            { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, borderColor: colours.border, ...shadows.subtle },
  eventName:       { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.primary, marginBottom: spacing.sm },
  metaRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  metaText:        { fontSize: fontSizes.sm, color: colours.textSecondary },
  metaDivider:     { width: 1, height: 14, backgroundColor: colours.border },
  locationText:    { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: spacing.md },
  statusBadge:     { alignSelf: 'center', backgroundColor: colours.primary, borderRadius: radius.round, paddingHorizontal: spacing.xl, paddingVertical: spacing.xs },
  statusBadgeText: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.white },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  sectionLine:     { flex: 1, height: 1, backgroundColor: colours.border },
  sectionTitle:    { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary },
  tipButtonsRow:      { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tipBtn:             { flex: 1, minWidth: 60, borderWidth: 1.5, borderColor: colours.primary, borderRadius: radius.round, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colours.surface },
  tipBtnSelected:     { backgroundColor: colours.primary },
  tipBtnText:         { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary },
  tipBtnTextSelected: { color: colours.white },
  activeTipText:      { textAlign: 'center', fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textPrimary },
  notesText:          { fontSize: fontSizes.base, color: colours.textSecondary, lineHeight: 22 },
  startBtn:           { borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', backgroundColor: '#22C55E', ...shadows.subtle },
  startBtnDisabled:   { opacity: 0.6 },
  startBtnText:       { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  bottomPad:          { height: spacing.xxxl },
});

export default UpcomingEventDetailScreen;