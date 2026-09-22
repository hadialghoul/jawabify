# Shopify Listing: Free-to-Install Connector, Billing Stays on Stripe

Jawabify is already an independent SaaS with its own web signups, billing, and dashboard — the Shopify app is a data connector to it. So instead of building Shopify Billing, we list the app as **Free to install** and make sure no payment screen of any kind ever appears inside the Shopify Admin. That is the route Shopify allows for connector apps to independent platforms.

The single rule everything below enforces: nothing in the Shopify-embedded experience asks for money, shows a plan card, or links to a checkout.

## What changes in the app

### 1. A dedicated Shopify connector landing screen
- After a merchant installs from Shopify, they land on a connector setup page (inside the embedded admin) that only does two things: shows the connection status of their store, and points them to jawabify.com to log in or create an account.
- No plan cards, no prices, no "Subscribe", no Stripe link that goes straight to checkout — just "Log in or create your Jawabify account" pointing at the marketing/auth site.
- Once they've signed in on jawabify.com and their store is linked, this page shows "Store connected" plus a link into their Jawabify dashboard.

### 2. Never route a Shopify-context session to the paywall
- Tenants that arrived via a Shopify install are flagged as Shopify-origin at OAuth time.
- The subscription gate must not redirect a Shopify-origin session to `/subscribe`. When such a tenant has no active subscription, they see the connector screen's "finish setup on jawabify.com" message instead of any billing UI.
- Any page rendered while embedded in the Shopify Admin (a `shop`/`host` param present, or in an iframe) renders no pricing or checkout UI at all, as a second safety net.
- The Shopify Billing edge functions get retired from the user path so there is no half-built second billing route to trip over.

### 3. Embedded app must work without localStorage / third-party cookies (1.1.1)
- Remove the `shopifyPendingInstall` localStorage handoff; carry shop identity through the OAuth `state` parameter and server-side records, and read shop/host from the URL on each load.
- Result: the flow works in Chrome incognito with third-party cookies blocked.

### 4. Confirm no offsite checkout for orders (1.1.2)
- Audit the WhatsApp ordering paths so that anything a shopper pays for goes through Shopify's own checkout (Admin API draft order / checkout URL) and never a third-party payment step. Document this in the reviewer notes.

### 5. A reviewer test account that never sees Stripe
- Seed a review account on jawabify.com with an active (comped) subscription so the reviewer can exercise every feature with no card form anywhere.
- Give them a store connected to that account, or clear instructions to connect their own test store.

## What you do in the Partner Dashboard (no code)

1. Pricing: set the listing to **Free to install**.
2. Pricing description, exact wording to paste: "Free to install. Requires a Jawabify account and a paid Jawabify subscription (billed by Jawabify) to function."
3. Testing instructions: state the app is a data connector for Jawabify, an independent SaaS platform with its own users and billing outside Shopify, and therefore relies on the off-platform billing allowance for connector apps; include the review account email/password and the step-by-step test flow; note the account already has an active subscription so no payment screen appears.
4. Keep the credentials current before every resubmission (4.5.4 / 4.5.5).

I'll draft the full reviewer-notes text for you to paste once the code changes are in.

## Technical details

- `is_shopify_tenant` / Shopify-origin flag set inside `shopify-oauth` token exchange; `useSubscription` reads it and suppresses the `/subscribe` redirect for those sessions.
- New embedded route (e.g. `/shopify/connect`) rendering the connector setup screen; Shopify install redirect points there.
- A small `isEmbeddedShopify()` helper (URL params + frame check) used to hard-gate `Subscribe.tsx`, pricing sections, and any upgrade CTA.
- `shopify-billing-create` / `shopify-billing-callback` no longer referenced from the UI.
- Stripe checkout remains untouched for direct jawabify.com signups.

## Open question
Do you want a limited free tier usable straight after connecting (reviewers favor it), or keep the connector strictly "connect, then subscribe on jawabify.com"?
