import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageSquare,
  Package,
  Users,
  Megaphone,
  Settings as SettingsIcon,
  LayoutDashboard,
  GraduationCap,
  UserRound,
  Star,
  Flag,
  Bot,
  CalendarDays,
  BookOpen,
  LayoutGrid,
  Home,
  UserPlus,
  Sparkles,
  HeartPulse,
  Stethoscope,
  ShieldAlert,
  FlaskConical,
  Briefcase,
  MoreHorizontal,
  Headphones,
  Phone,
  Mail,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, radius } from '../theme';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config';

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

const COMMON_HEAD: NavItem[] = [
  { key: 'chats', label: 'Chats', icon: MessageSquare },
  { key: 'home', label: 'Overview', icon: LayoutDashboard },
];

const COMMON_TAIL: NavItem[] = [
  { key: 'crm', label: 'CRM', icon: Users },
  { key: 'interested', label: 'Interested', icon: Star },
  { key: 'flagged', label: 'Flagged', icon: Flag },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'ai_issues', label: 'AI Issues', icon: Bot },
];

const ITEMS_BY_VERTICAL: Record<string, NavItem[]> = {
  ecommerce: [
    ...COMMON_HEAD,
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'crm', label: 'CRM', icon: Users },
    { key: 'interested', label: 'Interested', icon: Star },
    { key: 'flagged', label: 'Flagged', icon: Flag },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { key: 'ai_issues', label: 'AI Issues', icon: Bot },
  ],
  restaurant: [
    ...COMMON_HEAD,
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'reservations', label: 'Bookings', icon: CalendarDays },
    { key: 'menu', label: 'Menu', icon: BookOpen },
    { key: 'tables', label: 'Tables', icon: LayoutGrid },
    ...COMMON_TAIL,
  ],
  real_estate: [
    ...COMMON_HEAD,
    { key: 'listings', label: 'Listings', icon: Home },
    { key: 'viewings', label: 'Viewings', icon: CalendarDays },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'agents', label: 'Agents', icon: Briefcase },
    ...COMMON_TAIL,
  ],
  wellness: [
    ...COMMON_HEAD,
    { key: 'catalog', label: 'Catalog', icon: Sparkles },
    { key: 'sessions', label: 'Calendar', icon: CalendarDays },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'staff', label: 'Staff', icon: UserRound },
    ...COMMON_TAIL,
  ],
  healthcare: [
    ...COMMON_HEAD,
    { key: 'specialties', label: 'Specialties', icon: Stethoscope },
    { key: 'doctors', label: 'Doctors', icon: UserRound },
    { key: 'appointments', label: 'Calendar', icon: CalendarDays },
    { key: 'leads', label: 'Leads', icon: HeartPulse },
    { key: 'triage', label: 'Triage', icon: ShieldAlert },
    { key: 'labs', label: 'Labs', icon: FlaskConical },
    ...COMMON_TAIL,
  ],
  education: [
    ...COMMON_HEAD,
    { key: 'courses', label: 'Courses', icon: BookOpen },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'enrollments', label: 'Enrollments', icon: GraduationCap },
    ...COMMON_TAIL,
  ],
  service: [
    ...COMMON_HEAD,
    { key: 'catalog', label: 'Services', icon: Briefcase },
    { key: 'sessions', label: 'Bookings', icon: CalendarDays },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'staff', label: 'Staff', icon: UserRound },
    ...COMMON_TAIL,
  ],
};

interface Props {
  active: string;
  onSelect: (key: string) => void;
  badges?: Record<string, number>;
  vertical?: string;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
}

export function BottomNav({ active, onSelect, badges = {}, vertical = 'ecommerce', onOpenSettings, onOpenAccount }: Props) {
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const items = ITEMS_BY_VERTICAL[vertical] ?? ITEMS_BY_VERTICAL.ecommerce;
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const activeInOverflow = overflow.some((i) => i.key === active);

  const renderTab = (item: NavItem, isActive: boolean) => {
    const Icon = item.icon;
    const badge = badges[item.key];
    const danger = item.key === 'flagged' || item.key === 'ai_issues' || item.key === 'triage';
    return (
      <Pressable key={item.key} onPress={() => onSelect(item.key)} style={styles.tab}>
        {isActive ? <View style={styles.activeBar} /> : null}
        <View>
          <Icon size={20} color={isActive ? colors.primary : colors.mutedForeground} />
          {!!badge && badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: danger ? colors.destructive : colors.primary }]}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.label, isActive && { color: colors.primary }]}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  const extra = useMemo(
    () => [
      { key: '_settings', label: 'Settings', icon: SettingsIcon, onPress: onOpenSettings },
      { key: '_account', label: 'Profile', icon: UserRound, onPress: onOpenAccount },
      {
        key: '_support',
        label: 'Support',
        icon: Headphones,
        onPress: () => {
          setMoreOpen(false);
          setSupportOpen(true);
        },
      },
    ],
    [onOpenAccount, onOpenSettings],
  );

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {primary.map((item) => renderTab(item, active === item.key))}
        <Pressable onPress={() => setMoreOpen(true)} style={styles.tab}>
          {activeInOverflow ? <View style={styles.activeBar} /> : null}
          <MoreHorizontal size={20} color={activeInOverflow ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.label, activeInOverflow && { color: colors.primary }]}>More</Text>
        </Pressable>
      </View>

      <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.sheetTitle}>More</Text>
          <View style={styles.grid}>
            {overflow.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              const badge = badges[item.key];
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onSelect(item.key);
                    setMoreOpen(false);
                  }}
                  style={[styles.tile, isActive && styles.tileActive]}
                >
                  <View>
                    <Icon size={20} color={isActive ? colors.primary : colors.foreground} />
                    {!!badge && badge > 0 ? (
                      <View style={[styles.badge, { backgroundColor: colors.primary, top: -6, right: -10 }]}>
                        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.tileLabel, isActive && { color: colors.primary }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.divider} />
          <View style={styles.grid}>
            {extra.map((item) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    item.onPress();
                    setMoreOpen(false);
                  }}
                  style={styles.tile}
                >
                  <Icon size={20} color={colors.foreground} />
                  <Text style={styles.tileLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSupportOpen(false)} />
        <View style={styles.dialog}>
          <Text style={styles.sheetTitle}>Need a hand getting started?</Text>
          <Text style={styles.dialogBody}>Book a free onboarding call with our team.</Text>
          <Pressable style={styles.supportRow} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
            <Phone size={16} color={colors.primary} />
            <Text style={styles.supportText}>{SUPPORT_PHONE_DISPLAY}</Text>
          </Pressable>
          <Pressable style={styles.supportRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Mail size={16} color={colors.primary} />
            <Text style={styles.supportText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.96)',
    flexDirection: 'row',
    minHeight: 56,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 8, minWidth: 0 },
  label: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, maxWidth: '100%' },
  activeBar: { position: 'absolute', top: 0, width: 32, height: 2, borderRadius: 99, backgroundColor: colors.primary },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '23%',
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
  },
  tileActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tileLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', color: colors.foreground },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  dialog: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '32%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 20,
  },
  dialogBody: { color: colors.mutedForeground, marginBottom: 12 },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  supportText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
});
