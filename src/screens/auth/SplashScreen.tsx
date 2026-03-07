// src/screens/auth/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Easing, ImageBackground,
  Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import {
  colours, fontSizes, fontWeights,
  letterSpacing, spacing, radius,
} from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

const { width, height } = Dimensions.get('window');

// ── Bar/restaurant background from Unsplash (free, no key needed) ──
const BG_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
};

const SplashScreen = ({ navigation }: Props): React.JSX.Element => {
  const titleAnim  = useRef(new Animated.Value(-40)).current;
  const titleFade  = useRef(new Animated.Value(0)).current;
  const tagAnim    = useRef(new Animated.Value(-20)).current;
  const tagFade    = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(60)).current;
  const cardFade   = useRef(new Animated.Value(0)).current;
  const btnAnim    = useRef(new Animated.Value(20)).current;
  const btnFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Title slides in from left
      Animated.parallel([
        Animated.timing(titleAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      // Tagline
      Animated.parallel([
        Animated.timing(tagAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Phone card rises
      Animated.parallel([
        Animated.timing(cardAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      // Button fades in
      Animated.parallel([
        Animated.timing(btnAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(btnFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Login'), 3200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background photo */}
      <ImageBackground source={BG_IMAGE} style={styles.bgImage} resizeMode="cover">

        {/* Dark overlay */}
        <View style={styles.overlay} />

        {/* Top-left dark triangle panel (matches design) */}
        <View style={styles.triangleTopLeft} />
        <View style={styles.triangleTopRight} />

        {/* ── Top section ── */}
        <View style={styles.topSection}>
          {/* Title */}
          <Animated.View style={{
            opacity: titleFade,
            transform: [{ translateX: titleAnim }],
          }}>
            <Text style={styles.title}>Tipping On The Go</Text>
            <View style={styles.titleDotRow}>
              <View style={styles.titleDot} />
            </View>
          </Animated.View>

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, {
            opacity: tagFade,
            transform: [{ translateX: tagAnim }],
          }]}>
            Quick. Easy. Cashless
          </Animated.Text>
        </View>

        {/* ── Center phone mockup card ── */}
        <Animated.View style={[styles.phoneMockup, {
          opacity: cardFade,
          transform: [{ translateY: cardAnim }],
        }]}>
          {/* Phone frame */}
          <View style={styles.phoneFrame}>
            {/* Notch */}
            <View style={styles.notch} />

            {/* Screen content */}
            <View style={styles.phoneScreen}>
              <Text style={styles.thankYou}>Thank You!</Text>

              {/* Green checkmark */}
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>

              <View style={styles.tipRow}>
                <Text style={styles.tipAmount}>$2.00</Text>
                <Text style={styles.tipLabel}> Tip Added</Text>
              </View>

              <Text style={styles.tipSub}>Your tip has been successfully added.</Text>

              {/* Done button */}
              <View style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </View>
            </View>

            {/* Home indicator */}
            <View style={styles.homeIndicator} />
          </View>
        </Animated.View>

        {/* ── Get Started button ── */}
        <Animated.View style={[styles.btnWrap, {
          opacity: btnFade,
          transform: [{ translateY: btnAnim }],
        }]}>
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => navigation.replace('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>

      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgImage:   { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,60,0.62)',
  },

  // Diagonal triangle overlays (match design's angular panels)
  triangleTopLeft: {
    position:  'absolute',
    top:       0,
    left:      0,
    width:     width * 0.55,
    height:    height * 0.38,
    backgroundColor: 'rgba(15,25,80,0.55)',
    transform: [{ skewY: '15deg' }, { translateY: -60 }],
  },
  triangleTopRight: {
    position:  'absolute',
    top:       0,
    right:     0,
    width:     width * 0.55,
    height:    height * 0.38,
    backgroundColor: 'rgba(15,25,80,0.55)',
    transform: [{ skewY: '-15deg' }, { translateY: -60 }],
  },

  // Top text section
  topSection: {
    paddingTop:  height * 0.10,
    paddingHorizontal: spacing.xl,
    alignItems:  'center',
  },
  title: {
    fontSize:    fontSizes.hero,
    fontWeight:  fontWeights.extraBold,
    color:       colours.white,
    textAlign:   'center',
    letterSpacing: letterSpacing.tight,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleDotRow: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    marginTop:      4,
    paddingRight:   spacing.md,
  },
  titleDot: {
    width:  8, height: 8,
    borderRadius: 4,
    backgroundColor: colours.white,
  },
  tagline: {
    fontSize:    fontSizes.xl,
    fontWeight:  fontWeights.semiBold,
    color:       colours.white,
    textAlign:   'center',
    marginTop:   spacing.sm,
    letterSpacing: letterSpacing.wide,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Phone mockup
  phoneMockup: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       spacing.xl,
  },
  phoneFrame: {
    width:           width * 0.58,
    backgroundColor: '#111827',
    borderRadius:    36,
    borderWidth:     3,
    borderColor:     '#374151',
    overflow:        'hidden',
    paddingBottom:   spacing.lg,
  },
  notch: {
    width:           80,
    height:          24,
    backgroundColor: '#111827',
    borderRadius:    12,
    alignSelf:       'center',
    marginTop:       8,
    marginBottom:    spacing.sm,
  },
  phoneScreen: {
    paddingHorizontal: spacing.base,
    alignItems:        'center',
  },
  thankYou: {
    fontSize:    fontSizes.lg,
    fontWeight:  fontWeights.bold,
    color:       colours.white,
    marginBottom: spacing.md,
  },
  checkCircle: {
    width:           70,
    height:          70,
    borderRadius:    35,
    backgroundColor: colours.success,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.md,
  },
  checkMark: {
    fontSize:    36,
    color:       colours.white,
    fontWeight:  fontWeights.bold,
  },
  tipRow: {
    flexDirection:  'row',
    alignItems:     'baseline',
    marginBottom:   spacing.xs,
  },
  tipAmount: {
    fontSize:    fontSizes.xl,
    fontWeight:  fontWeights.extraBold,
    color:       colours.white,
  },
  tipLabel: {
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.bold,
    color:       colours.white,
  },
  tipSub: {
    fontSize:    fontSizes.xs,
    color:       'rgba(255,255,255,0.5)',
    textAlign:   'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  doneBtn: {
    width:           '100%',
    backgroundColor: '#3B82F6',
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
  },
  doneBtnText: {
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.bold,
    color:       colours.white,
  },
  homeIndicator: {
    width:           80,
    height:          4,
    backgroundColor: '#6B7280',
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       spacing.md,
  },

  // Get Started button
  btnWrap: {
    paddingHorizontal: spacing.xxl,
    paddingBottom:     spacing.xxxl,
  },
  getStartedBtn: {
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    shadowColor:     colours.primary,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       8,
  },
  getStartedText: {
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.bold,
    color:       colours.white,
    letterSpacing: letterSpacing.wide,
  },
});

export default SplashScreen;