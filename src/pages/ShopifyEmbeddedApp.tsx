import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadAppBridge, readShopFromUrl, withShop } from '@/lib/shopifyEmbedded';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Store } from 'lucide-react';

/**
 * Entry point of the embedded Shopify app (App URL: /shopify/app).
 *
 * No Jawabify login: the App Bridge session token signs the store in, the
 * account is created on first load, and billing only uses Shopify's own
 * approval screen (policy 1.2.1). No prices, links to jawabify.com or card
 * checkout are rendered here.
 */
declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

async function waitForAppBridge(timeoutMs = 8000): Promise<Window['shopify'] | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.shopify?.idToken) return window.shopify;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

type Phase = 'loading' | 'billing' | 'error';

export default function ShopifyEmbeddedApp() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [shop, setShop] = useState<string | null>(readShopFromUrl());
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const run = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const cfg = await supabase.functions.invoke('shopify-session-auth', { body: { config: true } });
      const apiKey = cfg.data?.api_key as string | undefined;
      if (!apiKey) throw new Error('This app is not configured yet.');
      loadAppBridge(apiKey);

      const bridge = await waitForAppBridge();
      const idToken =
        (bridge ? await bridge.idToken().catch(() => null) : null) ||
        new URLSearchParams(window.location.search).get('id_token');
      if (!idToken) throw new Error('Open Jawabify from your Shopify Admin → Apps.');

      const { data, error: fnErr } = await supabase.functions.invoke('shopify-session-auth', {
        body: { id_token: idToken },
      });
      if (fnErr || !data?.token_hash) {
        // Session token from the older connector app — use its screen instead.
        if (readShopFromUrl()) {
          navigate(withShop('/shopify/connect', readShopFromUrl()), { replace: true });
          return;
        }
        throw new Error(data?.error || 'Could not sign in to this store.');
      }
      setShop(data.shop);

      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });
      if (otpErr) throw otpErr;

      const bill = await supabase.functions.invoke('shopify-billing', {
        body: { shop: data.shop, status: true },
      });
      if (bill.data?.active) {
        navigate(withShop('/app', data.shop), { replace: true });
        return;
      }
      setPhase('billing');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }, [navigate]);

  useEffect(() => {
    run();
  }, [run]);

  const approve = async () => {
    if (!shop) return;
    setStarting(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke('shopify-billing', {
      body: { shop, plan: 'starter', embedded: true },
    });
    setStarting(false);
    if (data?.already_active) {
      navigate(withShop('/app', shop), { replace: true });
      return;
    }
    if (fnErr || !data?.confirmation_url) {
      setError(data?.error ?? 'Could not open the Shopify approval screen.');
      return;
    }
    // Shopify's approval page must load in the top frame, not inside the iframe.
    window.open(data.confirmation_url, '_top');
  };

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Jawabify for Shopify</h1>
          </div>

          {phase === 'billing' ? (
            <>
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {shop} is connected. Products and orders sync automatically.
                </span>
              </div>
              <p className="mb-5 text-sm text-muted-foreground">
                Approve your plan to start answering customers on WhatsApp with AI. It's billed on
                your Shopify invoice and starts with a 7-day free trial.
              </p>
              <Button className="w-full" size="lg" disabled={starting} onClick={approve}>
                {starting ? 'Opening…' : 'Choose plan in Shopify'}
              </Button>
            </>
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">{error}</p>
              <Button className="w-full" onClick={run}>Try again</Button>
            </>
          )}
          {phase === 'billing' && error && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
