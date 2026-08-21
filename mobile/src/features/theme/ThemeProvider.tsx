import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { themeColors, type Colors, type ThemeName } from '@/lib/theme-colors';
import { themePreferenceStorage, type ThemePreference } from '@/lib/theme-storage';

type ThemeContextValue = {
  colors: Colors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  theme: ThemeName;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyNativeColorScheme(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? null : preference);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const preferenceWasChanged = useRef(false);
  const systemTheme: ThemeName = systemColorScheme === 'dark' ? 'dark' : 'light';
  const theme: ThemeName = preference === 'system' ? systemTheme : preference;
  const colors = themeColors[theme];

  useEffect(() => {
    let isMounted = true;

    void themePreferenceStorage.get().then((storedPreference) => {
      if (!isMounted || preferenceWasChanged.current) return;
      if (storedPreference === 'system' || storedPreference === 'light' || storedPreference === 'dark') {
        applyNativeColorScheme(storedPreference);
        setPreferenceState(storedPreference);
      }
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    preferenceWasChanged.current = true;
    applyNativeColorScheme(nextPreference);
    setPreferenceState(nextPreference);
    void themePreferenceStorage.set(nextPreference).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ colors, preference, setPreference, theme }),
    [colors, preference, setPreference, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }

  return context;
}
