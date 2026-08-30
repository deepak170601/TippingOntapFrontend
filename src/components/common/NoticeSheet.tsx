// src/components/common/NoticeSheet.tsx
//
// A one-button "here is why you cannot continue" card, in the app's own
// clothes rather than Alert.alert — same reasoning as ConfirmSheet: the OS
// dialog draws in its own style and cannot see the palette.
//
// Closes itself after AUTO_CLOSE_MS if nobody touches it. Both places this is
// used are told-not-asked moments — "that number is not registered", "that
// number is already taken" — there is nothing to decide, so leaving it on
// screen forever would only be blocking a customer's card behind a dialog
// nobody needs to act on.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
} from 'react-native';
import {
  colours, fontSizes, fontWeights, spacing, radius, shadows,
} from '../../theme';

const AUTO_CLOSE_MS = 10000;

type Props = {
  visible:      boolean;
  title:        string;
  message:      string;
  /** Defaults to "OK". */
  actionLabel?: string;
  onClose:      () => void;
};

const NoticeSheet = ({
  visible, title, message, actionLabel = 'OK', onClose,
}: Props): React.JSX.Element => {
  // Latest onClose in a ref rather than a plain effect dependency. A caller
  // that does not memoize its onClose (most will not) would otherwise hand
  // this a new function every render, restarting the 10-second timer on
  // every parent re-render and leaving it never actually firing while
  // anything else on screen is updating state.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!visible) { return; }
    const timer = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeX}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeXText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>!</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity style={styles.action} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
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
  card: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.xxl,
    padding:         spacing.xxl,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colours.borderBlue,
    ...shadows.strong,
  },
  closeX: {
    position: 'absolute',
    top:      spacing.md,
    right:    spacing.md,
    zIndex:   1,
  },
  closeXText: {
    fontSize:   fontSizes.base,
    color:      colours.textSecondary,
    fontWeight: fontWeights.bold,
  },
  badge: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colours.warning,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.md,
  },
  badgeIcon: {
    fontSize:   fontSizes.xl,
    fontWeight: fontWeights.extraBold,
    color:      colours.white,
  },
  title: {
    fontSize:     fontSizes.lg,
    fontWeight:   fontWeights.extraBold,
    color:        colours.textPrimary,
    textAlign:    'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize:     fontSizes.sm,
    color:        colours.textSecondary,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: spacing.xl,
  },
  action: {
    width:           '100%',
    backgroundColor: colours.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    ...shadows.blue,
  },
  actionText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },
});

export default NoticeSheet;
