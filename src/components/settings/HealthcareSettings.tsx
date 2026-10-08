import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type HC = {
  bot_tone: string;
  appointment_duration_min: number;
  reminder_hours_before: number;
  followup_hours_after: number;
  lab_message_template: string;
  calendly_url: string | null;
  google_calendar_url: string | null;
  google_sheet_url: string | null;
  lab_webhook_url: string | null;
  crm_webhook_url: string | null;
  meta_ads_pixel: string | null;
  human_transfer_phone: string | null;
};

const TONES = ['professional', 'warm', 'concise'] as const;

export function HealthcareSettings() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState('professional');
  const [dur, setDur] = useState('30');
  const [rem, setRem] = useState('24');
  const [fol, setFol] = useState('48');
  const [labMsg, setLabMsg] = useState('');
  const [calendly, setCalendly] = useState('');
  const [gcal, setGcal] = useState('');
  const [sheet, setSheet] = useState('');
  const [labHook, setLabHook] = useState('');
  const [crmHook, setCrmHook] = useState('');
  const [pixel, setPixel] = useState('');
  const [human, setHuman] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      let { data } = await (supabase as any).from('healthcare_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
      if (!data) {
        const { data: inserted } = await (supabase as any).from('healthcare_settings').insert({ tenant_id: tenantId }).select().single();
        data = inserted;
      }
      if (cancelled) return;
      const s = data as HC | null;
      if (s) {
        setTone(s.bot_tone || 'professional');
        setDur(String(s.appointment_duration_min ?? 30));
        setRem(String(s.reminder_hours_before ?? 24));
        setFol(String(s.followup_hours_after ?? 48));
        setLabMsg(s.lab_message_template || '');
        setCalendly(s.calendly_url || '');
        setGcal(s.google_calendar_url || '');
        setSheet(s.google_sheet_url || '');
        setLabHook(s.lab_webhook_url || '');
        setCrmHook(s.crm_webhook_url || '');
        setPixel(s.meta_ads_pixel || '');
        setHuman(s.human_transfer_phone || '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const save = async (patch: Partial<HC>, message: string) => {
    if (!tenantId) return;
    const { error } = await (supabase as any).from('healthcare_settings').update(patch).eq('tenant_id', tenantId);
    if (error) toast.error(error.message);
    else toast.success(message);
  };

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.sub}>Loading healthcare settings…</Text>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Text style={styles.h2}>Healthcare · Bot tone</Text>
        <Text style={styles.sub}>How the AI should speak to patients.</Text>
        <View style={styles.row}>
          {TONES.map((t) => (
            <Button key={t} title={t} variant={tone === t ? 'primary' : 'outline'} onPress={() => setTone(t)} />
          ))}
        </View>
        <Button title="Save tone" onPress={() => save({ bot_tone: tone }, 'Tone saved')} />
      </Card>
      <Card>
        <Text style={styles.h2}>Appointments & reminders</Text>
        <Input value={dur} onChangeText={setDur} keyboardType="number-pad" placeholder="Duration (min)" />
        <Input value={rem} onChangeText={setRem} keyboardType="number-pad" placeholder="Reminder (hours before)" />
        <Input value={fol} onChangeText={setFol} keyboardType="number-pad" placeholder="Follow-up (hours after)" />
        <Button
          title="Save timings"
          onPress={() =>
            save(
              {
                appointment_duration_min: parseInt(dur, 10) || 30,
                reminder_hours_before: parseInt(rem, 10) || 24,
                followup_hours_after: parseInt(fol, 10) || 48,
              },
              'Timings saved',
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.h2}>Lab result message</Text>
        <Text style={styles.sub}>Sent when a result is ready. Use {'{name}'} for the patient.</Text>
        <Input value={labMsg} onChangeText={setLabMsg} placeholder="Lab message" />
        <Button title="Save lab message" onPress={() => save({ lab_message_template: labMsg }, 'Lab message saved')} />
      </Card>
      <Card>
        <Text style={styles.h2}>Integrations</Text>
        <Input value={calendly} onChangeText={setCalendly} placeholder="Calendly URL" autoCapitalize="none" />
        <Input value={gcal} onChangeText={setGcal} placeholder="Google Calendar URL" autoCapitalize="none" />
        <Input value={sheet} onChangeText={setSheet} placeholder="Google Sheet URL" autoCapitalize="none" />
        <Input value={labHook} onChangeText={setLabHook} placeholder="Lab webhook" autoCapitalize="none" />
        <Input value={crmHook} onChangeText={setCrmHook} placeholder="CRM webhook" autoCapitalize="none" />
        <Input value={pixel} onChangeText={setPixel} placeholder="Meta Ads pixel" autoCapitalize="none" />
        <Input value={human} onChangeText={setHuman} placeholder="Human transfer phone" keyboardType="phone-pad" />
        <Button
          title="Save integrations"
          onPress={() =>
            save(
              {
                calendly_url: calendly || null,
                google_calendar_url: gcal || null,
                google_sheet_url: sheet || null,
                lab_webhook_url: labHook || null,
                crm_webhook_url: crmHook || null,
                meta_ads_pixel: pixel || null,
                human_transfer_phone: human || null,
              },
              'Integrations saved',
            )
          }
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
