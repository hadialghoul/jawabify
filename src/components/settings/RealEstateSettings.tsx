import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type RE = {
  areas_covered: string[];
  currency: string;
  viewing_duration_min: number;
  reminder_hours_before: number;
  followup_hours_after: number;
  google_sheet_url: string | null;
  calendly_url: string | null;
  crm_webhook_url: string | null;
  human_transfer_phone: string | null;
};

export function RealEstateSettings() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState('');
  const [curr, setCurr] = useState('USD');
  const [dur, setDur] = useState('30');
  const [rem, setRem] = useState('2');
  const [fol, setFol] = useState('24');
  const [sheet, setSheet] = useState('');
  const [calendly, setCalendly] = useState('');
  const [webhook, setWebhook] = useState('');
  const [human, setHuman] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).from('real_estate_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (cancelled) return;
      const s = data as RE | null;
      if (s) {
        setAreas((s.areas_covered || []).join(', '));
        setCurr(s.currency || 'USD');
        setDur(String(s.viewing_duration_min ?? 30));
        setRem(String(s.reminder_hours_before ?? 2));
        setFol(String(s.followup_hours_after ?? 24));
        setSheet(s.google_sheet_url || '');
        setCalendly(s.calendly_url || '');
        setWebhook(s.crm_webhook_url || '');
        setHuman(s.human_transfer_phone || '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const save = async (patch: Partial<RE>, message: string) => {
    if (!tenantId) return;
    const { error } = await (supabase as any)
      .from('real_estate_settings')
      .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id' });
    if (error) toast.error(error.message);
    else toast.success(message);
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.sub}>Loading real estate settings…</Text>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Text style={styles.h2}>Real estate · Coverage</Text>
        <Text style={styles.sub}>Areas the AI qualifies leads for. Outside these, it declines or hands off.</Text>
        <Input value={areas} onChangeText={setAreas} placeholder="Achrafieh, Hamra, Verdun" />
        <Input value={curr} onChangeText={setCurr} placeholder="Currency" autoCapitalize="characters" />
        <Button
          title="Save coverage"
          onPress={() =>
            save(
              { areas_covered: areas.split(',').map((s) => s.trim()).filter(Boolean), currency: curr || 'USD' },
              'Coverage saved',
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.h2}>Viewings</Text>
        <Input value={dur} onChangeText={setDur} keyboardType="number-pad" placeholder="Duration (min)" />
        <Input value={rem} onChangeText={setRem} keyboardType="number-pad" placeholder="Reminder (hours before)" />
        <Input value={fol} onChangeText={setFol} keyboardType="number-pad" placeholder="Follow-up (hours after)" />
        <Button
          title="Save viewings"
          onPress={() =>
            save(
              {
                viewing_duration_min: parseInt(dur, 10) || 30,
                reminder_hours_before: parseInt(rem, 10) || 2,
                followup_hours_after: parseInt(fol, 10) || 24,
              },
              'Viewing timings saved',
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.h2}>Integrations</Text>
        <Input value={sheet} onChangeText={setSheet} placeholder="Google Sheet URL (listings sync)" autoCapitalize="none" />
        <Input value={calendly} onChangeText={setCalendly} placeholder="Calendly URL" autoCapitalize="none" />
        <Input value={webhook} onChangeText={setWebhook} placeholder="CRM webhook URL" autoCapitalize="none" />
        <Button
          title="Save links"
          onPress={() =>
            save(
              { google_sheet_url: sheet || null, calendly_url: calendly || null, crm_webhook_url: webhook || null },
              'Links saved',
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.h2}>Human handoff</Text>
        <Input value={human} onChangeText={setHuman} placeholder="+961..." keyboardType="phone-pad" />
        <Button title="Save handoff phone" onPress={() => save({ human_transfer_phone: human || null }, 'Handoff phone saved')} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground },
});
