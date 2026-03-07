// src/navigation/AuthNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen  from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

export type AuthStackParamList = {
  Splash: undefined;
  Login:  undefined;
  Signup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator
    screenOptions={{ headerShown: false }}
    initialRouteName="Splash"
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login"  component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;