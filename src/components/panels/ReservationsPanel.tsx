import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useReservations, type Reservation } from '../../hooks/useReservations';
import { useToast } from '../../hooks/useToast';
import { parseTimeInput } from '../../lib/parseTime';
import { KeyboardSheet } from '../KeyboardSheet';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

interface RTable {
  id: string;
  label: string;
  seats: number;
}

const STATUS_TONE: Record<Reservation['status'], 'success' | 'primary' | 'muted' | 'danger' | 'amber'> = {
  confirmed: 'success',
  seated: 'primary',
  completed: 'muted',
  cancelled: 'danger',
  no_show: 'amber',
};

export function ReservationsPanel() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [cursor, setCursor] = useState(new Date());
  const [tables, setTables] = useState<RTable[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    party: '2',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    duration: '90',
    tableId: '',
    notes: '',
  });

  const range = useMemo(() => {
    if (view === 'day') return { start: startOfDay(cursor), end: endOfDay(cursor) };
    return {
      start: startOfWeek(cursor, { weekStartsOn: 1 }),
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
  }, [view, cursor]);

  const { reservations, loading, create, update, remove } = useReservations(range.start, range.end);

  const loadTables = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('restaurant_tables')
      .select('id,label,seats')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });
    setTables((data as RTable[]) || []);
  }, [tenantId]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    return Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
  }, [view, cursor, range.start]);

  const shift = (n: number) => setCursor(view === 'day' ? addDays(cursor, n) : addWeeks(cursor, n));

  const openCreate = (date?: Date, time?: string) => {
    const d = date ?? cursor;
    setForm({
      name: '',
      phone: '',
      party: '2',
      date: format(d, 'yyyy-MM-dd'),
      time: time ?? '19:00',
      duration: '90',
      tableId: '',
      notes: '',
    });
    setCreateOpen(true);
  };

  const saveCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Guest name is required');
      return;
    }
    const hhmm = parseTimeInput(form.time) || form.time;
    if (!/^\d{2}:\d{2}$/.test(hhmm)) {
      toast.error('Enter a valid time (e.g. 19:00 or 7:30 pm)');
      return;
    }
    const [h, m] = hhmm.split(':').map(Number);
    const starts = new Date(`${form.date}T00:00:00`);
    starts.setHours(h, m, 0, 0);
    const ends = new Date(starts.getTime() + (parseInt(form.duration, 10) || 90) * 60_000);
    try {
      await create({
        table_id: form.tableId || null,
        contact_id: null,
        guest_name: form.name.trim(),
        guest_phone: form.phone.trim() || null,
        party_size: parseInt(form.party, 10) || 2,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: 'confirmed',
        source: 'manual',
        notes: form.notes.trim() || null,
      });
      toast.success('Reservation created');
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not create reservation');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarRow}>
          <Button title="Today" variant="outline" onPress={() => setCursor(new Date())} />
          <Pressable onPress={() => shift(-1)} style={styles.iconBtn}>
            <ChevronLeft size={20} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={() => shift(1)} style={styles.iconBtn}>
            <ChevronRight size={20} color={colors.foreground} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {view === 'day'
              ? format(cursor, 'EEE, MMM d')
              : `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d')}`}
          </Text>
        </View>
        <View style={styles.toolbarRow}>
          <View style={styles.seg}>
            <Pressable onPress={() => setView('day')} style={[styles.segBtn, view === 'day' && styles.segOn]}>
              <Text style={[styles.segText, view === 'day' && styles.segTextOn]}>Day</Text>
            </Pressable>
            <Pressable onPress={() => setView('week')} style={[styles.segBtn, view === 'week' && styles.segOn]}>
              <Text style={[styles.segText, view === 'week' && styles.segTextOn]}>Week</Text>
            </Pressable>
          </View>
          <Button title="Create" icon={<Plus size={14} color="#fff" />} onPress={() => openCreate()} />
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
        {days.map((d) => {
          const dayRes = reservations.filter((r) => isSameDay(new Date(r.starts_at), d));
          return (
            <View key={d.toISOString()} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <Text style={[styles.dayLabel, isToday(d) && { color: colors.primary }]}>
                  {format(d, 'EEEE, MMM d')}
                </Text>
                <Pressable onPress={() => openCreate(d)}>
                  <Text style={styles.addLink}>+ Add</Text>
                </Pressable>
              </View>
              {dayRes.length === 0 ? (
                <Text style={styles.empty}>No reservations</Text>
              ) : (
                dayRes.map((r) => {
                  const tableLabel = tables.find((t) => t.id === r.table_id)?.label;
                  return (
                    <Pressable key={r.id} style={styles.event} onPress={() => setSelected(r)}>
                      <View style={styles.eventTop}>
                        <Text style={styles.guest}>
                          {r.guest_name}
                          {r.source === 'ai' ? ' ✦' : ''}
                        </Text>
                        <Badge label={r.status.replace('_', ' ')} tone={STATUS_TONE[r.status]} />
                      </View>
                      <Text style={styles.meta}>
                        {format(new Date(r.starts_at), 'HH:mm')}–{format(new Date(r.ends_at), 'HH:mm')}
                        {' · '}
                        {r.party_size}p
                        {tableLabel ? ` · ${tableLabel}` : ''}
                      </Text>
                      {r.guest_phone ? <Text style={styles.meta}>{r.guest_phone}</Text> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>

      <KeyboardSheet visible={createOpen} onClose={() => setCreateOpen(false)}>
        <Text style={styles.h1}>New reservation</Text>
        <Input placeholder="Guest name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input placeholder="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
        <Input placeholder="Party size" value={form.party} onChangeText={(v) => setForm({ ...form, party: v })} keyboardType="number-pad" />
        <Input placeholder="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} />
        <Input placeholder="Time (19:00 or 7:30 pm)" value={form.time} onChangeText={(v) => setForm({ ...form, time: v })} />
        <Input placeholder="Duration (minutes)" value={form.duration} onChangeText={(v) => setForm({ ...form, duration: v })} keyboardType="number-pad" />
        <Text style={styles.meta}>Table</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Button
            title="None"
            variant={!form.tableId ? 'primary' : 'outline'}
            onPress={() => setForm({ ...form, tableId: '' })}
          />
          {tables.map((t) => (
            <Button
              key={t.id}
              title={`${t.label} (${t.seats})`}
              variant={form.tableId === t.id ? 'primary' : 'outline'}
              onPress={() => setForm({ ...form, tableId: t.id })}
            />
          ))}
        </ScrollView>
        <Input placeholder="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} />
        <Button title="Save reservation" onPress={saveCreate} />
      </KeyboardSheet>

      <KeyboardSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.h1}>{selected.guest_name}</Text>
              {selected.source === 'ai' ? <Sparkles size={16} color={colors.primary} /> : null}
            </View>
            <Text style={styles.meta}>Phone: {selected.guest_phone || '—'}</Text>
            <Text style={styles.meta}>Party: {selected.party_size}</Text>
            <Text style={styles.meta}>
              When: {format(new Date(selected.starts_at), 'EEE MMM d, HH:mm')} –{' '}
              {format(new Date(selected.ends_at), 'HH:mm')}
            </Text>
            <Text style={styles.meta}>
              Table: {tables.find((t) => t.id === selected.table_id)?.label ?? '—'}
            </Text>
            {selected.notes ? <Text style={styles.meta}>Notes: {selected.notes}</Text> : null}
            <Badge label={selected.status.replace('_', ' ')} tone={STATUS_TONE[selected.status]} />
            <View style={{ gap: 8, marginTop: 8 }}>
              {selected.status === 'confirmed' ? (
                <Button
                  title="Mark seated"
                  onPress={async () => {
                    await update(selected.id, { status: 'seated' });
                    setSelected(null);
                  }}
                />
              ) : null}
              {selected.status === 'seated' ? (
                <Button
                  title="Mark completed"
                  onPress={async () => {
                    await update(selected.id, { status: 'completed' });
                    setSelected(null);
                  }}
                />
              ) : null}
              <Button
                title="Cancel reservation"
                variant="outline"
                onPress={async () => {
                  await update(selected.id, { status: 'cancelled' });
                  setSelected(null);
                }}
              />
              <Button
                title="Delete"
                variant="destructive"
                icon={<Trash2 size={14} color="#fff" />}
                onPress={() =>
                  Alert.alert('Delete reservation?', '', [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await remove(selected.id);
                        setSelected(null);
                      },
                    },
                  ])
                }
              />
            </View>
          </>
        ) : null}
      </KeyboardSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  iconBtn: { padding: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.foreground },
  seg: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  segBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  segTextOn: { color: '#fff' },
  dayCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12, gap: 8 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  addLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  empty: { color: colors.mutedForeground, fontSize: 13 },
  event: { padding: 10, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, gap: 4 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  guest: { fontSize: 15, fontWeight: '700', color: colors.foreground, flex: 1 },
  meta: { fontSize: 12, color: colors.mutedForeground },
  h1: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
});
