// src/screens/auth/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, StatusBar, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { fontSizes, fontWeights, spacing } from '../../theme';

type NavProp = NativeStackNavigationProp<AuthStackParamList>;

const SplashScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NavProp>();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Login'), 2500);
    return () => clearTimeout(timer);
    // All three are stable: the Animated.Values are useRef(...).current and
    // navigation is a stable React Navigation object, so naming them here
    // satisfies the rule without making the effect re-run.
  }, [navigation, opacity, translateY]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/*
        ── Splash background asset ──────────────────────────────
        Place your splash image at: src/assets/images/splash_bg.png
      */}
      <Image
        source={require('../../assets/PNG/splash_screen.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width:  '100%',
    height: '100%',
  },
  content:    { alignItems: 'center', zIndex: 1 },
  logoCircle: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xl,
  },
  logoEmoji: { fontSize: 48 },
  appName: {
    fontSize:    fontSizes.xxl,
    fontWeight:  fontWeights.extraBold,
    color:       '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign:   'center',
  },
  tagline: {
    fontSize:  fontSizes.base,
    color:     'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
});

export default SplashScreen;