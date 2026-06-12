// src/screens/auth/LoginScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated, Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colours, fontSizes, fontWeights, spacing, radius } from '../../theme';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';

type NavProp  = NativeStackNavigationProp<AuthStackParamList>;
const OTP_LEN = 6;
const { width, height } = Dimensions.get('window');

const LoginScreen = (): React.JSX.Element => {
  const navigation          = useNavigation<NavProp>();
  const { loginWithTokens } = useAuth();

  const [phone,     setPhone]     = useState<string>('');
  const [otp,       setOtp]       = useState<string[]>(Array(OTP_LEN).fill(''));
  const [otpSent,   setOtpSent]   = useState<boolean>(false);
  const [loading,   setLoading]   = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [error,     setError]     = useState<string>('');

  const inputRefs    = useRef<(TextInput | null)[]>([]);
  const otpAnim      = useRef(new Animated.Value(0)).current;
  const otpHeight    = useRef(new Animated.Value(0)).current;

  // ── Countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (!otpSent || countdown <= 0) { return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpSent, countdown]);

  // ── Animate OTP section in ─────────────────────────────────
  const showOtpSection = () => {
    Animated.parallel([
      Animated.timing(otpAnim,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(otpHeight, { toValue: 1, duration: 350, useNativeDriver: false }),
    ]).start();
  };

  const cleanPhone = () => phone.replace(/\D/g, '');
  const e164Phone  = () => `+1${cleanPhone()}`;

  // ── Send OTP ──────────────────────────────────────────────
  const handleSendOtp = async (): Promise<void> => {
    if (cleanPhone().length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.sendPhoneOtp(e164Phone());
      setOtpSent(true);
      setCountdown(60);
      setOtp(Array(OTP_LEN).fill(''));
      showOtpSection();
      setTimeout(() => inputRefs.current[0]?.focus(), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP handlers ──────────────────────────────────────────
  const handleOtpChange = (text: string, index: number): void => {
    const digit   = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);
    if (digit && index < OTP_LEN - 1) { inputRefs.current[index + 1]?.focus(); }
    if (digit && index === OTP_LEN - 1) {
      const full = updated.join('');
      if (full.length === OTP_LEN) { handleVerify(full); }
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Verify ────────────────────────────────────────────────
  const handleVerify = async (code: string): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyPhoneOtp(e164Phone(), code);
      if (res.newUser) {
        navigation.navigate('Register', { phoneNumber: e164Phone() });
      } else {
        await loginWithTokens(res.accessToken!, res.refreshToken!, res.user!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
      setOtp(Array(OTP_LEN).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPress = (): void => {
    const code = otp.join('');
    if (code.length < OTP_LEN) { setError('Please enter all 6 digits.'); return; }
    handleVerify(code);
  };

  const handleResend = async (): Promise<void> => {
    setResending(true);
    setError('');
    try {
      await api.sendPhoneOtp(e164Phone());
      setCountdown(60);
      setOtp(Array(OTP_LEN).fill(''));
      inputRefs.current[0]?.focus();
    } catch { setError('Failed to resend.'); }
    finally { setResending(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.waveContainer}>
        <Image
          source={require('../../assets/PNG/Asset_4xhdpi.png')}
          style={styles.waveBg}
          resizeMode="cover"
        />
      </View>

      {/* ── "Log in" title on the wave ───────────────────── */}
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.screenTitle}>Log in</Text>
      </View>

      {/* ── White content area ───────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Phone input ────────────────────────────────── */}
        <View style={styles.phoneInputWrap}>
          <TextInput
            style={styles.phoneInput}
            value={phone}
            onChangeText={v => { setPhone(v); setError(''); }}
            placeholder="Enter phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={14}
            returnKeyType="done"
            onSubmitEditing={handleSendOtp}
            editable={!otpSent}
          />
        </View>

        {/* ── Send OTP / Resend ─────────────────────────── */}
        <TouchableOpacity
          style={styles.sendOtpRow}
          onPress={otpSent ? handleResend : handleSendOtp}
          disabled={loading || (otpSent && countdown > 0)}
          activeOpacity={0.7}
        >
          {loading && !otpSent ? (
            <ActivityIndicator size="small" color={colours.primary} />
          ) : (
            <Text style={[
              styles.sendOtpText,
              otpSent && countdown > 0 && styles.sendOtpDisabled,
            ]}>
              {otpSent
                ? countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'
                : 'Send OTP'}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── OTP section — slides in after Send OTP ───── */}
        <Animated.View style={[
          styles.otpSection,
          {
            opacity: otpAnim,
            transform: [{
              translateY: otpAnim.interpolate({
                inputRange: [0, 1], outputRange: [20, 0],
              }),
            }],
          },
        ]}>
          {otpSent && (
            <>
              <Text style={styles.otpLabel}>Enter OTP code</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { inputRefs.current[i] = ref; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={text => handleOtpChange(text, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    textAlign="center"
                  />
                ))}
              </View>
            </>
          )}
        </Animated.View>

        {/* ── Error ────────────────────────────────────── */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* ── Verify button ────────────────────────────── */}
        {otpSent && (
          <TouchableOpacity
            style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
            onPress={handleVerifyPress}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colours.primary} />
              : <Text style={styles.verifyBtnText}>Verify</Text>}
          </TouchableOpacity>
        )}

        {/* ── Sign up link ──────────────────────────────── */}
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register', { phoneNumber: '' })}>
            <Text style={styles.switchLink}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.poweredBy}>Powered by CyberClouds</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Wave background ───────────────────────────────────────
  // ── Title ─────────────────────────────────────────────────
  titleWrap: {
    position:          'absolute',
    top:               height * 0.28,
    right:             spacing.xl,
    left:              0,
    alignItems:        'flex-end',
    zIndex:            10,
  },
  screenTitle: {
    fontSize:   38,
    fontWeight: '800',
    color:      '#FFFFFF',
  },

  // ── Scroll ────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: {
    paddingTop:        height * 0.46,
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.xxxl,
    alignItems:        'center',
  },

  // ── Phone input ───────────────────────────────────────────
  phoneInputWrap: {
    width:        '100%',
    borderWidth:  2,
    borderColor:  colours.primary,
    borderRadius: 50,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    backgroundColor:   '#FFFFFF',
    marginBottom:      spacing.sm,
  },
  phoneInput: {
    fontSize:  fontSizes.base,
    color:     '#374151',
    width:     '100%',
  },

  // ── Send OTP ──────────────────────────────────────────────
  sendOtpRow:     { alignSelf: 'flex-end', marginBottom: spacing.lg },
  sendOtpText:    { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.primary },
  sendOtpDisabled:{ color: '#9CA3AF' },

  // ── OTP ───────────────────────────────────────────────────
  otpSection: { width: '100%', alignItems: 'flex-start' },
  otpLabel:   { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: '#111827', marginBottom: spacing.md },
  otpRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  otpBox: {
    width:           46,
    height:          54,
    borderRadius:    radius.md,
    fontSize:        fontSizes.xl,
    fontWeight:      fontWeights.bold,
    color:           '#1F2937',
    backgroundColor: '#E8EEF8',
    textAlign:       'center',
    borderWidth:     0,
  },
  otpBoxFilled: {
    backgroundColor: '#C7D8F5',
    color:           '#1A3ADB',
  },

  // ── Error ─────────────────────────────────────────────────
  errorText: {
    fontSize:    fontSizes.sm,
    color:       '#EF4444',
    marginBottom: spacing.sm,
    alignSelf:   'flex-start',
  },

  // ── Verify button ─────────────────────────────────────────
  verifyBtn: {
    width:           '65%',
    borderWidth:     2,
    borderColor:     colours.primary,
    borderRadius:    50,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    backgroundColor: '#FFFFFF',
    marginBottom:    spacing.xl,
    // Gradient border approximation
    shadowColor:     colours.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.2,
    shadowRadius:    8,
    elevation:       3,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: {
    fontSize:   fontSizes.lg,
    fontWeight: fontWeights.bold,
    color:      '#1F2937',
  },

  // ── Switch row ────────────────────────────────────────────
  switchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   spacing.xl,
  },
  switchText: { fontSize: fontSizes.base, color: '#6B7280' },
  switchLink: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.primary },

  // ── Footer ────────────────────────────────────────────────
  poweredBy: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.bold,
    color:      colours.primary,
    textAlign:  'center',
  },
  waveContainer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: height * 0.48,
  overflow: 'hidden',
},
waveBg: {
  width: '100%',
  height: '87%',
},
});

export default LoginScreen;