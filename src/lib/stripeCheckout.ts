import { APP_ORIGIN } from '../config';

/** Already live on app.jawabify.com — used as Stripe return + AuthSession redirect. */
export const CHECKOUT_RETURN_PREFIX = `${APP_ORIGIN}/checkout/return`;

export const STRIPE_PUBLISHABLE_KEYS = {
  live: 'pk_live_51TeJkjAdNHscJshxQtDf3DeX7elO9Q3fQ0n4fEpbn8CLUbXvySsUkjKHA52eEFX9IgqbgxcIqFdRP7A2kS43sgLI00dJJkvVCV',
  sandbox:
    'pk_test_51TXkARD6hGVBrCAN3ySjRjLdzbrq2B2Tfysn4zbCW6ray5ZpKuxwSjTI2fWRDlmzzCNK64ccn4faP5IRE3I0pLbH00kpOl8uWW',
} as const;

export type StripeCheckoutResult =
  | { status: 'success' }
  | { status: 'cancel' }
  | { status: 'dismissed' };

export type StripeCheckoutRequest = {
  html: string;
  baseUrl: string;
  doneUrlPrefix: string;
  resolve: (result: StripeCheckoutResult) => void;
};

type Listener = (req: StripeCheckoutRequest | null) => void;

let pending: StripeCheckoutRequest | null = null;
const listeners = new Set<Listener>();

export function subscribeStripeCheckout(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

function notify(req: StripeCheckoutRequest | null) {
  pending = req;
  listeners.forEach((l) => l(req));
}

export function cancelStripeCheckout() {
  if (!pending) return;
  const { resolve } = pending;
  notify(null);
  resolve({ status: 'dismissed' });
}

export function finishStripeCheckout(result: StripeCheckoutResult) {
  if (!pending) return;
  const { resolve } = pending;
  notify(null);
  resolve(result);
}

function escapeJs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function buildCheckoutHtml(publishableKey: string, clientSecret: string) {
  const pk = escapeJs(publishableKey);
  const secret = escapeJs(clientSecret);
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>Subscribe — Jawabify</title>
<script src="https://js.stripe.com/v3/"></script>
<style>
  html,body{margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;color:#0f172a}
  #wrap{padding:16px}
  #status{padding:24px;text-align:center;color:#64748b;font-size:14px}
  #checkout{min-height:60vh}
  .err{color:#dc2626}
</style>
</head><body>
<div id="wrap">
  <div id="status">Loading secure checkout…</div>
  <div id="checkout"></div>
</div>
<script>
(async function () {
  var statusEl = document.getElementById('status');
  try {
    var stripe = Stripe('${pk}');
    var checkout = await stripe.initEmbeddedCheckout({ clientSecret: '${secret}' });
    statusEl.style.display = 'none';
    checkout.mount('#checkout');
  } catch (e) {
    statusEl.className = 'err';
    statusEl.textContent = (e && e.message) ? e.message : 'Could not load checkout';
  }
})();
</script>
</body></html>`;
}

/**
 * Opens Stripe Embedded Checkout in an in-app WebView (no website login).
 * Completes when Stripe redirects to /checkout/return (already live).
 */
export function openEmbeddedStripeCheckout(
  clientSecret: string,
  environment: 'live' | 'sandbox',
): Promise<StripeCheckoutResult> {
  const publishableKey = STRIPE_PUBLISHABLE_KEYS[environment];
  return new Promise((resolve) => {
    if (pending) {
      pending.resolve({ status: 'dismissed' });
    }
    notify({
      html: buildCheckoutHtml(publishableKey, clientSecret),
      baseUrl: APP_ORIGIN,
      doneUrlPrefix: CHECKOUT_RETURN_PREFIX,
      resolve,
    });
  });
}
