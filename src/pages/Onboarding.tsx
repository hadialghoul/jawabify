import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { claimShopifyInstall } from '@/lib/shopifyPendingInstall';
import { readShopFromUrl, withShop } from '@/lib/shopifyEmbedded';
import { Facebook, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { Vertical } from '@/lib/verticals';
import { VERTICALS } from '@/lib/verticals';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { SignUpShowcase } from '@/components/auth/SignUpShowcase';
import { trackCompleteRegistration, trackStartTrial, trackSubscribe } from '@/lib/pixel';


const META_APP_ID = '1392579008772004';
const META_CONFIG_ID = '1648388239943864';

// (Optional profile fields removed from onboarding — collected later in Settings if needed)


declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export default function Onboarding() {
  const { user, tenantId, hasCredentials, isSuperAdmin, loading } = useAuth();
  const embeddedSignupDataRef = useRef<any>(null);
  const [step, setStep] = useState<'identity' | 'details' | 'whatsapp'>('identity');
  const initialVertical = ((user?.user_metadata as any)?.vertical || (user?.user_metadata as any)?.business_type) as Vertical | undefined;
  const [vertical, setVertical] = useState<Vertical | null>(
    initialVertical && VERTICALS.some((v) => v.id === initialVertical) ? initialVertical : null
  );

  const [submitting, setSubmitting] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbConnected, setFbConnected] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

  // Identity (editable post-signup)
  const [firstName, setFirstName] = useState<string>((user?.user_metadata as any)?.first_name ?? '');
  const [familyName, setFamilyName] = useState<string>((user?.user_metadata as any)?.family_name ?? '');
  const [businessName, setBusinessName] = useState<string>((user?.user_metadata as any)?.business_name ?? '');

  // Business details (essentials only)
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');


  // Load any existing profile data and skip step if already filled
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('country, city, contact_phone, onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setCountry(data.country ?? '');
        setCity(data.city ?? '');
        setContactPhone(data.contact_phone ?? '');
        if (data.onboarding_completed) setStep('whatsapp');
        // otherwise leave at 'identity' so user can navigate back
      }
      const { data: member } = await supabase
        .from('tenant_members')
        .select('tenant_id, tenants:tenant_id(vertical)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (member?.tenant_id) {
        const v = (member as any)?.tenants?.vertical as Vertical | undefined;
        if (v) setVertical(v);
        if (data?.onboarding_completed) setStep('whatsapp');
      }
    })();
  }, [user]);




  useEffect(() => {
    const handleEmbeddedSignupMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('facebook.net')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event?.startsWith('FINISH')) {
          embeddedSignupDataRef.current = data.data || null;
        } else if (data.event === 'CANCEL' && data.data?.error_message) {
          toast.error(data.data.error_message);
        }
      } catch (_) {
        // Ignore non-JSON messages from the Facebook SDK.
      }
    };

    window.addEventListener('message', handleEmbeddedSignupMessage);

    const initFB = () => {
      if (!window.FB) return false;
      try {
        window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: true, version: 'v21.0' });
      } catch (_) { /* already initialized */ }
      setSdkReady(true);
      return true;
    };

    if (initFB()) return;

    window.fbAsyncInit = initFB;

    const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = initFB;
      document.body.appendChild(script);
    } else {
      existing.addEventListener('load', initFB);
      initFB();
    }

    const pollId = window.setInterval(() => { if (initFB()) window.clearInterval(pollId); }, 300);
    const stopId = window.setTimeout(() => window.clearInterval(pollId), 10000);
    return () => {
      window.removeEventListener('message', handleEmbeddedSignupMessage);
      window.clearInterval(pollId);
      window.clearTimeout(stopId);
    };
  }, []);

  const waitForEmbeddedSignupData = async () => {
    for (let i = 0; i < 10; i++) {
      if (embeddedSignupDataRef.current) return embeddedSignupDataRef.current;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return embeddedSignupDataRef.current;
  };

  const ensureTenant = useCallback(async (): Promise<string | null> => {
    if (tenantId) return tenantId;
    if (createdTenantId) return createdTenantId;
    if (!user) return null;
    try {
      const displayName = user.user_metadata?.business_name || user.user_metadata?.display_name || 'My Business';
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: { name: displayName, vertical: vertical ?? 'ecommerce' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create tenant');
      setCreatedTenantId(data.tenant_id);
      claimShopifyInstall(data.tenant_id).catch(() => {});
      return data.tenant_id;

    } catch (error: any) {
      console.error('Tenant creation error:', error);
      toast.error(error.message || 'Failed to create tenant');
      return null;
    }
  }, [user, tenantId, createdTenantId, vertical]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !familyName.trim() || !businessName.trim() || !vertical) {
      toast.error('Please complete all fields');
      return;
    }
    setSavingIdentity(true);
    try {
      const displayName = `${firstName.trim()} ${familyName.trim()}`;
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          family_name: familyName.trim(),
          display_name: displayName,
          business_name: businessName.trim(),
          business_type: vertical,
          vertical,
        },
      });
      if (error) throw error;
      trackCompleteRegistration({ content_name: 'Onboarding Identity', status: 'success' });
      setStep('details');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!country.trim() || !city.trim() || !contactPhone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          country: country.trim(),
          city: city.trim(),
          contact_phone: contactPhone.trim(),
          onboarding_completed: true,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      trackCompleteRegistration({ content_name: 'Onboarding Details', status: 'success' });
      setStep('whatsapp');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save details');
    } finally {
      setSavingDetails(false);
    }
  };


  const handleFacebookSignup = () => {
    if (!sdkReady || !window.FB) {
      toast.error('Facebook SDK is still loading. Please try again in a moment.');
      return;
    }
    setFbConnecting(true);
    embeddedSignupDataRef.current = null;

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          (async () => {
            try {
              const tId = await ensureTenant();
              if (!tId) { setFbConnecting(false); toast.error('Failed to set up your account.'); return; }
              const signupData = await waitForEmbeddedSignupData();
              const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
                body: {
                  code,
                  tenant_id: tId,
                  waba_id: signupData?.waba_id || signupData?.waba_ids?.[0],
                  phone_number_id: signupData?.phone_number_id,
                  business_id: signupData?.business_id,
                },
              });
              if (error) throw error;
              if (data?.success) {
                setFbConnected(true);
                if (data.warning) {
                  toast.error(data.warning, { duration: 15000 });
                } else {
                  toast.success(`WhatsApp Business connected! (${data.phone_number || 'your number'})`);
                }

              } else {
                toast.error(data?.error || 'Failed to complete WhatsApp connection');
              }
            } catch (err: any) {
              toast.error(err?.message || 'Failed to connect WhatsApp. Please try again.');

            } finally {
              setFbConnecting(false);
            }
          })();
        } else {
          toast.error('Facebook login was cancelled.');
          setFbConnecting(false);
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
      }
    );
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const tId = await ensureTenant();
      if (!tId) { setSubmitting(false); return; }
      trackStartTrial({ content_name: 'Onboarding Finish', status: 'success', value: '0.00', currency: 'USD' });
      toast.success(fbConnected ? 'Setup complete!' : 'You can connect WhatsApp anytime from Settings.');
      window.sessionStorage.setItem('jawabify_app_history_locked', 'true');
      // Merchants who arrived from a Shopify install go back to the connector
      // screen — never to a checkout inside/after the Shopify flow (policy 1.2.1).
      const shop = readShopFromUrl();
      window.location.href = shop ? withShop('/shopify/connect', shop) : '/subscribe';
    } catch (error: any) {

      toast.error(error.message || 'Failed to complete setup');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isSuperAdmin) return <Navigate to="/super-admin" replace />;
  if (tenantId) return <Navigate to="/app" replace />;

  if (step === 'identity') {
    return (
      <div className="flex min-h-screen bg-background safe-top safe-bottom"><div className="hidden md:block md:w-1/2"><SignUpShowcase /></div><div className="flex w-full items-center justify-center p-4 md:w-1/2">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Your details</CardTitle>
            <CardDescription>Step 1 of 3 — you can edit these anytime before finishing</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="first-name">First name</Label>
                <Input id="first-name" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="family-name">Family name</Label>
                <Input id="family-name" placeholder="Doe" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-name">Business name</Label>
                <Input id="business-name" placeholder="Acme Co." value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Type of business</Label>
                <Select value={vertical ?? ''} onValueChange={(v) => setVertical(v as Vertical)} required>
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

              <Button type="submit" className="w-full" disabled={savingIdentity}>
                {savingIdentity ? 'Saving...' : 'Continue'}
              </Button>
              <div className="text-center text-sm text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut({ scope: 'local' });
                    window.location.href = '/auth';
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign out
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div></div>
    );
  }

  if (step === 'details') {
    return (
      <div className="flex min-h-screen bg-background safe-top safe-bottom"><div className="hidden md:block md:w-1/2"><SignUpShowcase /></div><div className="flex w-full items-center justify-center p-4 md:w-1/2">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Tell us about your business</CardTitle>
            <CardDescription>Step 2 of 3 — helps us tailor your setup</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <CountryCombobox value={country} onChange={setCountry} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Beirut" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Personal contact phone</Label>
                <Input id="phone" type="tel" placeholder="+xxx ..." value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Your personal number (not the WhatsApp Business one) — we use it to reach you about your account.</p>
              </div>

              <Button type="submit" className="w-full" disabled={savingDetails}>
                {savingDetails ? 'Saving...' : 'Continue'}
              </Button>
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={() => setStep('identity')}
                  className="text-primary hover:underline font-medium"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut({ scope: 'local' });
                    window.location.href = '/auth';
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign out
                </button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div></div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background safe-top safe-bottom"><div className="hidden md:block md:w-1/2"><SignUpShowcase /></div><div className="flex w-full items-center justify-center p-4 md:w-1/2">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connect WhatsApp (optional)</CardTitle>
          <CardDescription>Step 3 of 3 — you can skip this and connect later from Settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-6 text-center space-y-4">
            {fbConnected ? (
              <div className="space-y-3">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <p className="font-medium">WhatsApp Business Connected</p>
                <p className="text-sm text-muted-foreground">Your account is ready to send and receive messages.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Facebook className="mx-auto h-12 w-12 text-[#1877F2]" />
                <p className="font-medium">Connect with Facebook</p>
                <p className="text-sm text-muted-foreground">
                  Sign in with Facebook to link your WhatsApp Business Account (WABA) to Jawabify.
                </p>
                <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-left">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs font-medium text-destructive">
                    Warning: the WhatsApp number you connect will be locked to Jawabify and can no longer be used on WhatsApp or other platforms.
                  </p>
                </div>
                <Button
                  className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                  onClick={handleFacebookSignup}
                  disabled={fbConnecting || !sdkReady}
                >
                  {fbConnecting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
                  ) : !sdkReady ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading SDK...</>
                  ) : (
                    <><Facebook className="mr-2 h-4 w-4" />Continue with Facebook</>
                  )}
                </Button>
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleFinish} disabled={submitting}>
            {submitting ? 'Setting up...' : fbConnected ? 'Complete Setup' : 'Skip for now & go to dashboard'}
          </Button>

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
            <button onClick={() => setStep('details')} className="text-primary hover:underline font-medium">
              ← Back to details
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut({ scope: 'local' });
                window.location.href = '/auth';
              }}
              className="text-primary hover:underline font-medium"
            >
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div></div>
  );
}
