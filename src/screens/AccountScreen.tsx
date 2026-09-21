import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { WEB_ORIGIN } from '../config';

interface ProfileForm {
  display_name: string;
  business_name: string;
  country: string;
  city: string;
  address: string;
  contact_phone: string;
  website: string;
}

const EMPTY: ProfileForm = {
  display_name: '',
  business_name: '',
  country: '',
  city: '',
  address: '',
  contact_phone: '',
  website: '',
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setProfile({
          display_name: data.display_name || '',
          business_name: data.business_name || '',
          country: data.country || '',
          city: data.city || '',
          address: data.address || '',
          contact_phone: data.contact_phone || '',
          website: data.website || '',
        });
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h2}>Profile</Text>
        <Input placeholder="Display name" value={profile.display_name} onChangeText={(v) => setProfile({ ...profile, display_name: v })} />
        <Input placeholder="Business name" value={profile.business_name} onChangeText={(v) => setProfile({ ...profile, business_name: v })} />
        <Input placeholder="Country" value={profile.country} onChangeText={(v) => setProfile({ ...profile, country: v })} />
        <Input placeholder="City" value={profile.city} onChangeText={(v) => setProfile({ ...profile, city: v })} />
        <Input placeholder="Address" value={profile.address} onChangeText={(v) => setProfile({ ...profile, address: v })} />
        <Input placeholder="Phone" value={profile.contact_phone} onChangeText={(v) => setProfile({ ...profile, contact_phone: v })} />
        <Input placeholder="Website" value={profile.website} onChangeText={(v) => setProfile({ ...profile, website: v })} autoCapitalize="none" />
        <Button
          title={saving ? 'Saving...' : 'Save profile'}
          loading={saving || loading}
          onPress={async () => {
            if (!user) return;
            setSaving(true);
            const { error } = await supabase.from('profiles').update(profile).eq('user_id', user.id);
            setSaving(false);
            if (error) toast.error('Could not save profile');
            else toast.success('Profile updated');
          }}
        />

        <Text style={styles.h2}>Email</Text>
        <Text style={styles.sub}>{user?.email}</Text>
        <Button
          title="Send password reset email"
          variant="outline"
          onPress={async () => {
            if (!user?.email) return;
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${WEB_ORIGIN}/reset-password` });
            if (error) toast.error(error.message);
            else toast.success('Password reset link sent');
          }}
        />

        <Text style={styles.h2}>Change password</Text>
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
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.header, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, gap: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  pad: { padding: 16, gap: 10, paddingBottom: 48 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 8 },
  sub: { color: colors.mutedForeground },
});
