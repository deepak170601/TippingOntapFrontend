// src/components/StripeTerminalInit.tsx
import React, { useEffect } from 'react';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';

interface Props {
  children: React.ReactNode;
}

const StripeTerminalInit = ({ children }: Props): React.JSX.Element => {
  const { initialize } = useStripeTerminal();

  useEffect(() => {
    initialize().then(() => {
      console.log('Stripe Terminal SDK initialized ✓');
    }).catch((err) => {
      console.error('Stripe Terminal init failed:', err);
    });
  }, [initialize]);

  return <>{children}</>;
};

export default StripeTerminalInit;