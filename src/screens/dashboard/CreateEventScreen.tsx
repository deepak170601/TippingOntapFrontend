// src/screens/dashboard/CreateEventScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, Alert, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigationProp } from '../../navigation/AppNavigator';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';
import api from '../../services/api';

type NavProp = RootNavigationProp;

interface TipOption { label: string; cents: number | null; }

const ALL_TIP_OPTIONS: TipOption[] = [
  { label: '$1', cents: 100  },
  { label: '$2', cents: 200  },
  { label: '$3', cents: 300  },
  { label: 'Custom', cents: null },
];

interface FormState {
  name:        string;
  date:        Date | null;
  time:        Date | null;
  location:    string;
  description: string;
  tipOptions:  number[];
}

const INITIAL_FORM: FormState = {
  name:        '',
  date:        null,
  time:        null,
  location:    '',
  description: '',
  tipOptions:  [1],
};

// ── Formatters ─────────────────────────────────────────────────
const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// Backend expects YYYY-MM-DD
const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Backend expects HH:MM
const toTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const CreateEventScreen = (): React.JSX.Element => {
  const navigation  = useNavigation<NavProp>();
  const [form,      setForm]      = useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors,    setErrors]    = useState<Partial<Record<keyof FormState, string>>>({});

  // ── Picker visibility ─────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const toggleTipOption = (index: number): void => {
    setForm(prev => {
      const already  = prev.tipOptions.includes(index);
      const updated  = already
        ? prev.tipOptions.filter(i => i !== index)
        : [...prev.tipOptions, index];
      return { ...prev, tipOptions: updated };
    });
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

  // ── Submit ────────────────────────────────────────────────
  const handleCreate = async (): Promise<void> => {
    if (!validate()) { return; }
    setIsLoading(true);

    try {
      const selectedTips = form.tipOptions
        .map(i => ALL_TIP_OPTIONS[i].cents)
        .filter((c): c is number => c !== null);

      await api.createEvent({
        name:        form.name.trim(),
        date:        toIsoDate(form.date!),        // → "2029-06-17"
        time:        form.time ? toTimeString(form.time) : undefined, // → "19:00"
        location:    form.location.trim(),
        description: form.description.trim() || undefined,
        tipOptions:  selectedTips,
      });

      setForm(INITIAL_FORM);

      Alert.alert(
        '✅ Event Created!',
        `"${form.name}" has been added to your upcoming events.`,
        [{
          text: 'View Upcoming Events',
          onPress: () => navigation.navigate('UpcomingEvents'),
        }, {
          text: 'Go Home',
          style: 'cancel',
          onPress: () => navigation.navigate('Main'),
        }]
      );

    } catch (err) {
      Alert.alert('Failed to Create', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
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

          {/* ── Tip Amount Options — multi select ───────── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Select Tip Amount Options</Text>
            <View style={styles.tipOptionsRow}>
              {ALL_TIP_OPTIONS.map((opt, i) => {
                const selected = form.tipOptions.includes(i);
                const isCustom = opt.cents === null;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      styles.tipOption,
                      selected  && styles.tipOptionSelected,
                      isCustom  && styles.tipOptionCustom,
                      isCustom && selected && styles.tipOptionCustomSelected,
                    ]}
                    onPress={() => toggleTipOption(i)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tipOptionText, selected && styles.tipOptionTextSelected]}>
                      {opt.label}{isCustom ? ' +' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.tipOptions ? (
              <Text style={styles.errorText}>{errors.tipOptions}</Text>
            ) : (
              <Text style={styles.tipHint}>
                Selected: {form.tipOptions.length === 0
                  ? 'None'
                  : form.tipOptions.map(i => ALL_TIP_OPTIONS[i].label).join(', ')}
              </Text>
            )}
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
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl },
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
  tipOptionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
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
  tipOptionCustom:         { borderStyle: 'dashed' },
  tipOptionCustomSelected: { borderStyle: 'solid' },
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

  bottomPad: { height: spacing.xxxl },
});

export default CreateEventScreen;