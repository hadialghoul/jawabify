# 07 — FAQ `/faq`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/faq`
- `<title>` — **FAQ — Common Questions about Jawabify WhatsApp AI**
- `<meta name="description">` — **Answers about setup, AI behavior, integrations, security, campaigns, and pricing for the Jawabify WhatsApp AI platform.**
- Canonical: `https://jawabify.com/faq`
- **JSON-LD** — FAQPage schema flattening every Q/A below into `mainEntity[]`.

---

## Section 1 — Hero (centered)

- `pt-24 pb-8`
- Eyebrow **FAQ**
- H1: *"Questions,"* gradient **"answered"**
- Sub: *"Everything you need to know before starting your trial. Still curious? We're one message away."*

---

## Section 2 — 6 category cards, each with its own accordion

Grid `gap-6 lg:grid-cols-2 max-w-6xl mx-auto`. Each card:
- `rounded-3xl border border-border bg-white p-6 sm:p-8 card-elevated`
- Header row: 40 × 40 primary/10 icon tile + Urbanist bold H3 `text-xl` title.
- Accordion (single, collapsible). Each item: chevron on the right, question in `font-semibold text-sm sm:text-base`, `border-b border-border` between items, muted-foreground answer.

**Category 1 · Sparkles · Getting started**

- **Do I need to change my WhatsApp number?**
  > No. We connect via the official Meta WhatsApp Business Cloud API. You keep your number and your customers keep messaging you as usual.
- **How long does setup take?**
  > Most businesses go live in 10–30 minutes. Connect Meta, upload your knowledge base, and the AI starts replying immediately.
- **Do I need a developer?**
  > No. The entire setup is self-serve through our dashboard. If you'd like white-glove help, our Enterprise plan includes it.

**Category 2 · Bot · AI behavior**

- **What languages does the AI speak?**
  > 20+ including English, Arabic (both standard and Arabizi), French, Spanish, Portuguese, and more. It auto-detects and mirrors the customer's language.
- **Will the AI make things up?**
  > No. Jawabify uses strict grounding rules — if a piece of information isn't in your knowledge base or catalog, the AI either says so or escalates to a human. We call this deterministic behavior.
- **Can I hand off to a human agent?**
  > Yes. Toggle AI off per conversation, or configure automatic escalation on keywords, sentiment, or unresolved intents. Your team picks up right where the AI left off.
- **Can I control the tone of the AI?**
  > Yes. Set formal, friendly, playful, or any brand voice. Provide sample chats and the AI matches your existing style.

**Category 3 · Zap · Integrations**

- **Does it integrate with Shopify?**
  > Yes — native OAuth integration syncs your product catalog, creates real orders, and pulls fulfillment status back into WhatsApp automatically.
- **Can I connect Google Calendar?**
  > Yes. Bookings created via WhatsApp sync bi-directionally with Google Calendar so your team sees everything in one place.
- **What about other platforms?**
  > We support CSV import/export for CRMs, Zapier-compatible webhooks, and a REST API for custom integrations. Enterprise plans include bespoke integrations.

**Category 4 · ShieldCheck · Security & compliance**

- **How is my data secured?**
  > Multi-tenant row-level security, encryption at rest and in transit, audited edge functions, and no data sharing across tenants. Ever.
- **Do you train AI on my conversations?**
  > No. Your conversations are used only to serve your customers. We never share, sell, or train foundational models on your data.
- **What about GDPR and data deletion?**
  > GDPR-ready by design. Every tenant can export or delete their data at any time from the dashboard.

**Category 5 · Globe2 · Campaigns & compliance**

- **What about STOP keywords and opt-outs?**
  > We handle STOP, UNSUBSCRIBE, and CANCEL keywords automatically per tenant. Campaigns exclude opted-out contacts with a single checkbox.
- **Can I scale past the 250-message limit?**
  > Yes. Our campaign worker respects Meta's tier system and automatically paces sends. As your quality rating grows, your limits grow — we help you get to 100k+/day.
- **Are templates approved by Meta?**
  > Every campaign template you create is submitted to Meta for approval. We help you write templates that pass on the first try.

**Category 6 · CreditCard · Pricing & billing**

- **Is there a free trial?**
  > Yes — 7 days, no credit card required. Full feature access.
- **What happens after the trial?**
  > You choose a plan or your account pauses. No auto-charging without your input. Your data stays intact.
- **Can I cancel anytime?**
  > One click in Settings. No cancellation fees, no lock-in.
- **Are Meta WhatsApp fees included?**
  > No. Meta charges you separately for conversations at their standard rates (typically $0.005–$0.10 per conversation). We pass this through at cost.

---

## Section 3 — Support CTA (dark)

Full-width `rounded-3xl` dark gradient panel (`#0A0A22 → #1E1240`), `p-10 sm:p-14 text-white`, grid `lg:grid-cols-[1.3fr_1fr] items-center gap-8`.

**Left:**
- H3 Urbanist bold `text-3xl sm:text-4xl` — **Still have questions?**
- Body white/80: *Our team replies within one business day on every channel — WhatsApp, email, or a live call.*
- CTAs: white pill **Contact us** + ArrowRight → `/contact`; ghost white/20 border **Start free trial** → `/auth`.

**Right (stacked contact cards, `space-y-3`):**

Each card: `flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10`. Left = 40 × 40 rounded-xl icon tile, middle = 2-line label/value, right = ArrowRight in white/75.

1. **WhatsApp us** (emerald-500 tile, MessageCircle) — **+971 52 350 6806** → `https://wa.me/971523506806` (target `_blank`).
2. **Email support** (primary indigo tile, Mail) — **hello@jawabify.com** → `mailto:hello@jawabify.com`.

---

## Acceptance checklist

- [ ] Page is a 2-column grid of 6 category cards (light).
- [ ] Each card has its own accordion; only one item open at a time within a card.
- [ ] Every category header has a primary/10 icon tile.
- [ ] Support CTA has a WhatsApp card (emerald tile) and Email card (indigo tile).
- [ ] JSON-LD FAQPage renders once at page level.
