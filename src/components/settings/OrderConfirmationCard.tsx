import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Card } from '../ui';
import { colors } from '../../theme';

const KEY = 'order_confirmation_enabled';

export function OrderConfirmationCard() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('app_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', KEY)
      .maybeSingle()
      .then(({ data }) => {
        const value = data?.value;
        if (value === false || value === 'false') setEnabled(false);
        else setEnabled(true);
      });
  }, [tenantId]);

  const toggle = async (next: boolean) => {
    if (!tenantId || saving) return;
    const prev = enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', KEY)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const value = next;
      const { error } = existing
        ? await supabase.from('app_settings').update({ value }).eq('id', existing.id)
        : await supabase.from('app_settings').insert({ key: KEY, value, tenant_id: tenantId } as any);
      if (error) throw error;
      toast.success(next ? 'WhatsApp order confirmation on' : 'WhatsApp order confirmation off');
    } catch {
      setEnabled(prev);
      toast.error('Could not save WhatsApp order confirmation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <MessageSquare size={16} color={colors.primary} />
        <Text style={styles.title}>WhatsApp order confirmation</Text>
        <Switch value={enabled} onValueChange={toggle} disabled={saving || !tenantId} />
      </View>
      <Text style={styles.sub}>
        When this is off, new Shopify orders do not send the automatic WhatsApp confirmation. Orders placed in the
        WhatsApp chat still get their confirmation in the chat.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.foreground, fontWeight: '600', fontSize: 15 },
  sub: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
});
