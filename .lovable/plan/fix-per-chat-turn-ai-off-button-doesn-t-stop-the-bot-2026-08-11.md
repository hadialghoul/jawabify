# Fix: per-chat "turn AI off" button doesn't stop the bot

## What's actually happening

The toggle does save. 30 chats currently have AI turned off in the database, so the button and the update both work.

The problem is in the WhatsApp webhook: the per-chat "AI off" check runs **too late**. Two reply paths execute before it:

1. **Active guided order session** — if the customer is mid-order, the state machine answers and returns before the AI-off check is ever reached.
2. **Global tenant AI toggle check** also sits after that same point, so it's bypassed the same way.

Confirmed case: contact `+9613931355` has `ai_enabled = false`, has 1 active order session, and still received an outgoing message today at 12:20 UTC.

Secondary issue: the realtime `contacts` UPDATE handler in the chat hook doesn't map `ai_enabled`, so turning AI off from the mobile app or another tab doesn't visibly update the icon in an open browser session until a full refetch.

## Changes

### 1. Enforce AI-off before any automated reply (webhook)
`supabase/functions/whatsapp-cloud-webhook/index.ts`

- Move the per-contact `ai_enabled` lookup and the tenant-level `ai_replies_enabled` check to run right after the opt-out handling / vertical router, **before** the guided order flow session resume block.
- If AI is off for the chat (or globally for the tenant): store the incoming message, do not resume the order session, do not call the model, return 200.
- Remove the now-duplicate checks further down so the logic exists in exactly one place.
- Keep the existing vertical-flow check (restaurant, wellness, etc.) working the same way — it already respects the per-contact flag.

Note: incoming messages keep being saved and shown in the inbox; only automated outgoing replies stop. Manual replies from the dashboard are unaffected.

### 2. Reflect the flag in realtime UI
`src/hooks/useMessages.ts`

- In the `contacts` UPDATE realtime handler, also map `aiEnabled: updated.ai_enabled !== false`, so a toggle made on mobile, in another tab, or by Super Admin instantly updates the header icon.

## Verification

- Re-check the affected contact: with AI off, sending a message should log "AI replies disabled for contact" and produce no new outgoing row, even with a live order session.
- Toggle off in one tab and confirm the icon flips in a second tab without refresh.
