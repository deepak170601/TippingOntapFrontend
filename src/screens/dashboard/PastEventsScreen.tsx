// src/screens/dashboard/PastEventsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList, TextInput, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Event } from '../../services/api';
import api from '../../services/api';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import BottomTabBar from '../../components/BottomTabBar';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type FilterTab = 'All' | 'This Month' | 'Last Month';

const FILTER_TABS: FilterTab[] = ['All', 'This Month', 'Last Month'];

// ── Which month did this event fall in? ────────────────────────
//
// dateIso ("2029-06-17", local wall-clock, no zone — see the note on Event in
// api.ts) is the source, not the display date string, and not handed to
// new Date() directly. That constructor treats a bare "YYYY-MM-DD" as UTC
// midnight per spec, so in any timezone behind UTC an event on the 1st of a
// month reads back as the 30th or 31st of the one before — the same trap
// services/notifications.ts already builds around. Built from numeric parts
// instead. The display date string is only a fallback for an event with no
// dateIso, which should not happen for anything created after that field
// shipped.
const eventDate = (event: Event): Date => {
  if (event.dateIso) {
    const [y, m, d] = event.dateIso.split('-').map(Number);
    if (y && m && d) { return new Date(y, m - 1, d); }
  }
  return new Date(event.date);
};

// A single "months since year zero" number turns the comparison into plain
// subtraction, so a January event correctly counts December as last month.
// Comparing d.getMonth() === now.getMonth() - 1 does not: in January,
// now.getMonth() - 1 is -1, which no real month is ever equal to, so every
// December event silently vanished from "Last Month" the moment the calendar
// turned over — the exact moment a merchant is most likely to go looking for
// last month's earnings.
const monthIndex = (d: Date): number => d.getFullYear() * 12 + d.getMonth();

// Exported for __tests__/PastEventsScreen.test.ts — the year-boundary case is
// exactly the kind of bug that only shows up once a year, so it needs a test
// that doesn't wait for January to catch a regression.
export const getMonthTag = (event: Event): 'this' | 'last' | 'older' => {
  const d = eventDate(event);
  if (Number.isNaN(d.getTime())) { return 'older'; }
  const diff = monthIndex(new Date(Date.now())) - monthIndex(d);
  if (diff === 0) { return 'this'; }
  if (diff === 1) { return 'last'; }
  return 'older';
};

const PastEventsScreen = (): React.JSX.Element => {
  const navigation  = useNavigation<NavProp>();
  const topInset    = useTopInset();
  const [search,     setSearch]     = useState<string>('');
  const [activeTab,  setActiveTab]  = useState<FilterTab>('All');
  const [events,     setEvents]     = useState<Event[]>([]);
  const [loading,    setLoading]    = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getEvents();
      setEvents(res.past ?? []);
    } catch (err) {
      console.error('PastEvents load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ── Filter by tab ──────────────────────────────────────────
  const tabFiltered = events.filter(e => {
    if (activeTab === 'This Month') { return getMonthTag(e) === 'this'; }
    if (activeTab === 'Last Month') { return getMonthTag(e) === 'last'; }
    return true;
  });

  // ── Filter by search ───────────────────────────────────────
  const filtered = tabFiltered.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalEarned = tabFiltered.reduce((sum, e) => sum + (e.totalAmount ?? 0), 0);

  const renderItem = ({ item, index }: { item: Event; index: number }) => (
    <View style={[
      styles.eventCard,
      index === 0                   && styles.eventCardFirst,
      index === filtered.length - 1 && styles.eventCardLast,
    ]}>
      <Text style={styles.eventName}>{item.name}</Text>
      <Text style={styles.eventDate}>{item.date}</Text>
      <Text style={styles.eventLocation}>{item.location}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Guests Tipped:</Text>
          <Text style={styles.statValue}> {item.tipsCollected ?? 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Tips Earned:</Text>
          <Text style={styles.statValueGreen}> {fmt(item.totalAmount ?? 0)}</Text>
        </View>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Past Events</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[colours.primary]}
            tintColor={colours.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Total Earnings card ───────────────────── */}
            <View style={styles.earningsCard}>
              <Text style={styles.earningsTitle}>Total Earnings</Text>
              <Text style={styles.earningsAmount}>{fmt(totalEarned)}</Text>
            </View>

            {/* ── Filter tabs ───────────────────────────── */}
            <View style={styles.tabsRow}>
              {FILTER_TABS.map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Search ────────────────────────────────── */}
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search past events…"
                placeholderTextColor={colours.textSecondary}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No past events found'}
            </Text>
          </View>
        }
      />
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

  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },

  // Total Earnings card
  earningsCard: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    marginTop:       spacing.md,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colours.border,
    ...shadows.subtle,
  },
  earningsTitle:  { fontSize: fontSizes.lg,  fontWeight: fontWeights.bold,      color: colours.textPrimary, marginBottom: spacing.xs },
  earningsAmount: { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, color: colours.success },

  // Filter tabs
  tabsRow: {
    flexDirection:   'row',
    backgroundColor: colours.surface,
    borderRadius:    radius.round,
    padding:         3,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colours.border,
  },
  tab:           { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.round },
  tabActive:     { backgroundColor: colours.primary },
  tabText:       { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textSecondary },
  tabTextActive: { color: colours.white },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, borderRadius: radius.round, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colours.border, marginBottom: spacing.md, ...shadows.subtle },
  searchIcon:  { fontSize: 16, marginRight: spacing.xs },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSizes.base, color: colours.textPrimary },
  clearSearch: { fontSize: 14, color: colours.textSecondary, padding: spacing.xs },

  // Event cards
  eventCard:      { backgroundColor: colours.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderWidth: 1, borderColor: colours.border },
  eventCardFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  eventCardLast:  { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  eventName:      { fontSize: fontSizes.base, fontWeight: fontWeights.bold,    color: colours.textPrimary, marginBottom: 2 },
  eventDate:      { fontSize: fontSizes.sm,   color: colours.textSecondary,    marginBottom: 2 },
  eventLocation:  { fontSize: fontSizes.sm,   color: colours.textSecondary,    marginBottom: spacing.sm },

  statsRow:       { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  statItem:       { flexDirection: 'row', alignItems: 'center' },
  statLabel:      { fontSize: fontSizes.sm, color: colours.textSecondary },
  statValue:      { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.textPrimary },
  statValueGreen: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.success },

  separator:  { height: 1, backgroundColor: colours.border },
  emptyWrap:  { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText:  { fontSize: fontSizes.base, color: colours.textSecondary },
});

export default PastEventsScreen;