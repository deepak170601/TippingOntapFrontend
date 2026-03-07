// src/screens/dashboard/WalletScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import Header from '../../components/common/Header';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';

const WalletScreen = (): React.JSX.Element => (
  <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor={colours.surface} />
    <Header title="Wallet" />
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>💳</Text>
      </View>
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.sub}>Wallet & instant payouts are on the way.</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>🚧  Under Construction</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  iconWrap:  { width: 100, height: 100, borderRadius: 50, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, ...shadows.strong },
  icon:      { fontSize: 48 },
  title:     { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.textPrimary, marginBottom: spacing.sm },
  sub:       { fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  pill:      { backgroundColor: colours.primaryFade, borderRadius: radius.round, paddingHorizontal: spacing.base, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colours.primary },
  pillText:  { fontSize: fontSizes.sm, color: colours.primary, fontWeight: fontWeights.semiBold },
});

export default WalletScreen;