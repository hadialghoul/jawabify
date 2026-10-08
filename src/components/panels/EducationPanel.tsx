import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BookOpen, GraduationCap, Plus, Trash2 } from 'lucide-react-native';
import {
  useEduCourses,
  useEduEnrollments,
  useEduLeads,
  type EduCourse,
  type EduEnrollment,
  type EduLead,
} from '../../hooks/useEducation';
import { KeyboardSheet } from '../KeyboardSheet';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

const LEAD_STATUS: { value: EduLead['status']; label: string }[] = [
  { value: 'new', label: 'New enquiry' },
  { value: 'interested', label: 'Interested' },
  { value: 'trial_booked', label: 'Trial booked' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'completed', label: 'Completed' },
  { value: 'lost', label: 'Lost' },
];

const ENROLL_STATUS: { value: EduEnrollment['status']; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAY_OPTIONS = ['full', 'installment', 'trial'] as const;

type Mode = 'courses' | 'leads' | 'enrollments';

export function EducationPanel({ mode }: { mode: Mode }) {
  if (mode === 'courses') return <CoursesPanel />;
  if (mode === 'leads') return <LeadsPanel />;
  return <EnrollmentsPanel />;
}

function CoursesPanel() {
  const { items, create, update, remove, loading } = useEduCourses();
  const [edit, setEdit] = useState<Partial<EduCourse> | null>(null);

  const blank = (): Partial<EduCourse> => ({
    name: '',
    subject: '',
    level: '',
    age_group: '',
    description: '',
    price: 0,
    currency: 'USD',
    schedule: '',
    capacity: 20,
    payment_options: ['full'],
    trial_available: false,
    active: true,
    payment_link_url: '',
    start_date: null,
  });

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Course catalog</Text>
          <Text style={styles.sub}>Name, age, price, schedule, capacity, payment options.</Text>
        </View>
        <Button title="Add" icon={<Plus size={14} color="#fff" />} onPress={() => setEdit(blank())} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.empty}>No courses yet. Add your first course so the AI can answer enrollment questions.</Text>
      ) : null}
      {items.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.price}>
              {c.currency} {Number(c.price || 0).toFixed(2)}
            </Text>
          </View>
          <Text style={styles.sub}>{[c.subject, c.level, c.age_group].filter(Boolean).join(' · ') || '—'}</Text>
          {c.schedule ? <Text style={styles.sub}>{c.schedule}</Text> : null}
          <View style={styles.row}>
            {(c.payment_options || []).map((p) => (
              <Badge key={p} label={p} tone="muted" />
            ))}
            {c.trial_available ? <Badge label="trial" tone="success" /> : null}
            {!c.active ? <Badge label="inactive" tone="muted" /> : null}
            <Text style={styles.sub}>cap. {c.capacity}</Text>
          </View>
          <View style={styles.row}>
            <Button title="Edit" variant="outline" onPress={() => setEdit(c)} />
            <Button
              title="Delete"
              variant="ghost"
              icon={<Trash2 size={14} color={colors.destructive} />}
              onPress={() =>
                Alert.alert('Delete course?', c.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(c.id) },
                ])
              }
            />
          </View>
        </View>
      ))}

      <KeyboardSheet visible={!!edit} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Text style={styles.h1}>{edit.id ? 'Edit course' : 'Add course'}</Text>
            <Input placeholder="Name" value={edit.name || ''} onChangeText={(v) => setEdit({ ...edit, name: v })} />
            <Input placeholder="Subject" value={edit.subject || ''} onChangeText={(v) => setEdit({ ...edit, subject: v })} />
            <Input placeholder="Level" value={edit.level || ''} onChangeText={(v) => setEdit({ ...edit, level: v })} />
            <Input placeholder="Age group (e.g. 6-9)" value={edit.age_group || ''} onChangeText={(v) => setEdit({ ...edit, age_group: v })} />
            <Input placeholder="Schedule (Mon/Wed 5–6pm)" value={edit.schedule || ''} onChangeText={(v) => setEdit({ ...edit, schedule: v })} />
            <Input placeholder="Price" keyboardType="decimal-pad" value={String(edit.price ?? 0)} onChangeText={(v) => setEdit({ ...edit, price: Number(v) || 0 })} />
            <Input placeholder="Currency" autoCapitalize="characters" value={edit.currency || 'USD'} onChangeText={(v) => setEdit({ ...edit, currency: v })} />
            <Input placeholder="Capacity" keyboardType="number-pad" value={String(edit.capacity ?? 20)} onChangeText={(v) => setEdit({ ...edit, capacity: Number(v) || 0 })} />
            <Input placeholder="Start date (YYYY-MM-DD)" value={edit.start_date || ''} onChangeText={(v) => setEdit({ ...edit, start_date: v || null })} />
            <Text style={styles.label}>Payment options</Text>
            <View style={styles.row}>
              {PAY_OPTIONS.map((opt) => {
                const selected = (edit.payment_options || []).includes(opt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      const cur = new Set(edit.payment_options || []);
                      if (selected) cur.delete(opt);
                      else cur.add(opt);
                      setEdit({ ...edit, payment_options: Array.from(cur) });
                    }}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextOn]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Trial class available</Text>
              <Switch value={!!edit.trial_available} onValueChange={(v) => setEdit({ ...edit, trial_available: v })} trackColor={{ true: colors.primary }} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Active</Text>
              <Switch value={edit.active !== false} onValueChange={(v) => setEdit({ ...edit, active: v })} trackColor={{ true: colors.primary }} />
            </View>
            <Input placeholder="Payment link (optional)" autoCapitalize="none" value={edit.payment_link_url || ''} onChangeText={(v) => setEdit({ ...edit, payment_link_url: v })} />
            <Input placeholder="Description" value={edit.description || ''} onChangeText={(v) => setEdit({ ...edit, description: v })} />
            <Button
              title="Save"
              disabled={!edit.name?.trim()}
              onPress={async () => {
                if (!edit.name?.trim()) return;
                if (edit.id) await update(edit.id, edit);
                else await create(edit);
                setEdit(null);
              }}
            />
          </>
        ) : null}
      </KeyboardSheet>
    </ScrollView>
  );
}

function LeadsPanel() {
  const { items, update, remove, loading } = useEduLeads();
  const { items: courses } = useEduCourses();

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.h1}>Leads pipeline</Text>
      <Text style={styles.sub}>Parents and students captured from WhatsApp. Move them through stages as they convert.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? <Text style={styles.empty}>No education leads yet.</Text> : null}
      {items.map((l) => {
        const course = courses.find((c) => c.id === l.course_id);
        return (
          <View key={l.id} style={styles.card}>
            <Text style={styles.name}>{l.student_name || l.parent_name || 'Unnamed'}</Text>
            {l.student_age ? <Text style={styles.sub}>Age {l.student_age}</Text> : null}
            {course ? <Text style={styles.sub}>Course: {course.name}</Text> : null}
            {l.parent_phone ? <Text style={styles.sub}>{l.parent_phone}</Text> : null}
            {l.needs_human ? <Badge label="needs human" tone="danger" /> : null}
            <View style={styles.row}>
              {LEAD_STATUS.map((s) => (
                <Pressable key={s.value} onPress={() => update(l.id, { status: s.value })} style={[styles.chip, l.status === s.value && styles.chipOn]}>
                  <Text style={[styles.chipText, l.status === s.value && styles.chipTextOn]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              title="Delete"
              variant="ghost"
              icon={<Trash2 size={14} color={colors.destructive} />}
              onPress={() =>
                Alert.alert('Delete lead?', l.student_name || 'This lead', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(l.id) },
                ])
              }
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

function EnrollmentsPanel() {
  const { items, update, remove, loading } = useEduEnrollments();
  const { items: courses } = useEduCourses();

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <GraduationCap size={18} color={colors.primary} />
        <Text style={styles.h1}>Enrollments</Text>
      </View>
      <Text style={styles.sub}>Confirmed students. Payment status and weekly progress reminders flow from here.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.empty}>No enrollments yet. They appear here when the AI confirms a paid spot.</Text>
      ) : null}
      {items.map((e) => {
        const course = courses.find((c) => c.id === e.course_id);
        return (
          <View key={e.id} style={styles.card}>
            <View style={styles.row}>
              <BookOpen size={16} color={colors.primary} />
              <Text style={styles.name}>
                {e.student_name}
                {e.student_age ? ` · age ${e.student_age}` : ''}
              </Text>
            </View>
            <Text style={styles.sub}>
              {course?.name || '(no course)'} · {e.parent_name || '—'} · {e.parent_phone || '—'}
            </Text>
            <View style={styles.row}>
              <Badge label={e.plan_type} tone="muted" />
              <Badge label={e.payment_status} tone={e.payment_status === 'paid' ? 'success' : 'amber'} />
              {e.amount_paid > 0 ? (
                <Text style={styles.sub}>
                  {course?.currency || 'USD'} {Number(e.amount_paid).toFixed(2)}
                </Text>
              ) : null}
            </View>
            <View style={styles.row}>
              {ENROLL_STATUS.map((s) => (
                <Pressable key={s.value} onPress={() => update(e.id, { status: s.value })} style={[styles.chip, e.status === s.value && styles.chipOn]}>
                  <Text style={[styles.chipText, e.status === s.value && styles.chipTextOn]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              title="Delete"
              variant="ghost"
              icon={<Trash2 size={14} color={colors.destructive} />}
              onPress={() =>
                Alert.alert('Delete enrollment?', e.student_name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(e.id) },
                ])
              }
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground },
  empty: { fontSize: 13, color: colors.mutedForeground, marginTop: 12 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 8 },
  name: { fontWeight: '700', color: colors.foreground, flex: 1 },
  price: { fontWeight: '700', color: colors.foreground },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.foreground, textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
});
