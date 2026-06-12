// src/screens/auth/RegisterScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colours, fontSizes, fontWeights, spacing, radius, shadows } from '../../theme';
import { US_STATES, USState } from '../../constants/usStates';
import api from '../../services/api';
import  useAuth from '../../hooks/useAuth';
import {Image} from 'react-native';

const { height } = Dimensions.get('window');

type NavProp   = NativeStackNavigationProp<AuthStackParamList>;
type RouteType = RouteProp<AuthStackParamList, 'Register'>;

const OTP_LENGTH = 6;

interface FormState {
  firstName:   string;
  lastName:    string;
  email:       string;
  company:     string;
  ein:         string;
  address1:    string;
  address2:    string;
  zip:         string;
  city:        string;
  state:       USState | null;
}

const INITIAL: FormState = {
  firstName: '', lastName: '', email: '', company: '', ein: '',
  address1: '', address2: '', zip: '', city: '', state: null,
};

const RegisterScreen = (): React.JSX.Element => {
  const navigation    = useNavigation<NavProp>();
  const route         = useRoute<RouteType>();
  const phoneNumber   = route.params.phoneNumber;
  const { loginWithTokens } = useAuth();

  const [form,        setForm]        = useState<FormState>(INITIAL);
  const [errors,      setErrors]      = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading,     setLoading]     = useState<boolean>(false);

  // ── Phone OTP step (if arrived from "Create Account" link) ──
  const [phoneStep,   setPhoneStep]   = useState<'phone' | 'otp' | 'done'>(
    phoneNumber ? 'done' : 'phone'
  );
  const [phone,       setPhone]       = useState<string>(phoneNumber ?? '');
  const [phoneOtp,    setPhoneOtp]    = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [phoneLoading,setPhoneLoading]= useState<boolean>(false);
  const [phoneCountdown, setPhoneCountdown] = useState<number>(60);
  const phoneInputRefs = useRef<(TextInput | null)[]>([]);

  // ── Email OTP modal ───────────────────────────────────────
  const [emailVerified,    setEmailVerified]    = useState<boolean>(false);
  const [showEmailOtp,     setShowEmailOtp]     = useState<boolean>(false);
  const [emailOtp,         setEmailOtp]         = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [emailOtpLoading,  setEmailOtpLoading]  = useState<boolean>(false);
  const [emailCountdown,   setEmailCountdown]   = useState<number>(60);
  const [emailResending,   setEmailResending]   = useState<boolean>(false);
  const emailInputRefs = useRef<(TextInput | null)[]>([]);

  // ── State modal ───────────────────────────────────────────
  const [stateModal,  setStateModal]  = useState<boolean>(false);
  const [stateSearch, setStateSearch] = useState<string>('');

  // ── Countdown for phone OTP ───────────────────────────────
  useEffect(() => {
    if (phoneStep !== 'otp' || phoneCountdown <= 0) { return; }
    const t = setTimeout(() => setPhoneCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phoneStep, phoneCountdown]);

  // ── Countdown for email OTP ───────────────────────────────
  useEffect(() => {
    if (!showEmailOtp || emailCountdown <= 0) { return; }
    const t = setTimeout(() => setEmailCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showEmailOtp, emailCountdown]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    if (key === 'email') { setEmailVerified(false); }
  };

  const filteredStates = US_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // ── Phone send OTP ────────────────────────────────────────
  const handleSendPhoneOtp = async (): Promise<void> => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { Alert.alert('Error', 'Enter a valid phone number.'); return; }
    setPhoneLoading(true);
    try {
      await api.sendPhoneOtp(`+1${cleaned}`);
      setPhoneStep('otp');
      setPhoneCountdown(60);
      setTimeout(() => phoneInputRefs.current[0]?.focus(), 300);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Phone OTP change ──────────────────────────────────────
  const handlePhoneOtpChange = (text: string, index: number): void => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...phoneOtp];
    updated[index] = digit;
    setPhoneOtp(updated);
    if (digit && index < OTP_LENGTH - 1) { phoneInputRefs.current[index + 1]?.focus(); }
    if (digit && index === OTP_LENGTH - 1) {
      const full = updated.join('');
      if (full.length === OTP_LENGTH) { handleVerifyPhone(full); }
    }
  };

  // ── Verify phone OTP ──────────────────────────────────────
  const handleVerifyPhone = async (code: string): Promise<void> => {
    setPhoneLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, '');
      const res = await api.verifyPhoneOtp(`+1${cleaned}`, code);
      if (!res.newUser) {
        // Already registered — log in instead
        await loginWithTokens(res.accessToken!, res.refreshToken!, res.user!);
        return;
      }
      setPhone(`+1${cleaned}`);
      setPhoneStep('done');
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Invalid code.');
      setPhoneOtp(Array(OTP_LENGTH).fill(''));
      phoneInputRefs.current[0]?.focus();
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Send email OTP ────────────────────────────────────────
  const handleSendEmailOtp = async (): Promise<void> => {
    if (!form.email.includes('@')) { setErrors(e => ({ ...e, email: 'Enter a valid email.' })); return; }
    setEmailOtpLoading(true);
    try {
      await api.sendEmailOtp(form.email.trim());
      setEmailOtp(Array(OTP_LENGTH).fill(''));
      setEmailCountdown(60);
      setShowEmailOtp(true);
      setTimeout(() => emailInputRefs.current[0]?.focus(), 300);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // ── Email OTP change ──────────────────────────────────────
  const handleEmailOtpChange = (text: string, index: number): void => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...emailOtp];
    updated[index] = digit;
    setEmailOtp(updated);
    if (digit && index < OTP_LENGTH - 1) { emailInputRefs.current[index + 1]?.focus(); }
    if (digit && index === OTP_LENGTH - 1) {
      const full = updated.join('');
      if (full.length === OTP_LENGTH) { handleVerifyEmail(full); }
    }
  };

  // ── Verify email OTP ──────────────────────────────────────
  const handleVerifyEmail = async (code: string): Promise<void> => {
    setEmailOtpLoading(true);
    try {
      await api.verifyEmailOtp(form.email.trim(), code);
      setEmailVerified(true);
      setShowEmailOtp(false);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Invalid code.');
      setEmailOtp(Array(OTP_LENGTH).fill(''));
      emailInputRefs.current[0]?.focus();
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleResendEmail = async (): Promise<void> => {
    setEmailResending(true);
    try {
      await api.sendEmailOtp(form.email.trim());
      setEmailCountdown(60);
      setEmailOtp(Array(OTP_LENGTH).fill(''));
      emailInputRefs.current[0]?.focus();
    } catch { Alert.alert('Error', 'Failed to resend.'); }
    finally { setEmailResending(false); }
  };

  // ── Validate ──────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.firstName.trim())  { e.firstName = 'First name is required'; }
    if (!form.lastName.trim())   { e.lastName  = 'Last name is required'; }
    if (!form.email.trim())      { e.email     = 'Email is required'; }
    if (!emailVerified)          { e.email     = 'Please verify your email'; }
    if (form.company.trim() && !form.ein.trim())   { e.ein     = 'EIN required with company name'; }
    if (form.ein.trim() && !form.company.trim())   { e.company = 'Company name required with EIN'; }
    if (!form.address1.trim())   { e.address1  = 'Address is required'; }
    if (!form.zip.trim())        { e.zip       = 'ZIP is required'; }
    if (!form.city.trim())       { e.city      = 'City is required'; }
    if (!form.state)             { e.state     = 'State is required'; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleRegister = async (): Promise<void> => {
    if (!validate()) { return; }
    setLoading(true);
    try {
      const res = await api.register({
        phoneNumber:  phone,
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        email:        form.email.trim(),
        address1:     form.address1.trim(),
        city:         form.city.trim(),
        state:        form.state!.abbr,
        zip:          form.zip.trim(),
        address2:     form.address2.trim() || undefined,
        companyName:  form.company.trim()  || undefined,
        ein:          form.ein.trim()      || undefined,
      });
      await loginWithTokens(res.accessToken, res.refreshToken, res.user);
    } catch (err) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Unified phone step screen (phoneStep === 'phone' | 'otp') ──
  if (phoneStep !== 'done') {
    return (
      <KeyboardAvoidingView
        style={regStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <View style={regStyles.waveContainer}>
          <Image
            source={require('../../assets/PNG/Asset_4xhdpi.png')}
            style={regStyles.waveBg}
            resizeMode="cover"
          />
        </View>

        {/* ── "Sign up" title ───────────────────────────── */}
        <View style={regStyles.titleWrap} pointerEvents="none">
          <Text style={regStyles.screenTitle}>Sign up</Text>
        </View>

        <ScrollView
          style={regStyles.scroll}
          contentContainerStyle={regStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Phone input ──────────────────────────────── */}
          <View style={regStyles.phoneInputWrap}>
            <TextInput
              style={regStyles.phoneInput}
              value={phone}
              onChangeText={v => setPhone(v)}
              placeholder="Enter phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={14}
              returnKeyType="done"
              onSubmitEditing={handleSendPhoneOtp}
              editable={phoneStep === 'phone'}
            />
          </View>

          {/* ── Send OTP / Resend ─────────────────────────── */}
          <TouchableOpacity
            style={regStyles.sendOtpRow}
            onPress={handleSendPhoneOtp}
            disabled={phoneLoading || (phoneStep === 'otp' && phoneCountdown > 0)}
            activeOpacity={0.7}
          >
            {phoneLoading ? (
              <ActivityIndicator size="small" color={colours.primary} />
            ) : (
              <Text style={[
                regStyles.sendOtpText,
                phoneStep === 'otp' && phoneCountdown > 0 && regStyles.sendOtpDisabled,
              ]}>
                {phoneStep === 'otp'
                  ? phoneCountdown > 0 ? `Resend OTP in ${phoneCountdown}s` : 'Resend OTP'
                  : 'Send OTP'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── OTP section ────────────────────────────────── */}
          {phoneStep === 'otp' && (
            <>
              <Text style={regStyles.otpLabel}>Enter OTP code</Text>
              <View style={regStyles.otpRow}>
                {phoneOtp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => { phoneInputRefs.current[i] = ref; }}
                    style={[regStyles.otpBox, digit ? regStyles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={text => handlePhoneOtpChange(text, i)}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace' && !phoneOtp[i] && i > 0)
                        { phoneInputRefs.current[i - 1]?.focus(); }
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    textAlign="center"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[regStyles.verifyBtn, phoneLoading && regStyles.verifyBtnDisabled]}
                onPress={() => {
                  const c = phoneOtp.join('');
                  if (c.length === OTP_LENGTH) { handleVerifyPhone(c); }
                }}
                disabled={phoneLoading}
                activeOpacity={0.85}
              >
                {phoneLoading
                  ? <ActivityIndicator color={colours.primary} />
                  : <Text style={regStyles.verifyBtnText}>Verify</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── Log in link ────────────────────────────────── */}
          <View style={regStyles.switchRow}>
            <Text style={regStyles.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={regStyles.switchLink}>Log in</Text>
            </TouchableOpacity>
          </View>

          <Text style={regStyles.poweredBy}>Powered by CyberClouds</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main registration form (phoneStep === 'done') ──────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colours.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Phone verified badge */}
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedIcon}>✅</Text>
          <Text style={styles.verifiedText}>{phone} verified</Text>
        </View>

        {/* ── Personal Info ──────────────────────────── */}
        <SectionHeader title="Personal Info" />
        <View style={styles.card}>
          <Row>
            <Field label="First Name" error={errors.firstName} flex>
              <TextInput style={[styles.input, errors.firstName && styles.inputError]}
                value={form.firstName} onChangeText={v => set('firstName', v)}
                placeholder="John" placeholderTextColor={colours.textSecondary} returnKeyType="next" />
            </Field>
            <View style={{ width: spacing.sm }} />
            <Field label="Last Name" error={errors.lastName} flex>
              <TextInput style={[styles.input, errors.lastName && styles.inputError]}
                value={form.lastName} onChangeText={v => set('lastName', v)}
                placeholder="Doe" placeholderTextColor={colours.textSecondary} returnKeyType="next" />
            </Field>
          </Row>

          {/* Email + inline verify */}
          <Field label="Email Address" error={errors.email}>
            <View style={styles.emailRow}>
              <TextInput
                style={[styles.input, styles.emailInput, errors.email && styles.inputError,
                        emailVerified && styles.inputVerified]}
                value={form.email}
                onChangeText={v => set('email', v)}
                placeholder="you@example.com"
                placeholderTextColor={colours.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!emailVerified}
              />
              {emailVerified ? (
                <View style={styles.verifiedChip}>
                  <Text style={styles.verifiedChipText}>✓ Verified</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.verifyBtn, emailOtpLoading && styles.btnDisabled]}
                  onPress={handleSendEmailOtp}
                  disabled={emailOtpLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.verifyBtnText}>
                    {emailOtpLoading ? '…' : 'Verify'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Field>
        </View>

        {/* ── Business Info ──────────────────────────── */}
        <SectionHeader title="Business Info  (optional)" />
        <View style={styles.card}>
          <Field label="Company Name" error={errors.company}>
            <TextInput style={[styles.input, errors.company && styles.inputError]}
              value={form.company} onChangeText={v => set('company', v)}
              placeholder="Your business name" placeholderTextColor={colours.textSecondary} />
          </Field>
          <Field label={`EIN Number${form.company.trim() ? ' *' : ''}`} error={errors.ein}>
            <TextInput style={[styles.input, errors.ein && styles.inputError]}
              value={form.ein} onChangeText={v => set('ein', v)}
              placeholder="XX-XXXXXXX" placeholderTextColor={colours.textSecondary}
              keyboardType="numbers-and-punctuation" />
          </Field>
        </View>

        {/* ── Address ────────────────────────────────── */}
        <SectionHeader title="Address" />
        <View style={styles.card}>
          <Field label="Address Line 1" error={errors.address1}>
            <TextInput style={[styles.input, errors.address1 && styles.inputError]}
              value={form.address1} onChangeText={v => set('address1', v)}
              placeholder="Street address" placeholderTextColor={colours.textSecondary} />
          </Field>
          <Field label="Address Line 2  (optional)">
            <TextInput style={styles.input} value={form.address2}
              onChangeText={v => set('address2', v)}
              placeholder="Apt, suite, etc." placeholderTextColor={colours.textSecondary} />
          </Field>
          <Row>
            <Field label="ZIP" error={errors.zip} flex>
              <TextInput style={[styles.input, errors.zip && styles.inputError]}
                value={form.zip} onChangeText={v => set('zip', v)}
                placeholder="12345" placeholderTextColor={colours.textSecondary}
                keyboardType="number-pad" maxLength={10} />
            </Field>
            <View style={{ width: spacing.sm }} />
            <Field label="City" error={errors.city} flex>
              <TextInput style={[styles.input, errors.city && styles.inputError]}
                value={form.city} onChangeText={v => set('city', v)}
                placeholder="Austin" placeholderTextColor={colours.textSecondary} />
            </Field>
          </Row>
          <Field label="State" error={errors.state as string | undefined}>
            <TouchableOpacity
              style={[styles.input, styles.dropdownRow, errors.state && styles.inputError]}
              onPress={() => { setStateSearch(''); setStateModal(true); }} activeOpacity={0.7}>
              <Text style={[styles.dropdownText, !form.state && styles.placeholder]}>
                {form.state ? `${form.state.name} (${form.state.abbr})` : 'Select state'}
              </Text>
              <Text style={styles.dropdownArrow}>▾</Text>
            </TouchableOpacity>
          </Field>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>
            {loading ? 'Creating Account…' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      {/* ── Email OTP Modal ───────────────────────────── */}
      <Modal visible={showEmailOtp} animationType="fade" transparent
        onRequestClose={() => setShowEmailOtp(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Verify Email</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.highlight}>{form.email}</Text>
            </Text>

            <View style={styles.otpRow}>
              {emailOtp.map((digit, i) => (
                <TextInput key={i} ref={ref => { emailInputRefs.current[i] = ref; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit} onChangeText={text => handleEmailOtpChange(text, i)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !emailOtp[i] && i > 0)
                      { emailInputRefs.current[i - 1]?.focus(); }
                  }}
                  keyboardType="number-pad" maxLength={1} selectTextOnFocus textAlign="center" />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, emailOtpLoading && styles.btnDisabled]}
              onPress={() => { const c = emailOtp.join(''); if (c.length === OTP_LENGTH) handleVerifyEmail(c); }}
              disabled={emailOtpLoading} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>
                {emailOtpLoading ? 'Verifying…' : 'Verify Email'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.resendRow, { marginTop: spacing.md }]}>
              {emailCountdown > 0
                ? <Text style={styles.resendWait}>Resend in {emailCountdown}s</Text>
                : <TouchableOpacity onPress={handleResendEmail} disabled={emailResending}>
                    <Text style={styles.resendLink}>{emailResending ? 'Sending…' : 'Resend Code'}</Text>
                  </TouchableOpacity>}
            </View>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEmailOtp(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── State picker modal ────────────────────────── */}
      <Modal visible={stateModal} animationType="slide" transparent
        onRequestClose={() => setStateModal(false)}>
        <View style={styles.stateOverlay}>
          <View style={styles.stateSheet}>
            <View style={styles.stateHeader}>
              <Text style={styles.stateTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModal(false)}>
                <Text style={styles.stateClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.stateSearch}>
              <Text>🔍</Text>
              <TextInput style={styles.stateSearchInput} value={stateSearch}
                onChangeText={setStateSearch} placeholder="Search…"
                placeholderTextColor={colours.textSecondary} autoFocus />
            </View>
            <FlatList data={filteredStates} keyExtractor={item => item.abbr}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.stateRow, form.state?.abbr === item.abbr && styles.stateRowSelected]}
                  onPress={() => { set('state', item); setStateModal(false); }}>
                  <Text style={styles.stateAbbr}>{item.abbr}</Text>
                  <Text style={[styles.stateName, form.state?.abbr === item.abbr && styles.stateNameSelected]}>
                    {item.name}
                  </Text>
                  {form.state?.abbr === item.abbr && <Text style={{ color: colours.primary }}>✓</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colours.border, marginLeft: spacing.base }} />}
              showsVerticalScrollIndicator={false} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ── Small helper components ───────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <Text style={{ fontSize: 13, fontWeight: '700', color: colours.primary,
    marginBottom: 6, marginTop: spacing.md, paddingHorizontal: 2 }}>{title}</Text>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
);
const Field = ({ label, error, children, flex }:
  { label: string; error?: string; children: React.ReactNode; flex?: boolean }) => (
  <View style={[{ marginBottom: spacing.md }, flex ? { flex: 1 } : null]}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: colours.textPrimary, marginBottom: 4 }}>{label}</Text>
    {children}
    {error ? <Text style={{ fontSize: 11, color: colours.error, marginTop: 3 }}>{error}</Text> : null}
  </View>
);

// ── Registration form styles ──────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colours.primary, paddingHorizontal: spacing.base, paddingVertical: spacing.md, paddingTop: spacing.xl },
  backBtn:      { padding: spacing.xs },
  backArrow:    { fontSize: 32, color: colours.white, lineHeight: 36 },
  headerTitle:  { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.white, flex: 1, textAlign: 'center' },
  headerRight:  { width: 32 },
  body:         { flex: 1, padding: spacing.base, alignItems: 'center', paddingTop: spacing.xl },
  scrollContent:{ padding: spacing.base, paddingTop: spacing.md },
  iconCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: colours.primaryLight + '22', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  iconEmoji:    { fontSize: 36 },
  title:        { fontSize: fontSizes.xl, fontWeight: fontWeights.extraBold, color: colours.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle:     { fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  highlight:    { fontWeight: fontWeights.bold, color: colours.primary },
  card:         { backgroundColor: colours.surface, borderRadius: radius.lg, padding: spacing.base, borderWidth: 1, borderColor: colours.border, ...shadows.subtle, marginBottom: spacing.xs },
  inputLabel:   { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.textPrimary, marginBottom: spacing.xs },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countryCode:  { backgroundColor: colours.background, borderWidth: 1, borderColor: colours.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm + 2 },
  countryCodeText: { fontSize: fontSizes.base, color: colours.textPrimary, fontWeight: fontWeights.semiBold },
  phoneInput:   { flex: 1, borderWidth: 1, borderColor: colours.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSizes.base, color: colours.textPrimary, backgroundColor: colours.background },
  input:        { borderWidth: 1, borderColor: colours.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSizes.base, color: colours.textPrimary, backgroundColor: colours.background },
  inputError:   { borderColor: colours.error },
  inputVerified:{ borderColor: colours.success, backgroundColor: colours.success + '08' },
  emailRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emailInput:   { flex: 1 },
  verifyBtn:    { backgroundColor: colours.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  verifyBtnText:{ fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.white },
  verifiedChip: { backgroundColor: colours.success + '18', borderRadius: radius.round, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colours.success },
  verifiedChipText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colours.success },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', backgroundColor: colours.success + '18', borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, alignSelf: 'flex-start', marginBottom: spacing.sm, gap: spacing.xs },
  verifiedIcon: { fontSize: 14 },
  verifiedText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold, color: colours.success },
  dropdownRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: fontSizes.base, color: colours.textPrimary, flex: 1 },
  placeholder:  { color: colours.textSecondary },
  dropdownArrow:{ fontSize: 16, color: colours.textSecondary },
  otpRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  otpBox:       { width: 46, height: 56, borderWidth: 2, borderColor: colours.border, borderRadius: radius.md, fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colours.textPrimary, backgroundColor: colours.surface, textAlign: 'center' },
  otpBoxFilled: { borderColor: colours.primary, backgroundColor: colours.primary + '11' },
  primaryBtn:   { width: '100%', backgroundColor: colours.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center', ...shadows.subtle, marginTop: spacing.md },
  btnDisabled:  { opacity: 0.6 },
  primaryBtnText: { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.white },
  resendRow:    { marginTop: spacing.lg, alignItems: 'center' },
  resendWait:   { fontSize: fontSizes.sm, color: colours.textSecondary },
  resendLink:   { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary },
  // Email OTP modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  modalCard:    { width: '100%', backgroundColor: colours.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', ...shadows.strong },
  modalTitle:   { fontSize: fontSizes.xl, fontWeight: fontWeights.extraBold, color: colours.textPrimary, marginBottom: spacing.sm },
  modalSubtitle:{ fontSize: fontSizes.sm, color: colours.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  modalCancel:  { marginTop: spacing.md, padding: spacing.sm },
  modalCancelText: { fontSize: fontSizes.sm, color: colours.textSecondary },
  // State modal
  stateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  stateSheet:   { backgroundColor: colours.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', paddingBottom: spacing.xxxl },
  stateHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base, borderBottomWidth: 1, borderBottomColor: colours.border },
  stateTitle:   { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colours.textPrimary },
  stateClose:   { fontSize: 18, color: colours.textSecondary, padding: spacing.xs },
  stateSearch:  { flexDirection: 'row', alignItems: 'center', margin: spacing.base, borderWidth: 1, borderColor: colours.border, borderRadius: radius.round, paddingHorizontal: spacing.md, backgroundColor: colours.background, gap: spacing.xs },
  stateSearchInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSizes.base, color: colours.textPrimary },
  stateRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.sm },
  stateRowSelected: { backgroundColor: colours.primary + '11' },
  stateAbbr:    { fontSize: fontSizes.sm, fontWeight: fontWeights.extraBold, color: colours.primary, width: 36 },
  stateName:    { flex: 1, fontSize: fontSizes.base, color: colours.textPrimary },
  stateNameSelected: { fontWeight: fontWeights.bold, color: colours.primary },
});

// ── Phone/OTP step styles (unified sign-up screen) ────────────
const regStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  titleWrap: {
    position: 'absolute', top: height * 0.28, right: spacing.xl, left: 0,
    alignItems: 'flex-end', zIndex: 10,
  },
  screenTitle:  { fontSize: 38, fontWeight: '800', color: '#FFFFFF' },
  scroll:        { flex: 1 },
  scrollContent: {
    paddingTop: height * 0.46, paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl, alignItems: 'center',
  },
  phoneInputWrap: {
    width: '100%', borderWidth: 2, borderColor: colours.primary,
    borderRadius: 50, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF', marginBottom: spacing.sm,
  },
  phoneInput:     { fontSize: fontSizes.base, color: '#374151', width: '100%' },
  sendOtpRow:     { alignSelf: 'flex-end', marginBottom: spacing.lg },
  sendOtpText:    { fontSize: fontSizes.base, fontWeight: fontWeights.semiBold, color: colours.primary },
  sendOtpDisabled:{ color: '#9CA3AF' },
  otpLabel:       { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: '#111827', marginBottom: spacing.md, alignSelf: 'flex-start' },
  otpRow:         { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  otpBox:         { width: 46, height: 54, borderRadius: radius.md, fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: '#1F2937', backgroundColor: '#E8EEF8', textAlign: 'center', borderWidth: 0 },
  otpBoxFilled:   { backgroundColor: '#C7D8F5', color: '#1A3ADB' },
  verifyBtn: {
    width: '65%', borderWidth: 2, borderColor: colours.primary, borderRadius: 50,
    paddingVertical: spacing.md + 2, alignItems: 'center', backgroundColor: '#FFFFFF',
    marginBottom: spacing.xl, shadowColor: colours.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText:  { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: '#1F2937' },
  switchRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  switchText:     { fontSize: fontSizes.base, color: '#6B7280' },
  switchLink:     { fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colours.primary },
  poweredBy:      { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colours.primary, textAlign: 'center' },

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

  // 🔥 makes image feel richer
  transform: [{ scale: 1.05 }], // slight zoom for better crop

  // subtle positioning tweak (optional)
  marginTop: -10, // adjust if needed for your asset
},

});

export default RegisterScreen;