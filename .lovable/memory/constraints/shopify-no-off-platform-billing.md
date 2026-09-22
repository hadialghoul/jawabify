---
name: No off-platform billing in Shopify Admin
description: Every route is locked to the connector page while embedded in Shopify Admin; Stripe UI/endpoints blocked for Shopify-billed tenants
type: constraint
---
Shopify policy 1.2.1 / 1.1.1 rules — never regress these:

- `isEmbeddedShopify()` (src/lib/shopifyEmbedded.ts) detects the Admin via URL params OR frame + `shopify.com` ancestor/referrer. No storage is ever used (works with third-party cookies blocked).
- `EmbeddedShopifyLock` in `src/App.tsx` redirects EVERY route except `/shopify/connect`, `/privacy`, `/terms` to the connector while embedded. Do not add exceptions with pricing, plans, or checkout.
- `useBillingOrigin` treats embedded context, `tenants.billing_origin = 'shopify'`, or any `subscriptions.billing_provider = 'shopify'` row as Shopify-billed → no Stripe UI.
- `PaymentTestModeBanner` renders nothing when embedded.
- Server side: `create-checkout` and `create-portal-session` return 409 `shopify_billing_required` for Shopify-billed tenants (owner tenant, membership tenants, or any Shopify subscription row).

Reviewer test account: `admin@admin.com`, tenant `a0000000-0000-0000-0000-000000000001`, shop `3a6f9n-ty.myshopify.com`, forced Shopify-billed. Re-seed with the `seed-reviewer-account` edge function (header `x-reviewer-setup: REVIEWER_SETUP_TOKEN`).
