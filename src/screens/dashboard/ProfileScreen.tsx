// src/screens/dashboard/ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Modal, FlatList, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import api from '../../services/api';
import { US_STATES, USState } from '../../constants/usStates';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

interface FormState {
  firstName:   string;
  lastName:    string;
  company:     string;
  ein:         string;
  address1:    string;
  address2:    string;
  city:        string;
  state:       USState | null;
  zip:         string;
}

const ProfileScreen = (): React.JSX.Element => {
  const { user, updateUser, logout } = useAuthContext();

  // ── Real stats ────────────────────────────────────────────
  const [eventCount,   setEventCount]   = useState<number>(0);
  const [totalTips,    setTotalTips]    = useState<number>(0);
  const [tipCount,     setTipCount]     = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [refreshing,   setRefreshing]   = useState<boolean>(false);

  // ── Edit mode ─────────────────────────────────────────────
  const [editing,  setEditing]  = useState<boolean>(false);
  const [saving,   setSaving]   = useState<boolean>(false);
  const [errors,   setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});

  const [stateModal,  setStateModal]  = useState<boolean>(false);
  const [stateSearch, setStateSearch] = useState<string>('');

  const findState = (abbr?: string): USState | null =>
    US_STATES.find(s => s.abbr === abbr) ?? null;

  const buildForm = useCallback((): FormState => ({
    firstName: user?.firstName   ?? '',
    lastName:  user?.lastName    ?? '',
    company:   user?.companyName ?? '',
    ein:       user?.ein         ?? '',
    address1:  user?.address1    ?? '',
    address2:  user?.address2    ?? '',
    city:      user?.city        ?? '',
    state:     findState(user?.state),
    zip:       user?.zip         ?? '',
  }), [user]);

  const [form, setForm] = useState<FormState>(buildForm);

  // Re-sync form whenever user changes in context
  useEffect(() => { setForm(buildForm()); }, [buildForm]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // ── Load real stats ───────────────────────────────────────
  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const [eventsRes, walletRes] = await Promise.all([
        api.getEvents(),
        api.getWallet(),
      ]);

      const allEvents =
        (eventsRes.upcoming?.length ?? 0) +
        (eventsRes.active?.length   ?? 0) +
        (eventsRes.past?.length     ?? 0);

      const tips = (walletRes.days ?? []).reduce((sum, d) => sum + d.tipCount, 0);

      setEventCount(allEvents);
      setTotalTips(walletRes.totalAllTime ?? 0);
      setTipCount(tips);
    } catch (err) {
      console.error('Profile stats error:', err);
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Validation ────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.firstName.trim()) { e.firstName = 'First name is required'; }
    if (!form.lastName.trim())  { e.lastName  = 'Last name is required'; }
    if (!form.address1.trim())  { e.address1  = 'Address is required'; }
    if (!form.city.trim())      { e.city      = 'City is required'; }
    if (!form.state)            { e.state     = 'State is required'; }
    if (!form.zip.trim())       { e.zip       = 'ZIP is required'; }
    if (form.company.trim() && !form.ein.trim()) { e.ein     = 'EIN required with company name'; }
    if (form.ein.trim() && !form.company.trim()) { e.company = 'Company name required with EIN'; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (): Promise<void> => {
    if (!validate()) { return; }
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        address1:    form.address1.trim(),
        city:        form.city.trim(),
        state:       form.state!.abbr,
        zip:         form.zip.trim(),
        address2:    form.address2.trim() || undefined,
        companyName: form.company.trim()  || undefined,
        ein:         form.ein.trim()      || undefined,
      });

      // Sync context + AsyncStorage with server response
      updateUser(updated);
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');

    } catch (err) {
      Alert.alert(
        'Could Not Save',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    setForm(buildForm());
    setErrors({});
    setEditing(false);
  };

  const handleLogout = (): void => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const filteredStates = US_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // Whole dollars. These are three small side-by-side cards and
  // the cents are what push "$1,234.56" wide enough to shrink or wrap. The exact
  // figure lives on the Wallet screen, which is the right place to read a
  // balance; this row is a glance.
  const fmtCompact = (cents: number): string =>
    `$${Math.round(cents / 100).toLocaleString('en-US')}`;

  // "Avg Tip" was dropped rather than fixed. It was arithmetically correct —
  // all-time total over all-time count — but it answered a question nobody
  // asks: a merchant cannot act on it, and it moves so slowly after the first
  // week that it looks stuck. Tip count is the number that actually pairs with
  // the money beside it, and it disambiguates the middle card, which read as
  // "Total Tips" while showing dollars.
  const STATS = [
    { label: 'Events', value: String(eventCount), icon: '🎪' },
    { label: 'Earned', value: fmtCompact(totalTips), icon: '💰' },
    { label: 'Tips',   value: String(tipCount),   icon: '🧾' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Profile" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStats(); }}
            colors={[colours.primary]}
          />
        }
      >
        {/* ── Avatar hero ─────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.firstName ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.fullName ?? 'User'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        {/* ── Stats row — real data ───────────────────────── */}
        <View style={styles.statsRow}>
          {STATS.map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>

              {/* Fixed-height slot. The spinner and the value are different
                  heights, so without this the three cards jump as each one
                  resolves, and a card still loading sits lower than its
                  neighbours. */}
              <View style={styles.statValueSlot}>
                {statsLoading
                  ? <ActivityIndicator size="small" color={colours.primary} />
                  : (
                    <Text
                      style={styles.statValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {s.value}
                    </Text>
                  )}
              </View>

              <Text style={styles.statLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Section header with Edit toggle ─────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ══ VIEW MODE ═══════════════════════════════════ */}
        {!editing && (
          <View style={styles.infoCard}>
            <InfoRow icon="👤" label="Full Name" value={user?.fullName ?? '—'} />
            <View style={styles.infoDivider} />
            <InfoRow icon="📱" label="Phone"     value={user?.phoneNumber ?? '—'} />
            <View style={styles.infoDivider} />
            <InfoRow icon="✉️" label="Email"     value={user?.email ?? '—'} />
            {user?.companyName ? (
              <>
                <View style={styles.infoDivider} />
                <InfoRow icon="🏢" label="Company" value={user.companyName} />
                <View style={styles.infoDivider} />
                <InfoRow icon="🧾" label="EIN"     value={user.ein ?? '—'} />
              </>
            ) : null}
            <View style={styles.infoDivider} />
            <InfoRow
              icon="📍"
              label="Address"
              value={
                user?.address1
                  ? `${user.address1}${user.address2 ? `, ${user.address2}` : ''}\n${user.city}, ${user.state} ${user.zip}`
                  : '—'
              }
            />
          </View>
        )}

        {/* ══ EDIT MODE ═══════════════════════════════════ */}
        {editing && (
          <>
            {/* Personal */}
            <View style={styles.editCard}>
              <Row>
                <Field label="First Name" error={errors.firstName} flex>
                  <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    value={form.firstName}
                    onChangeText={v => set('firstName', v)}
                    placeholder="John"
                    placeholderTextColor={colours.textSecondary}
                  />
                </Field>
                <View style={{ width: spacing.sm }} />
                <Field label="Last Name" error={errors.lastName} flex>
                  <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    value={form.lastName}
                    onChangeText={v => set('lastName', v)}
                    placeholder="Doe"
                    placeholderTextColor={colours.textSecondary}
                  />
                </Field>
              </Row>

              {/* Read-only identifiers */}
              <Field label="Phone Number">
                <View style={[styles.input, styles.inputLocked]}>
                  <Text style={styles.lockedText}>{user?.phoneNumber ?? '—'}</Text>
                  <Text style={styles.lockedIcon}>🔒</Text>
                </View>
              </Field>

              <Field label="Email Address">
                <View style={[styles.input, styles.inputLocked]}>
                  <Text style={styles.lockedText}>{user?.email ?? '—'}</Text>
                  <Text style={styles.lockedIcon}>🔒</Text>
                </View>
              </Field>

              <Text style={styles.lockedNote}>
                Phone and email are verified identifiers and cannot be changed here.
              </Text>
            </View>

            {/* Business */}
            <Text style={styles.subSection}>BUSINESS  (optional)</Text>
            <View style={styles.editCard}>
              <Field label="Company Name" error={errors.company}>
                <TextInput
                  style={[styles.input, errors.company && styles.inputError]}
                  value={form.company}
                  onChangeText={v => set('company', v)}
                  placeholder="Your business name"
                  placeholderTextColor={colours.textSecondary}
                />
              </Field>
              <Field label={`EIN Number${form.company.trim() ? ' *' : ''}`} error={errors.ein}>
                <TextInput
                  style={[styles.input, errors.ein && styles.inputError]}
                  value={form.ein}
                  onChangeText={v => set('ein', v)}
                  placeholder="XX-XXXXXXX"
                  placeholderTextColor={colours.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
              </Field>
            </View>

            {/* Address */}
            <Text style={styles.subSection}>ADDRESS</Text>
            <View style={styles.editCard}>
              <Field label="Address Line 1" error={errors.address1}>
                <TextInput
                  style={[styles.input, errors.address1 && styles.inputError]}
                  value={form.address1}
                  onChangeText={v => set('address1', v)}
                  placeholder="Street address"
                  placeholderTextColor={colours.textSecondary}
                />
              </Field>
              <Field label="Address Line 2  (optional)">
                <TextInput
                  style={styles.input}
                  value={form.address2}
                  onChangeText={v => set('address2', v)}
                  placeholder="Apt, suite, etc."
                  placeholderTextColor={colours.textSecondary}
                />
              </Field>
              <Row>
                <Field label="ZIP" error={errors.zip} flex>
                  <TextInput
                    style={[styles.input, errors.zip && styles.inputError]}
                    value={form.zip}
                    onChangeText={v => set('zip', v)}
                    placeholder="12345"
                    placeholderTextColor={colours.textSecondary}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </Field>
                <View style={{ width: spacing.sm }} />
                <Field label="City" error={errors.city} flex>
                  <TextInput
                    style={[styles.input, errors.city && styles.inputError]}
                    value={form.city}
                    onChangeText={v => set('city', v)}
                    placeholder="Austin"
                    placeholderTextColor={colours.textSecondary}
                  />
                </Field>
              </Row>
              <Field label="State" error={errors.state as string | undefined}>
                <TouchableOpacity
                  style={[styles.input, styles.dropdownRow, errors.state && styles.inputError]}
                  onPress={() => { setStateSearch(''); setStateModal(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownText, !form.state && styles.placeholder]}>
                    {form.state ? `${form.state.name} (${form.state.abbr})` : 'Select state'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▾</Text>
                </TouchableOpacity>
              </Field>
            </View>

            {/* Save / Cancel */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={colours.white} />
                : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Sign out ────────────────────────────────────── */}
        {!editing && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── State picker modal ──────────────────────────── */}
      <Modal
        visible={stateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setStateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Text>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                value={stateSearch}
                onChangeText={setStateSearch}
                placeholder="Search…"
                placeholderTextColor={colours.textSecondary}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={item => item.abbr}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.stateRow, form.state?.abbr === item.abbr && styles.stateRowSelected]}
                  onPress={() => { set('state', item); setStateModal(false); }}
                >
                  <Text style={styles.stateAbbr}>{item.abbr}</Text>
                  <Text style={[styles.stateName, form.state?.abbr === item.abbr && styles.stateNameSelected]}>
                    {item.name}
                  </Text>
                  {form.state?.abbr === item.abbr && <Text style={styles.stateCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.stateSeparator} />}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ── Helper components ─────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoIcon}>{icon}</Text>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
);

const Field = ({
  label, error, children, flex,
}: { label: string; error?: string; children: React.ReactNode; flex?: boolean }) => (
  <View style={[{ marginBottom: spacing.md }, flex ? { flex: 1 } : null]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  scroll:    { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },

  // Hero
  hero:       { alignItems: 'center', paddingVertical: spacing.xl },
  avatarRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colours.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatar:     { width: 94, height: 94, borderRadius: 47, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40, fontWeight: fontWeights.bold, color: colours.white },
  name:       { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  email:      { fontSize: fontSizes.sm, color: colours.textSecondary, marginBottom: spacing.md },
  roleBadge:  { backgroundColor: colours.primary + '15', borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colours.primary + '40' },
  roleText:   { fontSize: fontSizes.sm, color: colours.primary, fontWeight: fontWeights.semiBold },

  // Stats
  statsRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard:  { flex: 1, backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', minHeight: 92, justifyContent: 'center', ...shadows.subtle },
  statIcon:  { fontSize: 22, marginBottom: spacing.xs },
  // Height fixed, width filled: every card reserves one identical row for its
  // number, so the icon above and the label below land on the same baseline
  // across all three regardless of how wide the value is or whether it has
  // loaded yet. This is what was making the row look crooked.
  statValueSlot: { height: 22, width: '100%', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary, textAlign: 'center' },
  statLabel: { fontSize: fontSizes.xs, color: colours.textSecondary, marginTop: 2, textAlign: 'center' },

  // Section
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  sectionLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.textSecondary, letterSpacing: 1.2 },
  editLink:     { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary },
  subSection:   { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.textSecondary, letterSpacing: 1.2, marginBottom: spacing.sm, marginTop: spacing.md, marginLeft: spacing.xs },

  // View mode card
  infoCard:    { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, ...shadows.subtle },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  infoIcon:    { fontSize: 20, marginRight: spacing.md, marginTop: 2 },
  infoText:    { flex: 1 },
  infoLabel:   { fontSize: fontSizes.xs, color: colours.textSecondary, fontWeight: fontWeights.semiBold, letterSpacing: 0.5 },
  infoValue:   { fontSize: fontSizes.base, color: colours.textPrimary, fontWeight: fontWeights.medium, marginTop: 2, lineHeight: 21 },
  infoDivider: { height: 1, backgroundColor: colours.border },

  // Edit mode
  editCard:   { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, borderWidth: 1, borderColor: colours.border, ...shadows.subtle },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colours.textPrimary, marginBottom: 4 },
  fieldError: { fontSize: 11, color: colours.error, marginTop: 3 },

  input:       { borderWidth: 1, borderColor: colours.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSizes.base, color: colours.textPrimary, backgroundColor: colours.background },
  inputError:  { borderColor: colours.error },
  inputLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.border + '30' },
  lockedText:  { fontSize: fontSizes.base, color: colours.textSecondary, flex: 1 },
  lockedIcon:  { fontSize: 14 },
  lockedNote:  { fontSize: fontSizes.xs, color: colours.textSecondary, fontStyle: 'italic', marginTop: -spacing.xs },

  dropdownRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText:  { fontSize: fontSizes.base, color: colours.textPrimary, flex: 1 },
  placeholder:   { color: colours.textSecondary },
  dropdownArrow: { fontSize: 16, color: colours.textSecondary },

  saveBtn:       { backgroundColor: colours.primary, borderRadius: radius.round, paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.lg, ...shadows.blue },
  btnDisabled:   { opacity: 0.6 },
  saveBtnText:   { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },
  cancelBtn:     { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  cancelBtnText: { fontSize: fontSizes.sm, color: colours.textSecondary },

  logoutBtn: {
    borderWidth:     1.5,
    borderColor:     colours.error,
    borderRadius:    radius.round,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.xl,
    backgroundColor: colours.surface,
  },
  logoutBtnText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.error },

  // State modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colours.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', paddingBottom: spacing.xxxl },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base, borderBottomWidth: 1, borderBottomColor: colours.border },
  modalTitle:   { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.textPrimary },
  modalClose:   { fontSize: 18, color: colours.textSecondary, padding: spacing.xs },
  modalSearch:  { flexDirection: 'row', alignItems: 'center', margin: spacing.base, borderWidth: 1, borderColor: colours.border, borderRadius: radius.round, paddingHorizontal: spacing.md, backgroundColor: colours.background, gap: spacing.xs },
  modalSearchInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSizes.base, color: colours.textPrimary },

  stateRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.sm },
  stateRowSelected:  { backgroundColor: colours.primary + '11' },
  stateAbbr:         { fontSize: fontSizes.sm, fontWeight: fontWeights.extraBold, color: colours.primary, width: 36 },
  stateName:         { flex: 1, fontSize: fontSizes.base, color: colours.textPrimary },
  stateNameSelected: { fontWeight: fontWeights.bold, color: colours.primary },
  stateCheck:        { fontSize: 16, color: colours.primary },
  stateSeparator:    { height: 1, backgroundColor: colours.border, marginLeft: spacing.base },
});

export default ProfileScreen;