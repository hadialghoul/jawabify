import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { addDays, format, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Package as PkgIcon, Plus, Sparkles, Trash2, UserRound, UserPlus } from 'lucide-react-native';
import {
  useWellnessLeads,
  useWellnessPackages,
  useWellnessServices,
  useWellnessSessions,
  useWellnessStaff,
  type WellnessLead,
  type WellnessPackage,
  type WellnessService,
  type WellnessSession,
  type WellnessStaff,
} from '../../hooks/useWellness';
import { KeyboardSheet } from '../KeyboardSheet';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

type Panel = 'catalog' | 'sessions' | 'leads' | 'staff';

export function WellnessPanel({ mode }: { mode: Panel | 'services' | 'packages' }) {
  const panel: Panel = mode === 'services' || mode === 'packages' ? 'catalog' : mode;
  const initialSub = mode === 'packages' ? 'packages' : 'services';

  if (panel === 'catalog') return <CatalogPanel initial={initialSub} />;
  if (panel === 'sessions') return <SessionsPanel />;
  if (panel === 'leads') return <LeadsPanel />;
  return <StaffPanel />;
}

function CatalogPanel({ initial }: { initial: 'services' | 'packages' }) {
  const [sub, setSub] = useState<'services' | 'packages'>(initial);
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.switchRow}>
        <Button title="Services" variant={sub === 'services' ? 'primary' : 'outline'} icon={<Sparkles size={14} color={sub === 'services' ? '#fff' : colors.foreground} />} onPress={() => setSub('services')} />
        <Button title="Packages" variant={sub === 'packages' ? 'primary' : 'outline'} icon={<PkgIcon size={14} color={sub === 'packages' ? '#fff' : colors.foreground} />} onPress={() => setSub('packages')} />
      </View>
      {sub === 'services' ? <ServicesPanel /> : <PackagesPanel />}
    </View>
  );
}

function ServicesPanel() {
  const { items, create, update, remove, loading } = useWellnessServices();
  const [editing, setEditing] = useState<Partial<WellnessService> | null>(null);
  const [form, setForm] = useState<Partial<WellnessService>>({});

  const openNew = () => {
    const blank = { name: '', category: '', duration_min: 60, price: null as number | null, currency: 'USD', description: '', active: true };
    setForm(blank);
    setEditing(blank);
  };

  const openEdit = (s: WellnessService) => {
    setForm(s);
    setEditing(s);
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Services</Text>
          <Text style={styles.sub}>What the AI offers and books.</Text>
        </View>
        <Button title="Add service" icon={<Plus size={14} color="#fff" />} onPress={openNew} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No services yet.</Text> : null}
      {items.map((s) => (
        <Pressable key={s.id} style={styles.card} onPress={() => openEdit(s)}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.meta}>
            {s.category || '—'} · {s.duration_min}min
            {s.price != null ? ` · ${s.currency} ${s.price}` : ''}
          </Text>
          {!s.active ? <Badge label="Off" tone="muted" /> : null}
        </Pressable>
      ))}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit service' : 'New service'}</Text>
        <Input placeholder="Name" value={form.name || ''} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input placeholder="Category" value={form.category || ''} onChangeText={(v) => setForm({ ...form, category: v })} />
        <Input placeholder="Duration (min)" keyboardType="number-pad" value={String(form.duration_min ?? 60)} onChangeText={(v) => setForm({ ...form, duration_min: parseInt(v, 10) || 60 })} />
        <Input placeholder="Price" keyboardType="decimal-pad" value={form.price != null ? String(form.price) : ''} onChangeText={(v) => setForm({ ...form, price: v ? parseFloat(v) : null })} />
        <Input placeholder="Currency" value={form.currency || 'USD'} onChangeText={(v) => setForm({ ...form, currency: v })} />
        <Input placeholder="Description" value={form.description || ''} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
        <View style={styles.row}>
          <Text style={styles.meta}>Active</Text>
          <Switch value={form.active !== false} onValueChange={(v) => setForm({ ...form, active: v })} />
        </View>
        <Button
          title="Save"
          onPress={async () => {
            if (!form.name?.trim()) return;
            if (form.id) await update(form.id, form);
            else await create(form);
            setEditing(null);
          }}
        />
        {form.id ? (
          <Button
            title="Delete"
            variant="destructive"
            icon={<Trash2 size={14} color="#fff" />}
            onPress={() =>
              Alert.alert('Delete service?', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(form.id!);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </KeyboardSheet>
    </ScrollView>
  );
}

function PackagesPanel() {
  const { items, create, update, remove, loading } = useWellnessPackages();
  const { items: services } = useWellnessServices();
  const [editing, setEditing] = useState<Partial<WellnessPackage> | null>(null);
  const [form, setForm] = useState<Partial<WellnessPackage>>({});

  const openNew = () => {
    const blank = { name: '', sessions_count: 5, price: null as number | null, currency: 'USD', service_ids: [] as string[], active: true };
    setForm(blank);
    setEditing(blank);
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Packages</Text>
          <Text style={styles.sub}>Multi-session bundles the AI can upsell.</Text>
        </View>
        <Button title="Add package" icon={<Plus size={14} color="#fff" />} onPress={openNew} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No packages yet.</Text> : null}
      {items.map((p) => (
        <Pressable
          key={p.id}
          style={styles.card}
          onPress={() => {
            setForm(p);
            setEditing(p);
          }}
        >
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.meta}>
            {p.sessions_count} sessions
            {p.price != null ? ` · ${p.currency} ${p.price}` : ''}
          </Text>
        </Pressable>
      ))}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit package' : 'New package'}</Text>
        <Input placeholder="Name" value={form.name || ''} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input placeholder="Sessions count" keyboardType="number-pad" value={String(form.sessions_count ?? 5)} onChangeText={(v) => setForm({ ...form, sessions_count: parseInt(v, 10) || 1 })} />
        <Input placeholder="Price" keyboardType="decimal-pad" value={form.price != null ? String(form.price) : ''} onChangeText={(v) => setForm({ ...form, price: v ? parseFloat(v) : null })} />
        <Text style={styles.meta}>Services included</Text>
        {services.length === 0 ? <Text style={styles.sub}>Add services first.</Text> : null}
        {services.map((s) => {
          const ids = form.service_ids || [];
          const on = ids.includes(s.id);
          return (
            <Pressable
              key={s.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() =>
                setForm({
                  ...form,
                  service_ids: on ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                })
              }
            >
              <Text style={{ color: on ? '#fff' : colors.foreground }}>{s.name}</Text>
            </Pressable>
          );
        })}
        <Button
          title="Save"
          onPress={async () => {
            if (!form.name?.trim()) return;
            if (form.id) await update(form.id, form);
            else await create(form);
            setEditing(null);
          }}
        />
        {form.id ? (
          <Button
            title="Delete"
            variant="destructive"
            onPress={() =>
              Alert.alert('Delete package?', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(form.id!);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </KeyboardSheet>
    </ScrollView>
  );
}

function SessionsPanel() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const rangeEnd = addDays(weekStart, 7);
  const { sessions, loading, create, update, remove, refresh } = useWellnessSessions(weekStart, rangeEnd);
  const { items: services } = useWellnessServices();
  const { items: staff } = useWellnessStaff();
  const [editing, setEditing] = useState<Partial<WellnessSession> | null>(null);
  const [form, setForm] = useState<Partial<WellnessSession>>({});

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Calendar</Text>
          <Text style={styles.sub}>{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}</Text>
        </View>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, -7))} style={styles.icon}>
          <ChevronLeft size={18} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => setWeekStart(addDays(weekStart, 7))} style={styles.icon}>
          <ChevronRight size={18} color={colors.primary} />
        </Pressable>
        <Button
          title="Add"
          icon={<Plus size={14} color="#fff" />}
          onPress={() => {
            const blank: Partial<WellnessSession> = {
              guest_name: '',
              guest_phone: '',
              scheduled_at: new Date().toISOString(),
              duration_min: 60,
              status: 'booked',
            };
            setForm(blank);
            setEditing(blank);
          }}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {days.map((day) => {
        const daySessions = sessions.filter((s) => format(new Date(s.scheduled_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
        return (
          <View key={day.toISOString()} style={styles.dayBlock}>
            <Text style={styles.dayTitle}>
              <CalendarDays size={12} color={colors.primary} /> {format(day, 'EEE, MMM d')}
            </Text>
            {daySessions.length === 0 ? <Text style={styles.meta}>No bookings</Text> : null}
            {daySessions.map((s) => (
              <Pressable
                key={s.id}
                style={styles.card}
                onPress={() => {
                  setForm(s);
                  setEditing(s);
                }}
              >
                <Text style={styles.name}>
                  {format(new Date(s.scheduled_at), 'HH:mm')} · {s.guest_name}
                </Text>
                <Text style={styles.meta}>{s.status} · {s.duration_min}min</Text>
              </Pressable>
            ))}
          </View>
        );
      })}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit booking' : 'New booking'}</Text>
        <Input placeholder="Guest name" value={form.guest_name || ''} onChangeText={(v) => setForm({ ...form, guest_name: v })} />
        <Input placeholder="Phone" value={form.guest_phone || ''} onChangeText={(v) => setForm({ ...form, guest_phone: v })} keyboardType="phone-pad" />
        <Input
          placeholder="When (YYYY-MM-DD HH:mm)"
          value={form.scheduled_at ? format(new Date(form.scheduled_at), 'yyyy-MM-dd HH:mm') : ''}
          onChangeText={(v) => {
            const d = new Date(v.replace(' ', 'T'));
            if (!Number.isNaN(d.getTime())) setForm({ ...form, scheduled_at: d.toISOString() });
          }}
        />
        <Text style={styles.meta}>Service</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switchRow}>
          {services.map((s) => (
            <Button key={s.id} title={s.name} variant={form.service_id === s.id ? 'primary' : 'outline'} onPress={() => setForm({ ...form, service_id: s.id, duration_min: s.duration_min })} />
          ))}
        </ScrollView>
        <Text style={styles.meta}>Staff</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switchRow}>
          {staff.map((s) => (
            <Button key={s.id} title={s.name} variant={form.staff_id === s.id ? 'primary' : 'outline'} onPress={() => setForm({ ...form, staff_id: s.id })} />
          ))}
        </ScrollView>
        <Button
          title="Save"
          onPress={async () => {
            if (!form.guest_name?.trim() || !form.scheduled_at) return;
            if (form.id) await update(form.id, form);
            else await create(form);
            setEditing(null);
            refresh();
          }}
        />
        {form.id ? (
          <Button
            title="Delete"
            variant="destructive"
            onPress={() =>
              Alert.alert('Delete booking?', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(form.id!);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </KeyboardSheet>
    </ScrollView>
  );
}

function LeadsPanel() {
  const { items, create, update, remove, loading } = useWellnessLeads();
  const [editing, setEditing] = useState<Partial<WellnessLead> | null>(null);
  const [form, setForm] = useState<Partial<WellnessLead>>({});

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Leads</Text>
          <Text style={styles.sub}>Prospects interested in bookings.</Text>
        </View>
        <Button
          title="Add lead"
          icon={<UserPlus size={14} color="#fff" />}
          onPress={() => {
            const blank = { status: 'new', interest: '', notes: '', source: 'manual', needs_human: false };
            setForm(blank);
            setEditing(blank);
          }}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No leads yet.</Text> : null}
      {items.map((l) => (
        <Pressable
          key={l.id}
          style={styles.card}
          onPress={() => {
            setForm(l);
            setEditing(l);
          }}
        >
          <View style={styles.row}>
            <Badge label={l.status} />
            {l.needs_human ? <Badge label="Needs human" tone="danger" /> : null}
          </View>
          <Text style={styles.name}>{l.interest || 'Lead'}</Text>
          {l.notes ? <Text style={styles.meta}>{l.notes}</Text> : null}
          <Text style={styles.meta}>{format(new Date(l.created_at), 'MMM d, yyyy')}</Text>
        </Pressable>
      ))}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit lead' : 'New lead'}</Text>
        <Input placeholder="Interest" value={form.interest || ''} onChangeText={(v) => setForm({ ...form, interest: v })} />
        <Input placeholder="Notes" value={form.notes || ''} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
        <Text style={styles.meta}>Status</Text>
        <ScrollView horizontal contentContainerStyle={styles.switchRow}>
          {['new', 'qualified', 'booked', 'completed', 'no_show'].map((s) => (
            <Button key={s} title={s} variant={form.status === s ? 'primary' : 'outline'} onPress={() => setForm({ ...form, status: s })} />
          ))}
        </ScrollView>
        <View style={styles.row}>
          <Text style={styles.meta}>Needs human</Text>
          <Switch value={!!form.needs_human} onValueChange={(v) => setForm({ ...form, needs_human: v })} />
        </View>
        <Button
          title="Save"
          onPress={async () => {
            if (form.id) await update(form.id, form);
            else await create(form);
            setEditing(null);
          }}
        />
        {form.id ? (
          <Button
            title="Delete"
            variant="destructive"
            onPress={() =>
              Alert.alert('Delete lead?', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(form.id!);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </KeyboardSheet>
    </ScrollView>
  );
}

function StaffPanel() {
  const { items, create, update, remove, loading } = useWellnessStaff();
  const [editing, setEditing] = useState<Partial<WellnessStaff> | null>(null);
  const [form, setForm] = useState<Partial<WellnessStaff>>({});

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Staff</Text>
          <Text style={styles.sub}>People the AI can book with.</Text>
        </View>
        <Button
          title="Add staff"
          icon={<Plus size={14} color="#fff" />}
          onPress={() => {
            const blank = { name: '', phone: '', email: '', specialties: [] as string[], bio: '', active: true };
            setForm(blank);
            setEditing(blank);
          }}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No staff yet.</Text> : null}
      {items.map((s) => (
        <Pressable
          key={s.id}
          style={styles.card}
          onPress={() => {
            setForm(s);
            setEditing(s);
          }}
        >
          <View style={styles.row}>
            <UserRound size={16} color={colors.primary} />
            <Text style={styles.name}>{s.name}</Text>
            {!s.active ? <Badge label="Off" tone="muted" /> : null}
          </View>
          {s.phone ? <Text style={styles.meta}>{s.phone}</Text> : null}
          {s.email ? <Text style={styles.meta}>{s.email}</Text> : null}
          {(s.specialties || []).length > 0 ? <Text style={styles.meta}>{(s.specialties || []).join(', ')}</Text> : null}
        </Pressable>
      ))}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit staff' : 'Add staff'}</Text>
        <Input placeholder="Name" value={form.name || ''} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input placeholder="Phone" value={form.phone || ''} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
        <Input placeholder="Email" value={form.email || ''} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" />
        <Input
          placeholder="Specialties (comma separated)"
          value={(form.specialties || []).join(', ')}
          onChangeText={(v) =>
            setForm({
              ...form,
              specialties: v
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
        <Input placeholder="Bio" value={form.bio || ''} onChangeText={(v) => setForm({ ...form, bio: v })} multiline />
        <View style={styles.row}>
          <Text style={styles.meta}>Active</Text>
          <Switch value={form.active !== false} onValueChange={(v) => setForm({ ...form, active: v })} />
        </View>
        <Button
          title="Save"
          onPress={async () => {
            if (!form.name?.trim()) return;
            if (form.id) await update(form.id, form);
            else await create(form);
            setEditing(null);
          }}
        />
        {form.id ? (
          <Button
            title="Delete"
            variant="destructive"
            onPress={() =>
              Alert.alert('Delete staff?', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await remove(form.id!);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        ) : null}
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </KeyboardSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  meta: { fontSize: 12, color: colors.mutedForeground },
  name: { fontWeight: '700', color: colors.foreground },
  empty: { textAlign: 'center', color: colors.mutedForeground, padding: 24 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, flexWrap: 'wrap' },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayBlock: { gap: 6, marginBottom: 8 },
  dayTitle: { fontWeight: '700', color: colors.foreground, fontSize: 13 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
