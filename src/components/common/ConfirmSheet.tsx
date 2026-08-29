// src/components/common/ConfirmSheet.tsx
//
// A yes/no question in the app's own clothes.
//
// Alert.alert draws in the OS style and cannot see the palette, so every
// confirmation looked like it belonged to a different application than the one
// asking it. This is the same card the create-event sheet and the tip overlay
// use, so a destructive prompt reads as part of the app rather than an
// interruption from Android.
//
// Destructive actions get a red confirm and the cancel sits underneath as the
// quieter option — the safe choice should never be the one that takes effort to
// find.
import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import {
  colours, fontSizes, fontWeights, spacing, radius, shadows,
} from '../../theme';

type Props = {
  visible:      boolean;
  title:        string;
  message:      string;

  /** Defaults to "Yes". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?:  string;

  /** Red confirm button, for anything that cannot be undone. */
  destructive?:  boolean;

  /** Spinner on the confirm button; also blocks both buttons. */
  busy?:         boolean;

  onConfirm:    () => void;
  onCancel:     () => void;
};

const ConfirmSheet = ({
  visible, title, message,
  confirmLabel = 'Yes',
  cancelLabel  = 'Cancel',
  destructive  = false,
  busy         = false,
  onConfirm, onCancel,
}: Props): React.JSX.Element => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    // Android back dismisses, but never mid-action — that would leave the
    // caller's busy state stranded with no way back.
    onRequestClose={() => { if (!busy) { onCancel(); } }}
  >
    <View style={styles.scrim}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <TouchableOpacity
          style={[
            styles.confirm,
            destructive && styles.confirmDestructive,
            busy && styles.disabled,
          ]}
          onPress={onConfirm}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={colours.white} />
            : <Text style={styles.confirmText}>{confirmLabel}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancel, busy && styles.disabled]}
          onPress={onCancel}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: {
    flex:              1,
    backgroundColor:   colours.overlay,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
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
  confirm: {
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    ...shadows.blue,
  },
  confirmDestructive: {
    backgroundColor: colours.error,
    shadowColor:     colours.error,
  },
  confirmText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
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

export default ConfirmSheet;
