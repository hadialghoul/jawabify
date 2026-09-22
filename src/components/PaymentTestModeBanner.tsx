import { isEmbeddedShopify } from "@/lib/shopifyEmbedded";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  // Never surface any payment-related messaging inside the Shopify Admin
  // (Shopify policy 1.2.1 — no off-platform billing UI).
  if (isEmbeddedShopify()) return null;
  if (!clientToken) {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-center text-sm text-destructive">
        Production checkout is not configured. Complete payments setup to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
        Payments are in test mode. Use card 4242 4242 4242 4242 with any future expiry & CVC.
      </div>
    );
  }
  return null;
}
