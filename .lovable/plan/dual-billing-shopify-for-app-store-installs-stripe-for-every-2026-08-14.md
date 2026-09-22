# Dual billing: Shopify for App Store installs, Stripe for everyone else

Shopify requires that merchants who install the app from the Shopify App Store are charged through Shopify's own billing (their invoice), not through an external card form. Merchants who sign up directly on jawabify.com keep paying with Stripe. One account never has both.

## How it will work

1. A merchant installs from the Shopify App Store → after OAuth they land in Jawabify with the shop already connected, and they are sent to a Shopify approval screen ("Jawabify Pro — $45/month, 7-day free trial") hosted by Shopify.
2. They approve → Shopify charges them monthly on their Shopify bill. Jawabify records the subscription as active.
3. A merchant who signs up on the website (or connects Shopify later from Settings) sees the current Stripe checkout, unchanged.
4. Everywhere the app checks "is this account paid?", it now accepts either a Stripe subscription or a Shopify app subscription, so dashboard access, trial banners, and Settings billing all behave identically.
5. If a merchant uninstalls the app or cancels in Shopify, Shopify notifies us and access ends at the end of the paid period.

## What the merchant sees on /subscribe

- Shopify-originated account: a single "Continue to Shopify to approve $45/month (7 days free)" button, plus a note that billing appears on their Shopify invoice. No card fields, no Stripe banner.
- Direct sign-up: today's embedded Stripe checkout, untouched.
- Super admin: unchanged bypass, plus the ability to see which provider an account is on and grant free days for either.

## Technical work

Database
- Add `billing_provider` (`stripe` | `shopify`) to `subscriptions`, defaulting to `stripe`, and make the Shopify rows keyed by `shopify_app_subscription_gid` + `shop_domain` (nullable columns, unique index).
- Add `billing_origin` on `tenants` (or reuse `shopify_pending_installs`) so we know an account arrived via the App Store and must never be offered Stripe.
- GRANTs + RLS: tenant members can read their own subscription row; only service role writes.

Edge functions
- `shopify-billing-create`: authenticated; loads the tenant's Shopify access token from `tenant_credentials`, calls Admin GraphQL `appSubscriptionCreate` (recurring $45 USD, `trialDays: 7`, `test` flag on dev stores), returns `confirmationUrl` for the frontend to redirect to.
- `shopify-billing-callback` (return URL from the approval screen): re-reads `currentAppInstallation.activeSubscriptions` and upserts the local subscription row, then redirects into `/app`.
- Extend `shopify-webhook` to handle `APP_SUBSCRIPTIONS_UPDATE` and `APP_UNINSTALLED`: mark the row active/cancelled/frozen accordingly. HMAC verification reuses the existing helper.
- `shopify-oauth`: after a successful App Store install, flag the install as App-Store-originated so the frontend routes to Shopify billing.

Frontend
- `useSubscription`: query the newest row for the user regardless of provider; keep the existing `isActive` rules and treat Shopify statuses (`ACTIVE`, `PENDING`, `FROZEN`, `CANCELLED` with period end in the future) with the same semantics. Environment filter only applies to Stripe rows.
- `Subscribe.tsx`: branch on provider — Shopify button (calls `shopify-billing-create`, redirects to `confirmationUrl`) vs existing Stripe checkout. Hide the Stripe test-mode banner in the Shopify branch.
- `Settings.tsx` / `Account.tsx` billing section: for Shopify accounts, link to the merchant's Shopify subscription management page instead of the Stripe portal.
- `SuperAdmin` Subscriptions/Payments tabs: show the provider column; free-day grants use `appSubscriptionCreate` with extended `trialDays` for Shopify accounts.

Shopify Partner dashboard (manual steps for you)
- The app listing stays "Free to install" with charges declared through the Billing API. No separate billing app or API account is needed — the same app uses its own installation token to create app subscriptions.
- Add `APP_SUBSCRIPTIONS_UPDATE` and `APP_UNINSTALLED` webhook subscriptions to the same app.
- Add the billing callback URL to the allowed redirection URLs.
- No new access scopes are needed — app subscriptions use the app's own installation token.

## Out of scope

- Usage-based or per-message charges (recurring flat $45 only).
- Migrating existing Stripe customers who later install from the App Store; they stay on Stripe.
