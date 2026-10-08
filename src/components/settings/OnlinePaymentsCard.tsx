import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

const asText = (v: any) => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v ? String(v) : '');

export function OnlinePaymentsCard() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);

  const upsertSetting = async (key: string, value: any) => {
    if (!tenantId) return;
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', key)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existing) await supabase.from('app_settings').update({ value }).eq('id', existing.id);
    else await supabase.from('app_settings').insert({ key, value, tenant_id: tenantId } as any);
  };

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('app_settings')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .in('key', ['online_payments_enabled', 'online_payment_link'])
      .then(({ data }) => {
        const pick = (k: string) => (data || []).find((r: any) => r.key === k)?.value;
        const e = pick('online_payments_enabled');
        setEnabled(e === true || e === 'true');
        setLink(asText(pick('online_payment_link')));
      });
  }, [tenantId]);

  const save = async (nextEnabled = enabled) => {
    if (!tenantId) {
      toast.error('No account selected');
      return false;
    }
    const trimmed = link.trim();
    if (nextEnabled && !/^https?:\/\/\S+$/i.test(trimmed)) {
      toast.error('Add a valid payment link starting with https://');
      return false;
    }
    setSaving(true);
    try {
      await upsertSetting('online_payments_enabled', nextEnabled);
      await upsertSetting('online_payment_link', trimmed);
      toast.success(nextEnabled ? 'Online payments on' : 'Online payments saved');
      return true;
    } catch {
      toast.error('Could not save');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (v: boolean) => {
    const prev = enabled;
    setEnabled(v);
    const ok = await save(v);
    if (!ok) setEnabled(prev);
  };

  return (
    <Card>
      <View style={styles.head}>
        <CreditCard size={16} color={colors.primary} />
        <Text style={styles.h2}>Online payments</Text>
      </View>
      <Text style={styles.sub}>
        When on, after a customer confirms an order or booking the assistant asks how they want to pay and sends your link if they choose online.
      </Text>
      <View style={styles.switchRow}>
        <Text style={[styles.label, { flex: 1 }]}>Accept online payments</Text>
        <Switch value={enabled} onValueChange={toggle} disabled={saving} trackColor={{ true: colors.primary }} />
      </View>
      <Text style={styles.label}>Payment link</Text>
      <Input
        value={link}
        onChangeText={setLink}
        placeholder="https://buy.stripe.com/... or your PayPal / Whish link"
        autoCapitalize="none"
      />
      <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={() => save()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
