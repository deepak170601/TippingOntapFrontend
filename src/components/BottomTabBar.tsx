// src/components/BottomTabBar.tsx
// Persistent tab bar shown on all stack screens
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import type { RootNavigationProp } from '../navigation/AppNavigator';
import { colours, tabBar } from '../theme';

interface TabItem {
  label:    string;
  icon:     string;
  screen:   'Home' | 'Wallet' | 'CreateEvent' | 'Settings' | 'Profile';
  isCenter: boolean;
}

const TABS: TabItem[] = [
  { label: 'Home',         icon: 'home',                       screen: 'Home',        isCenter: false },
  { label: 'Wallet',       icon: 'account-balance-wallet',     screen: 'Wallet',      isCenter: false },
  { label: 'Create Event', icon: 'add',                        screen: 'CreateEvent', isCenter: true  },
  { label: 'Settings',     icon: 'settings',                   screen: 'Settings',    isCenter: false },
  { label: 'Profile',      icon: 'person',                     screen: 'Profile',     isCenter: false },
];

const BottomTabBar = (): React.JSX.Element => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets     = useSafeAreaInsets();

  const handlePress = (screen: TabItem['screen']): void => {
    navigation.navigate('Main', {
      screen,
    } as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + 8,
          height:        tabBar.height + insets.bottom,
        },
      ]}
    >
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.screen}
          style={styles.tabItem}
          onPress={() => handlePress(tab.screen)}
          activeOpacity={0.7}
        >
          {tab.isCenter ? (
            <View style={styles.centerFab}>
              <Icon name={tab.icon} size={28} color={colours.white} />
            </View>
          ) : (
            <>
              <Icon name={tab.icon} size={24} color={colours.textSecondary} />
              <Text style={styles.label}>{tab.label}</Text>
            </>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: tabBar.background,
    borderTopWidth:  1,
    borderTopColor:  colours.border,
    elevation:       12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    alignItems:      'center',
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            2,
  },
  label: {
    fontSize:   10,
    fontWeight: '600',
    color:      colours.textSecondary,
    marginTop:  2,
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
});

export default BottomTabBar;