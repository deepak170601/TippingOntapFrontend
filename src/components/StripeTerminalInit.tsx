// src/components/StripeTerminalInit.tsx
import React, { useEffect, useRef } from 'react';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';

interface Props {
  children: React.ReactNode;
}

// Wraps the authenticated tree only, so it mounts on login and unmounts
// on logout / session expiry. Android permissions are already requested
// in App.tsx before this ever renders.
const StripeTerminalInit = ({ children }: Props): React.JSX.Element => {
  const { initialize, disconnectReader, clearCachedCredentials } = useStripeTerminal();

  useEffect(() => {
    initialize()
      .then(() => { console.log('Stripe Terminal SDK initialized ✓'); })
      .catch((err) => { console.error('Stripe Terminal init failed:', err); });
  }, [initialize]);

  // Connection tokens are minted per connected account, so a cached token
  // or connected reader belongs to the merchant who just logged out. If it
  // survives into the next session, tips get taken against the wrong
  // account. Purge on unmount — kept in a ref so the cleanup runs only
  // then, not whenever the SDK re-renders.
  const purgeRef = useRef({ disconnectReader, clearCachedCredentials });
  purgeRef.current = { disconnectReader, clearCachedCredentials };

  useEffect(() => () => {
    const { disconnectReader: disconnect, clearCachedCredentials: clear } = purgeRef.current;
    disconnect().catch(() => { /* no reader connected */ });
    clear().catch(() => { /* nothing cached */ });
  }, []);

  return <>{children}</>;
};

export default StripeTerminalInit;
