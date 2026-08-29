// src/screens/dashboard/SettingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Switch, Linking,
} from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import {
  areRemindersEnabled, setRemindersEnabled,
  hasNotificationPermission, requestNotificationPermission,
  cancelAllEventReminders, scheduledReminderCount,
} from '../../services/notifications';
import Header from '../../components/common/Header';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

const SettingsScreen = (): React.JSX.Element => {
  const { logout, user }             = useAuthContext();
  const [loggingOut, setLoggingOut]  = useState<boolean>(false);

  // ── Event reminders ───────────────────────────────────────
  // Two separate things decide whether a reminder ever arrives: this in-app
  // preference, and the OS permission. The switch shows the AND of them,
  // because a switch that reads "on" while Android is dropping every
  // notification is a lie the merchant only discovers by missing an event.
  const [remindersOn, setRemindersOn] = useState<boolean>(false);

  // How many are actually armed right now. Without this the feature is
  // invisible until it either fires or fails to, and "did that event schedule
  // anything?" can only be answered by waiting a day to find out.
  const [armed, setArmed] = useState<number>(0);

  const refreshReminderState = useCallback(async (): Promise<void> => {
    const [pref, granted, count] = await Promise.all([
      areRemindersEnabled(),
      hasNotificationPermission(),
      scheduledReminderCount(),
    ]);
    setRemindersOn(pref && granted);
    setArmed(count);
  }, []);

  // On focus, not on mount. Settings is a tab and stays mounted, so a
  // mount-only read would show the count from whenever the app started and go
  // stale the moment an event is created or ends.
  useFocusEffect(useCallback(() => { refreshReminderState(); }, [refreshReminderState]));

  const handleToggleReminders = async (next: boolean): Promise<void> => {
    if (!next) {
      setRemindersOn(false);
      await setRemindersEnabled(false);
      await cancelAllEventReminders();
      return;
    }

    // Turning it on has to clear the OS permission too. requestPermission only
    // shows a dialog the first time; after a denial Android returns silently,
    // so from then on the only route is Settings and we have to say so rather
    // than leave the switch flicking back with no explanation.
    await setRemindersEnabled(true);
    const granted = (await hasNotificationPermission())
      || (await requestNotificationPermission());

    setRemindersOn(granted);

    if (!granted) {
      Alert.alert(
        'Notifications are turned off',
        'Android is blocking notifications for this app, so event reminders '
        + 'cannot be delivered. You can turn them back on in system settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { Linking.openSettings(); } },
        ],
      );
    }
  };

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

          {/* Event reminders — a real switch, not a row that goes nowhere */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconWrap}>
              <Text style={styles.menuIcon}>🔔</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Event Reminders</Text>
              <Text style={styles.menuSub}>
                A day before and 30 minutes before each event
              </Text>
              <Text style={styles.menuSub}>
                {remindersOn
                  ? `${armed} scheduled right now`
                  : 'Off — nothing is scheduled'}
              </Text>
            </View>
            <Switch
              value={remindersOn}
              onValueChange={handleToggleReminders}
              trackColor={{ false: colours.border, true: colours.primaryLight }}
              thumbColor={remindersOn ? colours.primary : colours.surface}
            />
          </View>
          <View style={styles.menuDivider} />

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