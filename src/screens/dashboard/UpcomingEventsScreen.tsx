// src/screens/dashboard/UpcomingEventsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';                      // ← changed
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'; // ← changed
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Event } from '../../services/api';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

// ── Typed navigation — full stack, not screen-scoped ──────────
type NavProp = NativeStackNavigationProp<RootStackParamList>;                   // ← changed

const MOCK_UPCOMING: Event[] = [
  { id: '1', name: "Jenna's wedding reception",   date: 'Wed, 28 Feb 2026',   location: 'NYC'       },
  { id: '2', name: "Jonnah's engagement",          date: 'Sat, 20 March 2026', location: 'Brooklyn'  },
  { id: '3', name: "Elena's private party",        date: 'Fri, 25 March 2026', location: 'Manhattan' },
  { id: '4', name: "Ellen has a work anniversary", date: 'Fri, 25 March 2026', location: 'Queens'    },
  { id: '5', name: "Elena's Private Party",        date: 'Fri, 25 March 2026', location: 'Brooklyn'  },
  { id: '6', name: "Elena's Private Party",        date: 'Fri, 25 March 2026', location: 'Bronx'     },
];

// ── No props — navigation comes from hook instead ─────────────
const UpcomingEventsScreen = (): React.JSX.Element => {                         // ← changed
  const navigation = useNavigation<NavProp>();                                  // ← changed
  const [search, setSearch] = useState<string>('');
  const filtered = MOCK_UPCOMING.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item, index }: { item: Event; index: number }) => (
    <TouchableOpacity
      style={[
        styles.eventRow,
        index === 0                    && styles.eventRowFirst,
        index === filtered.length - 1  && styles.eventRowLast,
      ]}
      onPress={() => navigation.navigate('ActiveEvent', { event: item })}
      activeOpacity={0.75}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{item.name}</Text>
        <Text style={styles.eventDate}>{item.date}</Text>
      </View>
      <View style={styles.arrowCircle}>
        <Text style={styles.arrowIcon}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      {/* ── Blue header ───────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Events</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Search bar ────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search events…"
          placeholderTextColor={colours.textSecondary}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Events list ───────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>No events found</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
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
    paddingTop:        spacing.xl,
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
  clearSearch: {
    fontSize: 14,
    color:    colours.textSecondary,
    padding:  spacing.xs,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom:     spacing.xxxl,
  },

  // Event rows — grouped card style matching Image 4
  eventRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colours.surface,
    paddingHorizontal: spacing.base,
    paddingVertical:   spacing.md,
  },
  eventRowFirst: {
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
  },
  eventRowLast: {
    borderBottomLeftRadius:  radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  eventInfo: { flex: 1, marginRight: spacing.base },
  eventName: {
    fontSize:     fontSizes.base,
    fontWeight:   fontWeights.semiBold,
    color:        colours.primary,
    marginBottom: spacing.xs / 2,
  },
  eventDate: {
    fontSize: fontSizes.sm,
    color:    colours.textSecondary,
  },
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

  // Separator between rows
  separator: {
    height:          1,
    backgroundColor: colours.border,
    marginLeft:      spacing.base,
  },

  // Empty state
  emptyWrap:  { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText:  { fontSize: fontSizes.base, color: colours.textSecondary },
});

export default UpcomingEventsScreen;