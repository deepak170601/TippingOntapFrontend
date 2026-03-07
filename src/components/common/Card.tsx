// src/components/common/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colours, radius, spacing, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  variant?: 'default' | 'dark';
}

const Card = ({ children, style, variant = 'default' }: CardProps): React.JSX.Element => (
  <View style={[styles.base, variant === 'dark' && styles.dark, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  base: { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, ...shadows.card },
  dark: { backgroundColor: colours.primary },
});

export default React.memo(Card);