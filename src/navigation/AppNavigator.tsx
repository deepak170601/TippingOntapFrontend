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
import ActiveEventsScreen       from '../screens/dashboard/ActiveEventsScreen';
import UpcomingEventsScreen     from '../screens/dashboard/UpcomingEventsScreen';
import AllEventsScreen          from '../screens/dashboard/AllEventsScreen';
import TipResultScreen          from '../screens/payment/TipResultScreen';
import StripeTerminalInit       from '../components/StripeTerminalInit';
import { colours }              from '../theme';
import PastEventsScreen from '../screens/dashboard/PastEventsScreen';
import type { Event }           from '../services/api';
import UpcomingEventDetailScreen from '../screens/dashboard/UpcomingEventDetailScreen';

type AuthRootParamList = {
  Auth: undefined;
};

export type RootStackParamList = {
  Main:           undefined;
  ActiveEvent:    { event: Event };
  ActiveEvents:   undefined;
  PastEvents: undefined;
  UpcomingEvents: undefined;
  AllEvents:      undefined;
  TipResult:      { success: boolean; amountCents: number; eventName?: string };
  UpcomingEventDetail: { event: Event };
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AuthRoot = createNativeStackNavigator<AuthRootParamList>();
const MainRoot = createNativeStackNavigator<RootStackParamList>();

const UnauthenticatedNavigator = (): React.JSX.Element => (
  <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
    <AuthRoot.Screen name="Auth" component={AuthNavigator} />
  </AuthRoot.Navigator>
);

const AuthenticatedNavigator = (): React.JSX.Element => (
  <StripeTerminalInit>
    <MainRoot.Navigator screenOptions={{ headerShown: false }}>
      <MainRoot.Screen
        name="Main"
        component={MainNavigator}
      />
      <MainRoot.Screen
        name="ActiveEvent"                                        // ← ADD BACK
        component={ActiveEventScreen}                             // ← ADD BACK
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
        name="TipResult"
        component={TipResultScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <MainRoot.Screen
        name="UpcomingEventDetail"
        component={UpcomingEventDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </MainRoot.Navigator>
  </StripeTerminalInit>
);

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