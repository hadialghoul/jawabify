import type { ReactNode } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '../theme';

export function useSafeHeaderPad() {
  const insets = useSafeAreaInsets();
  const statusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  return Math.max(insets.top, statusBar, 24) + 6;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const top = useSafeHeaderPad();

  return (
    <View style={[styles.header, { paddingTop: top }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <View style={styles.titles}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.sub}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 10,
    minHeight: 56,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: { width: 12 },
  titles: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  right: { minWidth: 48, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
});
