import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type Day = { open: string; close: string; closed: boolean };
type Hours = Record<string, Day>;
type Tone = 'calm' | 'energetic' | 'luxury';

const DAYS: [string, string][] = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

const ZONES = ['Asia/Beirut', 'Asia/Dubai', 'Asia/Riyadh', 'Europe/London', 'Europe/Paris', 'America/New_York'];

const TONES: { value: Tone; label: string }[] = [
  { value: 'calm', label: 'Professional' },
  { value: 'energetic', label: 'Friendly' },
  { value: 'luxury', label: 'Premium' },
];

const defaultHours = (): Hours =>
  Object.fromEntries(DAYS.map(([k]) => [k, { open: '09:00', close: '17:00', closed: k === 'sun' }]));

export function ServiceBusinessSettings() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState<Tone>('calm');
  const [currency, setCurrency] = useState('USD');
  const [dur, setDur] = useState('60');
  const [rem1, setRem1] = useState('24');
  const [rem2, setRem2] = useState('2');
  const [fol, setFol] = useState('24');
  const [address, setAddress] = useState('');
  const [maps, setMaps] = useState('');
  const [tz, setTz] = useState('Asia/Beirut');
  const [hours, setHours] = useState<Hours>(defaultHours());
  const [calendly, setCalendly] = useState('');
  const [pay, setPay] = useState('');
  const [webhook, setWebhook] = useState('');
  const [human, setHuman] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let { data } = await (supabase as any).from('wellness_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    if (!data) {
      const { data: inserted } = await (supabase as any).from('wellness_settings').insert({ tenant_id: tenantId }).select().single();
      data = inserted;
    }
    if (data) {
      setTone((data.bot_tone as Tone) || 'calm');
      setCurrency(data.currency || 'USD');
      setDur(String(data.session_duration_min ?? 60));
      setRem1(String(data.reminder_hours_before ?? 24));
      setRem2(String(data.second_reminder_hours_before ?? 2));
      setFol(String(data.followup_hours_after ?? 24));
      setAddress(data.address || '');
      setMaps(data.maps_url || '');
      setTz(data.timezone || 'Asia/Beirut');
      const stored = data.opening_hours;
      setHours(stored && Object.keys(stored).length ? { ...defaultHours(), ...stored } : defaultHours());
      setCalendly(data.calendly_url || '');
      setPay(data.payment_link || '');
      setWebhook(data.crm_webhook_url || '');
      setHuman(data.human_transfer_phone || '');
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Record<string, unknown>, ok: string) => {
    if (!tenantId) return;
    const { error } = await (supabase as any).from('wellness_settings').update(patch).eq('tenant_id', tenantId);
    if (error) toast.error(error.message);
    else toast.success(ok);
  };

  const patchDay = (key: string, next: Partial<Day>) => {
    setHours((current) => ({ ...current, [key]: { ...current[key], ...next } }));
  };

  if (loading) {
    return (
      <Card>
        <Text style={styles.sub}>Loading booking settings…</Text>
      </Card>
    );
  }

  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];

  return (
    <>
      <Card>
        <Text style={styles.h2}>How the AI speaks</Text>
        <Text style={styles.sub}>The tone your assistant uses with clients.</Text>
        <Text style={styles.label}>Tone</Text>
        <View style={styles.row}>
          {TONES.map((t) => (
            <Button key={t.value} title={t.label} variant={tone === t.value ? 'primary' : 'outline'} onPress={() => setTone(t.value)} />
          ))}
        </View>
        <Input value={currency} onChangeText={setCurrency} placeholder="Currency" autoCapitalize="characters" />
        <Button title="Save tone & currency" onPress={() => save({ bot_tone: tone, currency: currency || 'USD' }, 'Tone and currency saved')} />
      </Card>

      <Card>
        <Text style={styles.h2}>Bookings & reminders</Text>
        <Text style={styles.sub}>Default length of a call or meeting, and when clients get reminded.</Text>
        <Input value={dur} onChangeText={setDur} keyboardType="number-pad" placeholder="Length (minutes)" />
        <Input value={rem1} onChangeText={setRem1} keyboardType="number-pad" placeholder="1st reminder (hours before)" />
        <Input value={rem2} onChangeText={setRem2} keyboardType="number-pad" placeholder="2nd reminder (hours before)" />
        <Input value={fol} onChangeText={setFol} keyboardType="number-pad" placeholder="Follow-up (hours after)" />
        <Button
          title="Save reminders"
          onPress={() =>
            save(
              {
                session_duration_min: parseInt(dur, 10) || 60,
                reminder_hours_before: parseInt(rem1, 10) || 24,
                second_reminder_hours_before: parseInt(rem2, 10) || 2,
                followup_hours_after: parseInt(fol, 10) || 24,
              },
              'Reminders saved',
            )
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Location & opening hours</Text>
        <Text style={styles.sub}>The assistant shares these with clients and books times in this time zone.</Text>
        <Input value={address} onChangeText={setAddress} placeholder="Address" />
        <Input value={maps} onChangeText={setMaps} placeholder="Google Maps link" autoCapitalize="none" />
        <Text style={styles.label}>Time zone</Text>
        <View style={styles.row}>
          {zones.map((zone) => (
            <Button key={zone} title={zone.replace('_', ' ')} variant={tz === zone ? 'primary' : 'outline'} onPress={() => setTz(zone)} />
          ))}
        </View>
        {DAYS.map(([key, name]) => (
          <View key={key} style={styles.day}>
            <Text style={styles.dayName}>{name}</Text>
            <Switch value={!hours[key]?.closed} onValueChange={(on) => patchDay(key, { closed: !on })} trackColor={{ true: colors.primary }} />
            {hours[key]?.closed ? (
              <Text style={styles.sub}>Closed</Text>
            ) : (
              <View style={styles.row}>
                <Input value={hours[key]?.open || '09:00'} onChangeText={(v) => patchDay(key, { open: v })} placeholder="09:00" style={styles.time} />
                <Input value={hours[key]?.close || '17:00'} onChangeText={(v) => patchDay(key, { close: v })} placeholder="17:00" style={styles.time} />
              </View>
            )}
          </View>
        ))}
        <Button
          title="Save location & hours"
          onPress={() =>
            save(
              { address: address || null, maps_url: maps || null, timezone: tz, opening_hours: hours },
              'Location and hours saved',
            )
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Booking & payment links</Text>
        <Text style={styles.sub}>Optional links the AI can share, plus a CRM webhook.</Text>
        <Input value={calendly} onChangeText={setCalendly} placeholder="Booking link (Calendly)" autoCapitalize="none" />
        <Input value={pay} onChangeText={setPay} placeholder="Payment link" autoCapitalize="none" />
        <Input value={webhook} onChangeText={setWebhook} placeholder="CRM webhook URL" autoCapitalize="none" />
        <Button
          title="Save links"
          onPress={() =>
            save(
              { calendly_url: calendly || null, payment_link: pay || null, crm_webhook_url: webhook || null },
              'Links saved',
            )
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Human handoff</Text>
        <Text style={styles.sub}>Where to forward complaints, VIPs and anything the AI can't answer.</Text>
        <Input value={human} onChangeText={setHuman} placeholder="+961..." keyboardType="phone-pad" />
        <Button title="Save handoff phone" onPress={() => save({ human_transfer_phone: human || null }, 'Handoff phone saved')} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  day: { gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  dayName: { fontWeight: '700', color: colors.foreground },
  time: { minWidth: 90, flex: 1 },
});
