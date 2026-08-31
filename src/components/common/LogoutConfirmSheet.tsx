// src/components/common/LogoutConfirmSheet.tsx
//
// The sign-out confirmation, owned in one place.
//
// It used to be written twice — once in ProfileScreen, once in SettingsScreen —
// and the two had already drifted: different titles ("Sign Out" vs "Log Out"),
// different button text, and only Settings showed a spinner while the request
// was in flight. Both drew with Alert.alert, which renders in the OS style and
// cannot see the app palette, so the one destructive action a merchant takes
// most deliberately looked like it came from somewhere else.
//
// Wrapping ConfirmSheet rather than re-styling either copy means the wording,
// the busy state and the failure behaviour are decided once. A caller supplies
// visibility and a cancel handler; it does not get to choose the copy, which is
// the point.
import React, { useState } from 'react';
import ConfirmSheet from './ConfirmSheet';
import { useAuthContext } from '../../context/AuthContext';

type Props = {
  visible:  boolean;
  onCancel: () => void;
};

const LogoutConfirmSheet = ({ visible, onCancel }: Props): React.JSX.Element => {
  const { logout } = useAuthContext();
  const [busy, setBusy] = useState<boolean>(false);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    try {
      await logout();
      // No cleanup on success on purpose. logout() flips the auth state and
      // AppNavigator swaps trees, so this component unmounts underneath us —
      // clearing busy here would be a setState on an unmounted component.
    } catch {
      // Staying signed in is the safe failure, so hand the sheet back rather
      // than leaving a dead spinner the merchant cannot dismiss.
      setBusy(false);
      onCancel();
    }
  };

  return (
    <ConfirmSheet
      visible={visible}
      title="Sign Out"
      message="You'll need to sign in again to collect tips."
      confirmLabel="Sign Out"
      cancelLabel="Stay Signed In"
      destructive
      busy={busy}
      onConfirm={handleConfirm}
      onCancel={() => { if (!busy) { onCancel(); } }}
    />
  );
};

export default LogoutConfirmSheet;
