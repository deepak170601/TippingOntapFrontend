// src/components/payment/AmountButton.tsx
import React from 'react';
import {
  TouchableOpacity, Text, View,
  StyleSheet, Animated,
} from 'react-native';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

interface AmountButtonProps {
  label:    string;
  sublabel?: string; // e.g. "most popular"
  selected: boolean;
  onPress:  () => void;
}

const AmountButton = ({
  label, sublabel, selected, onPress,
}: AmountButtonProps): React.JSX.Element => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.button, selected && styles.selected]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {/* Popular badge */}
        {sublabel && (
          <View style={styles.sublabelWrap}>
            <Text style={styles.sublabel}>{sublabel}</Text>
          </View>
        )}

        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>

        {/* Checkmark when selected */}
        {selected && (
          <View style={styles.checkWrap}>
            <Text style={styles.check}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '30%',
    aspectRatio: 1,
    margin: '1.5%',
  },
  button: {
    flex: 1,
    backgroundColor: colours.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colours.border,
    ...shadows.subtle,
  },
  selected: {
    borderColor: colours.accent,
    backgroundColor: colours.accentLight,
    ...shadows.card,
  },
  label: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colours.textPrimary,
  },
  labelSelected: {
    color: colours.primary,
    fontSize: fontSizes.xl,
  },
  sublabelWrap: {
    position: 'absolute',
    top: -1,
    backgroundColor: colours.accent,
    borderTopLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    left: -1,
  },
  sublabel: {
    fontSize: 8,
    fontWeight: fontWeights.bold,
    color: colours.primary,
    letterSpacing: 0.5,
  },
  checkWrap: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colours.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colours.primary,
  },
});

export default React.memo(AmountButton);