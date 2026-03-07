// src/screens/payment/TipResultScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows,
} from '../../theme';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'TipResult'>;

const TipResultScreen = (): React.JSX.Element => {
  const navigation            = useNavigation<NavProp>();
  const route                 = useRoute<RouteType>();
  const { success, amountCents, eventName } = route.params;

  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim,  { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(fadeAnim,   { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim,  { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const formatted = (amountCents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colours.background} />

      <Animated.View style={[
        styles.card,
        {
          opacity:   fadeAnim,
          transform: [
            { scale:      scaleAnim },
            { translateY: slideAnim },
          ],
        },
      ]}>
        {/* Thank You title */}
        <Text style={styles.thankYou}>Thank You!</Text>

        {/* Check circle */}
        <Animated.View style={[
          styles.checkCircle,
          success ? styles.checkSuccess : styles.checkFail,
          { transform: [{ scale: checkScale }] },
        ]}>
          <Text style={styles.checkIcon}>{success ? '✓' : '✕'}</Text>
        </Animated.View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.amountValue}>{formatted}</Text>
          <Text style={styles.amountLabel}> Tip Added</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {success
            ? 'Your tip has been successfully added.'
            : 'Payment could not be processed.'}
        </Text>

        {/* Event chip */}
        {eventName ? (
          <View style={styles.eventChip}>
            <Text style={styles.eventChipText}>🎪 {eventName}</Text>
          </View>
        ) : null}

        {/* Done button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>

        {/* Make another */}
        <TouchableOpacity
          style={styles.anotherBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.anotherBtnText}>Make Another Payment</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   colours.background,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.xxl,
    padding:         spacing.xxl,
    alignItems:      'center',
    ...shadows.strong,
    borderWidth:     1,
    borderColor:     colours.borderBlue,
  },
  thankYou: {
    fontSize:     fontSizes.xl,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    marginBottom: spacing.xl,
  },
  checkCircle: {
    width:          90,
    height:         90,
    borderRadius:   45,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.xl,
    ...shadows.blue,
  },
  checkSuccess: { backgroundColor: colours.success },
  checkFail:    { backgroundColor: colours.error   },
  checkIcon:    { fontSize: 46, color: colours.white, fontWeight: fontWeights.bold },
  amountRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    marginBottom:  spacing.sm,
  },
  amountValue: {
    fontSize:   fontSizes.xxl,
    fontWeight: fontWeights.extraBold,
    color:      colours.textPrimary,
  },
  amountLabel: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      colours.textPrimary,
  },
  subtitle: {
    fontSize:          fontSizes.sm,
    color:             colours.textSecondary,
    textAlign:         'center',
    lineHeight:        20,
    marginBottom:      spacing.lg,
    paddingHorizontal: spacing.md,
  },
  eventChip: {
    backgroundColor:   colours.primaryFade,
    borderRadius:      radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    marginBottom:      spacing.xl,
    borderWidth:       1,
    borderColor:       colours.borderBlue,
  },
  eventChipText: {
    fontSize:   fontSizes.sm,
    color:      colours.primary,
    fontWeight: fontWeights.semiBold,
  },
  doneBtn: {
    width:           '100%',
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginBottom:    spacing.sm,
    ...shadows.blue,
  },
  doneBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
  anotherBtn:     { paddingVertical: spacing.sm },
  anotherBtnText: {
    fontSize:   fontSizes.sm,
    color:      colours.primary,
    fontWeight: fontWeights.semiBold,
  },
});

export default TipResultScreen;