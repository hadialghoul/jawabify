import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Eye, EyeOff, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { WEB_ORIGIN } from '../config';
import { VERTICALS } from '../lib/verticals';
import { Button, Card, Input } from '../components/ui';
import { colors, radius } from '../theme';

const HEARD_ABOUT = ['Facebook', 'Instagram', 'TikTok', 'Marketing email', 'Ads', 'Search Engines', 'Word of mouth', 'Other'] as const;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: (p: string) => /\d/.test(p) },
  { label: 'One special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

type AuthMode = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const { loading } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [heardAbout, setHeardAbout] = useState('');
  const [heardAboutOther, setHeardAboutOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!pendingVerificationEmail) return;
    let cancelled = false;
    const tryAdvance = async () => {
      await supabase.auth.refreshSession();
      if (cancelled) return;
      const { data } = await supabase.auth.getUser();
      if (data.user?.email_confirmed_at && data.user.email?.toLowerCase() === pendingVerificationEmail.toLowerCase()) {
        setPendingVerificationEmail(null);
        return;
      }
      if (password) {
        const { data: signIn } = await supabase.auth.signInWithPassword({ email: pendingVerificationEmail, password });
        if (signIn?.user?.email_confirmed_at) setPendingVerificationEmail(null);
      }
    };
    tryAdvance();
    const interval = setInterval(tryAdvance, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingVerificationEmail, password]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        if (!firstName.trim() || !familyName.trim() || !businessName.trim() || !businessType) {
          toast.error('Please complete all fields');
          setSubmitting(false);
          return;
        }
        if (!heardAbout || (heardAbout === 'Other' && !heardAboutOther.trim())) {
          toast.error('Please tell us how you heard about us');
          setSubmitting(false);
          return;
        }
        const missing = PASSWORD_RULES.filter((r) => !r.test(password));
        if (missing.length) {
          toast.error(`Your password needs: ${missing.map((m) => m.label).join(', ').toLowerCase()}`);
          setSubmitting(false);
          return;
        }
        const referralSource = heardAbout === 'Other' ? heardAboutOther.trim() : heardAbout;
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session && existing.session.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
          await supabase.auth.signOut();
        }
        const displayName = `${firstName.trim()} ${familyName.trim()}`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${WEB_ORIGIN}/auth/callback`,
            data: {
              display_name: displayName,
              first_name: firstName.trim(),
              family_name: familyName.trim(),
              business_name: businessName.trim(),
              business_type: businessType,
              vertical: businessType,
              referral_source: referralSource,
            },
          },
        });
        if (error) throw error;
        const identities = (signUpData?.user as any)?.identities;
        if (signUpData?.user && Array.isArray(identities) && identities.length === 0) {
          toast.error('An account with this email already exists. Please sign in to continue.');
          setMode('signin');
          setSubmitting(false);
          return;
        }
        supabase.functions
          .invoke('send-transactional-email', {
            body: {
              templateName: 'signup-welcome',
              recipientEmail: email,
              idempotencyKey: `signup-welcome-${signUpData?.user?.id ?? email}`,
              templateData: { firstName: firstName.trim(), businessName: businessName.trim() },
            },
          })
          .catch(() => {});
        setPendingVerificationEmail(email);
        toast.success('Check your email to verify your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('not confirmed') || msg.includes('not verified') || msg.includes('confirm')) {
            setPendingVerificationEmail(email);
            await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${WEB_ORIGIN}/auth/callback` } });
            toast.info('Please verify your email. We just sent a new link.');
            setSubmitting(false);
            return;
          }
          throw error;
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Authentication failed');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.brand}>Jawabify</Text>
        </View>

        {pendingVerificationEmail ? (
          <Card>
            <Text style={styles.title}>Waiting to verify account</Text>
            <Text style={styles.muted}>We sent a verification link to {pendingVerificationEmail}. Open it, then return here.</Text>
            <Button
              title={resendingVerification ? 'Resending...' : 'Resend verification email'}
              variant="outline"
              loading={resendingVerification}
              onPress={async () => {
                setResendingVerification(true);
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: pendingVerificationEmail,
                  options: { emailRedirectTo: `${WEB_ORIGIN}/auth/callback` },
                });
                setResendingVerification(false);
                if (error) toast.error(error.message);
                else toast.success('Verification email resent.');
              }}
            />
            <Button title="Back to sign in" variant="ghost" onPress={() => { setPendingVerificationEmail(null); setMode('signin'); }} />
          </Card>
        ) : mode === 'forgot' ? (
          <Card>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.muted}>Enter your account email. We'll send you a verification link.</Text>
            <Input placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={resetEmail} onChangeText={setResetEmail} />
            <Button
              title={sendingReset ? 'Sending...' : 'Send reset link'}
              loading={sendingReset}
              disabled={!resetEmail.trim()}
              onPress={async () => {
                setSendingReset(true);
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: `${WEB_ORIGIN}/reset-password` });
                setSendingReset(false);
                if (error) toast.error(error.message);
                else {
                  toast.success('Password reset link sent. Check your email.');
                  setMode('signin');
                }
              }}
            />
            <Button title="Back to sign in" variant="ghost" onPress={() => setMode('signin')} />
          </Card>
        ) : (
          <Card>
            <Text style={styles.title}>{mode === 'signup' ? 'Create your account' : 'Sign in to your account'}</Text>
            {mode === 'signup' ? (
              <>
                <Input placeholder="First name" value={firstName} onChangeText={setFirstName} />
                <Input placeholder="Family name" value={familyName} onChangeText={setFamilyName} />
                <Input placeholder="Business name" value={businessName} onChangeText={setBusinessName} />
                <Text style={styles.label}>Type of business</Text>
                <View style={styles.chips}>
                  {VERTICALS.map((v) => (
                    <Pressable key={v.id} onPress={() => setBusinessType(v.id)} style={[styles.chip, businessType === v.id && styles.chipOn]}>
                      <Text style={[styles.chipText, businessType === v.id && { color: colors.primary }]}>
                        {v.emoji} {v.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.warn}>Warning: your vertical sets your dashboard layout and cannot be changed later.</Text>
                <Text style={styles.label}>How did you hear about us?</Text>
                <View style={styles.chips}>
                  {HEARD_ABOUT.map((opt) => (
                    <Pressable key={opt} onPress={() => setHeardAbout(opt)} style={[styles.chip, heardAbout === opt && styles.chipOn]}>
                      <Text style={[styles.chipText, heardAbout === opt && { color: colors.primary }]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
                {heardAbout === 'Other' ? <Input placeholder="Please tell us how" value={heardAboutOther} onChangeText={setHeardAboutOther} /> : null}
              </>
            ) : null}
            <Input placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <View>
              <Input placeholder="••••••••" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye}>
                {showPassword ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
              </Pressable>
            </View>
            {mode === 'signup'
              ? PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <View key={rule.label} style={styles.rule}>
                      {ok ? <Check size={14} color={colors.primary} /> : <X size={14} color={colors.mutedForeground} />}
                      <Text style={{ color: ok ? colors.primary : colors.mutedForeground, fontSize: 12 }}>{rule.label}</Text>
                    </View>
                  );
                })
              : null}
            {mode === 'signup' ? (
              <Pressable onPress={() => setAgreed((v) => !v)} style={styles.agree}>
                <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Check size={12} color="#fff" /> : null}</View>
                <Text style={styles.muted}>By signing up, you accept our Terms of Service and Privacy Notice.</Text>
              </Pressable>
            ) : null}
            <Button
              title={submitting ? 'Please wait...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
              loading={submitting}
              disabled={mode === 'signup' && !agreed}
              onPress={handleSubmit}
            />
            {mode === 'signin' ? (
              <Pressable onPress={() => { setResetEmail(email); setMode('forgot'); }}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
              <Text style={styles.switch}>
                {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.link}>{mode === 'signup' ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </Pressable>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  pad: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background, gap: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  logoMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  brand: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.foreground, marginBottom: 8 },
  muted: { color: colors.mutedForeground, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  warn: { fontSize: 12, color: colors.destructive, backgroundColor: 'rgba(240,68,68,0.1)', padding: 8, borderRadius: 8 },
  eye: { position: 'absolute', right: 12, top: 12 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agree: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  switch: { textAlign: 'center', color: colors.mutedForeground, marginTop: 8 },
});
