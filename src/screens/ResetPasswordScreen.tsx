import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { invokeErrorMessage } from '../lib/functionError';
import { APP_ORIGIN } from '../config';
import type { PasswordResetLink } from '../lib/passwordResetLink';
import { useToast } from '../hooks/useToast';
import { Button, Card, Input } from '../components/ui';
import { KeyboardScreen } from '../components/KeyboardSheet';
import { colors, radius } from '../theme';

type Stage = 'loading' | 'form' | 'expired';

export function ResetPasswordScreen({
  link,
  onDone,
}: {
  link: PasswordResetLink;
  onDone: () => void;
}) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [expiredReason, setExpiredReason] = useState<'expired' | 'used' | null>(null);

  const tokenHashRef = useRef<string | null>(null);
  const resetTokenRef = useRef<string | null>(null);
  const verifiedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        verifiedRef.current = true;
        setStage('form');
      }
    });

    (async () => {
      try {
        if (link.rt) {
          const { data, error } = await supabase.functions.invoke('complete-password-reset', {
            body: { token: link.rt, check: true },
          });
          if (error || !data?.ok) {
            const code = await invokeErrorMessage(error, data);
            setExpiredReason(code === 'used_link' ? 'used' : 'expired');
            setStage('expired');
            return;
          }
          resetTokenRef.current = link.rt;
          setStage('form');
          return;
        }

        if (link.errorDescription) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            verifiedRef.current = true;
            setStage('form');
            return;
          }
          setStage('expired');
          return;
        }

        if (link.tokenHash) {
          tokenHashRef.current = link.tokenHash;
          setStage('form');
          return;
        }

        if (link.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              verifiedRef.current = true;
              setStage('form');
              return;
            }
            setStage('expired');
            return;
          }
          verifiedRef.current = true;
          setStage('form');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          verifiedRef.current = true;
          setStage('form');
        } else {
          setStage('expired');
        }
      } catch {
        setStage('expired');
      }
    })();

    return () => subscription.unsubscribe();
  }, [link]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);

    if (resetTokenRef.current) {
      const { data, error } = await supabase.functions.invoke('complete-password-reset', {
        body: { token: resetTokenRef.current, password },
      });
      if (error || !data?.ok) {
        const msg = await invokeErrorMessage(error, data);
        setSaving(false);
        if (['invalid_link', 'used_link', 'expired_link'].includes(msg) || !msg) {
          setExpiredReason(msg === 'used_link' ? 'used' : 'expired');
          setStage('expired');
        } else {
          toast.error(msg);
        }
        return;
      }
      setSaving(false);
      toast.success('Password updated. Please sign in.');
      await supabase.auth.signOut();
      onDone();
      return;
    }

    if (!verifiedRef.current && tokenHashRef.current) {
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHashRef.current,
      });
      if (error) {
        setSaving(false);
        setStage('expired');
        return;
      }
      verifiedRef.current = true;
      tokenHashRef.current = null;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated. Please sign in.');
    await supabase.auth.signOut();
    onDone();
  };

  const handleResend = async () => {
    const target = resendEmail.trim();
    if (!target) return;
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${APP_ORIGIN}/reset-password`,
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('New reset link sent. Check your email and open the newest one.');
  };

  const description =
    stage === 'form'
      ? 'Enter a new password for your account.'
      : stage === 'expired'
        ? expiredReason === 'used'
          ? 'This reset link was already used to set a password.'
          : 'This reset link has expired (links last 1 hour) or a newer one was sent.'
        : 'Opening your reset link…';

  return (
    <KeyboardScreen>
      <View style={styles.wrap}>
        <Card>
          <View style={styles.icon}>
            <KeyRound size={20} color="#fff" />
          </View>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.sub}>{description}</Text>

          {stage === 'expired' ? (
            <View style={styles.form}>
              <Text style={styles.sub}>
                Enter your email and we'll send you a fresh link. Open the newest email — it works in any browser or
                phone.
              </Text>
              <Input
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={resendEmail}
                onChangeText={setResendEmail}
              />
              <Button title="Send me a new link" loading={resending} onPress={handleResend} />
              <Button title="Back to sign in" variant="outline" onPress={onDone} />
            </View>
          ) : stage === 'loading' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>New password</Text>
              <View>
                <Input
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.passwordInput}
                />
                <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
                </Pressable>
              </View>
              <Text style={styles.label}>Confirm password</Text>
              <View>
                <Input
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  value={confirm}
                  onChangeText={setConfirm}
                  style={styles.passwordInput}
                />
                <Pressable style={styles.eye} onPress={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
                </Pressable>
              </View>
              <Button title="Update password" loading={saving} onPress={handleSubmit} />
            </View>
          )}
        </Card>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: colors.background },
  icon: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  form: { gap: 10 },
  passwordInput: { paddingRight: 40 },
  eye: { position: 'absolute', right: 12, top: 14 },
});
