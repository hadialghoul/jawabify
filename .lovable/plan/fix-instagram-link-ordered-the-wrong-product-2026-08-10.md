# Fix: Instagram link ordered the wrong product

## What actually happened (verified from the conversation log)

The chat with +9613976705 on Aug 7:

```text
00:31:50  Customer: Hi
00:32:02  Bot: Hi!
00:32:03  Customer: https://www.instagram.com/p/DZ013kiAHQ_/?igsh=...
00:32:06  Customer: I want this one
00:32:20  Bot: Cart so far: 1x Dreamy Star Projector - $24.99
```

There was no click-to-WhatsApp ad payload on that message (it was a plain
pasted Instagram post link), so the bot had zero product signal. "I want this
one" started the deterministic order flow, which then tried to guess the
product from the conversation:

- Tier 1 (ad `product:` field): nothing, no ad note.
- Tier 2 (product link slug): the Instagram path is `/p/DZ013kiAHQ_` — the
  last path segment is a random post shortcode, which carries no product name.
- Tiers 3-5 (product named by bot / typed by customer / ad copy): nothing —
  only "Hi" and "I want this one".
- Tier 6 (AI fallback): the model was handed the whole catalog and the
  transcript and asked to pick an id, and it picked "Dreamy Star Projector"
  instead of answering NONE.

So the wrong product was silently seeded into the cart, the customer confirmed
without re-reading the item, order #2528 shipped a projector, and on Aug 10 he
came back saying "I want this... it is not the dreamy projector, this is
lighting for reading" (the flat book light).

## The fix

1. **Never guess from a bare demonstrative.** Before running the AI fallback,
   require at least one real product signal in the recent transcript (a
   catalog-ish word, an ad note, or a product-page link). If the only thing the
   customer said is "this / this one / hada / bade hayda" plus a link with no
   product name, skip inference entirely.

2. **Treat social links as no signal.** Recognise Instagram / Facebook /
   TikTok / YouTube / WhatsApp-status URLs and post-shortcode paths
   (`/p/...`, `/reel/...`, `/share/...`, `/posts/...`) and exclude them from
   slug matching, so a random shortcode can never feed the matcher.

3. **Harden the AI fallback.** Tighten the prompt to answer NONE unless the
   product is named or clearly described, and validate the answer in code: the
   chosen product's distinctive title words (or its type word, e.g. "light",
   "projector") must actually appear somewhere in the transcript. If not,
   discard the match.

4. **Ask instead of assuming.** When no product can be resolved, the order flow
   opens with the product question / picker instead of a pre-filled cart. This
   path already exists; it just wasn't reached because inference always
   returned something.

5. **Resolve the Instagram post when possible (best effort).** For an
   Instagram/Facebook post link, fetch the public page's `og:title` /
   `og:description` caption and use that text as the product hint. Instagram
   often serves a login wall to servers, so this is treated as a bonus signal
   only — when it fails we fall back to asking the customer.

## Technical notes

- `supabase/functions/whatsapp-cloud-webhook/order-flow.ts`
  - `slugsFromText`: skip social hosts and shortcode paths.
  - new `hasProductSignal(turns)` guard + a demonstrative-only detector, used
    before tier 6 in `inferProductFromContext`.
  - `resolveProductWithAI`: stricter system prompt + post-validation of the
    returned title against the transcript; log the rejection reason.
- `supabase/functions/whatsapp-cloud-webhook/index.ts`
  - social-post URL enrichment: fetch og tags for instagram/facebook links and
    append `[Shared post — caption: ...]` to the message text so the existing
    matching tiers can use it; silent no-op on failure.
- No database or UI changes. Existing order #2528 is untouched.
