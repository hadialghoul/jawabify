import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

const GATEWAY_STRIPE_BASE = 'https://connector-gateway.lovable.dev/stripe';

export function getConnectionApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

// Live payments now run on the business's own Stripe account (STRIPE_SECRET_KEY).
// Test mode (preview) keeps using the built-in sandbox.
export function createStripeClient(env: StripeEnv): Stripe {
  if (env === 'live') {
    return new Stripe(getEnv('STRIPE_SECRET_KEY'), { apiVersion: '2026-03-25.dahlia' as any });
  }
  return createLegacyStripeClient(env);
}

// Former built-in account — only for winding down old subscriptions.
export function createLegacyStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');

  return new Stripe(connectionApiKey, {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient((url: string | URL, init?: RequestInit) => {
      const gatewayUrl = url.toString().replace('https://api.stripe.com', GATEWAY_STRIPE_BASE);
      const headers = new Headers(init?.headers);
      headers.delete('authorization');
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(headers.entries()),
          'X-Connection-Api-Key': connectionApiKey,
          'Lovable-API-Key': lovableApiKey,
        },
      });
    }),
  });
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  // Live accepts both the old built-in account's secret and the own account's secret.
  const secrets = (env === 'sandbox'
    ? [Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')]
    : [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET')]
  ).filter((v): v is string => !!v);
  if (!secrets.length) throw new Error('Webhook secret is not configured');

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  let valid = false;
  for (const secret of secrets) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
    const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));
    if (v1Signatures.includes(expected)) { valid = true; break; }
  }
  if (!valid) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
