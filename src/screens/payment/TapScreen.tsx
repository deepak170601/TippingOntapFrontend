// src/screens/payment/TapScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import usePayment from '../../hooks/usePayment';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, letterSpacing,
} from '../../theme';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'TipResult'>;

const TapScreen = (): React.JSX.Element => {
  const navigation              = useNavigation<NavProp>();
  const route                   = useRoute<RouteType>();
  const { amountCents, eventName: eventNameParam } = route.params;

  // treat event as a minimal object for display
  const event = { id: 'demo', name: eventNameParam ?? '' };

  const {
    startPayment, cancelPayment,
    paymentState, statusMessage,
    STEPS, currentStepIndex,
  } = usePayment();

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const ripple1      = useRef(new Animated.Value(0)).current;
  const ripple2      = useRef(new Animated.Value(0)).current;
  const ripple3      = useRef(new Animated.Value(0)).current;
  const checkAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim    = useRef(new Animated.Value(20)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;

  const pulseLoop  = useRef<Animated.CompositeAnimation | null>(null);
  const rippleLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim,    { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim,    { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    pulseLoop.current.start();
  };

  const startRipples = () => {
    const makeRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    rippleLoop.current = Animated.parallel([
      makeRipple(ripple1, 0),
      makeRipple(ripple2, 500),
      makeRipple(ripple3, 1000),
    ]);
    rippleLoop.current.start();
  };

  const playSuccess = () => {
    pulseLoop.current?.stop();
    rippleLoop.current?.stop();
    Animated.spring(checkAnim, {
      toValue: 1, friction: 4, tension: 100, useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (paymentState === 'collecting') { startPulse(); startRipples(); }
    if (paymentState === 'processing') { pulseLoop.current?.stop(); rippleLoop.current?.stop(); }
    if (paymentState === 'success') {
      playSuccess();
      const timer = setTimeout(() => {
        navigation.navigate('TipResult', { success: true, amountCents, eventName: event.name });
      }, 1200);
      return () => clearTimeout(timer);
    }
    if (paymentState === 'failed') {
      const timer = setTimeout(() => {
        navigation.navigate('TipResult', { success: false, amountCents, eventName: event.name });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [paymentState]);

  useEffect(() => {
    startPayment({ amountCents, eventId: event.id });
    return () => { pulseLoop.current?.stop(); rippleLoop.current?.stop(); };
  }, []);

  const isCollecting = paymentState === 'collecting';
  const isSuccess    = paymentState === 'success';

  const formattedAmount = (amountCents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  const handleCancel = async (): Promise<void> => {
    await cancelPayment();
    navigation.goBack();
  };

  return (
    // ── JSX unchanged from original ───────────────────────────
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.headerLabel}>Processing Payment</Text>
        <Text style={styles.headerAmount}>{formattedAmount}</Text>
        <View style={styles.eventChip}>
          <Text style={styles.eventChipText}>🎪 {event.name}</Text>
        </View>
      </Animated.View>

      <View style={styles.centerArea}>
        {isCollecting && (
          <>
            {[ripple1, ripple2, ripple3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ripple,
                  {
                    opacity:   anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.4, 0] }),
                    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
                  },
                ]}
              />
            ))}
          </>
        )}

        <Animated.View style={[
          styles.pulseCircle,
          isSuccess && styles.pulseCircleSuccess,
          { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
        ]}>
          <View style={[styles.innerCircle, isSuccess && styles.innerCircleSuccess]}>
            {isSuccess ? (
              <Animated.Text style={[styles.centerEmoji, { transform: [{ scale: checkAnim }] }]}>✓</Animated.Text>
            ) : (
              <Text style={styles.centerEmoji}>{paymentState === 'processing' ? '⚡' : '📡'}</Text>
            )}
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.statusWrap, { opacity: fadeAnim }]}>
        <Text style={styles.statusText}>{statusMessage}</Text>
        {isCollecting && (
          <Text style={styles.instructionText}>Hold your card or phone near the top of the device</Text>
        )}
      </Animated.View>

      <View style={styles.stepsRow}>
        {STEPS.map((step, i) => {
          const isDone   = currentStepIndex > i || paymentState === 'success';
          const isActive = currentStepIndex === i;
          return (
            <View key={step.state} style={styles.stepItem}>
              <View style={[styles.stepDot, isDone && styles.stepDotDone, isActive && styles.stepDotActive]}>
                <Text style={styles.stepDotText}>{isDone ? '✓' : `${i + 1}`}</Text>
              </View>
              <Text style={[styles.stepLabel, (isDone || isActive) && styles.stepLabelActive]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {!isSuccess && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel Payment</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>🔒 Secured by Stripe Terminal</Text>
    </View>
  );
};

// ── styles unchanged — paste yours here ───────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.primary,
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  headerLabel: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  headerAmount: {
    fontSize: 52,
    fontWeight: fontWeights.extraBold,
    color: colours.accent,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  eventChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  eventChipText: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: fontWeights.medium,
  },

  // Center animation
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ripple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: colours.accent,
  },
  pulseCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(245,166,35,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircleSuccess: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: colours.success,
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colours.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colours.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  innerCircleSuccess: {
    backgroundColor: colours.success,
    shadowColor: colours.success,
  },
  centerEmoji: {
    fontSize: 52,
    color: colours.white,
    fontWeight: fontWeights.bold,
  },

  // Status
  statusWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  statusText: {
    fontSize: fontSizes.lg,
    color: colours.white,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Progress steps
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  stepItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colours.accent,
    borderColor: colours.accent,
    elevation: 4,
    shadowColor: colours.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  stepDotDone: {
    backgroundColor: colours.success,
    borderColor: colours.success,
  },
  stepDotText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colours.white,
  },
  stepLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: fontWeights.medium,
  },
  stepLabelActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // Cancel
  cancelBtn: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.round,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },

  // Footer
  footer: {
    marginBottom: spacing.xl,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: letterSpacing.wide,
  },
});

export default TapScreen;