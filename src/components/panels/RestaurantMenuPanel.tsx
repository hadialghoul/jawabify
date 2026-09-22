import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { KeyboardSheet } from '../KeyboardSheet';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

interface MenuItem {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  category: string | null;
  active?: boolean;
}

export function RestaurantMenuPanel() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [form, setForm] = useState<Partial<MenuItem>>({});

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setItems((data as MenuItem[]) || []);
    setLoading(false);
  }, [tenantId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!tenantId || !form.name?.trim()) return;
    if (form.id) {
      const { error } = await supabase.from('menu_items' as any).update(form).eq('id', form.id);
      if (error) toast.error(error.message);
      else toast.success('Updated');
    } else {
      const { error } = await supabase.from('menu_items' as any).insert({ ...form, tenant_id: tenantId });
      if (error) toast.error(error.message);
      else toast.success('Added');
    }
    setEditing(null);
    load();
  };

  const remove = (id: string) => {
    Alert.alert('Delete menu item?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('menu_items' as any).delete().eq('id', id);
          if (error) toast.error(error.message);
          else {
            toast.success('Deleted');
            load();
          }
          setEditing(null);
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Menu</Text>
          <Text style={styles.sub}>Dishes the AI can recommend and take orders for.</Text>
        </View>
        <Button
          title="Add item"
          icon={<Plus size={14} color="#fff" />}
          onPress={() => {
            const blank = { name: '', price: null as number | null, description: '', category: '', active: true };
            setForm(blank);
            setEditing(blank);
          }}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No menu items yet.</Text> : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => {
            setForm(item);
            setEditing(item);
          }}
        >
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.category || '—'}
            {item.price != null ? ` · ${item.price}` : ''}
          </Text>
          {item.active === false ? <Badge label="Off" tone="muted" /> : null}
        </Pressable>
      ))}

      <KeyboardSheet visible={!!editing} onClose={() => setEditing(null)}>
        <Text style={styles.h1}>{form.id ? 'Edit item' : 'Add menu item'}</Text>
        <Input placeholder="Name" value={form.name || ''} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input placeholder="Category" value={form.category || ''} onChangeText={(v) => setForm({ ...form, category: v })} />
        <Input
          placeholder="Price"
          keyboardType="decimal-pad"
          value={form.price != null ? String(form.price) : ''}
          onChangeText={(v) => setForm({ ...form, price: v ? parseFloat(v) : null })}
        />
        <Input placeholder="Description" value={form.description || ''} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
        <View style={styles.row}>
          <Text style={styles.meta}>Active</Text>
          <Switch value={form.active !== false} onValueChange={(v) => setForm({ ...form, active: v })} />
        </View>
        <Button title="Save" onPress={save} />
        {form.id ? <Button title="Delete" variant="destructive" icon={<Trash2 size={14} color="#fff" />} onPress={() => remove(form.id!)} /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
