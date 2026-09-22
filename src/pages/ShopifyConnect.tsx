import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { readShopFromUrl, withShop, isEmbeddedShopify, loadAppBridge } from '@/lib/shopifyEmbedded';
import { claimShopifyInstall } from '@/lib/shopifyPendingInstall';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Loader2, Store, CreditCard } from 'lucide-react';

/**
 * Shopify connector setup screen.
 *
 * Jawabify is an independent SaaS platform; the Shopify app is a data connector.
 * This screen only shows the store connection status and sends the merchant to
 * jawabify.com to sign in or create an account. It must never show prices, plan
 * cards, a subscribe button, or any checkout (Shopify policy 1.2.1).
 *
 * When the store is connected and an App Store install, the merchant approves
 * the plan through Shopify's own approval screen (opens in a new tab), which is
 * hosted by Shopify and satisfies the Billing API requirement.
 */
export default function ShopifyConnect() {
  const [searchParams] = useSearchParams();
  const { tenantId, loading } = useAuth();
  const shop = readShopFromUrl(searchParams.toString());
  const [checking, setChecking] = useState(true);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [billingActive, setBillingActive] = useState<boolean | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (loading) return;

      // Storage-free path (policy 1.1.1): resolve the store's status from the
      // `shop` URL param alone, so the embedded page works in incognito even when
      // no session (localStorage/third-party cookies) is available.
      if (shop) {
        const { data } = await supabase.functions.invoke('shopify-connect-status', {
          body: { shop },
        });
        if (data?.api_key && isEmbeddedShopify()) loadAppBridge(data.api_key);
        if (!cancelled && data?.connected) {
          setConnectedShop(shop);
          // Also resolve billing state (public, shop-keyed) so we can offer the
          // approval button without a session.
          // Check billing state (public, shop-keyed) so we can offer the
          // approval button without a session.
          const bill = await supabase.functions
            .invoke('shopify-billing', { body: { shop, status: true } })
            .catch(() => null);
          const billData = (bill as any)?.data;
          if (!cancelled && billData && 'active' in billData) {
            setBillingActive(!!billData.active);
          }
          setChecking(false);
          if (tenantId) await claimShopifyInstall(tenantId, shop);
          return;
        }
      }

      if (!tenantId) {
        if (!cancelled) setChecking(false);
        return;
      }
      // Link the pending install to this tenant (no-ops without a shop in the URL).
      await claimShopifyInstall(tenantId, shop);
      const { data } = await supabase
        .from('tenant_credentials')
        .select('shop_domain')
        .eq('tenant_id', tenantId)
        .eq('provider', 'shopify')
        .eq('is_active', true)
        .maybeSingle();
      if (!cancelled) {
        setConnectedShop(data?.shop_domain ?? null);
        setChecking(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loading, tenantId, shop]);

  const openExternal = (path: string) => {
    window.open(`${window.location.origin}${withShop(path, shop)}`, '_blank', 'noopener');
  };

  const approveBilling = async () => {
    if (!shop) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-billing', {
        body: { shop, plan: 'starter' },
      });
      if (error || !data?.confirmation_url) {
        setBillingError(data?.error ?? error?.message ?? 'Could not start Shopify billing.');
        return;
      }
      if (data.already_active) {
        setBillingActive(true);
        return;
      }
      window.open(data.confirmation_url, '_blank', 'noopener');
    } catch (e) {
      setBillingError((e as Error).message);
    } finally {
      setBillingLoading(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = !!connectedShop;
  const billingPending = isConnected && billingActive === false;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Jawabify for Shopify</h1>
          </div>

          {shop && (
            <p className="mb-5 text-sm text-muted-foreground">
              Store: <span className="font-medium text-foreground">{shop}</span>
            </p>
          )}

          {isConnected ? (
            <>
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Store connected to your Jawabify account
                  {connectedShop ? ` (${connectedShop})` : ''}. Products and orders now sync
                  automatically.
                </span>
              </div>

              {billingPending && (
                <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start gap-2">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Start your plan</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Approve your Jawabify plan to activate the dashboard. It's billed on your
                        Shopify invoice with a 7-day free trial. Approval opens in a new tab.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    size="lg"
                    disabled={billingLoading}
                    onClick={approveBilling}
                  >
                    {billingLoading ? 'Starting…' : 'Approve plan in Shopify'}
                    {!billingLoading && <ExternalLink className="ml-2 h-4 w-4" />}
                  </Button>
                  {billingError && (
                    <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {billingError}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    After approving, refresh this page to confirm.
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={() => openExternal('/app')}>
                Open Jawabify dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Jawabify is an independent platform that answers your customers on WhatsApp and
                turns those chats into Shopify orders. This app connects your store to your
                Jawabify account.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                To finish setup, log in or create your Jawabify account, then come back here to
                activate the app for this store.
              </p>

              <div className="grid gap-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => openExternal('/auth?mode=signup')}
                >
                  Connect Your Jawabify Account
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openExternal('/auth?mode=signin')}
                >
                  I already have an account — log in
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                After signing in on jawabify.com, come back to this page and refresh to confirm
                your store is connected.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
