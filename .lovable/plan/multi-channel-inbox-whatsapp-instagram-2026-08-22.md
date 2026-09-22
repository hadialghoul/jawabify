# Multi-channel inbox: WhatsApp + Instagram

Goal: one inbox that handles WhatsApp and Instagram DMs, with a channel filter, per-chat channel badges, an Integrations settings page, and a sidebar quick-switch between accounts.

## What you need to do from your side (Meta setup)

Do these before the Instagram side can go live. Everything else is built in the app.

1. **Instagram account type**: In the Instagram app, go to Settings > Account type and tools > Switch to professional account > choose **Business** (Creator accounts cannot use the messaging API).
2. **Link to a Facebook Page**: Instagram Settings > Account type and tools > Share to other apps / Page connection > connect the Instagram Business account to the Facebook Page you own (same Business Manager as your WhatsApp assets).
3. **Allow message access**: Instagram app > Settings > Messages and story replies > **Connected tools** > turn on "Allow access to messages".
4. **Meta App setup** (developers.facebook.com > your existing Jawabify app):
   - Add product **Instagram** (Instagram API setup with Facebook Login) alongside WhatsApp.
   - Request/keep permissions: `instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `business_management`.
   - Under App Review, submit `instagram_manage_messages` for Advanced Access with a screencast of the inbox (needed for accounts outside your own business).
5. **Webhooks**: In the app's Instagram product > Webhooks, add the callback URL and verify token we will give you after the backend function is deployed, then subscribe to the fields **messages**, **messaging_postbacks**, **message_reactions**, **messaging_seen**.
6. **Business verification**: confirm your Business Manager is verified (already required for WhatsApp) so Instagram messaging permissions can be approved.
7. **Connect inside Jawabify**: after deploy, open Settings > Integrations > Instagram > Connect and complete the Facebook login popup, then pick the Instagram account. That stores the page token and IG account ID for your tenant.

If a client (e.g. a Shopify merchant) wants Instagram, they repeat only step 7 — steps 1–3 on their own Instagram account, and nothing in the Meta dashboard.

## Backend changes

- Migration:
  - `platform` text on `contacts` and `messages`, default `'whatsapp'`, check constraint `('whatsapp','instagram')`, backfilled to `whatsapp`.
  - `external_id` text on `contacts` (Instagram-scoped user ID / IGSID) since Instagram users have no phone number; `phone_number` stays for WhatsApp.
  - Unique index per tenant on `(tenant_id, platform, coalesce(external_id, phone_number))` so the same person on both channels stays two conversations (no cross-channel merge).
  - Index on `messages (contact_id, created_at desc)` already exists; add `contacts (tenant_id, platform, updated_at desc)` for filtered inbox paging.
  - `tenant_credentials`: reuse the table with `provider = 'instagram'`, storing `page_id`, `ig_account_id`, `access_token`; add `ig_account_id` and `page_id` columns.
- New edge function `instagram-webhook`: GET verify handshake, POST fan-out that resolves tenant by `ig_account_id`, upserts the contact (fetch username via Graph API for the display name), inserts the message, and reuses the existing AI reply / flagging / push-notification pipeline with the Instagram send endpoint (`/{ig_id}/messages`) instead of the WhatsApp Graph call.
- New edge function `instagram-connect`: exchanges the short-lived Facebook login token for a long-lived page token, lists IG accounts, saves the chosen one to `tenant_credentials`.
- `send-whatsapp` stays as-is; add `send-instagram` (or a `platform` branch in a shared sender) and route outgoing sends by the contact's `platform`. Instagram enforces a 24-hour reply window — when it has passed, the send returns a clear error shown in the composer.
- AI replies, order flow, campaigns: AI + order flow work on both channels; **campaigns stay WhatsApp-only** (Instagram has no template broadcast), so campaign recipient queries filter `platform = 'whatsapp'`.

## Frontend changes

- `src/types/chat.ts`: add `platform: 'whatsapp' | 'instagram'` to `Contact` and `Message`, plus `externalId`/`handle`.
- `src/hooks/useMessages.ts`: map the new field, accept a `platform` filter in the contacts query and remote search, and route sends to the right function.
- New `ChannelBadge` component (WhatsApp green / Instagram gradient icon), rendered on each row in `ConversationList` and in the `ChatWindow` header next to the name (with `@handle` for Instagram).
- Channel filter: segmented control **All / WhatsApp / Instagram** above the search box in `ConversationList`, persisted per user in local state; hidden when Instagram is not connected.
- Sidebar quick-switch: account switcher in `IconRail` (desktop) and in the `BottomNav` "More" sheet (mobile) that flips the active channel context — it sets the same filter and the default channel for new chats.
- `NewChatDialog`: channel picker; Instagram new chats are only possible with users who messaged first (Meta rule), so the dialog explains that and only offers existing Instagram contacts.
- New `src/pages/Integrations.tsx` (route `/integrations`, linked from Settings and the gear menu): cards for WhatsApp (existing connect/disconnect status reused from Settings) and Instagram (connect via Facebook login, show connected account + username, disconnect). Existing WhatsApp connect UI in `Settings.tsx` is moved/linked here rather than duplicated.

## Notes

- Instagram DMs cannot be initiated by the business and have a 24-hour response window; the UI surfaces both limits instead of failing silently.
- No existing WhatsApp data changes behaviour: everything defaults to `platform = 'whatsapp'`.
