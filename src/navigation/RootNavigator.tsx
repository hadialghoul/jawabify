import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainScreen } from '../screens/MainScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { SuperAdminScreen } from '../screens/SuperAdminScreen';
import { colors } from '../theme';

export function RootNavigator() {
  const { user, tenantId, isSuperAdmin, isActingAs, loading } = useAuth();
  const [page, setPage] = useState<'app' | 'settings' | 'account'>('app');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  if (page === 'settings') return <SettingsScreen onBack={() => setPage('app')} />;
  if (page === 'account') return <AccountScreen onBack={() => setPage('app')} />;

  if (isSuperAdmin && !isActingAs) {
    return (
      <SuperAdminScreen onOpenSettings={() => setPage('settings')} onOpenAccount={() => setPage('account')} />
    );
  }

  if (!tenantId) return <OnboardingScreen />;

  return (
    <MainScreen
      key={tenantId ?? 'main'}
      onOpenSettings={() => setPage('settings')}
      onOpenAccount={() => setPage('account')}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },
  muted: { color: colors.mutedForeground },
});
