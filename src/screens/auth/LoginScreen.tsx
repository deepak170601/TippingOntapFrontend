// src/screens/auth/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import useAuth from '../../hooks/useAuth';
import {
  colours, fontSizes, fontWeights,
  spacing, radius, shadows, letterSpacing,
} from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props): React.JSX.Element => {
  const { login, isLoading, errorMsg: authError } = useAuth();

  const [email,    setEmail]   = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async (): Promise<void> => {
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email and password.');
      shake();
      return;
    }
    const success = await login(email.trim().toLowerCase(), password);
    if (!success) {
      setErrorMsg(authError || 'Something went wrong. Please try again.');
      shake();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      {/* ── Blue gradient top section ─────────────────── */}
      <View style={styles.topSection}>
        <View style={styles.topGradientA} />
        <View style={styles.topGradientB} />

        {/* Logo */}
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>💳</Text>
        </View>
        <Text style={styles.appName}>Tipping On The Go</Text>
        <Text style={styles.tagline}>Sign in to your account</Text>
      </View>

      {/* ── White form card ───────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[
          styles.formCard,
          { transform: [{ translateX: shakeAnim }] },
        ]}>

          {/* Email field */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colours.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password field */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colours.textSecondary}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPass(p => !p)}
              style={styles.eyeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <TouchableOpacity style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Error */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {errorMsg}</Text>
            </View>
          ) : null}

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={colours.white} />
              : <Text style={styles.loginBtnText}>Login</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign up link */}
          <TouchableOpacity
            style={styles.signupRow}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.signupText}>Don't have an account?  </Text>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>

        </Animated.View>

        {/* Footer */}
        <Text style={styles.footer}>🔒 Secured by Stripe Terminal</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colours.background },

  // ── Top blue section ──────────────────────────────
  topSection: {
    alignItems:        'center',
    paddingTop:        spacing.xxxl,
    paddingBottom:     spacing.xxl,
    paddingHorizontal: spacing.xl,
    overflow:          'hidden',
  },
  topGradientA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colours.primaryLight,
  },
  topGradientB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colours.primaryDark,
    opacity:         0.55,
    borderBottomRightRadius: 120,
  },
  logoCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.35)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.md,
  },
  logoEmoji: { fontSize: 38 },
  appName: {
    fontSize:    fontSizes.xl,
    fontWeight:  fontWeights.extraBold,
    color:       colours.white,
    letterSpacing: letterSpacing.tight,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize:  fontSizes.sm,
    color:     colours.textMuted,
    fontWeight: fontWeights.medium,
  },

  // ── Scroll ────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xxxl,
    alignItems:        'center',
  },

  // ── Form card ─────────────────────────────────────
  formCard: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.xl,
    padding:         spacing.xl,
    ...shadows.strong,
    borderWidth:     1,
    borderColor:     colours.borderBlue,
  },

  // Fields
  label: {
    fontSize:    fontSizes.sm,
    fontWeight:  fontWeights.semiBold,
    color:       colours.textPrimary,
    marginBottom: spacing.xs,
    marginTop:   spacing.md,
  },
  inputWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     colours.border,
    borderRadius:    radius.md,
    backgroundColor: colours.surfaceBlue,
    paddingHorizontal: spacing.sm,
  },
  inputIcon: { fontSize: 16, marginRight: spacing.xs },
  input: {
    flex:            1,
    paddingVertical: spacing.md,
    fontSize:        fontSizes.base,
    color:           colours.textPrimary,
  },
  eyeBtn:  { paddingHorizontal: spacing.sm },
  eyeText: { fontSize: 18 },

  // Forgot
  forgotWrap: { alignItems: 'flex-end', marginTop: spacing.sm },
  forgotText: {
    fontSize:   fontSizes.sm,
    color:      colours.primary,
    fontWeight: fontWeights.semiBold,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius:    radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colours.error,
    padding:         spacing.md,
    marginTop:       spacing.md,
  },
  errorText: { color: colours.error, fontSize: fontSizes.sm },

  // Login button
  loginBtn: {
    backgroundColor: colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginTop:       spacing.xl,
    ...shadows.blue,
  },
  btnDisabled:  { opacity: 0.6 },
  loginBtnText: {
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.bold,
    color:       colours.white,
    letterSpacing: letterSpacing.wide,
  },

  // Divider
  dividerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colours.border },
  dividerText: {
    marginHorizontal: spacing.sm,
    fontSize:         fontSizes.sm,
    color:            colours.textSecondary,
  },

  // Sign up
  signupRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
  },
  signupText: { fontSize: fontSizes.sm, color: colours.textSecondary },
  signupLink: {
    fontSize:   fontSizes.sm,
    color:      colours.primary,
    fontWeight: fontWeights.bold,
  },

  // Footer
  footer: {
    marginTop:  spacing.xl,
    fontSize:   fontSizes.xs,
    color:      colours.textSecondary,
    textAlign:  'center',
  },
});

export default LoginScreen;