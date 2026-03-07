// src/screens/auth/SignupScreen.tsx
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

// ── Password strength ──────────────────────────────────────────
const getStrength = (v: string): { bars: number; label: string; color: string } => {
  if (!v)           return { bars: 0, label: '',       color: colours.border   };
  if (v.length < 6) return { bars: 1, label: 'Weak',   color: colours.error    };
  if (v.length < 8) return { bars: 2, label: 'Fair',   color: colours.warning  };
  const extras =
    (/[A-Z]/.test(v) ? 1 : 0) +
    (/[0-9]/.test(v) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
  if (extras >= 2)  return { bars: 4, label: 'Strong', color: colours.success  };
  if (extras === 1) return { bars: 3, label: 'Good',   color: '#3B82F6'        };
  return                   { bars: 2, label: 'Fair',   color: colours.warning  };
};

const SignupScreen = ({ navigation }: Props): React.JSX.Element => {
  const { signup, isLoading, errorMsg: authError } = useAuth();

  const [fullName,  setFullName]  = useState<string>('');
  const [email,     setEmail]     = useState<string>('');
  const [password,  setPassword]  = useState<string>('');
  const [confirm,   setConfirm]   = useState<string>('');
  const [showPass,  setShowPass]  = useState<boolean>(false);
  const [errorMsg,  setErrorMsg]  = useState<string>('');

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

  const validate = (): string | null => {
    if (!fullName.trim())     { return 'Full name is required.'; }
    if (!email.trim())        { return 'Email address is required.'; }
    if (password.length < 8)  { return 'Password must be at least 8 characters.'; }
    if (password !== confirm) { return 'Passwords do not match.'; }
    return null;
  };

  const handleSignup = async (): Promise<void> => {
    const err = validate();
    if (err) { setErrorMsg(err); shake(); return; }
    setErrorMsg('');
    const success = await signup(
      fullName.trim(),
      email.trim().toLowerCase(),
      password,
    );
    if (!success) {
      setErrorMsg(authError || 'Something went wrong. Please try again.');
      shake();
    }
  };

  const strength = getStrength(password);
  const confirmMatch = confirm.length > 0 && confirm === password;
  const confirmWrong = confirm.length > 0 && confirm !== password;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      {/* ── Blue top section ──────────────────────────── */}
      <View style={styles.topSection}>
        <View style={styles.topGradientA} />
        <View style={styles.topGradientB} />
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>💳</Text>
        </View>
        <Text style={styles.appName}>Tipping On The Go</Text>
        <Text style={styles.tagline}>Create your account</Text>
      </View>

      {/* ── Form ─────────────────────────────────────── */}
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

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Smith"
              placeholderTextColor={colours.textSecondary}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Email */}
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

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor={colours.textSecondary}
              secureTextEntry={!showPass}
              returnKeyType="next"
            />
            <TouchableOpacity
              onPress={() => setShowPass(p => !p)}
              style={styles.eyeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Strength bar */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map(n => (
                  <View
                    key={n}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: n <= strength.bars ? strength.color : colours.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[
            styles.inputWrap,
            confirmMatch && styles.inputWrapSuccess,
            confirmWrong && styles.inputWrapError,
          ]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={colours.textSecondary}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
            {confirmMatch && <Text style={styles.matchIcon}>✅</Text>}
            {confirmWrong && <Text style={styles.matchIcon}>❌</Text>}
          </View>

          {/* Error */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {errorMsg}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={colours.white} />
              : <Text style={styles.submitBtnText}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Login link */}
          <TouchableOpacity
            style={styles.loginRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>Already have an account?  </Text>
            <Text style={styles.loginLink}>Login</Text>
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

  // Top section
  topSection: {
    alignItems:        'center',
    paddingTop:        spacing.xxl,
    paddingBottom:     spacing.xl,
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
    width:  72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoEmoji: { fontSize: 34 },
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

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xxxl,
    alignItems:        'center',
  },

  // Form card
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
  inputWrapSuccess: { borderColor: colours.success },
  inputWrapError:   { borderColor: colours.error   },
  inputIcon:  { fontSize: 16, marginRight: spacing.xs },
  input: {
    flex:            1,
    paddingVertical: spacing.md,
    fontSize:        fontSizes.base,
    color:           colours.textPrimary,
  },
  eyeBtn:    { paddingHorizontal: spacing.sm },
  eyeText:   { fontSize: 18 },
  matchIcon: { fontSize: 16, paddingHorizontal: spacing.sm },

  // Strength bar
  strengthWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     spacing.xs,
    gap:           spacing.sm,
  },
  strengthBars: {
    flex:          1,
    flexDirection: 'row',
    gap:           4,
  },
  strengthBar: {
    flex:         1,
    height:       4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize:   fontSizes.xs,
    fontWeight: fontWeights.bold,
    width:      44,
    textAlign:  'right',
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

  // Submit button
  submitBtn: {
    backgroundColor: colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginTop:       spacing.xl,
    ...shadows.blue,
  },
  btnDisabled:   { opacity: 0.6 },
  submitBtnText: {
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

  // Login link
  loginRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
  },
  loginText: { fontSize: fontSizes.sm, color: colours.textSecondary },
  loginLink: {
    fontSize:   fontSizes.sm,
    color:      colours.primary,
    fontWeight: fontWeights.bold,
  },

  // Footer
  footer: {
    marginTop: spacing.xl,
    fontSize:  fontSizes.xs,
    color:     colours.textSecondary,
    textAlign: 'center',
  },
});

export default SignupScreen;