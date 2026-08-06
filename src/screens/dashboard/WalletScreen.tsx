// src/screens/dashboard/WalletScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, StatusBar,
  ActivityIndicator, RefreshControl, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import api, { DailyEarning } from '../../services/api';
import { useAuthContext } from '../../context/AuthContext';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

const WalletScreen = (): React.JSX.Element => {
  const { user } = useAuthContext();
  const onboardingComplete = user?.onboardingComplete ?? false;

  // ── Daily earnings (existing) ─────────────────────────────
  const [totalAllTime, setTotalAllTime] = useState<number>(0);
  const [days,         setDays]         = useState<DailyEarning[]>([]);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [refreshing,   setRefreshing]   = useState<boolean>(false);

  // ── Connect balance ───────────────────────────────────────
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [pendingBalance,   setPendingBalance]   = useState<number>(0);
  const [balanceLoading,   setBalanceLoading]   = useState<boolean>(true);
  const [balanceError,     setBalanceError]     = useState<string | null>(null);

  // ── Withdraw modal ────────────────────────────────────────
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawAmount,    setWithdrawAmount]    = useState<string>('');
  const [withdrawLoading,   setWithdrawLoading]   = useState<boolean>(false);
  const [withdrawError,     setWithdrawError]     = useState<string | null>(null);

  const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

  // ── Load everything in parallel ───────────────────────────
  const loadData = useCallback(async (): Promise<void> => {
    setBalanceError(null);

    const walletPromise  = api.getWallet();
    const balancePromise = onboardingComplete
      ? api.getConnectBalance()
      : Promise.resolve(null);

    const [walletResult, balanceResult] = await Promise.allSettled([
      walletPromise,
      balancePromise,
    ]);

    // Wallet — daily earnings
    if (walletResult.status === 'fulfilled') {
      setTotalAllTime(walletResult.value.totalAllTime ?? 0);
      setDays(walletResult.value.days ?? []);
    } else {
      console.error('Wallet load error:', walletResult.reason);
    }

    // Connect balance
    if (balanceResult.status === 'fulfilled' && balanceResult.value) {
      setAvailableBalance(balanceResult.value.available ?? 0);
      setPendingBalance(balanceResult.value.pending ?? 0);
    } else if (balanceResult.status === 'rejected') {
      setBalanceError(
        balanceResult.reason instanceof Error
          ? balanceResult.reason.message
          : 'Could not load balance.'
      );
    }

    setLoading(false);
    setBalanceLoading(false);
    setRefreshing(false);
  }, [onboardingComplete]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Confirm withdraw ──────────────────────────────────────
  const handleConfirmWithdraw = async (): Promise<void> => {
    setWithdrawError(null);

    // Parse amount — blank means full balance
    let amountCents: number | undefined;
    if (withdrawAmount.trim() !== '') {
      const parsed = parseFloat(withdrawAmount);
      if (isNaN(parsed) || parsed <= 0) {
        setWithdrawError('Enter a valid amount.');
        return;
      }
      amountCents = Math.round(parsed * 100);
      if (amountCents > availableBalance) {
        setWithdrawError(`Amount exceeds available balance of ${fmt(availableBalance)}.`);
        return;
      }
    }

    setWithdrawLoading(true);
    try {
      await api.withdraw(amountCents);

      setShowWithdrawModal(false);
      setWithdrawAmount('');

      Alert.alert(
        'Payout Initiated',
        'Your funds are on the way. Arrives in about 2 business days.',
      );

      // Refresh balance
      const balance = await api.getConnectBalance();
      setAvailableBalance(balance.available ?? 0);
      setPendingBalance(balance.pending ?? 0);

    } catch (err) {
      setWithdrawError(
        err instanceof Error ? err.message : 'Withdrawal failed. Please try again.'
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  const withdrawDisabled =
    availableBalance === 0 || balanceLoading || withdrawLoading;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      <FlatList
        data={days}
        keyExtractor={item => item.date}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[colours.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Connect balance card ──────────────────── */}
            {onboardingComplete ? (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceCardTitle}>Your Balance</Text>

                {balanceLoading ? (
                  <ActivityIndicator
                    style={styles.balanceLoader}
                    color={colours.primary}
                  />
                ) : balanceError ? (
                  <Text style={styles.balanceErrorText}>{balanceError}</Text>
                ) : (
                  <>
                    {/* Available row + Withdraw button */}
                    <View style={styles.balanceRow}>
                      <View>
                        <Text style={styles.balanceLabel}>Available</Text>
                        <Text style={styles.balanceAmount}>
                          {fmt(availableBalance)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.withdrawBtn,
                          withdrawDisabled && styles.withdrawBtnDisabled,
                        ]}
                        onPress={() => {
                          setWithdrawAmount('');
                          setWithdrawError(null);
                          setShowWithdrawModal(true);
                        }}
                        disabled={withdrawDisabled}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.withdrawBtnText}>Withdraw</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Pending row */}
                    <View style={styles.pendingRow}>
                      <Text style={styles.balanceLabel}>Pending</Text>
                      <Text style={styles.pendingAmount}>
                        {fmt(pendingBalance)}
                      </Text>
                    </View>

                    <Text style={styles.balanceNote}>
                      Pending tips clear in about 2 business days.
                    </Text>
                  </>
                )}
              </View>
            ) : (
              // ── Not onboarded ──────────────────────────
              <View style={styles.notOnboardedCard}>
                <Text style={styles.notOnboardedIcon}>🔒</Text>
                <Text style={styles.notOnboardedText}>
                  Complete your payment setup to access your balance.
                </Text>
              </View>
            )}

            {/* ── Lifetime earnings ─────────────────────── */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Tips Collected</Text>
              <Text style={styles.totalAmount}>{fmt(totalAllTime)}</Text>
            </View>

            <Text style={styles.sectionHeader}>Daily Breakdown</Text>
          </>
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
          loading ? (
            <ActivityIndicator
              style={styles.listLoader}
              size="large"
              color={colours.primary}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyText}>No earnings yet</Text>
            </View>
          )
        }
      />

      {/* ── Withdraw modal ──────────────────────────────── */}
      <Modal
        visible={showWithdrawModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Withdraw to Bank Account</Text>

            <View style={styles.modalAvailableRow}>
              <Text style={styles.modalAvailableLabel}>Available</Text>
              <Text style={styles.modalAvailableAmount}>
                {fmt(availableBalance)}
              </Text>
            </View>

            <Text style={styles.modalInputLabel}>
              Amount  (leave blank for full balance)
            </Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalCurrency}>$</Text>
              <TextInput
                style={styles.modalInput}
                value={withdrawAmount}
                onChangeText={v => { setWithdrawAmount(v); setWithdrawError(null); }}
                placeholder={(availableBalance / 100).toFixed(2)}
                placeholderTextColor={colours.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {withdrawError ? (
              <Text style={styles.modalErrorText}>⚠️  {withdrawError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.modalConfirmBtn, withdrawLoading && styles.btnDisabled]}
              onPress={handleConfirmWithdraw}
              disabled={withdrawLoading}
              activeOpacity={0.85}
            >
              {withdrawLoading
                ? <ActivityIndicator color={colours.white} />
                : <Text style={styles.modalConfirmText}>Confirm Withdraw</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowWithdrawModal(false)}
              disabled={withdrawLoading}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  header:      { backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl, alignItems: 'center' },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },

  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },
  listLoader:  { marginTop: spacing.xxxl },

  // ── Balance card ──────────────────────────────────────────
  balanceCard: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    marginTop:       spacing.base,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colours.border,
    ...shadows.subtle,
  },
  balanceCardTitle: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary, marginBottom: spacing.md },
  balanceLoader:    { paddingVertical: spacing.lg },
  balanceErrorText: { fontSize: fontSizes.sm, color: colours.error, paddingVertical: spacing.sm },
  balanceRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  balanceLabel:     { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: 2 },
  balanceAmount:    { fontSize: fontSizes.xxl, fontWeight: fontWeights.extraBold, color: colours.success },
  pendingRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colours.border },
  pendingAmount:    { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textSecondary },
  balanceNote:      { fontSize: fontSizes.xs, color: colours.textSecondary, marginTop: spacing.sm, fontStyle: 'italic' },

  withdrawBtn: {
    backgroundColor:   colours.primary,
    borderRadius:      radius.round,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm + 2,
    ...shadows.blue,
  },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText:     { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.white },

  // ── Not onboarded ─────────────────────────────────────────
  notOnboardedCard: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    marginTop:       spacing.base,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colours.border,
    alignItems:      'center',
    ...shadows.subtle,
  },
  notOnboardedIcon: { fontSize: 32, marginBottom: spacing.sm },
  notOnboardedText: { fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 20 },

  // ── Total card ────────────────────────────────────────────
  totalCard: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colours.border,
    ...shadows.subtle,
  },
  totalLabel:  { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textSecondary, marginBottom: spacing.xs },
  totalAmount: { fontSize: fontSizes.xl, fontWeight: fontWeights.extraBold, color: colours.textPrimary },

  sectionHeader: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary, marginBottom: spacing.sm, marginTop: spacing.xs },

  // ── Day rows ──────────────────────────────────────────────
  dayRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colours.surface, padding: spacing.base, borderRadius: radius.md },
  dayDate:   { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.textPrimary },
  dayCount:  { fontSize: fontSizes.sm, color: colours.textSecondary, marginTop: 2 },
  dayTotal:  { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.success },
  separator: { height: spacing.xs },

  emptyWrap:  { alignItems: 'center', paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText:  { fontSize: fontSizes.base, color: colours.textSecondary },

  // ── Withdraw modal ────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  modalCard:    { width: '100%', backgroundColor: colours.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadows.strong },
  modalTitle:   { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },

  modalAvailableRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colours.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  modalAvailableLabel:  { fontSize: fontSizes.sm, color: colours.textSecondary },
  modalAvailableAmount: { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.success },

  modalInputLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textPrimary, marginBottom: spacing.xs },
  modalInputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colours.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colours.background },
  modalCurrency:   { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.primary, marginRight: spacing.xs },
  modalInput:      { flex: 1, fontSize: fontSizes.lg, color: colours.textPrimary, paddingVertical: spacing.md },
  modalErrorText:  { fontSize: fontSizes.sm, color: colours.error, marginTop: spacing.sm },

  modalConfirmBtn:  { backgroundColor: colours.primary, borderRadius: radius.round, paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.lg, ...shadows.blue },
  btnDisabled:      { opacity: 0.6 },
  modalConfirmText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },
  modalCancelBtn:   { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  modalCancelText:  { fontSize: fontSizes.sm, color: colours.textSecondary },
});

export default WalletScreen;