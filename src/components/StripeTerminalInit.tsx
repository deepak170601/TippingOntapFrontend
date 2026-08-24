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

  // initialize() resolves with { error } rather than rejecting, so a bare
  // .then() reports every failure as a success. It also has to reach the
  // backend — the SDK calls tokenProvider() before it touches native — so
  // a merchant who opens the app with no signal lands here with the SDK
  // dead and nothing to revive it. usePayment re-initializes on demand for
  // exactly that case; this effect only has to report the truth.
  useEffect(() => {
    initialize()
      .then(({ error }) => {
        if (error) {
          console.error('Stripe Terminal init failed:', error.code, error.message);
          return;
        }
        console.log('Stripe Terminal SDK initialized ✓');
      })
      .catch((err) => { console.error('Stripe Terminal init threw:', err); });
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
