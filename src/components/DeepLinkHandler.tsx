// src/components/DeepLinkHandler.tsx
// Renders nothing — handles deep links that require AuthContext access.
// Must be mounted INSIDE AuthProvider.
import { useEffect } from 'react';
import { Linking }   from 'react-native';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';

const DeepLinkHandler = (): null => {
  const { updateOnboardingStatus } = useAuthContext();

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }): Promise<void> => {

      // ── Professional returned from Stripe onboarding ───────
      if (url.includes('connect/return')) {
        try {
          const status = await api.getConnectStatus();
          if (status.onboardingComplete) {
            // Flips user.onboardingComplete in AuthContext →
            // AppNavigator re-renders → AuthenticatedNavigator mounts.
            // No navigate() call needed.
            updateOnboardingStatus(true);
          }
          // If not complete: OnboardingScreen stays visible.
          // User can tap "Check My Status" for a status message.
        } catch {
          // Silent fail — user manually checks on OnboardingScreen.
        }
        return;
      }

      // ── AccountLink expired — Stripe sends here ────────────
      if (url.includes('connect/refresh')) {
        // onboardingComplete is still false → OnboardingScreen still showing.
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
  }, [updateOnboardingStatus]);

  return null;
};

export default DeepLinkHandler;