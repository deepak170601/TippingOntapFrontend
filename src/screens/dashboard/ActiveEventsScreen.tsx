import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import api, { Event } from '../../services/api';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import BottomTabBar from '../../components/BottomTabBar';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const ActiveEventsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const topInset   = useTopInset();
  const [events,     setEvents]     = useState<Event[]>([]);
  const [search,     setSearch]     = useState<string>('');
  const [loading,    setLoading]    = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getEvents();
      setEvents(res.active ?? []);
    } catch (err) {
      console.error('ActiveEvents load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item, index }: { item: Event; index: number }) => (
    <TouchableOpacity
      style={[
        styles.eventRow,
        index === 0                   && styles.eventRowFirst,
        index === filtered.length - 1 && styles.eventRowLast,
      ]}
      onPress={() => navigation.navigate('ActiveEvent', { event: item })}
      activeOpacity={0.75}
    >
      <View style={styles.liveDot} />
      <View style={styles.eventInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.eventName}>{item.name}</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.eventDate}>{item.date}</Text>
        {item.location ? <Text style={styles.eventLocation}>📍 {item.location}</Text> : null}
      </View>
      <View style={styles.arrowCircle}>
        <Text style={styles.arrowIcon}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Events</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.countStrip}>
        <Text style={styles.countText}>{filtered.length} events currently active</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search active events…"
          placeholderTextColor={colours.textSecondary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colours.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyText}>No active events</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  backBtn:      { padding: spacing.xs },
  backArrow:    { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle:  { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  headerRight:  { width: 32 },
  countStrip:   { backgroundColor: colours.primaryDark, paddingHorizontal: spacing.base, paddingVertical: spacing.xs },
  countText:    { fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)', fontWeight: fontWeights.medium },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, marginHorizontal: spacing.base, marginVertical: spacing.md, borderRadius: radius.round, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colours.border, ...shadows.subtle },
  searchIcon:   { fontSize: 16, marginRight: spacing.xs },
  searchInput:  { flex: 1, paddingVertical: spacing.md, fontSize: fontSizes.base, color: colours.textPrimary },
  clearSearch:  { fontSize: 14, color: colours.textSecondary, padding: spacing.xs },
  listContent:  { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },
  loader:       { flex: 1, justifyContent: 'center' },
  eventRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderLeftWidth: 4, borderLeftColor: colours.success },
  eventRowFirst:{ borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  eventRowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: colours.success, marginRight: spacing.sm },
  eventInfo:    { flex: 1, marginRight: spacing.sm },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  eventName:    { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.textPrimary, flex: 1 },
  liveBadge:    { backgroundColor: colours.success, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  liveBadgeText:{ fontSize: 10, fontWeight: fontWeights.bold, color: colours.white },
  eventDate:    { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: 2 },
  eventLocation:{ fontSize: fontSizes.xs, color: colours.textSecondary },
  arrowCircle:  { width: 36, height: 36, borderRadius: 18, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  arrowIcon:    { fontSize: fontSizes.xl, color: colours.white, fontWeight: fontWeights.bold, lineHeight: 26 },
  separator:    { height: 1, backgroundColor: colours.border, marginLeft: spacing.base },
  emptyWrap:    { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyEmoji:   { fontSize: 48, marginBottom: spacing.md },
  emptyText:    { fontSize: fontSizes.base, color: colours.textSecondary },
});

export default ActiveEventsScreen;