import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  priceId: string;
  returnUrl: string;
}

export function StripeEmbeddedCheckout({ priceId, returnUrl }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [opening, setOpening] = useState(true);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    setError(null);
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, returnUrl, environment: getStripeEnvironment() },
      });
      if (error || !data?.clientSecret) {
        throw new Error(error?.message || "Failed to create checkout session");
      }
      setOpening(false);
      return data.clientSecret;
    } catch (e) {
      setOpening(false);
      const message = e instanceof Error ? e.message : "Failed to create checkout session";
      setError(message);
      throw e;
    }
  }, [priceId, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (error) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setError(null);
            setRetryKey((k) => k + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div id="checkout" className="relative min-h-[12rem]">
      {opening && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <EmbeddedCheckoutProvider
        key={`${priceId}:${returnUrl}:${retryKey}`}
        stripe={getStripe()}
        options={options}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
