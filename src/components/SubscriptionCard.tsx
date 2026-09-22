import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, ExternalLink, Loader2, Store, XCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingOrigin } from "@/hooks/useBillingOrigin";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { SubscriptionRecord } from "@/hooks/useSubscription";

function pickBest(rows: SubscriptionRecord[]): SubscriptionRecord | null {
  const active = (s: SubscriptionRecord) =>
    (["active", "trialing", "past_due"].includes(s.status) &&
      (!s.current_period_end || new Date(s.current_period_end) > new Date())) ||
    (s.status === "canceled" && !!s.current_period_end && new Date(s.current_period_end) > new Date());
  return rows.find(active) ?? rows[0] ?? null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trialing: { label: "Free trial", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  past_due: { label: "Payment failed", variant: "destructive" },
  canceled: { label: "Canceled", variant: "outline" },
  incomplete: { label: "Incomplete", variant: "outline" },
  unpaid: { label: "Unpaid", variant: "destructive" },
  paused: { label: "Paused", variant: "outline" },
};

export function SubscriptionCard({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const { subscription: ownSub, loading: subLoading } = useSubscription(userId);
  const { isShopifyBilled, shopDomain, loading: originLoading } = useBillingOrigin(userId);
  const { tenantId } = useAuth();
  const [tenantSub, setTenantSub] = useState<SubscriptionRecord | null>(null);
  const [tenantSubLoading, setTenantSubLoading] = useState(false);

  // Employees don't own the subscription — the account owner does. Fall back to
  // the workspace-level subscription so everyone sees (and can cancel) the plan.
  useEffect(() => {
    if (subLoading || ownSub || !tenantId) return;
    let cancelled = false;
    setTenantSubLoading(true);
    supabase
      .rpc("get_tenant_subscription", { p_tenant_id: tenantId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("get_tenant_subscription:", error.message);
        setTenantSub(pickBest(((data as SubscriptionRecord[] | null) ?? [])));
        setTenantSubLoading(false);
      });
    return () => { cancelled = true; };
  }, [subLoading, ownSub, tenantId]);

  const subscription = ownSub ?? tenantSub;
  const loading = subLoading || originLoading || tenantSubLoading;
  const [opening, setOpening] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelPlan = async () => {
    setCancelling(true);
    try {
      const env = getStripeEnvironment();
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { environment: env },
      });
      if (error) throw new Error(error.message || "Could not cancel the plan");
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.current_period_end
          ? `Plan canceled. You keep access until ${formatDate(data.current_period_end)}.`
          : "Plan canceled at the end of the current period.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const openPortal = async () => {
    setOpening(true);
    try {
      const env = getStripeEnvironment();
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { environment: env, returnUrl: `${window.location.origin}/settings` },
      });
      if (error || !data?.url) throw new Error(error?.message || "Could not open billing portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(false);
    }
  };

  const status = subscription?.status ?? "none";
  const meta = STATUS_LABEL[status];
  const periodEnd = subscription?.current_period_end ?? null;
  const isTrialing = status === "trialing";
  const willCancel = subscription?.cancel_at_period_end;
  // Shopify-billed tenants (App Store installs) must never see Stripe UI,
  // even if an older Stripe row exists on the account.
  const isShopify = isShopifyBilled || subscription?.billing_provider === "shopify";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Subscription & billing
        </CardTitle>
        <CardDescription>Manage your Jawabify Pro subscription, payment method, and invoices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading subscription…
          </div>
        ) : !subscription ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">You don't have an active subscription.</p>
            <Button onClick={() => navigate("/subscribe")}>
              {isShopify ? "Approve your plan in Shopify" : "Start 7-day free trial"}
            </Button>
            {isShopify && (
              <p className="text-xs text-muted-foreground">
                Your plan is billed through Shopify{shopDomain ? ` (${shopDomain})` : ""}.
              </p>
            )}
          </div>
        ) : isShopify ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="font-medium">Jawabify Pro · $45/month</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>
                  {meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : <Badge variant="outline">{status}</Badge>}
                  {willCancel && (
                    <Badge variant="outline" className="ml-2">Cancels at period end</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Billed through</div>
                <div className="font-medium flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" />
                  Shopify
                  {(subscription.shop_domain || shopDomain) && (
                    <span className="text-muted-foreground">· {subscription.shop_domain || shopDomain}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {isTrialing ? "Trial ends" : willCancel ? "Access until" : "Next charge"}
                </div>
                <div className="font-medium">{formatDate(periodEnd)}</div>
              </div>
            </div>
            {["active", "trialing", "past_due"].includes(status) && !willCancel && (
              <div className="flex flex-wrap gap-2 pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                      <XCircle className="mr-2 h-4 w-4" /> Cancel plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan stays active until {formatDate(periodEnd)} — Shopify won't charge you again after that.
                        You can resubscribe anytime.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={cancelPlan}
                        disabled={cancelling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, cancel plan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              This subscription is billed through Shopify. Cancelling here stops future charges and keeps your access until the end of the paid period. Payment details and invoices live in your Shopify admin under Settings → Apps and sales channels.
            </p>

          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="font-medium">Jawabify Pro · $45/month</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>
                  {meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : <Badge variant="outline">{status}</Badge>}
                  {willCancel && (
                    <Badge variant="outline" className="ml-2">Cancels at period end</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {isTrialing ? "Trial ends" : willCancel ? "Access until" : "Next charge"}
                </div>
                <div className="font-medium">{formatDate(periodEnd)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={openPortal} disabled={opening}>
                {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                Manage billing
              </Button>
              {["active", "trialing", "past_due"].includes(status) && !willCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                      <XCircle className="mr-2 h-4 w-4" /> Cancel plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan stays active until {formatDate(periodEnd)} — you won't be charged again after that.
                        You can resubscribe anytime.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={cancelPlan}
                        disabled={cancelling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, cancel plan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {status === "canceled" && (
                <Button variant="outline" onClick={() => navigate("/subscribe")}>Resubscribe</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Update card, view invoices, or cancel anytime. Cancellation keeps access until the end of your billing period.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

