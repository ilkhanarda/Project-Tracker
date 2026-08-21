import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../AuthProvider';

type AuthMode = 'login' | 'register';
type FieldName = 'displayName' | 'email' | 'password' | 'confirmPassword';

type AuthPageProps = {
  mode: AuthMode;
};

type GlassSurfaceProps = {
  children: ReactNode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
};

const canRenderNativeGlass =
  Platform.OS === 'ios' &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

function GlassSurface({
  children,
  interactive = false,
  style,
  tintColor = 'rgba(255, 255, 255, 0.22)',
}: GlassSurfaceProps) {
  if (canRenderNativeGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={style}
        tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  return <View style={[styles.glassFallback, style]}>{children}</View>;
}

type FieldIconProps = {
  icon: LucideIcon;
};

function FieldIcon({ icon: Icon }: FieldIconProps) {
  return (
    <View style={styles.fieldIconContainer}>
      <Icon
        color="#3C3C43"
        size={17}
        strokeWidth={2.2}
      />
    </View>
  );
}

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiredFieldsAreFilled = isRegister
    ? displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0
    : email.trim().length > 0 && password.length > 0;
  const canSubmit = requiredFieldsAreFilled && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await login({ email: email.trim(), password });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function fieldTint(field: FieldName) {
    return focusedField === field
      ? 'rgba(255, 255, 255, 0.42)'
      : 'rgba(255, 255, 255, 0.24)';
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View pointerEvents="none" style={styles.wallpaper}>
        <View style={[styles.colorShape, styles.blueShape]} />
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={80}
          style={StyleSheet.absoluteFill}
          tint="light"
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            directionalLockEnabled
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {isRegister ? 'Create your account' : 'Welcome back'}
                </Text>
                <Text style={styles.subtitle}>
                  {isRegister
                    ? 'Create an account to start using the application.'
                    : 'Sign in to continue to your dashboard.'}
                </Text>
              </View>

              <GlassSurface style={styles.formCard} tintColor="rgba(255, 255, 255, 0.26)">
                <View style={styles.topReflection} />

                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Display name</Text>
                    <GlassSurface
                      style={[
                        styles.inputSurface,
                        focusedField === 'displayName' && styles.inputSurfaceFocused,
                      ]}
                      tintColor={fieldTint('displayName')}>
                      <FieldIcon icon={UserRound} />
                      <TextInput
                        autoCapitalize="words"
                        autoComplete="name"
                        autoCorrect={false}
                        maxLength={50}
                        onBlur={() => setFocusedField(null)}
                        onChangeText={setDisplayName}
                        onFocus={() => setFocusedField('displayName')}
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                        placeholder="Enter your name"
                        placeholderTextColor="rgba(60, 60, 67, 0.48)"
                        returnKeyType="next"
                        style={styles.input}
                        textContentType="name"
                        value={displayName}
                      />
                    </GlassSurface>
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email address</Text>
                  <GlassSurface
                    style={[
                      styles.inputSurface,
                      focusedField === 'email' && styles.inputSurfaceFocused,
                    ]}
                    tintColor={fieldTint('email')}>
                    <FieldIcon icon={Mail} />
                    <TextInput
                      ref={emailInputRef}
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      inputMode="email"
                      keyboardType="email-address"
                      maxLength={254}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      placeholder="Enter your email"
                      placeholderTextColor="rgba(60, 60, 67, 0.48)"
                      returnKeyType="next"
                      style={styles.input}
                      textContentType="emailAddress"
                      value={email}
                    />
                  </GlassSurface>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <GlassSurface
                    style={[
                      styles.inputSurface,
                      focusedField === 'password' && styles.inputSurfaceFocused,
                    ]}
                    tintColor={fieldTint('password')}>
                    <FieldIcon icon={LockKeyhole} />
                    <TextInput
                      ref={passwordInputRef}
                      autoCapitalize="none"
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      autoCorrect={false}
                      maxLength={128}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onSubmitEditing={() => {
                        if (isRegister) {
                          confirmPasswordInputRef.current?.focus();
                        } else {
                          void handleSubmit();
                        }
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor="rgba(60, 60, 67, 0.48)"
                      returnKeyType={isRegister ? 'next' : 'done'}
                      secureTextEntry={!showPassword}
                      style={styles.input}
                      textContentType={isRegister ? 'newPassword' : 'password'}
                      value={password}
                    />
                    <Pressable
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setShowPassword((current) => !current)}
                      style={({ pressed }) => [
                        styles.visibilityButton,
                        pressed && styles.controlPressed,
                      ]}>
                      {showPassword ? (
                        <EyeOff color="#007AFF" size={18} strokeWidth={2.2} />
                      ) : (
                        <Eye color="#007AFF" size={18} strokeWidth={2.2} />
                      )}
                    </Pressable>
                  </GlassSurface>
                </View>

                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm password</Text>
                    <GlassSurface
                      style={[
                        styles.inputSurface,
                        focusedField === 'confirmPassword' && styles.inputSurfaceFocused,
                      ]}
                      tintColor={fieldTint('confirmPassword')}>
                      <FieldIcon icon={LockKeyhole} />
                      <TextInput
                        ref={confirmPasswordInputRef}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        autoCorrect={false}
                        maxLength={128}
                        onBlur={() => setFocusedField(null)}
                        onChangeText={setConfirmPassword}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onSubmitEditing={() => void handleSubmit()}
                        placeholder="Enter your password again"
                        placeholderTextColor="rgba(60, 60, 67, 0.48)"
                        returnKeyType="done"
                        secureTextEntry={!showPassword}
                        style={styles.input}
                        textContentType="newPassword"
                        value={confirmPassword}
                      />
                    </GlassSurface>
                  </View>
                )}

                {error && (
                  <View accessibilityLiveRegion="polite" style={styles.errorMessage}>
                    <CircleAlert
                      color="#FF3B30"
                      size={18}
                      strokeWidth={2.3}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={!canSubmit}
                  onPress={() => void handleSubmit()}
                  style={({ pressed }) => [
                    styles.submitPressable,
                    pressed && canSubmit && styles.submitPressed,
                  ]}>
                  <GlassSurface
                    interactive
                    style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                    tintColor={canSubmit ? 'rgba(0, 122, 255, 0.80)' : 'rgba(120, 120, 128, 0.25)'}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.submitText}>
                          {isRegister ? 'Create account' : 'Sign in'}
                        </Text>
                        <ArrowRight
                          color="#FFFFFF"
                          size={17}
                          strokeWidth={2.6}
                        />
                      </>
                    )}
                  </GlassSurface>
                </Pressable>
              </GlassSurface>

              <GlassSurface style={styles.switcher} tintColor="rgba(255, 255, 255, 0.25)">
                <Text style={styles.switcherText}>
                  {isRegister ? 'Already have an account?' : 'Need an account?'}
                </Text>
                <Link href={isRegister ? '/' : '/register'} asChild>
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    style={({ pressed }) => pressed && styles.controlPressed}>
                    <Text style={styles.switcherLink}>
                      {isRegister ? 'Sign in' : 'Create an account'}
                    </Text>
                  </Pressable>
                </Link>
              </GlassSurface>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View >
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  wallpaper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  colorShape: {
    borderRadius: 999,
  },
  blueShape: {
    width: 360,
    height: 360,
    backgroundColor: 'rgba(78, 98, 233, 0.14)',
  },
  glassFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.86)',
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
  },
  appIcon: {
    width: 68,
    height: 68,
    marginBottom: 25,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#386CA8',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 7,
  },
  appIconInner: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#007AFF',
  },
  appIconSymbol: {
    width: 34,
    height: 34,
  },
  appIconFallback: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '600',
  },
  header: {
    marginBottom: 25,
    alignItems: 'center',
  },
  title: {
    color: '#111113',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.05,
    lineHeight: 40,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 9,
    color: 'rgba(60, 60, 67, 0.68)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  formCard: {
    gap: 18,
    padding: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#5A7698',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 10,
  },
  topReflection: {
    position: 'absolute',
    top: 0,
    left: 38,
    right: 38,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    marginLeft: 5,
    color: 'rgba(28, 28, 30, 0.82)',
    fontSize: 14,
    fontWeight: '500',
  },
  inputSurface: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    borderRadius: 17,
    overflow: 'hidden',
  },
  inputSurfaceFocused: {
    borderWidth: 1.5,
    borderColor: 'rgba(0, 122, 255, 0.72)',
  },
  fieldIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(118, 118, 128, 0.10)',
  },
  input: {
    minWidth: 0,
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '400',
  },
  visibilityButton: {
    minWidth: 32,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: {
    transform: [{ scale: 0.96 }],
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
  },
  errorText: {
    flex: 1,
    color: '#C62921',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  submitPressable: {
    borderRadius: 18,
  },
  submitPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 122, 255, 0.90)',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(118, 118, 128, 0.30)',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  switcher: {
    minHeight: 29,
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 19,
    overflow: 'hidden',
  },
  switcherText: {
    color: 'rgba(60, 60, 67, 0.70)',
    fontSize: 14,
  },
  switcherLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
