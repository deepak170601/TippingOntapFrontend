// App.tsx
import React, { useEffect, useState } from 'react';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import {
  StripeTerminalProvider,
  requestNeededAndroidPermissions,
} from '@stripe/stripe-terminal-react-native';
import { AuthProvider }         from './src/context/AuthContext';
import AppNavigator             from './src/navigation/AppNavigator';
import { fetchConnectionToken } from './src/services/stripe';
import DeepLinkHandler from './src/components/DeepLinkHandler';

type PermissionStatus = 'loading' | 'granted' | 'denied';

export default function App(): React.JSX.Element {
  const [permStatus, setPermStatus] = useState<PermissionStatus>('loading');

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async (): Promise<void> => {
    try {
      const granted = await requestNeededAndroidPermissions({
        accessFineLocation: {
          title:          'Location Permission',
          message:        'Stripe Terminal needs access to your location to find payment readers.',
          buttonPositive: 'Accept',
        },
      });
      setPermStatus(granted ? 'granted' : 'denied');
    } catch (e) {
      console.error('Permission request error:', e);
      setPermStatus('denied');
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (permStatus === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A3ADB" />
          <Text style={styles.loadingText}>Requesting permissions…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Denied ─────────────────────────────────────────────────
  if (permStatus === 'denied') {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <Text style={styles.deniedEmoji}>📍</Text>
          <Text style={styles.deniedTitle}>Permissions Required</Text>
          <Text style={styles.deniedMsg}>
            Bluetooth and Location access are required for Tap to Pay.
            Please allow them to continue.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={requestPermissions}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  // ── Granted ────────────────────────────────────────────────
  // AuthProvider is OUTSIDE StripeTerminalProvider so auth token
  // exists before fetchConnectionToken is ever called
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeepLinkHandler />
        <StripeTerminalProvider
          logLevel="verbose"
          tokenProvider={fetchConnectionToken}
        >
          <AppNavigator />
        </StripeTerminalProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop:  16,
    fontSize:   14,
    color:      '#6B7280',
  },
  deniedEmoji: {
    fontSize:     48,
    marginBottom: 16,
  },
  deniedTitle: {
    fontSize:     20,
    fontWeight:   '700',
    color:        '#0F1F5C',
    marginBottom: 12,
    textAlign:    'center',
  },
  deniedMsg: {
    fontSize:     14,
    color:        '#6B7280',
    textAlign:    'center',
    lineHeight:   22,
    marginBottom: 32,
  },
  retryBtn: {
    backgroundColor: '#1A3ADB',
    borderRadius:    999,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  retryText: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
});