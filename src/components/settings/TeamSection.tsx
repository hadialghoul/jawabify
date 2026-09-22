import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Activity, KeyRound, Trash2, UserPlus, Users } from 'lucide-react-native';
import { useMemberActivity, useTeam, type TeamMember } from '../../hooks/useTeam';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Card, Input } from '../ui';
import { KeyboardSheet } from '../KeyboardSheet';
import { colors, radius } from '../../theme';

export function TeamSection() {
  const toast = useToast();
  const { members, loading, working, addMember, setPassword, setRole, setActive, removeMember } = useTeam();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [role, setRoleValue] = useState<'admin' | 'employee'>('employee');
  const [pwTarget, setPwTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={styles.head}>
          <Users size={16} color={colors.primary} />
          <Text style={styles.title}>Team</Text>
        </View>
        <Text style={styles.sub}>Create logins for your employees. They sign in with their own email and work inside this account.</Text>
        <Button title="Add employee" icon={<UserPlus size={14} color="#fff" />} onPress={() => setAddOpen(true)} />
        {loading ? <Text style={styles.sub}>Loading team…</Text> : null}
        {members.map((m) => (
          <View key={m.id} style={styles.member}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.display_name || m.email || 'Team member'}</Text>
              <Text style={styles.sub}>{m.email}</Text>
              <View style={styles.row}>
                <Badge label={m.role} />
                {!m.is_active ? <Badge label="Disabled" tone="danger" /> : null}
              </View>
            </View>
            <View style={styles.row}>
              <Button title="Password" variant="outline" onPress={() => { setPwTarget(m); setNewPassword(''); }} />
              {m.role !== 'owner' ? (
                <>
                  <Button
                    title={m.role === 'admin' ? 'Make employee' : 'Make admin'}
                    variant="outline"
                    onPress={() => setRole(m.id, m.role === 'admin' ? 'employee' : 'admin').catch((e) => toast.error(e.message))}
                  />
                  <Button
                    title={m.is_active ? 'Disable' : 'Enable'}
                    variant="outline"
                    onPress={() => setActive(m.id, !m.is_active).catch((e) => toast.error(e.message))}
                  />
                  <Pressable
                    onPress={() =>
                      Alert.alert('Remove team member?', `${m.display_name || m.email} will no longer be able to sign in.`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () =>
                            removeMember(m.id)
                              .then(() => toast.success('Team member removed'))
                              .catch((e) => toast.error(e.message)),
                        },
                      ])
                    }
                    style={styles.iconBtn}
                  >
                    <Trash2 size={16} color={colors.destructive} />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        ))}
        {!loading && members.length === 0 ? <Text style={styles.sub}>No team members yet.</Text> : null}
      </Card>

      <TeamActivityCard />

      <KeyboardSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={styles.title}>Add an employee</Text>
        <Input placeholder="Full name" value={name} onChangeText={setName} />
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input placeholder="Temporary password (8+ characters)" value={password} onChangeText={setPasswordValue} />
        <View style={styles.row}>
          <Button title="Employee" variant={role === 'employee' ? 'primary' : 'outline'} onPress={() => setRoleValue('employee')} />
          <Button title="Admin" variant={role === 'admin' ? 'primary' : 'outline'} onPress={() => setRoleValue('admin')} />
        </View>
        <Button
          title={working ? 'Creating…' : 'Create login'}
          loading={working}
          disabled={!name.trim() || !email.trim() || password.length < 8}
          onPress={async () => {
            try {
              await addMember({ display_name: name.trim(), email: email.trim(), password, role });
              toast.success(`${name.trim()} can now sign in`);
              setAddOpen(false);
              setName('');
              setEmail('');
              setPasswordValue('');
              setRoleValue('employee');
            } catch (e: any) {
              toast.error(e?.message || 'Could not create the employee login');
            }
          }}
        />
      </KeyboardSheet>

      <KeyboardSheet visible={!!pwTarget} onClose={() => setPwTarget(null)}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.sub}>{pwTarget?.display_name || pwTarget?.email}</Text>
        <Input placeholder="At least 8 characters" value={newPassword} onChangeText={setNewPassword} />
        <Button
          title={working ? 'Updating…' : 'Update password'}
          loading={working}
          disabled={newPassword.length < 8}
          icon={<KeyRound size={14} color="#fff" />}
          onPress={async () => {
            if (!pwTarget) return;
            try {
              await setPassword(pwTarget.id, newPassword);
              toast.success('Password updated');
              setPwTarget(null);
              setNewPassword('');
            } catch (e: any) {
              toast.error(e?.message || 'Could not update the password');
            }
          }}
        />
      </KeyboardSheet>
    </View>
  );
}

function TeamActivityCard() {
  const [days, setDays] = useState(7);
  const { rows, loading, reload } = useMemberActivity(days);
  const people = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.member_id) map.set(r.member_id, r.display_name || r.email || 'Team member');
    });
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [rows]);
  const [who, setWho] = useState('all');
  const filtered = who === 'all' ? rows : rows.filter((r) => r.member_id === who);

  return (
    <Card>
      <View style={styles.head}>
        <Activity size={16} color={colors.primary} />
        <Text style={styles.title}>Team activity</Text>
      </View>
      <Text style={styles.sub}>Sign-in and sign-out times per employee, with what they handled.</Text>
      <View style={styles.row}>
        {[1, 7, 30].map((d) => (
          <Button key={d} title={d === 1 ? 'Today' : `${d}d`} variant={days === d ? 'primary' : 'outline'} onPress={() => setDays(d)} />
        ))}
        <Button title="Refresh" variant="ghost" onPress={reload} />
      </View>
      {people.length > 0 ? (
        <View style={styles.row}>
          <Button title="Everyone" variant={who === 'all' ? 'primary' : 'outline'} onPress={() => setWho('all')} />
          {people.map((p) => (
            <Button key={p.id} title={p.label} variant={who === p.id ? 'primary' : 'outline'} onPress={() => setWho(p.id)} />
          ))}
        </View>
      ) : null}
      {loading ? <Text style={styles.sub}>Loading activity…</Text> : null}
      {!loading && filtered.length === 0 ? <Text style={styles.sub}>No sign-ins in this period.</Text> : null}
      {filtered.slice(0, 12).map((r) => (
        <View key={r.session_id} style={styles.session}>
          <Text style={styles.name}>{r.display_name || r.email || 'Team member'}</Text>
          <Text style={styles.sub}>
            In {new Date(r.started_at).toLocaleString()} · {r.ended_at ? `Out ${new Date(r.ended_at).toLocaleString()}` : 'Still active'}
          </Text>
          <Text style={styles.sub}>
            {r.messages_sent} msgs · {r.orders_handled} orders
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground },
  name: { fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  member: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 8 },
  session: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8, gap: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
