import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type Day = { open: string; close: string; closed?: boolean };
type Hours = Record<string, Day>;

const DAYS: [string, string][] = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];

const DEFAULT_HOURS: Hours = Object.fromEntries(
  DAYS.map(([k]) => [k, { open: '11:00', close: '23:00', closed: false }]),
);

export function RestaurantBusinessSettings() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState('0');
  const [eta, setEta] = useState('30-45 min');
  const [specials, setSpecials] = useState('');
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [maxParty, setMaxParty] = useState('10');
  const [reminderHrs, setReminderHrs] = useState('2');
  const [floors, setFloors] = useState('1');
  const [indoor, setIndoor] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const [kitchenPhone, setKitchenPhone] = useState('');
  const [humanPhone, setHumanPhone] = useState('');
  const [upsell, setUpsell] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [{ data: settings }, { data: feeRow }, { data: upsellRows }] = await Promise.all([
      (supabase as any).from('restaurant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('app_settings').select('value').eq('tenant_id', tenantId).eq('key', 'default_delivery_fee').maybeSingle(),
      supabase
        .from('app_settings')
        .select('key, value')
        .eq('tenant_id', tenantId)
        .in('key', ['ai_upsell_enabled', 'restaurant_upsell_enabled']),
    ]);

    if (settings) {
      setEta(settings.eta_text || '30-45 min');
      setSpecials(settings.daily_specials || '');
      setHours(
        settings.opening_hours && Object.keys(settings.opening_hours).length
          ? { ...DEFAULT_HOURS, ...settings.opening_hours }
          : DEFAULT_HOURS,
      );
      setMaxParty(String(settings.max_party_size ?? 10));
      setReminderHrs(String(settings.reminder_hours_before ?? 2));
      setFloors(String(settings.floors_count ?? 1));
      setIndoor(!!settings.has_indoor);
      setOutdoor(!!settings.has_outdoor);
      setKitchenPhone(settings.kitchen_notify_phone || '');
      setHumanPhone(settings.human_transfer_phone || '');
    }

    if (feeRow?.value !== undefined && feeRow?.value !== null) {
      setFee(String(feeRow.value));
    }

    const rows = upsellRows || [];
    const primary = rows.find((r: any) => r.key === 'ai_upsell_enabled')?.value;
    const legacy = rows.find((r: any) => r.key === 'restaurant_upsell_enabled')?.value;
    const raw = primary ?? legacy;
    if (raw !== undefined && raw !== null) {
      setUpsell(raw === true || raw === 'true');
    }

    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (patch: Record<string, unknown>, ok: string) => {
    if (!tenantId) return;
    const { error } = await (supabase as any)
      .from('restaurant_settings')
      .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id' });
    if (error) toast.error(error.message);
    else toast.success(ok);
  };

  const saveFee = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from('app_settings').upsert(
      { tenant_id: tenantId, key: 'default_delivery_fee', value: parseFloat(fee) || 0 } as any,
      { onConflict: 'tenant_id,key' },
    );
    if (error) toast.error(error.message);
    else toast.success('Delivery fee saved');
  };

  const toggleUpsell = async (v: boolean) => {
    if (!tenantId) return;
    setUpsell(v);
    const { error } = await supabase.from('app_settings').upsert(
      [
        { tenant_id: tenantId, key: 'ai_upsell_enabled', value: v as any },
        { tenant_id: tenantId, key: 'restaurant_upsell_enabled', value: v as any },
      ],
      { onConflict: 'tenant_id,key' },
    );
    if (error) toast.error(error.message);
    else toast.success(v ? 'Upsell enabled' : 'Upsell disabled');
  };

  if (loading) {
    return (
      <Card>
        <Text style={styles.sub}>Loading restaurant settings…</Text>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Text style={styles.h2}>Restaurant 🍽️</Text>
        <Text style={styles.sub}>Delivery fee, ETA and upsell — same as the website.</Text>
        <Text style={styles.label}>Default delivery fee</Text>
        <Input value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" />
        <Button title="Save fee" onPress={saveFee} />
        <Text style={styles.label}>Estimated delivery time</Text>
        <Input value={eta} onChangeText={setEta} placeholder="e.g. 30-45 min" />
        <Button title="Save ETA" onPress={() => saveSettings({ eta_text: eta }, 'ETA saved')} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>AI upsell</Text>
            <Text style={styles.sub}>Suggests one extra item once per order.</Text>
          </View>
          <Switch value={upsell} onValueChange={toggleUpsell} trackColor={{ true: colors.primary }} />
        </View>
      </Card>

      <Card>
        <Text style={styles.h2}>Daily specials</Text>
        <Input
          value={specials}
          onChangeText={setSpecials}
          placeholder="e.g. Today: 20% off mezze platter until 5pm"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Button
          title="Save specials"
          onPress={() => saveSettings({ daily_specials: specials || null }, 'Specials saved')}
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Opening hours</Text>
        <Text style={styles.sub}>Reservations outside these hours are politely declined.</Text>
        {DAYS.map(([key, label]) => {
          const h = hours[key] ?? { open: '11:00', close: '23:00', closed: false };
          return (
            <View key={key} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{label}</Text>
              <Switch
                value={!h.closed}
                onValueChange={(v) => setHours({ ...hours, [key]: { ...h, closed: !v } })}
                trackColor={{ true: colors.primary }}
              />
              <Input
                value={h.open}
                onChangeText={(v) => setHours({ ...hours, [key]: { ...h, open: v } })}
                editable={!h.closed}
                style={styles.timeInput}
                placeholder="11:00"
              />
              <Text style={styles.sub}>to</Text>
              <Input
                value={h.close}
                onChangeText={(v) => setHours({ ...hours, [key]: { ...h, close: v } })}
                editable={!h.closed}
                style={styles.timeInput}
                placeholder="23:00"
              />
            </View>
          );
        })}
        <Button title="Save hours" onPress={() => saveSettings({ opening_hours: hours }, 'Hours saved')} />
      </Card>

      <Card>
        <Text style={styles.h2}>Reservations & seating</Text>
        <Text style={styles.label}>Max party size</Text>
        <Input value={maxParty} onChangeText={setMaxParty} keyboardType="number-pad" />
        <Text style={styles.label}>Reminder (hours before)</Text>
        <Input value={reminderHrs} onChangeText={setReminderHrs} keyboardType="number-pad" />
        <Text style={styles.label}>Number of floors</Text>
        <Input value={floors} onChangeText={setFloors} keyboardType="number-pad" />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Has indoor seating</Text>
          <Switch value={indoor} onValueChange={setIndoor} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Has outdoor seating</Text>
          <Switch value={outdoor} onValueChange={setOutdoor} trackColor={{ true: colors.primary }} />
        </View>
        <Button
          title="Save reservation settings"
          onPress={() =>
            saveSettings(
              {
                max_party_size: parseInt(maxParty, 10) || 10,
                reminder_hours_before: parseInt(reminderHrs, 10) || 2,
                floors_count: Math.max(1, parseInt(floors, 10) || 1),
                has_indoor: indoor,
                has_outdoor: outdoor,
              },
              'Reservation settings saved',
            )
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Human handoff</Text>
        <Text style={styles.sub}>Where to forward VIPs, complaints and large groups.</Text>
        <Text style={styles.label}>Human transfer phone</Text>
        <Input value={humanPhone} onChangeText={setHumanPhone} placeholder="+9613xxxxxxx" keyboardType="phone-pad" />
        <Text style={styles.label}>Kitchen / ops phone (optional)</Text>
        <Input value={kitchenPhone} onChangeText={setKitchenPhone} placeholder="+9613xxxxxxx" keyboardType="phone-pad" />
        <Button
          title="Save phones"
          onPress={() =>
            saveSettings(
              {
                human_transfer_phone: humanPhone || null,
                kitchen_notify_phone: kitchenPhone || null,
              },
              'Handoff phones saved',
            )
          }
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  sub: { fontSize: 12, color: colors.mutedForeground, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginTop: 8, marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dayLabel: { width: 36, fontSize: 13, fontWeight: '600', color: colors.foreground },
  timeInput: { flex: 1, minWidth: 64 },
});
