// src/navigation/MainNavigator.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import HomeScreen        from '../screens/dashboard/HomeScreen';
import WalletScreen      from '../screens/dashboard/WalletScreen';
import CreateEventScreen from '../screens/dashboard/CreateEventScreen';
import SettingsScreen    from '../screens/dashboard/SettingsScreen';
import ProfileScreen     from '../screens/dashboard/ProfileScreen';
import { tabBar, colours, fontSizes } from '../theme';

export type MainTabParamList = {
  Home:        undefined;
  Wallet:      undefined;
  CreateEvent: undefined;
  Settings:    undefined;
  Profile:     undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const CenterTabIcon = ({ focused }: { focused: boolean }) => (
  <View style={[styles.centerFab, focused && styles.centerFabActive]}>
    <Icon name="add" size={28} color={colours.white} />
  </View>
);

const MainNavigator = (): React.JSX.Element => {
  const insets = useSafeAreaInsets();

  return (
  <Tab.Navigator
    screenOptions={{
      headerShown:             false,
      tabBarStyle:             {
        ...styles.tabBar,
        paddingBottom: insets.bottom + 8,
        height:        tabBar.height + insets.bottom,
      },
      tabBarActiveTintColor:   tabBar.activeColor,
      tabBarInactiveTintColor: tabBar.inactiveColor,
      tabBarLabelStyle:        styles.label,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, size }) => (
          <Icon name="home" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Wallet"
      component={WalletScreen}
      options={{
        tabBarLabel: 'Wallet',
        tabBarIcon: ({ color, size }) => (
          <Icon name="account-balance-wallet" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="CreateEvent"
      component={CreateEventScreen}
      options={{
        tabBarLabel:         '',
        tabBarIcon: ({ focused }) => <CenterTabIcon focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarLabel: 'Settings',
        tabBarIcon: ({ color, size }) => (
          <Icon name="settings" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => (
          <Icon name="person" size={size} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: tabBar.background,
    borderTopWidth:  1,
    borderTopColor:  colours.border,
    elevation:       12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
  },
  label: {
    fontSize:   10,
    fontWeight: '600',
    marginTop:  -2,
  },
  centerFab: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colours.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    20,
    elevation:       6,
    shadowColor:     colours.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
  },
  centerFabActive: { backgroundColor: colours.primaryDark },
});

export default MainNavigator;