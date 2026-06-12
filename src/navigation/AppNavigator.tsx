// src/navigation/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useAuthContext }            from '../context/AuthContext';
import AuthNavigator                 from './AuthNavigator';
import MainNavigator                 from './MainNavigator';
import ActiveEventScreen             from '../screens/dashboard/ActiveEventScreen';
import ActiveEventsScreen            from '../screens/dashboard/ActiveEventsScreen';
import UpcomingEventsScreen          from '../screens/dashboard/UpcomingEventsScreen';
import AllEventsScreen               from '../screens/dashboard/AllEventsScreen';
import TipResultScreen               from '../screens/payment/TipResultScreen';
import StripeTerminalInit            from '../components/StripeTerminalInit';
import PastEventsScreen              from '../screens/dashboard/PastEventsScreen';
import UpcomingEventDetailScreen     from '../screens/dashboard/UpcomingEventDetailScreen';
import OnboardingScreen              from '../screens/dashboard/OnboardingScreen';
import { colours }                   from '../theme';
import type { Event }                from '../services/api';

// ── Param lists ───────────────────────────────────────────────
type AuthRootParamList = {
  Auth: undefined;
};

type OnboardingRootParamList = {
  Onboarding: undefined;
};

export type RootStackParamList = {
  Main:                undefined;
  ActiveEvent:         { event: Event };
  ActiveEvents:        undefined;
  PastEvents:          undefined;
  UpcomingEvents:      undefined;
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

// ── Onboarding gate — authenticated but not yet onboarded ────
// Only shows OnboardingScreen. No back button, no way to skip.
// When updateOnboardingStatus(true) is called from OnboardingScreen,
// user.onboardingComplete flips in AuthContext → AppNavigator
// re-renders automatically → AuthenticatedNavigator mounts.
// No navigate() call needed.
const OnboardingNavigator = (): React.JSX.Element => (
  <OnboardingRoot.Navigator screenOptions={{ headerShown: false }}>
    <OnboardingRoot.Screen name="Onboarding" component={OnboardingScreen} />
  </OnboardingRoot.Navigator>
);

// ── Authenticated — full app ──────────────────────────────────
const AuthenticatedNavigator = (): React.JSX.Element => (
  <StripeTerminalInit>
    <MainRoot.Navigator screenOptions={{ headerShown: false }}>
      <MainRoot.Screen
        name="Main"
        component={MainNavigator}
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
        name="UpcomingEvents"
        component={UpcomingEventsScreen}
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

// ── Root navigator ────────────────────────────────────────────
const AppNavigator = (): React.JSX.Element => {
  const { isAuthenticated, isLoading, user } = useAuthContext();

  const onboardingComplete = user?.onboardingComplete ?? false;

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
      {isAuthenticated && !onboardingComplete && <OnboardingNavigator />}
      {isAuthenticated &&  onboardingComplete && <AuthenticatedNavigator />}
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