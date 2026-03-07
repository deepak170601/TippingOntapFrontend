// src/components/common/Button.tsx
import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle,
} from 'react-native';
import { colours, fontSizes, fontWeights, spacing, radius, letterSpacing } from '../../theme';

type Variant = 'primary' | 'outline' | 'danger';

interface ButtonProps {
  label:      string;
  onPress:    () => void;
  variant?:   Variant;
  isLoading?: boolean;
  disabled?:  boolean;
  style?:     ViewStyle;
}

const Button = ({
  label, onPress, variant = 'primary',
  isLoading = false, disabled = false, style,
}: ButtonProps): React.JSX.Element => (
  <TouchableOpacity
    style={[
      styles.base,
      styles[variant],
      (disabled || isLoading) && styles.disabled,
      style,
    ]}
    onPress={onPress}
    disabled={disabled || isLoading}
    activeOpacity={0.82}
  >
    {isLoading
      ? <ActivityIndicator color={variant === 'danger' ? colours.white : colours.primary} />
      : <Text style={[
          styles.text,
          variant === 'outline' && styles.textOutline,
          variant === 'danger'  && styles.textDanger,
        ]}>{label}</Text>
    }
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base:        { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  primary:     { backgroundColor: colours.accent, elevation: 2, shadowColor: colours.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  outline:     { borderWidth: 1.5, borderColor: colours.primary, backgroundColor: colours.transparent },
  danger:      { backgroundColor: colours.error, elevation: 2 },
  disabled:    { opacity: 0.5 },
  text:        { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.primary, letterSpacing: letterSpacing.wide },
  textOutline: { color: colours.primary },
  textDanger:  { color: colours.white },
});

export default React.memo(Button);