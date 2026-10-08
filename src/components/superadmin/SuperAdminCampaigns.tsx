import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { CampaignsPanel } from '../panels/CampaignsPanel';
import { colors } from '../../theme';
import type { Contact } from '../../types';

/** Jawabify support-number campaigns. Separate from a customer's own campaigns. */
export function SuperAdminCampaigns() {
  const { user, ownTenantId } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(ownTenantId);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError(null);
      let tid = ownTenantId;
      if (!tid) {
        const { data: mem } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        tid = (mem?.tenant_id as string) || null;
      }
      if (!tid) {
        setError('No admin tenant yet. Open Admin inbox once to initialize it.');
        setLoading(false);
        return;
      }
      setTenantId(tid);
      const { data, error: contactsError } = await supabase
        .from('contacts')
        .select('id,name,phone_number,platform,opted_out,opted_out_at,ai_enabled')
        .eq('tenant_id', tid)
        .eq('platform', 'whatsapp')
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (contactsError) setError(contactsError.message);
      else {
        setContacts(
          (data || []).map((c: any) => ({
            id: c.id,
            name: c.name || c.phone_number,
            phoneNumber: c.phone_number,
            platform: c.platform || 'whatsapp',
            aiEnabled: c.ai_enabled ?? true,
            optedOut: c.opted_out ?? false,
            optedOutAt: c.opted_out_at ? new Date(c.opted_out_at) : undefined,
          })),
        );
      }
      setLoading(false);
    })();
  }, [user, ownTenantId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error || !tenantId) {
    return (
      <View style={styles.center}>
        <Text style={styles.danger}>{error || 'No admin tenant yet. Open Admin inbox once to initialize it.'}</Text>
      </View>
    );
  }
  return <CampaignsPanel contacts={contacts} tenantId={tenantId} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  danger: { color: colors.destructive, textAlign: 'center' },
});
