// src/components/DeepLinkHandler.tsx
// Renders nothing — handles deep links that require AuthContext access.
// Must be mounted INSIDE AuthProvider.
import { useEffect } from 'react';
import { Linking }   from 'react-native';
import { useAuthContext } from '../context/AuthContext';

const DeepLinkHandler = (): null => {
  const { refreshConnectStatus } = useAuthContext();

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }): Promise<void> => {

      // ── Professional returned from Stripe onboarding ───────
      if (url.includes('connect/return')) {
        // refreshConnectStatus writes canCollectTips into AuthContext →
        // AppNavigator re-renders → AuthenticatedNavigator mounts. No
        // navigate() call needed, and no branching needed here either.
        //
        // This used to check onboardingComplete and only then let the merchant
        // in, which is the wrong moment: they land back here the instant Stripe
        // verifies their identity, which is exactly when charges switch on and
        // typically well before payouts do. Waiting for both bounced them
        // straight back to the onboarding screen at the moment they had in fact
        // become able to earn.
        //
        // Failure is silent by design — the merchant can still tap "Check My
        // Status" on the onboarding screen.
        await refreshConnectStatus();
        return;
      }

      // ── AccountLink expired — Stripe sends here ────────────
      if (url.includes('connect/refresh')) {
        // canCollectTips is still false → OnboardingScreen still showing.
        // "Complete Setup" will request a fresh link automatically.
        // No action needed.
      }
    };

    // Foreground — app already open when deep link fires
    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start — app was closed when deep link fired
    Linking.getInitialURL().then(url => {
      if (url) { handleUrl({ url }); }
    });

    return () => subscription.remove();
  }, [refreshConnectStatus]);

  return null;
};

export default DeepLinkHandler;