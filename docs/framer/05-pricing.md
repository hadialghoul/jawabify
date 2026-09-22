# 05 — Pricing `/pricing`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/pricing`
- `<title>` — **Pricing — Starter, Growth & Enterprise plans | Jawabify**
- `<meta name="description">` — **Three simple plans starting at $45/month with a 7-day free trial. Unlimited AI replies, orders, CRM, campaigns and 20+ languages — no per-seat or per-message fees.**
- Canonical: `https://jawabify.com/pricing`
- **JSON-LD** (Product with 2 offers):
  ```json
  {"@context":"https://schema.org","@type":"Product","name":"Jawabify","description":"AI-powered WhatsApp Business platform with unlimited replies, orders, CRM and campaigns.","brand":{"@type":"Brand","name":"Jawabify"},"offers":[{"@type":"Offer","name":"Starter","price":"45","priceCurrency":"USD","url":"https://jawabify.com/pricing","availability":"https://schema.org/InStock"},{"@type":"Offer","name":"Growth","price":"90","priceCurrency":"USD","url":"https://jawabify.com/pricing","availability":"https://schema.org/InStock"}]}
  ```

---

## Section 1 — Hero (centered)

- `pt-24`
- Eyebrow **Pricing**
- H1: *"Three plans."* gradient **"Pays for itself in days."**
- Sub: *"No per-seat fees. No per-message markups. Pick the plan that fits — upgrade anytime."*

---

## Section 2 — 3 tier cards

Grid `gap-6 lg:grid-cols-3 max-w-6xl mx-auto items-start`.

### Card A — Starter (light)
- `rounded-3xl border border-border bg-white p-8 card-elevated`
- Chip on top: `bg-secondary rounded-full px-3 py-1 text-xs uppercase tracking-widest` — **Starter**
- Price row (`mt-6 flex items-baseline gap-2`):
  - `text-xl font-medium line-through text-muted-foreground/70` — **$90**
  - Urbanist black `text-5xl` — **$45**
  - `text-muted-foreground` — **/ month**
- Sub: *"Everything you need to start replying automatically."*
- CTA: full-width secondary white outline pill → **Start free trial** + `ArrowRight` → `/auth`
- Eyebrow **"What's included"** in muted-foreground uppercase.
- Feature list `mt-3 space-y-2.5`, each = 14 px primary `Check` + text:
  1. Up to 1,000 orders per month
  2. WhatsApp AI auto-reply
  3. 20+ languages incl. Arabic & Arabizi
  4. Voice note transcription
  5. Shared inbox with order context
  6. Shopify two-way sync

### Card B — Growth (dark, featured)
- `rounded-3xl` with gradient bg `linear-gradient(135deg, #0A0A22, #1E1240)`, white text, `noise` texture overlay optional, and `lg:-mt-4` (lifted above the others).
- Absolute glow: `-top-20 -right-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl`.
- Top row: white/10 chip **Growth** on left, primary/20 chip on right — `<Sparkles>` icon + **Most popular**.
- Price row: strikethrough `$140` in white/50, then `$90` in Urbanist 900, then white/80 `/ month`.
- Sub: *"Scale without limits. Built for serious operators."*
- CTA: full-width white-on-dark pill → **Start free trial** → `/auth`
- Eyebrow "What's included" in white/70.
- Feature list — each = 14 px `emerald-400` check + white/85 text:
  1. Everything in Starter
  2. Unlimited orders
  3. Bulk campaigns & broadcasts
  4. Automated order confirmations
  5. Full CRM & 40+ analytics metrics
  6. Priority support

### Card C — Enterprise (light)
- Same light card style as Starter.
- Chip **Enterprise**.
- Price: Urbanist bold `text-4xl` — **Custom** (no `$`, no `/month`).
- Sub: *"For agencies, multi-brand, and high-volume operations."*
- CTA: secondary white outline pill → **Talk to sales** → `/contact`
- Features (primary check):
  1. Everything in Growth
  2. Dedicated success manager
  3. Custom AI training on your archives
  4. SLA & priority 24/7 support
  5. SSO, advanced roles & audit logs
  6. Custom integrations (ERP, POS, CRM)
  7. White-label options
  8. Volume discounts on Meta fees

---

## Section 3 — Full comparison table

Eyebrow **Compare**. H2: *"Full breakdown,"* gradient **"side by side"**.

Container: `rounded-3xl border border-border bg-white overflow-hidden card-elevated`.
CSS grid `grid-cols-[1.4fr_1fr_1fr_1fr] text-sm`.

Header row (`bg-secondary/40 p-4 text-[11px] uppercase tracking-widest`):
- **Feature** (muted-foreground) · **Starter · $45/mo** · **Growth · $90/mo** · **Enterprise**

Data rows (border-top border-border, `p-4`, first col medium weight, rest muted-foreground):

| Feature | Starter | Growth | Enterprise |
|---------|---------|--------|-----------|
| AI auto-replies | Unlimited | Unlimited | Unlimited |
| Orders / month | 1,000 | Unlimited | Unlimited |
| Languages | 20+ | 20+ | 20+ + custom dialects |
| Bulk campaigns | — | Unlimited* | Unlimited |
| Team seats | Unlimited | Unlimited | Unlimited + SSO |
| Shopify integration | Native | Native | Native + custom |
| Analytics retention | 3 months | 12 months | Unlimited |
| Support SLA | 2 business days | 1 business day | 1 hour · 24/7 |
| Onboarding | Self-serve | Self-serve + docs | White-glove |

Footnote below: `text-xs text-muted-foreground` — *"\* Meta rate limits apply per template category. We help you scale your messaging tier as your quality rating grows."*

---

## Section 4 — Pricing FAQ

Centered header: Eyebrow **Pricing FAQ**, H2 *"Common"* gradient **"pricing questions"**.

Container: `max-w-3xl mx-auto rounded-3xl border border-border bg-white p-2 sm:p-4 card-elevated`. Use a shadcn-style Accordion (single, collapsible).

Items:

- **What's the difference between Starter and Growth?**
  > Starter is capped at 1,000 orders/month and does not include bulk campaigns — perfect for small shops just getting started. Growth adds unlimited orders, campaigns, and priority support for teams that need to scale.
- **What happens after the free trial?**
  > Your account pauses until you choose a plan. Nothing is charged automatically without your input. Your data stays intact.
- **Can I cancel or switch plans anytime?**
  > Absolutely. One click in Settings. No cancellation fees, no lock-in, and you keep access until the end of your billing period.
- **Do you charge per seat or per message?**
  > No. Flat monthly pricing with unlimited seats and unlimited contacts. Meta charges you separately for WhatsApp conversation fees at their standard rates (paid to Meta at cost).

Below the accordion, centered `text-sm text-muted-foreground`:
> *"Prices in USD. Meta WhatsApp conversation fees billed separately by Meta at cost."*

---

## Acceptance checklist

- [ ] Growth card is dark gradient with a purple radial glow top-right.
- [ ] Growth card sits `-4 px` above the other two on ≥ lg (lifted).
- [ ] Starter shows strikethrough $90 → $45; Growth strikethrough $140 → $90.
- [ ] Enterprise shows "Custom" (no strikethrough) and CTA points to `/contact`.
- [ ] Comparison table is a 4-column CSS grid, first cell = "Feature".
- [ ] Footnote references the `*` next to "Unlimited*".
- [ ] FAQ uses an accordion with chevron indicators.
