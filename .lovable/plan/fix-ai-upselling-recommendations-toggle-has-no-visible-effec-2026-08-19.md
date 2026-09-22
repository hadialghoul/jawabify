# Fix: "AI upselling & recommendations" toggle has no visible effect

## What I checked

- The toggle in Settings saves correctly: turning it on writes `ai_upsell_enabled` to the settings table for the current account, and the value for the Lumon/admin account is currently `true`.
- The webhook does read that setting and injects an "UPSELL & RECOMMEND (ENABLED)" block into the AI prompt.

So the switch itself is wired. What's missing is that the instruction almost never survives the rest of the AI rules, and it doesn't apply on the paths where upselling actually matters.

## Why nothing shows up in real chats

1. The base reply rule is stricter than the upsell rule: "ONE short sentence, never more than 15 words, no over-explaining." A price answer already uses that budget, so the model drops the extra suggestion nearly every time.
2. The upsell block is written as permission ("you MAY add"), and it sits before the strongest directives in the prompt, so it loses to them.
3. The buying moment is not AI-driven. Once a customer starts ordering, the programmatic order flow takes over and the AI prompt isn't used at all — so no add-on is ever offered at the point where an upsell converts.
4. Restaurant and wellness accounts use their own separate upsell settings, so flipping this switch in Settings does nothing for them.

## The fix

1. Make the instruction binding, not optional: when the toggle is on, allow a second short clause/sentence explicitly (raise the word budget for that reply only), phrase it as a requirement when a relevant add-on exists in the knowledge base, and move it to the end of the prompt so it isn't overridden.
2. Pick the suggestion from real data instead of hoping the model finds one: before calling the model, select one candidate item from the account's catalog/knowledge base (different product than the one being discussed, in stock, and any item flagged as on sale gets priority) and name it in the prompt with its exact price. Keeps the existing no-invented-products and price-authority guards intact.
3. Add the upsell into the programmatic order flow: after the first item is confirmed and before checkout, offer exactly one add-on ("want X for $Y too?"), accept yes/no, and never repeat it in the same session. Skipped entirely when the toggle is off.
4. Never let it interfere: no suggestion when the customer is complaining, asking about delivery status, requesting a human, or has already declined once.
5. Unify the verticals: the Settings switch becomes the single source of truth so restaurant and wellness accounts respect it too, and their existing per-vertical switch stays in sync.
6. Verify end to end after the change: send a test product question with the toggle off, then on, and confirm from the message log that the reply gains exactly one suggestion.

## Technical notes

- Setting key: `ai_upsell_enabled` in `app_settings` (per `tenant_id`).
- Prompt assembly lives in `supabase/functions/whatsapp-cloud-webhook/index.ts`; the upsell block moves to the tail of `fullSystemPrompt` with a conditional relaxation of the 15-word cap.
- Candidate selection reuses the existing catalog fetch already used by the order flow (`order-flow.ts` `CatalogItem`), so no extra query per message.
- Order-flow upsell adds one optional step with a `upsell_offered` marker on the order session so it fires at most once per session.
- Restaurant/wellness read `ai_upsell_enabled` with their current keys (`restaurant_upsell_enabled`) as fallback.
