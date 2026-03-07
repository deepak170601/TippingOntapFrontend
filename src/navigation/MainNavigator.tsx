// src/navigation/MainNavigator.tsx
import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

const TabIcon = ({ symbol, color }: { symbol: string; color: string }) => (
  <Text style={{ fontSize: 22, color }}>{symbol}</Text>
);

const CenterTabIcon = ({ focused }: { focused: boolean }) => (
  <View style={[styles.centerFab, focused && styles.centerFabActive]}>
    <Text style={styles.centerFabText}>+</Text>
  </View>
);

const MainNavigator = (): React.JSX.Element => (
  <Tab.Navigator
    screenOptions={{
      headerShown:             false,
      tabBarStyle:             styles.tabBar,
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
        tabBarIcon: ({ color }) => <TabIcon symbol="⌂" color={color} />,
      }}
    />
    <Tab.Screen
      name="Wallet"
      component={WalletScreen}
      options={{
        tabBarLabel: 'Wallet',
        tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} />,
      }}
    />
    <Tab.Screen
      name="CreateEvent"
      component={CreateEventScreen}
      options={{
        tabBarLabel: '',
        tabBarIcon: ({ focused }) => <CenterTabIcon focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarLabel: 'Settings',
        tabBarIcon: ({ color }) => <TabIcon symbol="⚙" color={color} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} />,
      }}
    />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: tabBar.background,
    height:          tabBar.height + (Platform.OS === 'ios' ? 20 : 0),
    paddingBottom:   Platform.OS === 'ios' ? 24 : tabBar.paddingBottom,
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
  centerFabActive: {
    backgroundColor: colours.primaryDark,
  },
  centerFabText: {
    fontSize:    28,
    color:       colours.white,
    fontWeight:  '300',
    lineHeight:  32,
  },
});

export default MainNavigator;