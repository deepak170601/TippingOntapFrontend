// src/screens/payment/AmountScreen.tsx
// Params: { event: Event }
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet,
  Animated, Keyboard,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PaymentStackParamList } from '../../navigation/PaymentNavigator';
import Header       from '../../components/common/Header';
import AmountButton from '../../components/payment/AmountButton';
import Button       from '../../components/common/Button';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows, letterSpacing,
} from '../../theme';

type Props = NativeStackScreenProps<PaymentStackParamList, 'Amount'>;

interface PresetAmount {
  label:     string;
  cents:     number | null;
  sublabel?: string;
}

const PRESET_AMOUNTS: PresetAmount[] = [
  { label: '$1',     cents: 100  },
  { label: '$2',     cents: 200  },
  { label: '$5',     cents: 500,  sublabel: '⭐ popular' },
  { label: '$10',    cents: 1000, sublabel: '🔥 top pick' },
  { label: '$20',    cents: 2000 },
  { label: 'Custom', cents: null },
];

const AmountScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const event = route.params?.event ?? {
    id: 'demo', name: 'Demo Event', date: '', location: '',
  };

  const [selectedIndex,  setSelectedIndex]  = useState<number | null>(null);
  const [customAmount,   setCustomAmount]   = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isCustom    = selectedIndex === PRESET_AMOUNTS.length - 1;
  const isSelected  = selectedIndex !== null;

  const getSelectedCents = (): number | null => {
    if (selectedIndex === null) { return null; }
    if (isCustom) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? null : Math.round(parsed * 100);
    }
    return PRESET_AMOUNTS[selectedIndex].cents;
  };

  const selectedCents = getSelectedCents();
  const canProceed    = selectedCents !== null && selectedCents > 0;

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setCustomAmount('');
    if (index === PRESET_AMOUNTS.length - 1) {
      // Animate custom input in
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }).start();
    } else {
      Keyboard.dismiss();
      fadeAnim.setValue(0);
    }
  };

  const handleProceed = (): void => {
    if (!canProceed || !selectedCents) { return; }
    navigation.navigate('Tap', { amountCents: selectedCents, event });
  };

  const formattedAmount = canProceed && selectedCents
    ? (selectedCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : null;

  return (
    <View style={styles.container}>
      <Header
        title="Select Tip Amount"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Event banner */}
        <View style={styles.eventBanner}>
          <View style={styles.eventIconWrap}>
            <Text style={styles.eventIcon}>🎪</Text>
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventLabel}>Tipping for</Text>
            <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
          </View>
        </View>

        {/* Prompt */}
        <Text style={styles.prompt}>Choose an amount below</Text>

        {/* Amount grid */}
        <View style={styles.grid}>
          {PRESET_AMOUNTS.map((item, i) => (
            <AmountButton
              key={item.label}
              label={item.label}
              sublabel={item.sublabel}
              selected={selectedIndex === i}
              onPress={() => handleSelect(i)}
            />
          ))}
        </View>

        {/* Custom amount input — animates in */}
        {isCustom && (
          <Animated.View style={[styles.customCard, { opacity: fadeAnim }]}>
            <Text style={styles.customTitle}>Enter custom amount</Text>
            <View style={styles.customInputRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencySymbol}>$</Text>
              </View>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colours.textSecondary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              {customAmount.length > 0 && (
                <TouchableOpacity
                  onPress={() => setCustomAmount('')}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        {/* Selected amount preview */}
        {canProceed && formattedAmount && (
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>You are tipping</Text>
            <Text style={styles.previewAmount}>{formattedAmount}</Text>
          </View>
        )}

        {/* Proceed button */}
        <View style={styles.proceedWrap}>
          <Button
            label={
              canProceed && formattedAmount
                ? `Proceed to Pay  ${formattedAmount}`
                : 'Select an Amount'
            }
            onPress={handleProceed}
            disabled={!canProceed}
          />
        </View>

        {/* Accepted cards row */}
        <View style={styles.cardsRow}>
          {['💳 Visa', '💳 Mastercard', '💳 Amex', '📱 Apple Pay'].map(c => (
            <View key={c} style={styles.cardChip}>
              <Text style={styles.cardChipText}>{c}</Text>
            </View>
          ))}
        </View>

        {/* Test mode notice */}
        <Text style={styles.testMode}>
          🔒 Tap-to-Pay Demo (Test Mode) — No real charges
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  // Event banner
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colours.accent,
    ...shadows.subtle,
    gap: spacing.md,
  },
  eventIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colours.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  eventIcon:  { fontSize: 22 },
  eventInfo:  { flex: 1 },
  eventLabel: { fontSize: fontSizes.xs, color: colours.textSecondary, fontWeight: fontWeights.medium },
  eventName:  { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.textPrimary },

  // Prompt
  prompt: {
    fontSize: fontSizes.sm,
    color: colours.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: fontWeights.medium,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: spacing.lg,
  },

  // Custom input
  customCard: {
    backgroundColor: colours.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.card,
    borderWidth: 1.5,
    borderColor: colours.accent,
  },
  customTitle:    { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textPrimary, marginBottom: spacing.sm },
  customInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencyBadge:  { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center' },
  currencySymbol: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.accent },
  customInput:    { flex: 1, fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colours.textPrimary, paddingVertical: spacing.sm },
  clearBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: colours.border, alignItems: 'center', justifyContent: 'center' },
  clearText:      { fontSize: fontSizes.xs, color: colours.textSecondary, fontWeight: fontWeights.bold },

  // Preview
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(26,46,74,0.12)',
  },
  previewLabel:  { fontSize: fontSizes.sm, color: colours.textSecondary, fontWeight: fontWeights.medium },
  previewAmount: { fontSize: fontSizes.lg, fontWeight: fontWeights.extraBold, color: colours.primary },

  // Proceed
  proceedWrap: { marginBottom: spacing.lg },

  // Cards row
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardChip:     { backgroundColor: colours.surface, borderRadius: radius.round, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colours.border },
  cardChipText: { fontSize: fontSizes.xs, color: colours.textSecondary },

  // Test mode
  testMode: {
    textAlign: 'center',
    fontSize: fontSizes.xs,
    color: colours.textSecondary,
    letterSpacing: letterSpacing.normal,
  },
});

export default AmountScreen;