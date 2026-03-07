// src/navigation/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useAuthContext }       from '../context/AuthContext';
import AuthNavigator            from './AuthNavigator';
import MainNavigator            from './MainNavigator';
import ActiveEventScreen        from '../screens/dashboard/ActiveEventScreen';
import UpcomingEventsScreen     from '../screens/dashboard/UpcomingEventsScreen';
import TipResultScreen          from '../screens/payment/TipResultScreen';
import { colours } from '../theme';
import type { Event } from '../services/api';

// ── Auth stack (unauthenticated) ───────────────────────────────
type AuthRootParamList = {
  Auth: undefined;
};

// ── Main stack (authenticated) ─────────────────────────────────
export type RootStackParamList = {
  Main:           undefined;
  ActiveEvent:    { event: Event };
  UpcomingEvents: undefined;
  TipResult:      { success: boolean; amountCents: number; eventName?: string };
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AuthRoot = createNativeStackNavigator<AuthRootParamList>();
const MainRoot = createNativeStackNavigator<RootStackParamList>();

// ── Unauthenticated navigator ──────────────────────────────────
const UnauthenticatedNavigator = (): React.JSX.Element => (
  <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
    <AuthRoot.Screen name="Auth" component={AuthNavigator} />
  </AuthRoot.Navigator>
);

// ── Authenticated navigator ────────────────────────────────────
const AuthenticatedNavigator = (): React.JSX.Element => (
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
      name="UpcomingEvents"
      component={UpcomingEventsScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <MainRoot.Screen
      name="TipResult"
      component={TipResultScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
  </MainRoot.Navigator>
);

// ── Root ───────────────────────────────────────────────────────
const AppNavigator = (): React.JSX.Element => {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colours.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated
        ? <AuthenticatedNavigator />
        : <UnauthenticatedNavigator />
      }
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