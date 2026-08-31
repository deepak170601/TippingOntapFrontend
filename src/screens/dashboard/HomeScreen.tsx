// src/screens/dashboard/HomeScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import type { RootNavigationProp } from '../../navigation/AppNavigator';
import { useAuthContext } from '../../context/AuthContext';
import api, { Event }    from '../../services/api';
import { syncEventReminders } from '../../services/notifications';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import PayoutSetupBanner from '../../components/PayoutSetupBanner';
import ConfirmSheet from '../../components/common/ConfirmSheet';


type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const HomeScreen = ({ navigation }: Props): React.JSX.Element => {
  const { user }       = useAuthContext();
  const rootNavigation = useNavigation<RootNavigationProp>();
  const topInset       = useTopInset();

  const [activeEvents,   setActiveEvents]   = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents,     setPastEvents]     = useState<Event[]>([]);
  const [totalProfit,    setTotalProfit]    = useState<number>(0);
  const [refreshing,     setRefreshing]     = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.getEvents(),
        api.getHomeStats(),
      ]);
      setActiveEvents(eventsRes.active     ?? []);
      setUpcomingEvents(eventsRes.upcoming ?? []);

      // Keep the phone's scheduled reminders in step with the server's idea of
      // what is upcoming. This runs on every focus, which is what makes an
      // edited, cancelled or already-started event stop reminding — the sync is
      // idempotent and does no network of its own, so it is free to repeat.
      // Deliberately not awaited: it never throws and the screen must not wait
      // on the notification subsystem to render.
      syncEventReminders(eventsRes.upcoming ?? []).catch(() => { /* never fatal */ });
      setPastEvents((eventsRes.past        ?? []).slice(0, 2));
      setTotalProfit(statsRes.totalProfit  ?? 0);
    } catch (err) {
      console.error('HomeScreen load error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refetch on every focus so totalProfit reflects tips taken
  // elsewhere — this tab stays mounted, so mount-only would go stale.
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ── Navigation handlers ────────────────────────────────────
  const handleViewTip = (event: Event): void => {
    rootNavigation.navigate('TipCollection', { event });
  };

  // Ending an event is one tap, irreversible, and stops the merchant taking
  // money — so it asks first, in the app's own card rather than an OS alert.
  //
  // The failure used to be swallowed, which is worse than it sounds: the card
  // stays on screen looking unchanged, so the merchant reads a failed request
  // as a successful one and walks away from an event that is still live.
  const [endingEvent, setEndingEvent] = useState<Event | null>(null);
  const [endBusy,     setEndBusy]     = useState<boolean>(false);

  const confirmEndEvent = async (): Promise<void> => {
    if (endingEvent === null) { return; }
    setEndBusy(true);
    try {
      await api.endEvent(endingEvent.id);
      setEndingEvent(null);
      await loadData();
    } catch (err) {
      setEndingEvent(null);
      Alert.alert(
        'Could not end event',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setEndBusy(false);
    }
  };

  const firstName = user?.fullName?.split(' ')[0] ?? 'Alex';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Blue header ───────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <Text style={styles.headerLogo}>LOGO</Text>
        <Text style={styles.headerGreeting}>Hi {firstName}!</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Profit strip ──────────────────────────────────── */}
      <View style={styles.profitStrip}>
        <View style={styles.profitLeft}>
          <Text style={styles.profitLabel}>Total Profit : </Text>
          <Text style={styles.profitAmount}>{fmt(totalProfit)}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Wallet')}>
          <Text style={styles.viewHistory}>View History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colours.primary]}
            tintColor={colours.primary}
          />
        }
      >
        {/* ── Payouts not enabled yet ────────────────────── */}
        {/* Renders nothing unless the merchant can collect but not withdraw. */}
        <PayoutSetupBanner />

        {/* ── Upcoming Events card ───────────────────────── */}
        <View style={styles.upcomingCard}>
          <View style={styles.upcomingGradientA} />
          <View style={styles.upcomingGradientB} />
          <View style={styles.upcomingContent}>
            <View style={styles.upcomingMeta}>
              <Text style={styles.upcomingDate}>
                {upcomingEvents[0]?.date ?? 'No upcoming events'}
              </Text>
              <Text style={styles.upcomingLocation}>
                {upcomingEvents[0]?.location ?? ''}
              </Text>
            </View>
            <View style={styles.upcomingCenter}>
              <View style={styles.calendarIcon}>
                <Text style={styles.calendarEmoji}>📅</Text>
              </View>
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => rootNavigation.navigate('UpcomingEvents')}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.upcomingTitle}>Upcoming Events</Text>
          </View>
        </View>

        {/* ── Active Events ─────────────────────────────── */}
        <SectionHeader
          title="Active Events"
          action="See All"
          onPress={() => rootNavigation.navigate('ActiveEvents')}
        />
        {activeEvents.length === 0 ? (
          <EmptyCard message="No active events right now" />
        ) : (
          activeEvents.map(event => (
            <ActiveEventCard
              key={event.id}
              event={event}
              onViewTip={() => handleViewTip(event)}
              onEndEvent={() => setEndingEvent(event)}
            />
          ))
        )}

        {/* ── Past Events ───────────────────────────────── */}
        <SectionHeader
          title="Past Events"
          action="See All"
          onPress={() => rootNavigation.navigate('PastEvents')}
        />
        <View style={styles.pastCard}>
          {pastEvents.length === 0 ? (
            <EmptyCard message="No past events" />
          ) : (
            pastEvents.map((event, index) => (
              <React.Fragment key={event.id}>
                <PastEventRow event={event} fmt={fmt} />
                {index < pastEvents.length - 1 && <View style={styles.pastDivider} />}
              </React.Fragment>
            ))
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <ConfirmSheet
        visible={endingEvent !== null}
        title="End this event?"
        message={
          `"${endingEvent?.name ?? ''}" will move to Past Events and stop `
          + 'accepting tips. This cannot be undone.'
        }
        confirmLabel="Yes, end it"
        cancelLabel="No, keep it running"
        destructive
        busy={endBusy}
        onConfirm={confirmEndEvent}
        onCancel={() => setEndingEvent(null)}
      />
    </View>
  );
};

// ── Sub-components ────────────────────────────────────────────
const SectionHeader = ({
  title, action, onPress,
}: { title: string; action: string; onPress: () => void }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <TouchableOpacity onPress={onPress}>
      <Text style={styles.sectionAction}>{action}</Text>
    </TouchableOpacity>
  </View>
);

const ActiveEventCard = ({
  event, onViewTip, onEndEvent,
}: { event: Event; onViewTip: () => void; onEndEvent: () => void }) => (
  <View style={styles.activeCard}>
    <Text style={styles.activeName}>{event.name}</Text>
    <Text style={styles.activeMeta}>Date:  {event.date}</Text>
    <Text style={styles.activeMeta}>Location:  {event.location}</Text>
    <View style={styles.activeActions}>
      <TouchableOpacity style={styles.viewTipBtn} onPress={onViewTip} activeOpacity={0.8}>
        <Text style={styles.viewTipText}>View Tip</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.endEventBtn} onPress={onEndEvent} activeOpacity={0.8}>
        <Text style={styles.endEventText}>End Event</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const PastEventRow = ({ event, fmt }: { event: Event; fmt: (cents: number) => string }) => (
  <View style={styles.pastRow}>
    <Text style={styles.pastName}>{event.name}</Text>
    <Text style={styles.pastAmount}>{fmt(event.totalAmount ?? 0)}</Text>
  </View>
);

const EmptyCard = ({ message }: { message: string }) => (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.primary,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.md,
  },
  headerLogo:     { fontSize: fontSizes.base, fontWeight: fontWeights.bold,      color: colours.white },
  headerGreeting: { fontSize: fontSizes.lg,   fontWeight: fontWeights.bold,      color: colours.white },
  headerRight:    { width: 40 },
  profitStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.primaryDark,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.sm,
  },
  profitLeft:   { flexDirection: 'row', alignItems: 'center' },
  profitLabel:  { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold,  color: colours.white },
  profitAmount: { fontSize: fontSizes.base, fontWeight: fontWeights.extraBold, color: colours.white },
  viewHistory:  { fontSize: fontSizes.sm,   fontWeight: fontWeights.semiBold,  color: colours.accent },
  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.base },
  upcomingCard: {
    height:       140,
    borderRadius: radius.xl,
    overflow:     'hidden',
    marginBottom: spacing.base,
    ...shadows.blue,
  },
  upcomingGradientA: { ...StyleSheet.absoluteFillObject, backgroundColor: colours.primaryLight },
  upcomingGradientB: { ...StyleSheet.absoluteFillObject, backgroundColor: colours.primaryDark, opacity: 0.55, borderTopLeftRadius: radius.xl * 3 },
  upcomingContent:   { flex: 1, padding: spacing.base, justifyContent: 'space-between' },
  upcomingMeta:      { flexDirection: 'row', gap: spacing.base },
  upcomingDate:      { fontSize: fontSizes.sm, color: colours.textOnBlue, fontWeight: fontWeights.medium },
  upcomingLocation:  { fontSize: fontSizes.sm, color: colours.textMuted },
  upcomingCenter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarIcon:      { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  calendarEmoji:     { fontSize: 26 },
  viewAllBtn:        { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  viewAllText:       { fontSize: fontSizes.sm, color: colours.white, fontWeight: fontWeights.semiBold },
  upcomingTitle:     { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, color: colours.white, letterSpacing: -0.5 },
  sectionHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.base, marginBottom: spacing.sm },
  sectionTitle:      { fontSize: fontSizes.base, fontWeight: fontWeights.bold,      color: colours.textPrimary },
  sectionAction:     { fontSize: fontSizes.sm,   fontWeight: fontWeights.semiBold,  color: colours.primary },
  activeCard:        { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm, borderWidth: 1, borderColor: colours.borderBlue, ...shadows.card },
  activeName:        { fontSize: fontSizes.base, fontWeight: fontWeights.bold,      color: colours.primary,       marginBottom: spacing.xs },
  activeMeta:        { fontSize: fontSizes.sm,   color: colours.textSecondary,      marginBottom: spacing.xs / 2 },
  activeActions:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  viewTipBtn:        { flex: 1, backgroundColor: colours.primary, borderRadius: radius.round, paddingVertical: spacing.sm, alignItems: 'center', ...shadows.blue },
  viewTipText:       { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.white },
  endEventBtn:       { flex: 1, borderRadius: radius.round, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: colours.error },
  endEventText:      { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.error },
  pastCard:          { backgroundColor: colours.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadows.subtle, borderWidth: 1, borderColor: colours.border },
  pastRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md, backgroundColor: '#F8FAFF' },
  pastDivider:       { height: 1, backgroundColor: colours.border },
  pastName:          { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colours.textPrimary },
  pastAmount:        { fontSize: fontSizes.base, fontWeight: fontWeights.bold,   color: colours.textPrimary },
  emptyCard:         { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colours.border, borderStyle: 'dashed', marginBottom: spacing.sm },
  emptyText:         { fontSize: fontSizes.sm, color: colours.textSecondary },
  bottomPad:         { height: spacing.xxxl },
});

export default HomeScreen;