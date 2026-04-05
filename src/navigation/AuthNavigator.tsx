// src/navigation/AuthNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen   from '../screens/auth/SplashScreen';
import LoginScreen    from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

export type AuthStackParamList = {
  Splash:   undefined;
  Login:    undefined;
  Register: { phoneNumber: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash"   component={SplashScreen}   />
    <Stack.Screen name="Login"    component={LoginScreen}    />
    <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
  </Stack.Navigator>
);

export default AuthNavigator;