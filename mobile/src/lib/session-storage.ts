import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'project-tracking-session-token';

function getWebStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export const sessionStorage = {
  async get() {
    if (Platform.OS === 'web') {
      return getWebStorage()?.getItem(SESSION_TOKEN_KEY) ?? null;
    }

    return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  },

  async set(token: string) {
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(SESSION_TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  },

  async remove() {
    if (Platform.OS === 'web') {
      getWebStorage()?.removeItem(SESSION_TOKEN_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  },
};
