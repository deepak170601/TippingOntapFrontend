// src/components/common/Loader.tsx
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colours, fontSizes, spacing } from '../../theme';

interface LoaderProps {
  message?:    string;
  fullScreen?: boolean;
}

const Loader = ({ message, fullScreen = false }: LoaderProps): React.JSX.Element => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={colours.accent} />
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container:  { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  fullScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244,246,250,0.92)', zIndex: 99 },
  message:    { marginTop: spacing.md, fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center' },
});

export default React.memo(Loader);