// src/hooks/useTopInset.ts
// Returns the status bar height so headers can pad below it.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';

const useTopInset = (): number => {
  const insets = useSafeAreaInsets();

  // Android sometimes reports 0 — fall back to StatusBar.currentHeight
  if (insets.top > 0) { return insets.top; }
  if (Platform.OS === 'android') { return StatusBar.currentHeight ?? 24; }
  return 20;
};

export default useTopInset;