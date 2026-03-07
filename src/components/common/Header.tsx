// src/components/common/Header.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colours, fontSizes, fontWeights, spacing, shadows } from '../../theme';

interface HeaderProps {
  title:      string;
  showBack?:  boolean;
  onBack?:    () => void;
  rightNode?: React.ReactNode;
}

const Header = ({ title, showBack = false, onBack, rightNode }: HeaderProps): React.JSX.Element => (
  <View style={styles.container}>
    <View style={styles.side}>
      {showBack && (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      )}
    </View>
    <Text style={styles.title} numberOfLines={1}>{title}</Text>
    <View style={styles.side}>
      {rightNode ?? null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    ...shadows.subtle,
  },
  side:      { width: 44, alignItems: 'flex-start' },
  title:     { flex: 1, textAlign: 'center', fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.primary },
  backBtn:   { padding: spacing.xs },
  backArrow: { fontSize: fontSizes.xl, color: colours.primary, fontWeight: fontWeights.bold },
});

export default React.memo(Header);