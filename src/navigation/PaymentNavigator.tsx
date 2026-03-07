// src/navigation/PaymentNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AmountScreen from '../screens/payment/AmountScreen';
import TapScreen    from '../screens/payment/TapScreen';
import ResultScreen from '../screens/payment/ResultScreen';
import type { Event } from '../services/api';

export type PaymentStackParamList = {
  Amount: { event: Event };
  Tap:    { amountCents: number; event: Event };
  Result: { success: boolean; amountCents: number; errorMessage?: string };
};

const Stack = createNativeStackNavigator<PaymentStackParamList>();

const PaymentNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Amount" component={AmountScreen} />
    <Stack.Screen name="Tap"    component={TapScreen} />
    <Stack.Screen name="Result" component={ResultScreen} />
  </Stack.Navigator>
);

export default PaymentNavigator;