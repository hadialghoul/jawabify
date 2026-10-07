import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { APP_ORIGIN } from '@/lib/appHost';

const PLANS = {
  starter: 'jawabify_pro_monthly_v2',
  growth: 'jawabify_growth_monthly',
} as const;

/**
 * Mobile-only Stripe checkout bridge.
 * Expo opens this URL with the existing Supabase session in the hash so the
 * user never hits /subscribe (which would force a website sign-in). After
 * payment, Stripe redirects to /oauth/billing/return and the app AuthSession closes.
 */
export default function MobileBillingCheckout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<keyof typeof PLANS>('starter');

  const returnUrl = useMemo(
    () => `${APP_ORIGIN}/oauth/billing/return?status=success&session_id={CHECKOUT_SESSION_ID}`,
    [],
  );

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const requested = params.get('plan');
    if (requested === 'starter' || requested === 'growth') setPlan(requested);

    // Clear tokens from the address bar as soon as we read them.
    if (hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (!accessToken) {
      setError('Missing session. Close this window and try again from the Jawabify app.');
      return;
    }

    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        setReady(true);
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Complete your subscription</h1>
        <p className="text-sm text-muted-foreground">
          You stay signed in from the Jawabify app. After payment you will return automatically.
        </p>
        <div className="overflow-hidden rounded-lg border bg-card">
          <StripeEmbeddedCheckout priceId={PLANS[plan]} returnUrl={returnUrl} />
        </div>
      </div>
    </div>
  );
}
