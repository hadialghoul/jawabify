import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { KeyboardSheet } from '../KeyboardSheet';
import { Button, Input } from '../ui';
import { colors, radius } from '../../theme';

interface RTable {
  id: string;
  label: string;
  seats: number;
  floor: number | null;
  seating_area: string | null;
  sort_order: number;
}

const blankForm = { id: '' as string, label: '', seats: '4', floor: '1', seating_area: 'indoor' };

export function RestaurantTablesPanel() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [tables, setTables] = useState<RTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [floorsCount, setFloorsCount] = useState(1);
  const [hasIndoor, setHasIndoor] = useState(false);
  const [hasOutdoor, setHasOutdoor] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data }, { data: settings }] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id,label,seats,floor,seating_area,sort_order')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true }),
      (supabase as any).from('restaurant_settings').select('floors_count,has_indoor,has_outdoor').eq('tenant_id', tenantId).maybeSingle(),
    ]);
    setTables((data as RTable[]) || []);
    if (settings) {
      setFloorsCount(Math.max(1, settings.floors_count ?? 1));
      setHasIndoor(!!settings.has_indoor);
      setHasOutdoor(!!settings.has_outdoor);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showFloor = floorsCount > 1;
  const showArea = hasIndoor && hasOutdoor;
  const isEdit = !!form.id;

  const openNew = () => {
    setForm(blankForm);
    setSheetOpen(true);
  };

  const openEdit = (t: RTable) => {
    setForm({
      id: t.id,
      label: t.label,
      seats: String(t.seats),
      floor: String(t.floor ?? 1),
      seating_area: t.seating_area || 'indoor',
    });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!tenantId || !form.label.trim()) {
      toast.error('Enter a table label');
      return;
    }
    const payload = {
      label: form.label.trim(),
      seats: parseInt(form.seats, 10) || 4,
      floor: showFloor ? parseInt(form.floor, 10) || 1 : null,
      seating_area: showArea ? form.seating_area : null,
    };
    if (isEdit) {
      const { error } = await supabase.from('restaurant_tables').update(payload).eq('id', form.id);
      if (error) toast.error(error.message);
      else {
        toast.success('Table updated');
        setSheetOpen(false);
        void load();
      }
      return;
    }
    const sort_order = (tables[tables.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from('restaurant_tables').insert({
      tenant_id: tenantId,
      ...payload,
      sort_order,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Table added');
      setSheetOpen(false);
      void load();
    }
  };

  const remove = (t: RTable) => {
    Alert.alert(`Delete ${t.label}?`, 'Past reservations are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('restaurant_tables').delete().eq('id', t.id);
          if (error) toast.error(error.message);
          else {
            toast.success('Deleted');
            void load();
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Tables</Text>
          <Text style={styles.sub}>Add, edit or remove tables. Deleting a table won't delete past reservations.</Text>
        </View>
        <Button title="Add" icon={<Plus size={14} color="#fff" />} onPress={openNew} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
      {!loading && tables.length === 0 ? <Text style={styles.empty}>No tables yet.</Text> : null}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
        {tables.map((t) => (
          <View key={t.id} style={styles.row}>
            <Pressable style={{ flex: 1 }} onPress={() => openEdit(t)}>
              <Text style={styles.label}>{t.label}</Text>
              <Text style={styles.sub}>
                {t.seats} seats
                {t.floor != null ? ` · Floor ${t.floor}` : ''}
                {t.seating_area ? ` · ${t.seating_area}` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={() => openEdit(t)} hitSlop={10} style={styles.iconBtn}>
              <Pencil size={16} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={() => remove(t)} hitSlop={10} style={styles.iconBtn}>
              <Trash2 size={16} color={colors.destructive} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <KeyboardSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={styles.h1}>{isEdit ? 'Edit table' : 'New table'}</Text>
        <Input placeholder="Label (e.g. T1)" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} />
        <Input placeholder="Seats" value={form.seats} onChangeText={(v) => setForm({ ...form, seats: v })} keyboardType="number-pad" />
        {showFloor ? (
          <Input placeholder="Floor" value={form.floor} onChangeText={(v) => setForm({ ...form, floor: v })} keyboardType="number-pad" />
        ) : null}
        {showArea ? (
          <View style={styles.areaRow}>
            <Button
              title="Indoor"
              variant={form.seating_area === 'indoor' ? 'primary' : 'outline'}
              onPress={() => setForm({ ...form, seating_area: 'indoor' })}
            />
            <Button
              title="Outdoor"
              variant={form.seating_area === 'outdoor' ? 'primary' : 'outline'}
              onPress={() => setForm({ ...form, seating_area: 'outdoor' })}
            />
          </View>
        ) : null}
        <Button title={isEdit ? 'Save changes' : 'Save table'} onPress={save} />
      </KeyboardSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  h1: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.mutedForeground, marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  areaRow: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
});
