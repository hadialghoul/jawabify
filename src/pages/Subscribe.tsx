import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { isEmbeddedShopify, readShopFromUrl, withShop } from "@/lib/shopifyEmbedded";
import { useBillingOrigin } from "@/hooks/useBillingOrigin";
import { isNativeApp, openSystemBrowser } from "@/lib/mobileBridge";
import { Loader2, ShieldCheck, Check, Store, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = {
  starter: { label: "Starter", price: 45, priceId: "jawabify_pro_monthly_v2" },
  growth: { label: "Growth", price: 90, priceId: "jawabify_growth_monthly" },
} as const;

type Plan = keyof typeof PLANS;

export default function Subscribe() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();
  const [authChecked, setAuthChecked] = useState(false);
  const { isActive, loading } = useSubscription(userId);
  const [plan, setPlan] = useState<Plan>("starter");
  const [showCheckout, setShowCheckout] = useState(false);
  const [shopifyOrigin, setShopifyOrigin] = useState(false);
  const [billingShop, setBillingShop] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Never render billing UI inside the Shopify Admin (Shopify policy 1.2.1).
  const embedded = isEmbeddedShopify();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("plan");
    if (requested === "starter" || requested === "growth") {
      setPlan(requested);
    }
  }, []);

  useEffect(() => {
    if (embedded) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setUserId(data.user.id);
      setAuthChecked(true);
    });
  }, [navigate, embedded]);

  useEffect(() => {
    if (!loading && isActive) {
      navigate("/app", { replace: true });
    }
  }, [loading, isActive, navigate]);

  // App Store installs are billed through Shopify, never Stripe. Detect the
  // tenant's billing origin so we show the right approval flow.
  const { isShopifyBilled, shopDomain, loading: originLoading } = useBillingOrigin(
    embedded ? undefined : userId,
  );

  useEffect(() => {
    setShopifyOrigin(isShopifyBilled);
    if (shopDomain) setBillingShop(shopDomain);
  }, [isShopifyBilled, shopDomain]);

  function choosePlan(nextPlan: Plan) {
    setShowCheckout(false);
    setCheckoutError(null);
    setPlan(nextPlan);
  }

  function changePlan() {
    setShowCheckout(false);
    setCheckoutError(null);
  }

  const startShopifyBilling = async () => {
    if (!billingShop) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-billing", {
        body: { shop: billingShop, plan },
      });
      if (error || !data?.confirmation_url) {
        setCheckoutError(data?.error ?? error?.message ?? "Could not start Shopify billing.");
        return;
      }
      if (data.already_active) {
        navigate("/app", { replace: true });
        return;
      }
      if (isNativeApp()) {
        await openSystemBrowser(data.confirmation_url);
      } else {
        window.open(data.confirmation_url, "_blank", "noopener");
      }
    } catch (e) {
      setCheckoutError((e as Error).message);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const continueWithPlan = async () => {
    setCheckoutError(null);

    if (shopifyOrigin) {
      await startShopifyBilling();
      return;
    }

    setShowCheckout(true);
  };

  if (embedded) {
    return <Navigate to={withShop("/shopify/app", readShopFromUrl())} replace />;
  }

  if (!authChecked || loading || originLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const returnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
  const continueLabel = `Continue with ${PLANS[plan].label} — $${PLANS[plan].price}/month`;
  const showContinueButton = shopifyOrigin || !showCheckout;

  return (
    <div className="min-h-screen bg-background">
      {!shopifyOrigin && <PaymentTestModeBanner />}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            Final step — start your free trial
          </div>
          <h1 className="text-3xl font-bold mb-2">7 days free, then ${PLANS[plan].price}/month</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {shopifyOrigin
              ? "Your Jawabify plan is billed through Shopify. Approve it from your Shopify admin — the 7-day trial starts now."
              : "Pick your plan and add a payment method. You won't be charged until your 7-day trial ends. Cancel anytime from Settings."}
          </p>
        </div>

        <div className="mx-auto max-w-md mb-6 grid grid-cols-2 gap-3">
          {(["starter", "growth"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePlan(key)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                plan === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent/40"
              }`}
            >
              <div className="text-sm font-semibold">{PLANS[key].label}</div>
              <div className="text-2xl font-bold">
                ${PLANS[key].price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">7-day free trial</div>
            </button>
          ))}
        </div>

        <ul className="mx-auto max-w-md mb-6 grid gap-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary" /> Full access to every feature during trial
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary" /> No charge for 7 days
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary" /> Cancel anytime — no questions asked
          </li>
        </ul>

        {shopifyOrigin && (
          <div className="mx-auto max-w-md mb-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
            <strong className="block mb-1">Billed through Shopify</strong>
            This account was installed from the Shopify App Store, so your plan appears on
            your Shopify invoice. No card is needed here.
          </div>
        )}

        {!shopifyOrigin && !showCheckout && (
          <div className="mx-auto max-w-md mb-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
            <strong className="block mb-1">Billed directly by Jawabify</strong>
            Your subscription is managed and charged by Jawabify, not through Shopify or any third-party marketplace.
          </div>
        )}

        {showContinueButton && (
          <div className="mx-auto max-w-md space-y-3">
            <Button
              className="w-full text-sm sm:text-base"
              size="lg"
              disabled={(shopifyOrigin && !billingShop) || checkoutBusy}
              onClick={() => void continueWithPlan()}
            >
              {checkoutBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening checkout…
                </>
              ) : shopifyOrigin ? (
                <>
                  <Store className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{continueLabel}</span>
                  <ExternalLink className="h-4 w-4 ml-2 shrink-0" />
                </>
              ) : (
                continueLabel
              )}
            </Button>

            {shopifyOrigin && billingShop && (
              <p className="text-center text-xs text-muted-foreground">
                {billingShop} · Approval opens in {isNativeApp() ? "your browser" : "a new tab"}
              </p>
            )}

            {checkoutError && (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{checkoutError}</p>
                <Button variant="outline" className="w-full" onClick={() => void continueWithPlan()}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {!shopifyOrigin && showCheckout && (
          <div className="mx-auto max-w-md space-y-3">
            <Button variant="link" className="h-auto p-0 text-primary" onClick={changePlan}>
              Change plan
            </Button>
            <div className="overflow-hidden rounded-lg border bg-card">
              <StripeEmbeddedCheckout priceId={PLANS[plan].priceId} returnUrl={returnUrl} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
