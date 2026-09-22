import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Check, X } from 'lucide-react';
import { VERTICALS } from '@/lib/verticals';
import { SignInShowcase } from '@/components/auth/SignInShowcase';
import { SignUpShowcase } from '@/components/auth/SignUpShowcase';
import { Helmet } from 'react-helmet-async';
import { trackStartTrial, trackCompleteRegistration, trackLead } from '@/lib/pixel';
import { readShopFromUrl, withShop } from '@/lib/shopifyEmbedded';


const APP_HISTORY_LOCK_KEY = 'jawabify_app_history_locked';

const HEARD_ABOUT_OPTIONS = [
  'Facebook',
  'Instagram',
  'TikTok',
  'Marketing email',
  'Ads',
  'Search Engines',
  'Word of mouth',
  'Other',
] as const;

type AuthMode = 'signin' | 'signup' | 'forgot';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: (p: string) => /\d/.test(p) },
  { label: 'One special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function missingPasswordRules(p: string) {
  return PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
}

export default function Auth() {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlMode = searchParams.get('mode') as AuthMode | null;
  // A Shopify App Store install can land here before the merchant has an account.
  // The shop is carried in the URL only — never localStorage / cookies — so the
  // flow works in incognito with third-party cookies blocked (Shopify 1.1.1).
  const shopifyInstallShop = readShopFromUrl(searchParams.toString());

  const [mode, setMode] = useState<AuthMode>(
    urlMode === 'signup' || urlMode === 'forgot' ? urlMode : 'signin'
  );
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

  // While on the "waiting to verify" panel, auto-advance the moment the
  // email is verified — even when verification happens on another device.
  // On the originating device we also silently sign in with the credentials
  // still in the form, because signUp does not create a session until the
  // email is confirmed.
  useEffect(() => {
    if (!pendingVerificationEmail) return;

    const isSameAccount = (candidate?: string | null) =>
      !!candidate && candidate.toLowerCase() === pendingVerificationEmail.toLowerCase();

    let cancelled = false;
    const tryAdvance = async () => {
      // refreshSession() is what actually picks up email_confirmed_at on this device.
      await supabase.auth.refreshSession();
      if (cancelled) return;
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user?.email_confirmed_at && isSameAccount(data.user.email)) {
          window.sessionStorage.setItem(APP_HISTORY_LOCK_KEY, 'true');
          navigate(withShop('/onboarding', shopifyInstallShop), { replace: true });
        return;
      }
      if (password) {
        const { data: signIn } = await supabase.auth.signInWithPassword({
          email: pendingVerificationEmail,
          password,
        });
        if (cancelled) return;
        if (signIn?.user?.email_confirmed_at && isSameAccount(signIn.user.email)) {
            window.sessionStorage.setItem(APP_HISTORY_LOCK_KEY, 'true');
            navigate(withShop('/onboarding', shopifyInstallShop), { replace: true });
        }
      }
    };

    tryAdvance();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at && isSameAccount(session.user.email)) {
        window.sessionStorage.setItem(APP_HISTORY_LOCK_KEY, 'true');
        navigate(withShop('/onboarding', shopifyInstallShop), { replace: true });
      }
    });

    const interval = window.setInterval(tryAdvance, 4000);

    // Listen for verification finishing in another tab on the same device.
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('jawabify-auth');
      bc.onmessage = (e) => {
        if (e?.data?.type === 'verified') tryAdvance();
      };
    } catch {}

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearInterval(interval);
      bc?.close();
    };
  }, [pendingVerificationEmail, password, navigate]);

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setResendingVerification(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingVerificationEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResendingVerification(false);
    if (error) toast.error(error.message);
    else toast.success('Verification email resent.');
  };

  const handleSendReset = async () => {
    const target = (resetEmail || email).trim();
    if (!target) {
      toast.error('Enter your email address');
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset link sent. Check your email.');
      setMode('signin');
      setResetEmail('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const routeAuthenticatedUser = async (userId: string) => {
    const [{ data: roleRow }, { data: member }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'super_admin').maybeSingle(),
      supabase.from('tenant_members').select('tenant_id').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (roleRow) navigate('/super-admin', { replace: true });
    else if (member?.tenant_id) navigate(withShop('/app', shopifyInstallShop), { replace: true });
    else navigate(withShop('/onboarding', shopifyInstallShop), { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const missing = missingPasswordRules(password);
        if (missing.length > 0) {
          toast.error(`Your password needs: ${missing.join(', ').toLowerCase()}`);
          setSubmitting(false);
          return;
        }
        const referralSource = heardAbout === 'Other' ? heardAboutOther.trim() : heardAbout;
        trackStartTrial({ content_name: 'Auth Sign Up Form', value: '0.00', currency: 'USD' });
        // Never let a previously signed-in account (e.g. admin) leak into a new
        // signup: signUp() does not replace an existing session.
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session && existing.session.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
          window.sessionStorage.removeItem(APP_HISTORY_LOCK_KEY);
          await supabase.auth.signOut();
        }
        const displayName = `${firstName.trim()} ${familyName.trim()}`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,

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
        // Supabase returns a user with empty identities[] when the email is already registered.
        const identities = (signUpData?.user as any)?.identities;
        if (signUpData?.user && Array.isArray(identities) && identities.length === 0) {
          toast.error('An account with this email already exists. Please sign in to continue.');
          setMode('signin');
          setSubmitting(false);
          return;
        }
        trackLead({ content_name: 'Auth Sign Up', status: 'success' });
        trackCompleteRegistration({ content_name: 'Auth Sign Up', status: 'success' });
        // Fire-and-forget welcome email with onboarding call CTA.
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'signup-welcome',
            recipientEmail: email,
            idempotencyKey: `signup-welcome-${signUpData?.user?.id ?? email}`,
            templateData: { firstName: firstName.trim(), businessName: businessName.trim() },
          },
        }).catch((e) => console.warn('signup-welcome email failed', e));
        // Fire-and-forget internal notifications of the new signup.
        ['Info@theleadsbridge.com', 'jawabify@gmail.com'].forEach((notifyEmail) => {
          supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'internal-signup-alert',
              recipientEmail: notifyEmail,
              idempotencyKey: `internal-signup-alert-${notifyEmail}-${signUpData?.user?.id ?? email}`,
              templateData: {
                email,
                firstName: firstName.trim(),
                businessName: businessName.trim(),
                businessType: businessType?.trim?.() || '',
                signedUpAt: new Date().toISOString(),
                referralSource,
              },
            },
          }).catch((e) => console.warn('internal signup alert failed', e));
        });

        setPendingVerificationEmail(email);
        toast.success('Check your email to verify your account.');
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('not confirmed') || msg.includes('not verified') || msg.includes('confirm')) {
            // The local session may simply be stale — try a refresh first.
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (
              refreshed?.user?.email_confirmed_at &&
              refreshed.user.email?.toLowerCase() === email.trim().toLowerCase()
            ) {

              window.sessionStorage.setItem(APP_HISTORY_LOCK_KEY, 'true');
              await routeAuthenticatedUser(refreshed.user.id);
              return;
            }
            // Otherwise show the waiting panel and resend a fresh link.
            setPendingVerificationEmail(email);
            await supabase.auth.resend({
              type: 'signup',
              email,
              options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            toast.info('Please verify your email. We just sent a new link.');
            setSubmitting(false);
            return;
          }
          throw error;
        }
        window.sessionStorage.setItem(APP_HISTORY_LOCK_KEY, 'true');
        await routeAuthenticatedUser(signInData.user!.id);
      }
    } catch (error: any) {
      const raw = String(error?.message ?? '');
      // Supabase returns a vague "weak password" message — tell the user exactly
      // which requirements are still missing.
      if (/weak.?password|password.*(should|must)/i.test(raw)) {
        const missing = missingPasswordRules(password);
        toast.error(
          missing.length
            ? `Password too weak. Add: ${missing.join(', ').toLowerCase()}`
            : 'Password too weak. Try a longer password that is not a common one.',
        );
      } else {
        toast.error(raw || 'Authentication failed');
      }
    }
    setSubmitting(false);
  };

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <div className="flex min-h-screen bg-background safe-top safe-bottom">
      <Helmet>
        <title>Sign in to Jawabify — AI WhatsApp Messaging</title>
        <meta name="description" content="Sign in or create your Jawabify account to manage WhatsApp conversations, orders and AI auto‑replies for your business." />
        <link rel="canonical" href="https://jawabify.com/auth" />
        <meta property="og:title" content="Sign in to Jawabify" />
        <meta property="og:url" content="https://jawabify.com/auth" />
      </Helmet>
      <h1 className="sr-only">Sign in to Jawabify</h1>
      <div className="hidden md:block md:w-1/2">
        {isSignUp ? <SignUpShowcase /> : <SignInShowcase />}
      </div>
      <div className="flex w-full items-center justify-center p-4 md:w-1/2">
        {pendingVerificationEmail ? (
          <Card className="w-full max-w-md border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </div>
              <CardTitle className="text-2xl">Waiting to verify account</CardTitle>
              <CardDescription>
                We sent a verification link to <span className="font-medium text-foreground">{pendingVerificationEmail}</span>. Click it from this device to continue setting up your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Didn't get the email? Check your spam folder or resend it below.
              </p>
              <Button onClick={handleResendVerification} disabled={resendingVerification} variant="outline" className="w-full">
                {resendingVerification ? 'Resending...' : 'Resend verification email'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { setPendingVerificationEmail(null); setMode('signin'); }}
              >
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card className="w-full max-w-md border-0 shadow-none md:border md:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isForgot ? (
                'Reset Password'
              ) : (
                <Link
                  to="/"
                  className="inline-block text-foreground hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  aria-label="Go back to home page"
                >
                  Jawabify
                </Link>
              )}
            </CardTitle>
            <CardDescription>
              {isForgot
                ? 'Enter your account email. We\'ll send you a verification link.'
                : isSignUp
                  ? 'Create your account'
                  : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isForgot ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSendReset}
                  disabled={sendingReset || !resetEmail.trim()}
                  className="w-full"
                >
                  {sendingReset ? 'Sending...' : 'Send reset link'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setMode('signin')}
                  className="w-full"
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name">First name</Label>
                      <Input id="first-name" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="family-name">Family name</Label>
                      <Input id="family-name" placeholder="Doe" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="business">Business name</Label>
                      <Input id="business" placeholder="Acme Co." value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type of business</Label>
                      <Select value={businessType} onValueChange={setBusinessType} required>
                        <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                        <SelectContent>
                          {VERTICALS.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              <span className="mr-2">{v.emoji}</span>{v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <p className="text-xs font-medium text-destructive">
                          Warning: your vertical sets your dashboard layout and AI defaults. Once chosen, it cannot be changed later.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>How did you hear about us?</Label>
                      <Select value={heardAbout} onValueChange={setHeardAbout} required>
                        <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                        <SelectContent>
                          {HEARD_ABOUT_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {heardAbout === 'Other' && (
                        <Input
                          placeholder="Please tell us how"
                          value={heardAboutOther}
                          onChange={(e) => setHeardAboutOther(e.target.value)}
                          required
                        />
                      )}
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isSignUp && (
                    <ul className="mt-2 space-y-1" aria-live="polite">
                      {PASSWORD_RULES.map((rule) => {
                        const ok = rule.test(password);
                        return (
                          <li
                            key={rule.label}
                            className={`flex items-center gap-1.5 text-xs ${ok ? 'text-primary' : 'text-muted-foreground'}`}
                          >
                            {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {isSignUp && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="agree"
                      checked={agreed}
                      onCheckedChange={(val) => setAgreed(val === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="agree" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                      By signing up, you accept our{' '}
                      <Link to="/privacy" className="font-medium text-primary hover:underline">Terms of Service and Privacy Notice.</Link>
                    </Label>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submitting || (isSignUp && !agreed)}>
                  {submitting ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
                </Button>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setResetEmail(email); setMode('forgot'); }}
                    className="block w-full text-center text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
                {mode === 'signin' && (
                  <p className="text-center text-xs leading-relaxed text-muted-foreground">
                    By continuing, you agree to our{' '}
                    <Link to="/privacy" className="font-medium text-primary hover:underline">
                      Terms and Privacy Policy
                    </Link>
                    .
                  </p>
                )}
              </form>
            )}
            {!isForgot && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => setMode(isSignUp ? 'signin' : 'signup')}
                  className="text-primary hover:underline font-medium"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
