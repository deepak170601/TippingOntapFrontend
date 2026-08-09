// src/screens/dashboard/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

const SettingsScreen = (): React.JSX.Element => {
  const { logout, user }             = useAuthContext();
  const [loggingOut, setLoggingOut]  = useState<boolean>(false);

  const handleLogout = (): void => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try { await logout(); }
            catch { setLoggingOut(false); }
          },
        },
      ]
    );
  };

  const MENU_ITEMS = [
    { icon: '🔔', label: 'Notifications',    sub: 'Manage your alerts' },
    { icon: '🔐', label: 'Security',          sub: 'Password & 2FA' },
    { icon: '💳', label: 'Payment Methods',   sub: 'Connected readers' },
    { icon: '📄', label: 'Terms of Service',  sub: 'Legal information' },
    { icon: '❓', label: 'Help & Support',    sub: 'Get in touch' },
  ];

  return (
    <View style={styles.container}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.fullName ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName ?? 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          </View>
          <View style={styles.editBadge}>
            <Text style={styles.editText}>✏️</Text>
          </View>
        </View>

        {/* Menu items */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
                <View style={styles.menuIconWrap}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Logout button */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut
            ? <ActivityIndicator color={colours.white} />
            : <Text style={styles.logoutText}>🚪  Log Out</Text>
          }
        </TouchableOpacity>

        <Text style={styles.version}>Tipping On The Go  v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colours.background },
  scroll:       { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  profileCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.xl, ...shadows.card },
  avatar:       { width: 56, height: 56, borderRadius: 28, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText:   { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.white },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary },
  profileEmail: { fontSize: fontSizes.sm, color: colours.textSecondary, marginTop: 2 },
  editBadge:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colours.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colours.border },
  editText:     { fontSize: 14 },
  sectionLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.textSecondary, letterSpacing: 1.2, marginBottom: spacing.sm, marginLeft: spacing.xs },
  menuCard:     { backgroundColor: colours.surface, borderRadius: radius.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colours.borderBlue, ...shadows.card },
  menuItem:     { flexDirection: 'row', alignItems: 'center', padding: spacing.base },
  menuIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: colours.background, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  menuIcon:     { fontSize: 18 },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: fontSizes.base, fontWeight: fontWeights.medium, color: colours.textPrimary },
  menuSub:      { fontSize: fontSizes.xs, color: colours.textSecondary, marginTop: 2 },
  menuArrow:    { fontSize: fontSizes.xl, color: colours.textSecondary },
  menuDivider:  { height: 1, backgroundColor: colours.border, marginLeft: spacing.base + 38 + spacing.md },
  logoutBtn:    { backgroundColor: colours.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', elevation: 2, marginBottom: spacing.lg },
  logoutDisabled: { opacity: 0.6 },
  logoutText:   { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },
  version:      { textAlign: 'center', fontSize: fontSizes.xs, color: colours.textSecondary },
});

export default SettingsScreen;