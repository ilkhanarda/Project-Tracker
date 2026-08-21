import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogOut, X } from 'lucide-react-native';
import { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { useAppTheme } from '@/features/theme/ThemeProvider';
import type { ThemePreference } from '@/lib/theme-storage';

const themeOptions: ThemePreference[] = ['system', 'light', 'dark'];
const initialFor = (value: string) => value.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';

export default function AccountSheetScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { colors, preference: themePreference, setPreference: setThemePreference, theme } = useAppTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const selectedThemeIndex = Math.max(0, themeOptions.indexOf(themePreference));

  useLayoutEffect(() => {
    navigation.setOptions({
      contentStyle: { backgroundColor: colors.surface },
    });
  }, [colors.surface, navigation]);

  async function handleLogout() {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleClose() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    router.replace('/dashboard');
  }

  if (!user) return null;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(20, safeAreaInsets.bottom + 12) },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initialFor(user.displayName)}</Text>
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{user.displayName}</Text>
          <Text numberOfLines={1} style={[styles.email, { color: colors.secondaryText }]}>{user.email}</Text>
        </View>
        <Pressable
          accessibilityLabel="Close account sheet"
          onPress={handleClose}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.cardMuted }, pressed && styles.pressed]}>
          <X color={colors.secondaryText} size={19} />
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>APPEARANCE</Text>
      <SegmentedControl
        accessibilityLabel="Appearance"
        appearance={theme}
        onChange={(event) => {
          const nextPreference = themeOptions[event.nativeEvent.selectedSegmentIndex];
          if (nextPreference) setThemePreference(nextPreference);
        }}
        selectedIndex={selectedThemeIndex}
        style={styles.appearanceControl}
        values={['System', 'Light', 'Dark']}
      />

      <Pressable
        accessibilityLabel="Log out"
        disabled={isLoggingOut}
        onPress={() => void handleLogout()}
        style={({ pressed }) => [styles.logout, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}>
        {isLoggingOut
          ? <ActivityIndicator color={colors.danger} size="small" />
          : <LogOut color={colors.danger} size={20} />}
        <Text style={[styles.logoutText, { color: colors.danger }]}>{isLoggingOut ? 'Logging out...' : 'Log Out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  identity: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    fontWeight: '400',
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    marginBottom: -9,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  appearanceControl: {
    height: 44,
  },
  logout: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
