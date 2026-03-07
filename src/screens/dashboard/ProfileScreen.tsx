// src/screens/dashboard/ProfileScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

const ProfileScreen = (): React.JSX.Element => {
  const { user } = useAuthContext();

  const STATS = [
    { label: 'Events',     value: '12',    icon: '🎪' },
    { label: 'Total Tips', value: '$1,240', icon: '💰' },
    { label: 'Avg Tip',    value: '$8.50',  icon: '📈' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colours.surface} />
      <Header title="Profile" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar hero */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.fullName ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.fullName ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>⭐ Event Merchant</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {STATS.map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Info card */}
        <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="👤" label="Full Name" value={user?.fullName ?? '—'} />
          <View style={styles.infoDivider} />
          <InfoRow icon="✉️" label="Email"     value={user?.email    ?? '—'} />
          <View style={styles.infoDivider} />
          <InfoRow icon="🎪" label="Role"      value="Event Merchant" />
        </View>

      </ScrollView>
    </View>
  );
};

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoIcon}>{icon}</Text>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  scroll:      { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },
  hero:        { alignItems: 'center', paddingVertical: spacing.xxl },
  avatarRing:  { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colours.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatar:      { width: 94, height: 94, borderRadius: 47, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: fontSizes.hero, fontWeight: fontWeights.bold, color: colours.white },
  name:        { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  email:       { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: spacing.md },
  roleBadge:   { backgroundColor: colours.primaryFade, borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colours.borderBlue },
  roleText:    { fontSize: fontSizes.sm, color: colours.primary, fontWeight: fontWeights.semiBold },
  statsRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard:    { flex: 1, backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadows.subtle },
  statIcon:    { fontSize: 22, marginBottom: spacing.xs },
  statValue:   { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary },
  statLabel:   { fontSize: fontSizes.xs, color: colours.textSecondary, marginTop: 2 },
  sectionLabel:{ fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.textSecondary, letterSpacing: 1.2, marginBottom: spacing.sm, marginLeft: spacing.xs },
  infoCard:    { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, ...shadows.card },
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  infoIcon:    { fontSize: 20, marginRight: spacing.md },
  infoText:    { flex: 1 },
  infoLabel:   { fontSize: fontSizes.xs, color: colours.textSecondary, fontWeight: fontWeights.semiBold, letterSpacing: 0.5 },
  infoValue:   { fontSize: fontSizes.base, color: colours.textPrimary, fontWeight: fontWeights.medium, marginTop: 2 },
  infoDivider: { height: 1, backgroundColor: colours.border },
});

export default ProfileScreen;