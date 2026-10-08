import * as WebBrowser from 'expo-web-browser';
import { APP_ORIGIN } from '../config';
import { supabase } from './supabase';
import { actingHeaders } from './actingTenant';
import { invokeErrorMessage } from './functionError';
import {
  CHECKOUT_RETURN_PREFIX,
  openEmbeddedStripeCheckout,
  type StripeCheckoutResult,
} from './stripeCheckout';

WebBrowser.maybeCompleteAuthSession();

/**
 * Use the already-deployed /checkout/return page so Stripe redirects never
 * hit undeployed /oauth/billing/* routes (404).
 */
export const BILLING_RETURN_URL = CHECKOUT_RETURN_PREFIX;

export const SUBSCRIBE_PLANS = {
  starter: { label: 'Starter', price: 45, priceId: 'jawabify_pro_monthly_v2' },
  growth: { label: 'Growth', price: 90, priceId: 'jawabify_growth_monthly' },
} as const;

export type SubscribePlanKey = keyof typeof SUBSCRIBE_PLANS;

const STARTER_PRICE_ID = SUBSCRIBE_PLANS.starter.priceId;

export type BillingSessionResult = StripeCheckoutResult;

function parseBillingReturn(url: string): BillingSessionResult {
  try {
    const parsed = new URL(url);
    const status = parsed.searchParams.get('status');
    if (status === 'cancel') return { status: 'cancel' };
    if (status === 'success' || parsed.searchParams.has('session_id') || parsed.pathname.includes('/checkout/return')) {
      return { status: 'success' };
    }
  } catch {
    /* ignore */
  }
  return { status: 'success' };
}

export async function openStripeBillingSession(stripeUrl: string): Promise<BillingSessionResult> {
  const result = await WebBrowser.openAuthSessionAsync(stripeUrl, BILLING_RETURN_URL);
  if (result.type === 'success' && result.url) {
    return parseBillingReturn(result.url);
  }
  return { status: 'dismissed' };
}

export async function createPortalUrl(
  environment: 'live' | 'sandbox',
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { environment, returnUrl: `${BILLING_RETURN_URL}?from=portal` },
    headers: actingHeaders(),
  });
  if (!error && data?.url) return { url: data.url };
  return { error: await invokeErrorMessage(error, data) };
}

async function createEmbeddedCheckout(
  environment: 'live' | 'sandbox',
  priceId: string,
): Promise<{ clientSecret?: string; error?: string }> {
  const returnUrl = `${BILLING_RETURN_URL}?session_id={CHECKOUT_SESSION_ID}`;
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      priceId,
      returnUrl,
      environment,
    },
    headers: actingHeaders(),
  });
  if (!error && data?.clientSecret) return { clientSecret: data.clientSecret };
  // Hosted mode (if deployed later) — open that URL in AuthSession instead.
  if (!error && data?.url) {
    return { error: `hosted:${data.url}` };
  }
  return { error: await invokeErrorMessage(error, data) };
}

/**
 * Start trial / subscribe without opening the website /subscribe page.
 * Uses the live create-checkout function (clientSecret) + in-app Stripe WebView.
 */
export async function openStartTrialSession(
  priceId: string = STARTER_PRICE_ID,
): Promise<BillingSessionResult> {
  let lastError = 'Could not start checkout';

  for (const environment of ['live', 'sandbox'] as const) {
    const { clientSecret, error } = await createEmbeddedCheckout(environment, priceId);
    if (clientSecret) {
      return openEmbeddedStripeCheckout(clientSecret, environment);
    }
    if (error?.startsWith('hosted:')) {
      const url = error.slice('hosted:'.length);
      return openStripeBillingSession(url);
    }
    if (error) lastError = error;
  }

  throw new Error(lastError);
}
