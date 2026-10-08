import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { Package, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react-native';
import type { Order } from '../../types';
import { colors, radius } from '../../theme';
import { Badge, Button, Input } from '../ui';
import { supabase } from '../../lib/supabase';
import { actingHeaders } from '../../lib/actingTenant';
import { printOrderInvoice } from '../../lib/printInvoice';
import { useToast } from '../../hooks/useToast';
import { KeyboardSheet } from '../KeyboardSheet';

const STATUS: Record<Order['status'], { label: string; tone: 'amber' | 'primary' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', tone: 'amber' },
  processing: { label: 'Processing', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function OrdersPanel({
  orders,
  onUpdateStatus,
  onDeleteOrder,
  onCreateOrder,
}: {
  orders: Order[];
  onUpdateStatus: (id: string, status: Order['status']) => void;
  onDeleteOrder: (id: string) => void;
  onCreateOrder: (data: {
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    productName: string;
    quantity: number;
  }) => Promise<unknown>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerAddress: '', customerPhone: '', productName: '', quantity: '1' });

  const syncShopify = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-api', {
        headers: actingHeaders(),
        body: { action: 'sync_orders', params: { since_days: 30, limit: 250 } },
      });
      if (error) throw error;
      toast.success(`Synced: +${data?.inserted ?? 0} new, ${data?.updated ?? 0} updated`);
    } catch (e: any) {
      toast.error(e?.message || 'Shopify sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h1}>Orders</Text>
          <Text style={styles.sub}>Manage all customer orders.</Text>
        </View>
        <View style={styles.row}>
          <Button title={syncing ? 'Syncing' : 'Sync'} variant="outline" onPress={syncShopify} loading={syncing} icon={<RefreshCw size={14} color={colors.foreground} />} />
          <Button title="New" onPress={() => setOpen(true)} icon={<Plus size={14} color="#fff" />} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 8 }}>
        {orders.length === 0 ? (
          <View style={styles.empty}>
            <Package size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.sub}>Orders will appear here when customers place them</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.id}>#{order.displayId}</Text>
                <Badge label={STATUS[order.status].label} tone={STATUS[order.status].tone} />
                <Pressable
                  onPress={async () => {
                    try {
                      await printOrderInvoice(order);
                    } catch (e: any) {
                      toast.error(e?.message || 'Could not share invoice');
                    }
                  }}
                  hitSlop={8}
                  accessibilityLabel="Print invoice"
                >
                  <Printer size={16} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete order', 'Remove this order?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDeleteOrder(order.id) },
                    ])
                  }
                >
                  <Trash2 size={16} color={colors.destructive} />
                </Pressable>
              </View>
              <Text style={styles.product}>{order.productName} × {order.quantity}</Text>
              <Text style={styles.meta}>{order.customerName} · {order.customerPhone}</Text>
              {order.customerAddress ? <Text style={styles.meta}>{order.customerAddress}</Text> : null}
              <Text style={styles.meta}>{formatDistanceToNow(order.createdAt, { addSuffix: true })}</Text>
              <View style={styles.statuses}>
                {(['pending', 'processing', 'completed', 'cancelled'] as const).map((s) => (
                  <Pressable key={s} onPress={() => onUpdateStatus(order.id, s)} style={[styles.statusChip, order.status === s && styles.statusChipOn]}>
                    <Text style={[styles.statusText, order.status === s && { color: colors.primary }]}>{STATUS[s].label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <KeyboardSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.h1}>New order</Text>
        <Input placeholder="Customer name" value={form.customerName} onChangeText={(v) => setForm({ ...form, customerName: v })} />
        <Input placeholder="Phone" value={form.customerPhone} onChangeText={(v) => setForm({ ...form, customerPhone: v })} keyboardType="phone-pad" />
        <Input placeholder="Address" value={form.customerAddress} onChangeText={(v) => setForm({ ...form, customerAddress: v })} />
        <Input placeholder="Product" value={form.productName} onChangeText={(v) => setForm({ ...form, productName: v })} />
        <Input placeholder="Quantity" keyboardType="number-pad" value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} />
        <Button
          title="Create order"
          onPress={async () => {
            await onCreateOrder({ ...form, quantity: Number(form.quantity) || 1 });
            setOpen(false);
            setForm({ customerName: '', customerAddress: '', customerPhone: '', productName: '', quantity: '1' });
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </KeyboardSheet>
    </View>
  );
}

export function prefillFromContact(contact?: Contact | null) {
  return contact ? { customerName: contact.name, customerPhone: contact.phoneNumber } : undefined;
}

const styles = StyleSheet.create({
  head: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: 10 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  id: { fontSize: 12, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  product: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statusChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
});
