// src/screens/dashboard/AllEventsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, SectionList, TextInput, RefreshControl,
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

interface Section {
  title: string;
  type:  'active' | 'upcoming' | 'past';
  data:  Event[];
}

// ── Section header colours ────────────────────────────────────
const SECTION_COLOURS = {
  active:   { bg: 'rgba(34,197,94,0.1)',    border: colours.success,       text: colours.success       },
  upcoming: { bg: colours.primaryFade,      border: colours.primary,       text: colours.primary       },
  past:     { bg: 'rgba(107,114,128,0.08)', border: colours.textSecondary, text: colours.textSecondary },
};

const AllEventsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const topInset   = useTopInset();
  const [search,     setSearch]     = useState<string>('');
  const [upcoming,   setUpcoming]   = useState<Event[]>([]);
  const [active,     setActive]     = useState<Event[]>([]);
  const [past,       setPast]       = useState<Event[]>([]);
  const [loading,    setLoading]    = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getEvents();
      setUpcoming(res.upcoming ?? []);
      setActive(res.active     ?? []);
      setPast(res.past         ?? []);
    } catch (err) {
      console.error('AllEvents load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Build sections from live state ───────────────────────────
  const allSections: Section[] = [
    { title: 'Active Events',   type: 'active',   data: active   },
    { title: 'Upcoming Events', type: 'upcoming', data: upcoming },
    { title: 'Past Events',     type: 'past',     data: past     },
  ];

  // ── Filter across all sections by search ─────────────────────
  const filtered: Section[] = allSections
    .map(section => ({
      ...section,
      data: section.data.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(s => s.data.length > 0);

  const renderSectionHeader = ({ section }: { section: Section }) => {
    const col = SECTION_COLOURS[section.type];
    return (
      <View style={[styles.sectionHeader, { backgroundColor: col.bg, borderLeftColor: col.border }]}>
        <View style={[styles.sectionDot, { backgroundColor: col.border }]} />
        <Text style={[styles.sectionTitle, { color: col.text }]}>{section.title}</Text>
        <Text style={[styles.sectionCount, { color: col.text }]}>{section.data.length}</Text>
      </View>
    );
  };

  const renderItem = ({
    item, index, section,
  }: { item: Event; index: number; section: Section }) => {
    const isFirst = index === 0;
    const isLast  = index === section.data.length - 1;

    const handlePress = () => {
      if (section.type === 'active' || section.type === 'upcoming') {
        navigation.navigate('UpcomingEventDetail', { event: item });
      }
      // past events — could navigate to a detail screen later
    };

    const tipFormatted = item.totalAmount
      ? (item.totalAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.eventRow,
          isFirst && styles.eventRowFirst,
          isLast  && styles.eventRowLast,
        ]}
        onPress={handlePress}
        activeOpacity={section.type === 'past' ? 1 : 0.75}
        disabled={section.type === 'past'}
      >
        <View style={styles.eventInfo}>
          <Text style={[
            styles.eventName,
            section.type === 'past' && styles.eventNamePast,
          ]}>{item.name}</Text>
          <Text style={styles.eventDate}>{item.date}</Text>
          {item.location ? (
            <Text style={styles.eventLocation}>📍 {item.location}</Text>
          ) : null}
        </View>

        <View style={styles.eventRight}>
          {/* Active — live dot */}
          {section.type === 'active' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Past — tip amount */}
          {section.type === 'past' && tipFormatted && (
            <Text style={styles.tipAmount}>{tipFormatted}</Text>
          )}

          {/* Upcoming / Active — arrow */}
          {section.type !== 'past' && (
            <View style={styles.arrowCircle}>
              <Text style={styles.arrowIcon}>›</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSeparator = () => <View style={styles.separator} />;

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
        <Text style={styles.headerTitle}>All Events</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Search ──────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search all events…"
          placeholderTextColor={colours.textSecondary}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Section list ────────────────────────────────── */}
      <SectionList
        sections={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[colours.primary]}
            tintColor={colours.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No events found'}
            </Text>
          </View>
        }
      />
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.primary,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.md,
  },
  backBtn:     { padding: spacing.xs },
  backArrow:   { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  headerRight: { width: 32 },

  // Search
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colours.surface,
    marginHorizontal:  spacing.base,
    marginVertical:    spacing.md,
    borderRadius:      radius.round,
    paddingHorizontal: spacing.md,
    borderWidth:       1,
    borderColor:       colours.border,
    ...shadows.subtle,
  },
  searchIcon:  { fontSize: 16, marginRight: spacing.xs },
  searchInput: {
    flex:            1,
    paddingVertical: spacing.md,
    fontSize:        fontSizes.base,
    color:           colours.textPrimary,
  },
  clearSearch: { fontSize: 14, color: colours.textSecondary, padding: spacing.xs },

  // List
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom:     spacing.xxxl,
  },

  // Section header
  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      radius.md,
    borderLeftWidth:   3,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginTop:         spacing.lg,
    marginBottom:      spacing.sm,
    gap:               spacing.sm,
  },
  sectionDot:   { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, letterSpacing: 0.8 },
  sectionCount: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold },

  // Event row
  eventRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.surface,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.md,
  },
  eventRowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  eventRowLast:  { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },

  eventInfo:     { flex: 1, marginRight: spacing.base },
  eventName: {
    fontSize:     fontSizes.base,
    fontWeight:   fontWeights.semiBold,
    color:        colours.primary,
    marginBottom: spacing.xs / 2,
  },
  eventNamePast: { color: colours.textPrimary },
  eventDate:     { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: 2 },
  eventLocation: { fontSize: fontSizes.xs, color: colours.textSecondary },

  eventRight: { alignItems: 'flex-end', gap: spacing.xs },

  // Live badge
  liveBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   'rgba(34,197,94,0.1)',
    borderRadius:      radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    marginBottom:      spacing.xs,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colours.success },
  liveText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.success },

  // Tip amount for past
  tipAmount: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.success },

  // Arrow
  arrowCircle: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colours.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  arrowIcon: {
    fontSize:   fontSizes.xl,
    color:      colours.white,
    fontWeight: fontWeights.bold,
    lineHeight: 26,
  },

  // Separator
  separator: { height: 1, backgroundColor: colours.border, marginLeft: spacing.base },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText:  { fontSize: fontSizes.base, color: colours.textSecondary },
});

export default AllEventsScreen;