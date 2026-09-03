// src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useAuthContext }            from '../context/AuthContext';
import AuthNavigator                 from './AuthNavigator';
import MainNavigator                 from './MainNavigator';
import type { MainTabParamList }     from './MainNavigator';
import ActiveEventScreen             from '../screens/dashboard/ActiveEventScreen';
import TipCollectionScreen           from '../screens/dashboard/TipCollectionScreen';
import ActiveEventsScreen            from '../screens/dashboard/ActiveEventsScreen';
import AllEventsScreen               from '../screens/dashboard/AllEventsScreen';
import TipResultScreen               from '../screens/payment/TipResultScreen';
import StripeTerminalInit            from '../components/StripeTerminalInit';
import PastEventsScreen              from '../screens/dashboard/PastEventsScreen';
import UpcomingEventDetailScreen     from '../screens/dashboard/UpcomingEventDetailScreen';
import OnboardingScreen              from '../screens/dashboard/OnboardingScreen';
import { colours }                   from '../theme';
import { requestNotificationPermission } from '../services/notifications';
import type { Event }                from '../services/api';

// ── Param lists ───────────────────────────────────────────────
type AuthRootParamList = {
  Auth: undefined;
};

type OnboardingRootParamList = {
  Onboarding: undefined;
};

export type RootStackParamList = {
  // Typed as the tab param list rather than undefined so callers can jump
  // straight to a tab — navigate('Main', { screen: 'Upcoming' }). Upcoming
  // used to be its own stack screen; now that it is a tab, this is the only
  // way to reach it from a screen sitting above the tab navigator.
  Main:                NavigatorScreenParams<MainTabParamList> | undefined;
  // TipCollection is where a running event is opened from. ActiveEvent stays
  // registered — it is the merchant-facing view of the same event, with the
  // running totals and the earnings breakdown, and nothing about it changed.
  TipCollection:       { event: Event };
  ActiveEvent:         { event: Event };
  ActiveEvents:        undefined;
  PastEvents:          undefined;
  AllEvents:           undefined;
  UpcomingEventDetail: { event: Event };
  TipResult:           { success: boolean; amountCents: number; eventName?: string };
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ── Navigators ────────────────────────────────────────────────
const AuthRoot        = createNativeStackNavigator<AuthRootParamList>();
const OnboardingRoot  = createNativeStackNavigator<OnboardingRootParamList>();
const MainRoot        = createNativeStackNavigator<RootStackParamList>();

// ── Unauthenticated — auth flow only ─────────────────────────
const UnauthenticatedNavigator = (): React.JSX.Element => (
  <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
    <AuthRoot.Screen name="Auth" component={AuthNavigator} />
  </AuthRoot.Navigator>
);

// ── Onboarding gate — cannot take a card yet ─────────────────
// Only shows OnboardingScreen. No back button, no way to skip.
// When refreshConnectStatus() sees charges enabled — from the deep link back
// out of Stripe, from "Check My Status", or from the app returning to the
// foreground — canCollectTips flips in AuthContext → AppNavigator re-renders
// automatically → AuthenticatedNavigator mounts. No navigate() call needed.
const OnboardingNavigator = (): React.JSX.Element => (
  <OnboardingRoot.Navigator screenOptions={{ headerShown: false }}>
    <OnboardingRoot.Screen name="Onboarding" component={OnboardingScreen} />
  </OnboardingRoot.Navigator>
);

// ── Authenticated — full app ──────────────────────────────────
const AuthenticatedNavigator = (): React.JSX.Element => {
  return (
  <StripeTerminalInit>
    <MainRoot.Navigator screenOptions={{ headerShown: false }}>
      <MainRoot.Screen
        name="Main"
        component={MainNavigator}
      />
      <MainRoot.Screen
        name="TipCollection"
        component={TipCollectionScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="ActiveEvent"
        component={ActiveEventScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="ActiveEvents"
        component={ActiveEventsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="PastEvents"
        component={PastEventsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="AllEvents"
        component={AllEventsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="UpcomingEventDetail"
        component={UpcomingEventDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MainRoot.Screen
        name="TipResult"
        component={TipResultScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </MainRoot.Navigator>
  </StripeTerminalInit>
  );
};

// ── Root navigator ────────────────────────────────────────────
const AppNavigator = (): React.JSX.Element => {
  const { isAuthenticated, isLoading, canCollectTips } = useAuthContext();

  // Notification permission is asked once, as soon as a signed-in merchant
  // reaches the app — not mid-task, and no longer only after Stripe clears
  // them. It used to live in AuthenticatedNavigator, which never mounts for a
  // merchant stuck on the onboarding gate, so the people most likely to need
  // a reminder that setup is unfinished were the ones never asked.
  //
  // It used to be requested straight after an event was created, which put
  // Android's system permission dialog on screen a frame before the app's own
  // "event created" dialog. Two dialog windows in the same beat, and the
  // second one's buttons stopped responding.
  //
  // requestPermission only shows a dialog the first time; every later call
  // resolves from the stored answer, so running this on each launch is free.
  // Not awaited and cannot throw — nothing here depends on the answer.
  useEffect(() => {
    if (isAuthenticated) { requestNotificationPermission(); }
  }, [isAuthenticated]);

  // Gated on canCollectTips, NOT onboardingComplete.
  //
  // onboardingComplete is charges_enabled AND payouts_enabled. Stripe turns
  // charges on as soon as identity clears, and payouts on later once the bank
  // account is verified separately — so gating the whole app on both left a
  // merchant Stripe was willing to let trade stuck on the onboarding screen,
  // sometimes for days, while customers stood there waiting to tip.
  //
  // ActiveEventScreen already checked chargesEnabled before starting a payment.
  // That check was right; it was simply unreachable, because nobody got past
  // this component to run it.
  //
  // "Can collect, cannot withdraw" is a normal middle state rather than a
  // broken one, and is handled inside the app by PayoutSetupBanner instead of
  // by keeping the merchant out.

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated && <UnauthenticatedNavigator />}
      {isAuthenticated && !canCollectTips && <OnboardingNavigator />}
      {isAuthenticated &&  canCollectTips && <AuthenticatedNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colours.background,
  },
});

export default AppNavigator;