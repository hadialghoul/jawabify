# Fix sender name on emails: "wpapitry" → "Jawabify"

The old project name is still hardcoded as the site/sender name in the email functions, so verification and app emails arrive from "wpapitry".

## Changes

1. Auth email function (`supabase/functions/auth-email-hook/index.ts`)
   - `SITE_NAME` → `Jawabify` (used in the From name, subject/body copy, and template props).
   - Sample preview URL → `https://jawabify.com`.
2. App email function (`supabase/functions/send-transactional-email/index.ts`)
   - `SITE_NAME` → `Jawabify`.
3. Shopify OAuth fallback URL (`supabase/functions/shopify-oauth/index.ts`)
   - Stale `wpapitry.lovable.app` fallback → `https://jawabify.com`.
4. Redeploy `auth-email-hook`, `send-transactional-email`, and `shopify-oauth` so the new name takes effect.

## Notes

The From address domain stays `jawabify.com` as configured; only the display name changes. Emails already queued keep the old name.
