import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Building2, CreditCard, KeyRound, LogOut, Mail, Save, Trash2, UserRound } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { WEB_ORIGIN } from '../config';
import { ScreenHeader } from '../components/ScreenHeader';
import { KeyboardForm } from '../components/KeyboardSheet';
import { BillingCard } from '../components/settings/BillingCard';

interface ProfileForm {
  display_name: string;
  business_name: string;
  business_type: string;
  country: string;
  city: string;
  address: string;
  contact_phone: string;
  website: string;
  expected_volume: string;
  referral_source: string;
}

const EMPTY: ProfileForm = {
  display_name: '',
  business_name: '',
  business_type: '',
  country: '',
  city: '',
  address: '',
  contact_phone: '',
  website: '',
  expected_volume: '',
  referral_source: '',
};

export function AccountScreen({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setProfile({
          display_name: data.display_name || '',
          business_name: data.business_name || '',
          business_type: data.business_type || '',
          country: data.country || '',
          city: data.city || '',
          address: data.address || '',
          contact_phone: data.contact_phone || '',
          website: data.website || '',
          expected_volume: data.expected_volume || '',
          referral_source: data.referral_source || '',
        });
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Account" onBack={onBack} />
      <KeyboardForm contentStyle={styles.pad}>
        <View style={styles.sectionHead}>
          <CreditCard size={16} color={colors.primary} />
          <Text style={styles.h2}>Payment & billing</Text>
        </View>
        <BillingCard />

        <View style={styles.sectionHead}>
          <UserRound size={16} color={colors.primary} />
          <Text style={styles.h2}>Personal information</Text>
        </View>
        <Input placeholder="Display name" value={profile.display_name} onChangeText={(v) => setProfile({ ...profile, display_name: v })} />
        <Input placeholder="Contact phone" value={profile.contact_phone} onChangeText={(v) => setProfile({ ...profile, contact_phone: v })} />

        <View style={styles.sectionHead}>
          <Building2 size={16} color={colors.primary} />
          <Text style={styles.h2}>Business information</Text>
        </View>
        <Input placeholder="Business name" value={profile.business_name} onChangeText={(v) => setProfile({ ...profile, business_name: v })} />
        <Input placeholder="Business type" value={profile.business_type} onChangeText={(v) => setProfile({ ...profile, business_type: v })} />
        <Input placeholder="Country" value={profile.country} onChangeText={(v) => setProfile({ ...profile, country: v })} />
        <Input placeholder="City" value={profile.city} onChangeText={(v) => setProfile({ ...profile, city: v })} />
        <Input placeholder="Address" value={profile.address} onChangeText={(v) => setProfile({ ...profile, address: v })} />
        <Input placeholder="Website" value={profile.website} onChangeText={(v) => setProfile({ ...profile, website: v })} autoCapitalize="none" />
        <Input placeholder="Expected monthly volume" value={profile.expected_volume} onChangeText={(v) => setProfile({ ...profile, expected_volume: v })} />
        <Input placeholder="How did you hear about us" value={profile.referral_source} onChangeText={(v) => setProfile({ ...profile, referral_source: v })} />
        <Button
          title={saving ? 'Saving...' : 'Save profile'}
          loading={saving || loading}
          icon={!saving ? <Save size={14} color="#fff" /> : undefined}
          onPress={async () => {
            if (!user) return;
            setSaving(true);
            const { error } = await supabase.from('profiles').update(profile).eq('user_id', user.id);
            setSaving(false);
            if (error) toast.error('Could not save profile');
            else toast.success('Profile updated');
          }}
        />

        <View style={styles.sectionHead}>
          <Mail size={16} color={colors.primary} />
          <Text style={styles.h2}>Email address</Text>
        </View>
        <Text style={styles.sub}>{user?.email}</Text>
        <Input placeholder="New email" autoCapitalize="none" keyboardType="email-address" value={newEmail} onChangeText={setNewEmail} />
        <Button
          title={savingEmail ? 'Sending…' : 'Send confirmation'}
          loading={savingEmail}
          disabled={!newEmail.trim()}
          onPress={async () => {
            if (!newEmail.trim() || newEmail === user?.email) {
              toast.error('Enter a different email address');
              return;
            }
            setSavingEmail(true);
            const { error } = await supabase.auth.updateUser(
              { email: newEmail.trim() },
              { emailRedirectTo: `${WEB_ORIGIN}/account` },
            );
            setSavingEmail(false);
            if (error) toast.error(error.message);
            else {
              toast.success('Confirmation links sent to both emails');
              setNewEmail('');
            }
          }}
        />
        <Button
          title="Send password reset email"
          variant="outline"
          icon={<Mail size={14} color={colors.foreground} />}
          onPress={async () => {
            if (!user?.email) return;
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${WEB_ORIGIN}/reset-password` });
            if (error) toast.error(error.message);
            else toast.success('Password reset link sent');
          }}
        />

        <View style={styles.sectionHead}>
          <KeyRound size={16} color={colors.primary} />
          <Text style={styles.h2}>Change password</Text>
        </View>
        <Input placeholder="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
        <Input placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <Input placeholder="Confirm new password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
        <Button
          title="Update password"
          variant="outline"
          onPress={async () => {
            if (!user?.email) return;
            if (newPassword !== confirmPassword) {
              toast.error('Passwords do not match');
              return;
            }
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
            if (signInError) {
              toast.error('Current password is incorrect');
              return;
            }
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) toast.error(error.message);
            else {
              toast.success('Password updated');
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }
          }}
        />

        <Button
          title="Delete account"
          variant="destructive"
          icon={<Trash2 size={14} color="#fff" />}
          onPress={() =>
            Alert.alert('Delete account', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  const { error } = await supabase.functions.invoke('delete-account');
                  if (error) toast.error(error.message);
                  else {
                    toast.success('Account deleted');
                    await signOut();
                  }
                },
              },
            ])
          }
        />
        <Button title="Sign out" variant="ghost" icon={<LogOut size={14} color={colors.primary} />} onPress={signOut} />
      </KeyboardForm>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 10 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sub: { color: colors.mutedForeground },
});
