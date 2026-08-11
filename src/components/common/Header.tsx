// src/components/common/Header.tsx
import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import useTopInset from '../../hooks/useTopInset';
import { colours, fontSizes, fontWeights, spacing, shadows } from '../../theme';

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps): React.JSX.Element => {
  const topInset = useTopInset();

  return (
    <>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.container, { paddingTop: topInset + spacing.sm }]}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colours.surface,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    ...shadows.subtle,
  },
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.primary },
});

export default React.memo(Header);
