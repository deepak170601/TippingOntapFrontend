// src/components/common/ContactSupportSheet.tsx
//
// The "having trouble signing up?" escape hatch, shown over the Stripe
// onboarding gate — the one screen a merchant can be stuck on with no way
// forward and no way into the app.
//
// Two choices, and neither reveals a number. The merchant asks to be called
// or emailed and support reaches out to them; the support line is not printed
// here. That is a deliberate product decision, not an oversight: a number on
// this screen is a number in every screenshot of it.
//
// Styled as the same card as ConfirmSheet and LogoutConfirmSheet rather than
// Alert.alert, so the last thing a stuck merchant sees still looks like the
// app they are trying to join.
import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import { requestSupport, SUPPORT_IS_MOCKED } from '../../services/support';
import type { SupportChannel, SupportRequest } from '../../services/support';
import {
  colours, fontSizes, fontWeights, spacing, radius, shadows,
} from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Where the merchant was when they asked. Reaches support with the request. */
  context?: string;
};

type Phase = 'choosing' | 'sending' | 'sent' | 'failed';

const PayloadRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.payloadRow}>
    <Text style={styles.payloadLabel}>{label}</Text>
    <Text style={styles.payloadValue} selectable>{value}</Text>
  </View>
);

const ContactSupportSheet = ({
  visible, onClose, context,
}: Props): React.JSX.Element => {
  const { user } = useAuthContext();
  const [phase, setPhase] = useState<Phase>('choosing');
  const [chosen, setChosen] = useState<SupportChannel | null>(null);

  // The exact payload that went to support, kept so it can be shown. While the
  // transport is mocked this is the only way to see what support will actually
  // receive; it is also the thing to read back over the phone if a request
  // seems to have gone missing.
  const [sent, setSent] = useState<SupportRequest | null>(null);

  const handleChoose = async (channel: SupportChannel): Promise<void> => {
    setChosen(channel);
    setPhase('sending');
    try {
      setSent(await requestSupport(channel, user, context));
      setPhase('sent');
    } catch {
      // Never report success on a failure — a merchant who believes help is
      // coming stops looking for another way through.
      setPhase('failed');
    }
  };

  // Reset on the way out so reopening starts at the choice again rather than
  // on a stale confirmation from last time.
  const handleClose = (): void => {
    if (phase === 'sending') { return; }
    setPhase('choosing');
    setChosen(null);
    setSent(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.scrim}>
        {/* Scrolls: with the payload shown, the card can outgrow a small
            screen, and the Close button must never be the thing off the
            bottom edge. */}
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.card}
          showsVerticalScrollIndicator={false}
        >

          {phase === 'choosing' && (
            <>
              <Text style={styles.title}>Contact Us</Text>
              <Text style={styles.message}>
                Tell us how to reach you and someone from our team will get in
                touch to help you finish setting up.
              </Text>

              <TouchableOpacity
                style={styles.option}
                onPress={() => handleChoose('email')}
                activeOpacity={0.85}
              >
                <Text style={styles.optionIcon}>✉️</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Contact me by email</Text>
                  <Text style={styles.optionSub}>
                    {user?.email ?? 'The address on your account'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={() => handleChoose('phone')}
                activeOpacity={0.85}
              >
                <Text style={styles.optionIcon}>📞</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Contact me by phone</Text>
                  {/* The merchant's own number, not a support line. Support
                      calls them; there is no number here to dial. */}
                  <Text style={styles.optionSub}>
                    We'll call the number on your account
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {phase === 'sending' && (
            <View style={styles.centred}>
              <ActivityIndicator size="large" color={colours.primary} />
              <Text style={styles.sendingText}>Sending your request…</Text>
            </View>
          )}

          {phase === 'sent' && (
            <>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.title}>We've got it</Text>
              <Text style={styles.message}>
                {chosen === 'phone'
                  ? 'Someone will call you on the number registered to your account.'
                  : 'Someone will email you at the address registered to your account.'}
              </Text>
              {SUPPORT_IS_MOCKED && (
                // Visible on purpose while the transport is mocked. A test
                // build that says "we've got it" and sends nothing is how a
                // real merchant ends up waiting for a call that never comes.
                <Text style={styles.mockNote}>
                  Test build — no message was actually sent yet.
                </Text>
              )}

              {/* The payload itself. Shown because it is the only way to see
                  what support receives while the transport is mocked, and it
                  stays useful afterwards as something a merchant can read back
                  if a request appears to have gone missing. Selectable so it
                  can be copied out of a test build. */}
              {sent !== null && (
                <View style={styles.payload}>
                  <Text style={styles.payloadTitle}>What we're sending</Text>
                  <PayloadRow label="Contact by" value={sent.channel} />
                  <PayloadRow label="Name"       value={sent.name} />
                  <PayloadRow label="Email"      value={sent.email} />
                  <PayloadRow label="Phone"      value={sent.phoneNumber} />
                  <PayloadRow label="Device"     value={sent.device} />
                  <PayloadRow label="Screen"     value={sent.context} />
                  <PayloadRow label="Sent"       value={sent.sentAt} />
                </View>
              )}
            </>
          )}

          {phase === 'failed' && (
            <>
              <Text style={styles.successIcon}>⚠️</Text>
              <Text style={styles.title}>Could not send</Text>
              <Text style={styles.message}>
                Something went wrong sending your request. Please check your
                connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retry}
                onPress={() => setPhase('choosing')}
                activeOpacity={0.85}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.cancel, phase === 'sending' && styles.disabled]}
            onPress={handleClose}
            disabled={phase === 'sending'}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>
              {phase === 'sent' ? 'Done' : 'Close'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex:              1,
    backgroundColor:   colours.overlay,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  cardScroll: {
    width:     '100%',
    flexGrow:  0,
    maxHeight: '85%',
  },
  card: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.xxl,
    padding:         spacing.xxl,
    borderWidth:     1,
    borderColor:     colours.borderBlue,
    ...shadows.strong,
  },
  title: {
    fontSize:     fontSizes.xl,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    marginBottom: spacing.sm,
    textAlign:    'center',
  },
  message: {
    fontSize:     fontSizes.sm,
    color:        colours.textSecondary,
    lineHeight:   20,
    textAlign:    'center',
    marginBottom: spacing.xl,
  },

  option: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colours.background,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colours.borderBlue,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
  },
  optionIcon:  { fontSize: 24, marginRight: spacing.md },
  optionText:  { flex: 1 },
  optionLabel: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.textPrimary,
  },
  optionSub: {
    fontSize:  fontSizes.xs,
    color:     colours.textSecondary,
    marginTop: 2,
  },

  centred:     { alignItems: 'center', paddingVertical: spacing.xl },
  sendingText: {
    marginTop: spacing.md,
    fontSize:  fontSizes.sm,
    color:     colours.textSecondary,
  },

  successIcon:  { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  mockNote: {
    fontSize:     fontSizes.xs,
    color:        colours.warning,
    textAlign:    'center',
    marginBottom: spacing.md,
    fontWeight:   fontWeights.semiBold,
  },

  retry: {
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    ...shadows.blue,
  },
  retryText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  payload: {
    backgroundColor:   colours.background,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colours.borderBlue,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom:      spacing.md,
  },
  payloadTitle: {
    fontSize:     fontSizes.xs,
    fontWeight:   fontWeights.bold,
    color:        colours.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  payloadRow: { flexDirection: 'row', marginBottom: 3 },
  payloadLabel: {
    width:    82,
    fontSize: fontSizes.xs,
    color:    colours.textSecondary,
  },
  payloadValue: {
    flex:     1,
    fontSize: fontSizes.xs,
    color:    colours.textPrimary,
  },

  cancel: {
    paddingVertical: spacing.md,
    marginTop:       spacing.xs,
    alignItems:      'center',
  },
  cancelText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.semiBold,
    color:      colours.textSecondary,
  },
  disabled: { opacity: 0.6 },
});

export default ContactSupportSheet;
