import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { useEduSettings } from '../../hooks/useEducation';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

const TONES = ['friendly', 'professional', 'warm'] as const;
const LANGS = ['en', 'ar', 'fr'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function EducationSettings() {
  const { settings, loading, save } = useEduSettings();
  const [tone, setTone] = useState('friendly');
  const [langs, setLangs] = useState<string[]>(['en', 'ar', 'fr']);
  const [remH, setRemH] = useState('1');
  const [dayBefore, setDayBefore] = useState(true);
  const [trialMin, setTrialMin] = useState('30');
  const [pday, setPday] = useState('5');
  const [pmsg, setPmsg] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [calendly, setCalendly] = useState('');
  const [gcal, setGcal] = useState('');
  const [sheet, setSheet] = useState('');
  const [payTpl, setPayTpl] = useState('');
  const [crmHook, setCrmHook] = useState('');
  const [pixel, setPixel] = useState('');
  const [human, setHuman] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTone(settings.bot_tone || 'friendly');
    setLangs(settings.languages || ['en', 'ar', 'fr']);
    setRemH(String(settings.reminder_hours_before ?? 1));
    setDayBefore(!!settings.day_before_reminder);
    setPday(String(settings.progress_day_of_week ?? 5));
    setPmsg(settings.progress_message_template || '');
    setTrialMin(String(settings.trial_class_minutes ?? 30));
    setEnrollMsg(settings.enrollment_confirmation_template || '');
    setCalendly(settings.calendly_url || '');
    setGcal(settings.google_calendar_url || '');
    setSheet(settings.google_sheet_url || '');
    setPayTpl(settings.payment_link_template || '');
    setCrmHook(settings.crm_webhook_url || '');
    setPixel(settings.meta_ads_pixel || '');
    setHuman(settings.human_transfer_phone || '');
  }, [settings]);

  if (loading || !settings) {
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.sub}>Loading education settings…</Text>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Text style={styles.h2}>Education · Bot voice</Text>
        <Text style={styles.sub}>How the AI speaks to parents and students.</Text>
        <Text style={styles.label}>Tone</Text>
        <View style={styles.row}>
          {TONES.map((t) => (
            <Button key={t} title={t} variant={tone === t ? 'primary' : 'outline'} onPress={() => setTone(t)} />
          ))}
        </View>
        <Text style={styles.label}>Languages</Text>
        <View style={styles.row}>
          {LANGS.map((l) => {
            const on = langs.includes(l);
            return (
              <Button
                key={l}
                title={l.toUpperCase()}
                variant={on ? 'primary' : 'outline'}
                onPress={() => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}
              />
            );
          })}
        </View>
        <Button title="Save voice" onPress={() => save({ bot_tone: tone, languages: langs }, 'Bot voice saved')} />
      </Card>

      <Card>
        <Text style={styles.h2}>Reminders</Text>
        <Text style={styles.sub}>Class reminder timing and day-before alerts.</Text>
        <Input value={remH} onChangeText={setRemH} keyboardType="number-pad" placeholder="Hours before class" />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Also send a day-before reminder</Text>
          <Switch value={dayBefore} onValueChange={setDayBefore} trackColor={{ true: colors.primary }} />
        </View>
        <Input value={trialMin} onChangeText={setTrialMin} keyboardType="number-pad" placeholder="Trial class duration (min)" />
        <Button
          title="Save reminders"
          onPress={() =>
            save(
              {
                reminder_hours_before: Number(remH) || 1,
                day_before_reminder: dayBefore,
                trial_class_minutes: Number(trialMin) || 30,
              },
              'Reminders saved',
            )
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Weekly progress message</Text>
        <Text style={styles.sub}>Sent to parents once a week. Use {'{parent}'} and {'{student}'}.</Text>
        <View style={styles.row}>
          {DAYS.map((d, i) => (
            <Button key={d} title={d} variant={pday === String(i) ? 'primary' : 'outline'} onPress={() => setPday(String(i))} />
          ))}
        </View>
        <Input value={pmsg} onChangeText={setPmsg} placeholder="Progress message template" />
        <Button
          title="Save progress message"
          onPress={() => save({ progress_day_of_week: Number(pday), progress_message_template: pmsg }, 'Progress message saved')}
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Enrollment confirmation</Text>
        <Text style={styles.sub}>Sent when a student is confirmed. Use {'{student}'}, {'{course}'}, {'{start_date}'}.</Text>
        <Input value={enrollMsg} onChangeText={setEnrollMsg} placeholder="Confirmation message" />
        <Button
          title="Save confirmation"
          onPress={() => save({ enrollment_confirmation_template: enrollMsg }, 'Confirmation saved')}
        />
      </Card>

      <Card>
        <Text style={styles.h2}>Integrations</Text>
        <Text style={styles.sub}>Calendar, sheets, payment links, ads and escalation.</Text>
        <Input value={calendly} onChangeText={setCalendly} placeholder="Calendly URL" autoCapitalize="none" />
        <Input value={gcal} onChangeText={setGcal} placeholder="Google Calendar URL" autoCapitalize="none" />
        <Input value={sheet} onChangeText={setSheet} placeholder="Google Sheet URL" autoCapitalize="none" />
        <Input value={payTpl} onChangeText={setPayTpl} placeholder="Payment link template" autoCapitalize="none" />
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
                payment_link_template: payTpl || null,
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
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
