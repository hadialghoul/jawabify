import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { VERTICALS, type Vertical } from '../lib/verticals';
import { Button, Card, Input } from '../components/ui';
import { colors, radius } from '../theme';
import { WEB_ORIGIN } from '../config';
import { KeyboardScreen } from '../components/KeyboardSheet';

export function OnboardingScreen() {
  const { user, tenantId, refreshContext, signOut } = useAuth();
  const toast = useToast();
  const initialVertical = ((user?.user_metadata as any)?.vertical || (user?.user_metadata as any)?.business_type) as Vertical | undefined;
  const [step, setStep] = useState<'identity' | 'details' | 'whatsapp'>('identity');
  const [vertical, setVertical] = useState<Vertical | null>(
    initialVertical && VERTICALS.some((v) => v.id === initialVertical) ? initialVertical : null,
  );
  const [firstName, setFirstName] = useState<string>((user?.user_metadata as any)?.first_name ?? '');
  const [familyName, setFamilyName] = useState<string>((user?.user_metadata as any)?.family_name ?? '');
  const [businessName, setBusinessName] = useState<string>((user?.user_metadata as any)?.business_name ?? '');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('country, city, contact_phone, onboarding_completed').eq('user_id', user.id).maybeSingle();
      if (data) {
        setCountry(data.country ?? '');
        setCity(data.city ?? '');
        setContactPhone(data.contact_phone ?? '');
        if (data.onboarding_completed) setStep('whatsapp');
      }
    })();
  }, [user]);

  const ensureTenant = useCallback(async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    if (createdTenantId) return createdTenantId;
    if (!user) return null;
    const displayName = user.user_metadata?.business_name || user.user_metadata?.display_name || 'My Business';
    const { data, error } = await supabase.functions.invoke('create-tenant', {
      body: { name: displayName, vertical: vertical ?? 'ecommerce' },
    });
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || 'Failed to create tenant');
      return null;
    }
    setCreatedTenantId(data.tenant_id);
    return data.tenant_id;
  }, [user, tenantId, createdTenantId, vertical, toast]);

  return (
    <KeyboardScreen>
      <Text style={styles.brand}>Jawabify</Text>
      <Card>
        {step === 'identity' ? (
          <>
            <Text style={styles.title}>Your business</Text>
            <Input placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <Input placeholder="Family name" value={familyName} onChangeText={setFamilyName} />
            <Input placeholder="Business name" value={businessName} onChangeText={setBusinessName} />
            <Text style={styles.label}>Type of business</Text>
            <View style={styles.chips}>
              {VERTICALS.map((v) => (
                <Pressable key={v.id} onPress={() => setVertical(v.id)} style={[styles.chip, vertical === v.id && styles.chipOn]}>
                  <Text style={[styles.chipText, vertical === v.id && { color: colors.primary }]}>
                    {v.emoji} {v.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              title={savingIdentity ? 'Saving...' : 'Continue'}
              loading={savingIdentity}
              onPress={async () => {
                if (!firstName.trim() || !familyName.trim() || !businessName.trim() || !vertical) {
                  toast.error('Please complete all fields');
                  return;
                }
                setSavingIdentity(true);
                const { error } = await supabase.auth.updateUser({
                  data: {
                    first_name: firstName.trim(),
                    family_name: familyName.trim(),
                    display_name: `${firstName.trim()} ${familyName.trim()}`,
                    business_name: businessName.trim(),
                    business_type: vertical,
                    vertical,
                  },
                });
                setSavingIdentity(false);
                if (error) toast.error(error.message);
                else setStep('details');
              }}
            />
          </>
        ) : null}

        {step === 'details' ? (
          <>
            <Text style={styles.title}>Business details</Text>
            <Input placeholder="Country" value={country} onChangeText={setCountry} />
            <Input placeholder="City" value={city} onChangeText={setCity} />
            <Input placeholder="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
            <Button
              title={savingDetails ? 'Saving...' : 'Continue'}
              loading={savingDetails}
              onPress={async () => {
                if (!user) return;
                if (!country.trim() || !city.trim() || !contactPhone.trim()) {
                  toast.error('Please fill in all fields');
                  return;
                }
                setSavingDetails(true);
                const tid = await ensureTenant();
                const { error } = await supabase
                  .from('profiles')
                  .update({
                    country: country.trim(),
                    city: city.trim(),
                    contact_phone: contactPhone.trim(),
                    onboarding_completed: true,
                  })
                  .eq('user_id', user.id);
                setSavingDetails(false);
                if (error) toast.error(error.message);
                else {
                  if (tid) await refreshContext();
                  setStep('whatsapp');
                }
              }}
            />
            <Button title="Back" variant="ghost" onPress={() => setStep('identity')} />
          </>
        ) : null}

        {step === 'whatsapp' ? (
          <>
            <Text style={styles.title}>Connect WhatsApp</Text>
            <Text style={styles.muted}>
              WhatsApp Business signup uses Facebook. You can connect now in the browser, or skip and do it later from Settings.
            </Text>
            <Button
              title="Connect WhatsApp"
              onPress={async () => {
                await ensureTenant();
                await refreshContext();
                await WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/onboarding`);
                await refreshContext();
              }}
            />
            <Button
              title="Skip for now"
              variant="outline"
              onPress={async () => {
                await ensureTenant();
                await refreshContext();
              }}
            />
          </>
        ) : null}
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </Card>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  brand: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.foreground, marginTop: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  muted: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  label: { fontWeight: '700', color: colors.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
});
