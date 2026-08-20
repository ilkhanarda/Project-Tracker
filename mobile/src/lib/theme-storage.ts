import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'project-tracking-theme-preference';

function getWebStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export const themePreferenceStorage = {
  async get() {
    if (Platform.OS === 'web') {
      return getWebStorage()?.getItem(THEME_PREFERENCE_KEY) ?? null;
    }

    return SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
  },

  async set(preference: ThemePreference) {
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(THEME_PREFERENCE_KEY, preference);
      return;
    }

    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
  },
};
