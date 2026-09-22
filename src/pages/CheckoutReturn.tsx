import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const { tenantId, isSuperAdmin } = useAuth();
  const [userId, setUserId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [notified, setNotified] = useState(false);
  const { isActive } = useSubscription(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  // Actively verify the session against Stripe (don't wait for webhook).
  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      while (!cancelled && attempts < 15) {
        attempts++;
        try {
          const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
            body: { sessionId, environment: getStripeEnvironment() },
          });
          if (cancelled) return;
          if (error) throw error;
          if (data?.ready) return; // subscription hook will pick it up via realtime
        } catch (e: any) {
          console.error("verify-checkout-session failed:", e);
          if (!cancelled) setError(e?.message || "Verification failed");
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!cancelled) setTimedOut(true);
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, userId]);

  const destination = isSuperAdmin ? "/super-admin" : tenantId ? "/app" : "/onboarding";

  useEffect(() => {
    if (!isActive) return;
    if (!notified) {
      toast.success("Subscription activated — welcome to Jawabify!");
      setNotified(true);
    }
    const t = setTimeout(() => navigate(destination, { replace: true }), 2000);
    return () => clearTimeout(t);
  }, [isActive, notified, destination, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {isActive ? (
          <>
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Payment successful 🎉</h1>
            <p className="text-muted-foreground">
              Your subscription is active. You now have full access to Jawabify.
            </p>
            <Button className="w-full" onClick={() => navigate(destination, { replace: true })}>
              Go to my dashboard
            </Button>
          </>
        ) : error || timedOut ? (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Payment received, activation pending</h1>
            <p className="text-sm text-muted-foreground">
              We're still syncing your subscription. It should appear within a minute — if not,
              contact support and share this reference: <br />
              <code className="text-xs break-all">{sessionId}</code>
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
              <Button onClick={() => navigate(destination, { replace: true })}>Go to dashboard</Button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Confirming your subscription…</h1>
            <p className="text-sm text-muted-foreground">
              {sessionId ? "This usually takes a few seconds." : "No session found."}
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>Go to dashboard</Button>
          </>
        )}
      </div>
    </div>
  );
}
