import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { parsePasswordResetLink, type PasswordResetLink } from '../lib/passwordResetLink';
import { AuthScreen } from '../screens/AuthScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainScreen } from '../screens/MainScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { SuperAdminScreen } from '../screens/SuperAdminScreen';
import { colors } from '../theme';

export function RootNavigator() {
  const { user, tenantId, isSuperAdmin, isActingAs, loading } = useAuth();
  const [page, setPage] = useState<'app' | 'settings' | 'account'>('app');
  const [settingsFocus, setSettingsFocus] = useState<'billing' | null>(null);
  const [resetLink, setResetLink] = useState<PasswordResetLink | null>(null);

  useEffect(() => {
    const apply = (url: string | null) => {
      const parsed = parsePasswordResetLink(url);
      if (parsed) setResetLink(parsed);
    };
    Linking.getInitialURL().then(apply).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => sub.remove();
  }, []);

  const openSettings = (focus?: 'billing') => {
    setSettingsFocus(focus ?? null);
    setPage('settings');
  };

  if (resetLink) {
    return (
      <ResetPasswordScreen
        key={resetLink.rt || resetLink.tokenHash || resetLink.code || 'reset'}
        link={resetLink}
        onDone={() => setResetLink(null)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  if (page === 'settings') {
    return (
      <SettingsScreen
        onBack={() => {
          setSettingsFocus(null);
          setPage('app');
        }}
        focusSection={settingsFocus}
      />
    );
  }
  if (page === 'account') return <AccountScreen onBack={() => setPage('app')} />;

  if (isSuperAdmin && !isActingAs) {
    return (
      <SuperAdminScreen onOpenSettings={() => openSettings()} onOpenAccount={() => setPage('account')} />
    );
  }

  if (!tenantId) return <OnboardingScreen />;

  return (
    <MainScreen
      key={tenantId ?? 'main'}
      onOpenSettings={() => openSettings()}
      onOpenBilling={() => openSettings('billing')}
      onOpenAccount={() => setPage('account')}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },
  muted: { color: colors.mutedForeground },
});
