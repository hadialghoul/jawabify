import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
}) {
  const palette =
    variant === 'outline'
      ? { bg: colors.card, fg: colors.foreground, border: colors.border }
      : variant === 'ghost'
        ? { bg: 'transparent', fg: colors.primary, border: 'transparent' }
        : variant === 'destructive'
          ? { bg: colors.destructive, fg: '#fff', border: colors.destructive }
          : { bg: colors.primary, fg: '#fff', border: colors.primary };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <Text style={[styles.btnText, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[styles.input, style]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = 'primary',
}: {
  label: string;
  tone?: 'primary' | 'danger' | 'muted' | 'success' | 'amber';
}) {
  const map = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: 'rgba(240,68,68,0.12)', fg: colors.destructive },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
    success: { bg: colors.successSoft, fg: colors.success },
    amber: { bg: colors.amberSoft, fg: colors.amber },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
