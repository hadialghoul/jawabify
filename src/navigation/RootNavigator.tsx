import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MainScreen } from '../screens/MainScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { colors } from '../theme';
import { useState } from 'react';

export function RootNavigator() {
  const { user, tenantId, isSuperAdmin, loading } = useAuth();
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
  if (!tenantId && !isSuperAdmin) return <OnboardingScreen />;

  if (page === 'settings') return <SettingsScreen onBack={() => setPage('app')} />;
  if (page === 'account') return <AccountScreen onBack={() => setPage('app')} />;

  return <MainScreen onOpenSettings={() => setPage('settings')} onOpenAccount={() => setPage('account')} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },
  muted: { color: colors.mutedForeground },
});
