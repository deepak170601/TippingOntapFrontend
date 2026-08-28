// src/components/StripeOnboardingModal.tsx
//
// Stripe onboarding, rendered inside the app instead of in a browser.
//
// The old flow handed the merchant to connect.stripe.com and hoped they found
// their way back through a deep link. That handoff is a drop-off point: branded
// app, then suddenly a third-party page, then a return trip. This keeps the
// whole thing on-screen, themed with our colours.
//
// One caveat worth knowing before you go looking for a bug: Stripe shows a
// single authenticated screen of its own partway through. That is unavoidable
// on Express accounts — Stripe owns requirement collection there, and the opt
// out (disable_stripe_user_authentication) is only permitted for platforms that
// collect requirements themselves and accept negative-balance liability. It
// carries our name, colour and icon from the Connect dashboard settings.
//
// What this does NOT change is how long verification takes. Identity checks,
// document requests and manual review are identical either way.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  loadConnectAndInitialize,
} from '@stripe/stripe-react-native';
import type { StripeConnectInstance } from '@stripe/stripe-react-native';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
  colours, fontSizes, fontWeights, spacing, radius,
} from '../theme';

// Stripe takes CSS strings, so the numeric theme tokens need a unit.
//
// colorBackground is surface (white), not background (#EEF2FF) — it sits behind
// form fields and overlays, and the tinted page blue reads as grubby there.
const appearance = {
  variables: {
    colorPrimary:    colours.primary,
    colorBackground: colours.surface,
    colorText:       colours.textPrimary,
    colorDanger:     colours.error,
    colorBorder:     colours.border,
    borderRadius:    `${radius.md}px`,
    fontSizeBase:    `${fontSizes.base}px`,
  },
};

type Props = {
  visible: boolean;
  /** Called once the merchant leaves onboarding, after status has been refreshed. */
  onClose: () => void;
};

const StripeOnboardingModal = ({ visible, onClose }: Props): React.JSX.Element | null => {
  const { refreshConnectStatus } = useAuthContext();

  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [failed,   setFailed]   = useState<boolean>(false);
  const [opening,  setOpening]  = useState<boolean>(false);

  // Why it failed, shown in the fallback card. A fallback that only says
  // "could not load" tells whoever is debugging it nothing, and this is a
  // release build with no console attached.
  const [reason,   setReason]   = useState<string | null>(null);

  // The session call returns a client secret alongside the publishable key, and
  // loadConnectAndInitialize only wants the key. Holding the secret for the
  // SDK's first fetchClientSecret call saves minting an AccountSession we would
  // otherwise throw away every time this opens.
  const primed = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) { return; }

    let cancelled = false;

    (async () => {
      try {
        const session = await api.createConnectSession();
        if (cancelled) { return; }

        primed.current = session.clientSecret;

        setInstance(loadConnectAndInitialize({
          publishableKey: session.publishableKey,
          fetchClientSecret: async (): Promise<string> => {
            const cached = primed.current;
            if (cached !== null) {
              primed.current = null;
              return cached;
            }
            // The SDK calls back here on its own when a session expires.
            return (await api.createConnectSession()).clientSecret;
          },
          appearance,
        }));
      } catch (err) {
        if (!cancelled) {
          setReason(err instanceof Error ? `session: ${err.message}` : 'session: unknown error');
          setFailed(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  // Reset when dismissed so the next open starts from a fresh session rather
  // than reusing an instance whose secret has since expired.
  useEffect(() => {
    if (visible) { return; }
    setInstance(null);
    setFailed(false);
    setOpening(false);
    setReason(null);
    primed.current = null;
  }, [visible]);

  // onExit fires whenever the merchant leaves — finished, or backed out halfway.
  // It is not a success signal, so the only correct response is to ask Stripe
  // what actually changed. When charges get switched on, refreshConnectStatus
  // flips canCollectTips and AppNavigator swaps trees by itself; there is
  // nothing for this component to navigate to.
  //
  // onClose runs first so the modal is already unmounting when the status
  // update lands, rather than setting state on a tree that is about to be
  // replaced.
  const handleExit = async (): Promise<void> => {
    onClose();
    await refreshConnectStatus();
  };

  // Stripe may call this more than once for a single failure, so it has to be
  // idempotent — the last reason wins and setFailed(true) twice is harmless.
  //
  // error.type is the useful half: 'render_error' points at the WebView,
  // 'authentication_error' or 'invalid_request_error' at the publishable key or
  // the platform's Connect settings, 'api_connection_error' at the network.
  const handleLoadError = ({ error, elementTagName }: {
    error: { type: string; message?: string };
    elementTagName: string;
  }): void => {
    setReason(
      `${error.type}${error.message ? `: ${error.message}` : ''} [${elementTagName}]`,
    );
    setFailed(true);
  };

  // The browser redirect this component replaced. Still the right answer when
  // the component itself cannot load.
  const handleUseBrowser = async (): Promise<void> => {
    setOpening(true);
    try {
      const { url } = await api.getOnboardingLink();
      await Linking.openURL(url);
      onClose();
    } catch {
      setOpening(false);
    }
  };

  if (!visible) { return null; }

  if (failed) {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.scrim}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continue in your browser</Text>
            <Text style={styles.cardBody}>
              Setup could not load inside the app. You can finish it in your
              browser instead — it is the same form, and your progress is saved
              either way.
            </Text>

            {reason !== null && (
              <Text style={styles.reason} selectable>{reason}</Text>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, opening && styles.btnDisabled]}
              onPress={handleUseBrowser}
              disabled={opening}
              activeOpacity={0.85}
            >
              {opening
                ? <ActivityIndicator color={colours.white} />
                : <Text style={styles.primaryBtnText}>Open Browser</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (instance === null) {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.scrim}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={colours.primary} />
            <Text style={styles.loaderText}>Preparing your setup…</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // ConnectAccountOnboarding presents itself full-screen with its own navigation
  // bar, so it needs neither a navigator route nor a Modal wrapper of ours.
  return (
    <ConnectComponentsProvider connectInstance={instance}>
      <ConnectAccountOnboarding
        title="Set up payouts"
        onExit={handleExit}
        onLoadError={handleLoadError}
      />
    </ConnectComponentsProvider>
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

  loaderCard: {
    backgroundColor:   colours.surface,
    borderRadius:      radius.lg,
    paddingVertical:   spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems:        'center',
  },
  loaderText: {
    marginTop: spacing.md,
    fontSize:  fontSizes.sm,
    color:     colours.textSecondary,
  },

  card: {
    width:           '100%',
    backgroundColor: colours.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
  },
  cardTitle: {
    fontSize:     fontSizes.lg,
    fontWeight:   fontWeights.bold,
    color:        colours.textPrimary,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontSize:     fontSizes.sm,
    color:        colours.textSecondary,
    lineHeight:   20,
    marginBottom: spacing.lg,
  },

  reason: {
    fontSize:        fontSizes.xs,
    color:           colours.error,
    marginBottom:    spacing.lg,
    fontFamily:      'monospace',
  },

  primaryBtn: {
    backgroundColor: colours.primary,
    borderRadius:    radius.round,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  btnDisabled:    { opacity: 0.6 },
  primaryBtnText: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.bold,
    color:      colours.white,
  },

  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  cancelBtnText: {
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.semiBold,
    color:      colours.textSecondary,
  },
});

export default StripeOnboardingModal;
