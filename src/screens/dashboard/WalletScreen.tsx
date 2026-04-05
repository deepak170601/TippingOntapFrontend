import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import api, { DailyEarning } from '../../services/api';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';

const WalletScreen = (): React.JSX.Element => {
  const [totalAllTime, setTotalAllTime] = useState<number>(0);
  const [days,         setDays]         = useState<DailyEarning[]>([]);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [refreshing,   setRefreshing]   = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getWallet();
      setTotalAllTime(res.totalAllTime ?? 0);
      setDays(res.days ?? []);
    } catch (err) {
      console.error('Wallet load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Earnings</Text>
        <Text style={styles.totalAmount}>{fmt(totalAllTime)}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colours.primary} />
      ) : (
        <FlatList
          data={days}
          keyExtractor={item => item.date}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              colors={[colours.primary]}
              tintColor={colours.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.dayRow}>
              <View>
                <Text style={styles.dayDate}>{item.date}</Text>
                <Text style={styles.dayCount}>{item.tipCount} tips</Text>
              </View>
              <Text style={styles.dayTotal}>{fmt(item.total)}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyText}>No earnings yet</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  header:      { backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl, alignItems: 'center' },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  totalCard:   { backgroundColor: colours.surface, margin: spacing.base, borderRadius: radius.lg, padding: spacing.base, borderWidth: 1, borderColor: colours.border, ...shadows.subtle },
  totalLabel:  { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.textSecondary, marginBottom: spacing.xs },
  totalAmount: { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, color: colours.success },
  loader:      { flex: 1 },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },
  dayRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colours.surface, padding: spacing.base, borderRadius: radius.md, marginBottom: spacing.xs },
  dayDate:     { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.textPrimary },
  dayCount:    { fontSize: fontSizes.sm, color: colours.textSecondary, marginTop: 2 },
  dayTotal:    { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.success },
  separator:   { height: spacing.xs },
  emptyWrap:   { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyEmoji:  { fontSize: 48, marginBottom: spacing.md },
  emptyText:   { fontSize: fontSizes.base, color: colours.textSecondary },
});

export default WalletScreen;