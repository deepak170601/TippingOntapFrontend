// src/screens/dashboard/CreateEventScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, Alert, Platform, Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootNavigationProp } from '../../navigation/AppNavigator';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';
import useTopInset from '../../hooks/useTopInset';
import api from '../../services/api';
import { syncEventReminders } from '../../services/notifications';

type NavProp = RootNavigationProp;

// This screen sits in the bottom tab navigator, so its two destinations are
// reached in different ways, and conflating them is what broke "Go Home".
//
// "View Upcoming Events" is a screen on the parent stack. navigate() bubbles
// out of the tab navigator to find it, so the root-typed prop reaches it.
//
// "Go Home" is a sibling *tab*. It used to navigate to 'Main' — the stack route
// that contains this very tab navigator — so React Navigation dutifully went to
// a screen that was already on top and nothing moved. The Home tab has to be
// named directly.
type TabNavProp = BottomTabNavigationProp<MainTabParamList>;

// One-tap starting points, not the whole menu. A merchant can add any amount
// below, and remove any of these.
//
// These used to BE the menu — $1, $2, $3 and a "Custom" chip that did nothing.
// Custom stored a null which handleCreate then filtered out, so choosing it
// alone produced an event with no tip amounts at all, and the tip screen
// correctly showed none. Whatever the merchant picked here is exactly what a
// customer is offered, so it had to stop being a fixed list of three.
const QUICK_AMOUNTS: number[] = [100, 200, 300, 500, 1000, 2000];

// Stripe rejects anything under 50 cents outright, so there is no point letting
// one be typed. The ceiling is ours — a tip jar is not a payment terminal, and
// a mistyped 50000 should be caught here rather than by a merchant wondering
// why a customer is being asked for $500.
const MIN_TIP_CENTS = 50;
const MAX_TIP_CENTS = 50000;

interface FormState {
  name:        string;
  date:        Date | null;
  time:        Date | null;
  location:    string;
  description: string;

  // Cent values, ascending. Sent verbatim as the event's tipOptions, and what
  // TipCollectionScreen puts in front of a customer.
  tipOptions:  number[];
}

const INITIAL_FORM: FormState = {
  name:        '',
  date:        null,
  time:        null,
  location:    '',
  description: '',
  tipOptions:  [100, 200, 500],
};

// ── Formatters ─────────────────────────────────────────────────
const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// Backend expects YYYY-MM-DD
const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Whole dollars render without cents — "$5", not "$5.00" — because that is how
// a tip button reads on the customer's screen, and the two should match.
const money = (cents: number): string =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

// Backend expects HH:MM
const toTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const CreateEventScreen = (): React.JSX.Element => {
  // Same runtime object, two types. useNavigation returns the nearest
  // navigator — the tab one — and navigate() bubbles to the parent stack when a
  // name is not found locally, so both of these work; the types just describe
  // which set of routes each call is aiming at.
  const navigation    = useNavigation<NavProp>();
  const tabNavigation = useNavigation<TabNavProp>();

  const topInset    = useTopInset();
  const [form,      setForm]      = useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors,    setErrors]    = useState<Partial<Record<keyof FormState, string>>>({});

  // Name of the event just created, and the flag for the success sheet. Held
  // separately because the form is reset the moment the request succeeds.
  const [createdName, setCreatedName] = useState<string | null>(null);

  // Text in the "add an amount" box, in dollars exactly as typed.
  const [customTip, setCustomTip] = useState<string>('');

  // ── Picker visibility ─────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // Kept sorted so the customer-facing grid reads low to high regardless of the
  // order the merchant happened to add them in.
  const toggleTipAmount = (cents: number): void => {
    setForm(prev => ({
      ...prev,
      tipOptions: prev.tipOptions.includes(cents)
        ? prev.tipOptions.filter(c => c !== cents)
        : [...prev.tipOptions, cents].sort((a, b) => a - b),
    }));
    setErrors(prev => ({ ...prev, tipOptions: undefined }));
  };

  const addCustomAmount = (): void => {
    const dollars = parseFloat(customTip.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setErrors(prev => ({ ...prev, tipOptions: 'Enter an amount like 7.50' }));
      return;
    }

    // Round before comparing, or 0.499 passes the floor check and then stores
    // as 50 anyway — the value tested has to be the value kept.
    const cents = Math.round(dollars * 100);

    if (cents < MIN_TIP_CENTS) {
      setErrors(prev => ({
        ...prev,
        tipOptions: `Tips must be at least $${(MIN_TIP_CENTS / 100).toFixed(2)}`,
      }));
      return;
    }
    if (cents > MAX_TIP_CENTS) {
      setErrors(prev => ({
        ...prev,
        tipOptions: `Tips cannot be more than $${MAX_TIP_CENTS / 100}`,
      }));
      return;
    }
    if (form.tipOptions.includes(cents)) {
      setErrors(prev => ({ ...prev, tipOptions: 'That amount is already on the list' }));
      return;
    }

    setForm(prev => ({
      ...prev,
      tipOptions: [...prev.tipOptions, cents].sort((a, b) => a - b),
    }));
    setCustomTip('');
    setErrors(prev => ({ ...prev, tipOptions: undefined }));
  };

  // ── Date picker handler ───────────────────────────────────
  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selected) {
      setField('date', selected);
    }
  };

  // ── Time picker handler ───────────────────────────────────
  const onTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selected) {
      setField('time', selected);
    }
  };

  // ── Validation ────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) { newErrors.name     = 'Event name is required'; }
    if (!form.date)        { newErrors.date     = 'Date is required'; }
    if (!form.location.trim()) { newErrors.location = 'Location is required'; }
    if (form.tipOptions.length === 0) {
      newErrors.tipOptions = 'Select at least one tip amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Leaving the success sheet ─────────────────────────────
  // Dismiss before navigating, never after. A React Native Modal on Android is
  // its own window sitting above the whole activity, so navigating while it is
  // still up renders the destination underneath it — the app looks frozen on a
  // dialog whose buttons appear to do nothing.
  const leaveTo = (where: 'upcoming' | 'home'): void => {
    setCreatedName(null);
    if (where === 'upcoming') {
      navigation.navigate('UpcomingEvents');
    } else {
      tabNavigation.navigate('Home');
    }
  };

  // ── Submit ────────────────────────────────────────────────
  const handleCreate = async (): Promise<void> => {
    if (!validate()) { return; }
    setIsLoading(true);

    try {
      await api.createEvent({
        name:        form.name.trim(),
        date:        toIsoDate(form.date!),        // → "2029-06-17"
        time:        form.time ? toTimeString(form.time) : undefined, // → "19:00"
        location:    form.location.trim(),
        description: form.description.trim() || undefined,
        tipOptions:  form.tipOptions,
      });

      const created = form.name.trim();
      setForm(INITIAL_FORM);
      setCreatedName(created);

      // Arm this event's reminders now, rather than waiting for the Home tab to
      // be focused. Sync used to live only in HomeScreen.loadData, so creating
      // an event and then tapping "View Upcoming Events" scheduled nothing at
      // all — the reminders did not exist until the merchant happened to go
      // home. Refetches because the response carries the id and status the
      // scheduler needs, which createEvent's own body does not give us here.
      // Not awaited: the success sheet must not wait on it, and the next Home
      // focus is still a backstop if it fails.
      api.getEvents()
        .then(res => syncEventReminders(res.upcoming ?? []))
        .catch(() => { /* Home focus will pick it up */ });

    } catch (err) {
      Alert.alert('Failed to Create', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Create Events</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>

          {/* ── Event Name ──────────────────────────────── */}
          <Field label="Event Name" error={errors.name}>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={form.name}
              onChangeText={v => setField('name', v)}
              placeholder="Enter event name"
              placeholderTextColor={colours.textSecondary}
              returnKeyType="next"
            />
          </Field>

          {/* ── Event Date — calendar picker ─────────────── */}
          <Field label="Event Date" error={errors.date as string | undefined}>
            <TouchableOpacity
              style={[styles.input, styles.pickerRow, errors.date && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerText, !form.date && styles.pickerPlaceholder]}>
                {form.date ? formatDate(form.date) : 'Select date'}
              </Text>
              <Text style={styles.pickerIcon}>📅</Text>
            </TouchableOpacity>
          </Field>

          {showDatePicker && (
            <DateTimePicker
              value={form.date ?? new Date()}
              mode="date"
              display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {/* ── Event Time — clock picker ────────────────── */}
          <Field label="Event Time (optional)">
            <TouchableOpacity
              style={[styles.input, styles.pickerRow]}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerText, !form.time && styles.pickerPlaceholder]}>
                {form.time ? formatTime(form.time) : 'Select time'}
              </Text>
              <Text style={styles.pickerIcon}>🕐</Text>
            </TouchableOpacity>
          </Field>

          {showTimePicker && (
            <DateTimePicker
              value={form.time ?? new Date()}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'android' ? 'clock' : 'spinner'}
              onChange={onTimeChange}
            />
          )}

          {/* ── Event Location ──────────────────────────── */}
          <Field label="Event Location" error={errors.location}>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              value={form.location}
              onChangeText={v => setField('location', v)}
              placeholder="Enter location"
              placeholderTextColor={colours.textSecondary}
              returnKeyType="next"
            />
          </Field>

          {/* ── Tip amounts — whatever the merchant wants ── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Tip Amounts</Text>
            <Text style={styles.tipHint}>
              Exactly these buttons are what a customer sees when they tip.
            </Text>

            {/* Chosen amounts. Tap to remove. */}
            <View style={styles.chosenRow}>
              {form.tipOptions.length === 0 ? (
                <Text style={styles.chosenEmpty}>No amounts yet — add at least one.</Text>
              ) : form.tipOptions.map(cents => (
                <TouchableOpacity
                  key={cents}
                  style={styles.chosenChip}
                  onPress={() => toggleTipAmount(cents)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chosenChipText}>{money(cents)}</Text>
                  <Text style={styles.chosenChipX}>×</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add your own */}
            <View style={styles.customRow}>
              <View style={styles.customInputWrap}>
                <Text style={styles.customCurrency}>$</Text>
                <TextInput
                  style={styles.customInput}
                  value={customTip}
                  onChangeText={setCustomTip}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colours.textSecondary}
                  returnKeyType="done"
                  onSubmitEditing={addCustomAmount}
                />
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={addCustomAmount}
                activeOpacity={0.85}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Common amounts, as a shortcut rather than the menu */}
            <Text style={styles.quickLabel}>Quick add</Text>
            <View style={styles.tipOptionsRow}>
              {QUICK_AMOUNTS.map(cents => {
                const selected = form.tipOptions.includes(cents);
                return (
                  <TouchableOpacity
                    key={cents}
                    style={[styles.tipOption, selected && styles.tipOptionSelected]}
                    onPress={() => toggleTipAmount(cents)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tipOptionText, selected && styles.tipOptionTextSelected]}>
                      {money(cents)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {errors.tipOptions ? (
              <Text style={styles.errorText}>{errors.tipOptions}</Text>
            ) : null}
          </View>

          {/* ── Event Description ────────────────────────── */}
          <Field label="Event Description  (optional)">
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={v => setField('description', v)}
              placeholder="Add event details..."
              placeholderTextColor={colours.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Field>

        </View>

        {/* ── Create button ─────────────────────────────── */}
        <TouchableOpacity
          style={[styles.createBtn, isLoading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.createBtnText}>
            {isLoading ? 'Creating…' : 'Create'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── Event created ──────────────────────────────────
          Was Alert.alert, which draws in the OS's own style and ignores the
          app's palette entirely. This is the same card the rest of the app
          uses: white surface, blue border, brand primary on the action. */}
      <Modal
        visible={createdName !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedName(null)}
      >
        <View style={styles.successScrim}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>

            <Text style={styles.successTitle}>Event Created</Text>
            <Text style={styles.successBody}>
              <Text style={styles.successName}>{createdName}</Text>
              {' has been added to your upcoming events.'}
            </Text>

            <TouchableOpacity
              style={styles.successPrimary}
              onPress={() => leaveTo('upcoming')}
              activeOpacity={0.85}
            >
              <Text style={styles.successPrimaryText}>View Upcoming Events</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successSecondary}
              onPress={() => leaveTo('home')}
              activeOpacity={0.7}
            >
              <Text style={styles.successSecondaryText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Field wrapper ─────────────────────────────────────────────
const Field = ({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  backBtn:     { padding: spacing.xs },
  backArrow:   { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },
  headerRight: { width: 32 },

  scrollContent: { padding: spacing.base },

  card: {
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.base,
    borderWidth:     1,
    borderColor:     colours.border,
    ...shadows.subtle,
    marginBottom:    spacing.md,
  },

  fieldWrap:  { marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary, marginBottom: spacing.xs },
  errorText:  { fontSize: fontSizes.xs, color: colours.error, marginTop: spacing.xs },

  input: {
    borderWidth:       1,
    borderColor:       colours.border,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm + 2,
    fontSize:          fontSizes.base,
    color:             colours.textPrimary,
    backgroundColor:   colours.background,
  },
  inputError: { borderColor: colours.error },

  // Date / Time picker rows
  pickerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText:       { fontSize: fontSizes.base, color: colours.textPrimary, flex: 1 },
  pickerPlaceholder:{ color: colours.textSecondary },
  pickerIcon:       { fontSize: 18 },

  // Tip options
  // ── Tip amounts ───────────────────────────────────────────
  chosenRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
    marginBottom:  spacing.md,
    minHeight:     36,
    alignItems:    'center',
  },
  chosenEmpty: {
    fontSize:  fontSizes.sm,
    color:     colours.textSecondary,
    fontStyle: 'italic',
  },
  chosenChip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colours.primary,
    borderRadius:      radius.round,
    paddingVertical:   spacing.xs + 2,
    paddingHorizontal: spacing.md,
    gap:               spacing.xs,
  },
  chosenChipText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  chosenChipX: {
    fontSize:   fontSizes.base,
    color:      'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },

  customRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginBottom:  spacing.md,
  },
  customInputWrap: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       colours.border,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor:   colours.surface,
  },
  customCurrency: {
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.bold,
    color:       colours.primary,
    marginRight: spacing.xs,
  },
  customInput: {
    flex:            1,
    fontSize:        fontSizes.base,
    color:           colours.textPrimary,
    paddingVertical: spacing.md,
  },
  addBtn: {
    backgroundColor:   colours.primary,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.xl,
    justifyContent:    'center',
  },
  addBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  quickLabel: {
    fontSize:     fontSizes.xs,
    fontWeight:   fontWeights.semiBold,
    color:        colours.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  tipOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  tipOption: {
    flex:            1,
    borderWidth:     1.5,
    borderColor:     colours.border,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    backgroundColor: colours.background,
  },
  tipOptionSelected:       { backgroundColor: colours.primary, borderColor: colours.primary },
  tipOptionText:           { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.textSecondary },
  tipOptionTextSelected:   { color: colours.white },
  tipHint:                 { fontSize: fontSizes.xs, color: colours.textSecondary, marginTop: spacing.xs },

  textArea: { minHeight: 90, paddingTop: spacing.sm },

  createBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    ...shadows.subtle,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText:     { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white },

  // ── Event-created sheet ───────────────────────────────────
  successScrim: {
    flex:              1,
    backgroundColor:   colours.overlay,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  successCard: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.xxl,
    padding:         spacing.xxl,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colours.borderBlue,
    ...shadows.strong,
  },
  successCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: colours.success,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.lg,
  },
  successIcon: {
    fontSize:   38,
    color:      colours.white,
    fontWeight: fontWeights.bold,
  },
  successTitle: {
    fontSize:     fontSizes.xl,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    marginBottom: spacing.sm,
  },
  successBody: {
    fontSize:     fontSizes.sm,
    color:        colours.textSecondary,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: spacing.xl,
  },
  successName: {
    fontWeight: fontWeights.bold,
    color:      colours.textPrimary,
  },
  successPrimary: {
    width:           '100%',
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    ...shadows.blue,
  },
  successPrimaryText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  successSecondary: {
    paddingVertical: spacing.md,
    marginTop:       spacing.xs,
  },
  successSecondaryText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.semiBold,
    color:      colours.textSecondary,
  },

  bottomPad: { height: spacing.xxxl },
});

export default CreateEventScreen;