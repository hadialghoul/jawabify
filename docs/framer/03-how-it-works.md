# 03 — How it works `/how-it-works`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/how-it-works`
- `<title>` — **How Jawabify Works — Set Up WhatsApp AI in Under an Hour**
- `<meta name="description">` — **See how Jawabify connects to WhatsApp, learns your business, and starts answering, ordering and booking automatically — step by step.**
- Canonical: `https://jawabify.com/how-it-works`

---

## Section 1 — Hero (centered)

- `pt-24`
- Eyebrow: **How it works**
- H1: *"From zero to fully automated"* + gradient **"in under an hour"**
- Sub: *"No integrations to build. No developers required. Follow the timeline below and go live today."*

---

## Section 2 — Vertical timeline (7 steps)

Framer prompt:
> Build a vertical timeline. On the left, draw an absolute vertical connector line from top to bottom of the list: `1 px` wide, gradient `from-primary via-primary/40 to-transparent`, positioned at `left-6 sm:left-8`.
> Each timeline node is an ordered list item with left padding `pl-16 sm:pl-24`.
> On the left of every card, absolutely position a **circle node** — `h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-white border-2 border-primary shadow-elegant`, centered icon in primary.
> The card itself is `rounded-3xl border border-border bg-white p-6 sm:p-8 card-elevated` and lifts `-translate-y-0.5` on hover.

Card content:
- Top row = "Step 0X" eyebrow (primary uppercase-widest) + right-side time pill (`text-[11px] px-2.5 py-1 rounded-full bg-secondary text-muted-foreground`).
- H3 title (Urbanist bold `text-2xl`).
- Body muted-foreground.
- Bottom detail line: 14 px primary `Check` icon + `text-[12px] text-primary` detail.

The 7 steps:

**01 · Plug · ~2 min** — *Connect WhatsApp*
> Sign in with Meta. We provision your WhatsApp Business Cloud API in one click — no phone-switching, no waiting for approvals.
Detail: **Meta OAuth · Number verified in ~2 min · Existing number, no changes**

**02 · Brain · ~5 min** — *Upload your business knowledge*
> Import PDFs, spreadsheets, product images, or paste your website URL. Connect Shopify with one click for live catalog sync.
Detail: **Drag & drop · Shopify OAuth · PDF, DOCX, CSV, XLSX supported**

**03 · Sparkles · ~5 min** — *Train the AI on your voice*
> Tell it your tone, business hours, delivery policy, and escalation rules. It reads examples of past chats and adapts to your style.
Detail: **Guided setup · Test in sandbox before going live**

**04 · MessageSquare · Instant** — *Customers start chatting*
> Nothing changes for your customers — same number, same WhatsApp. But now every message gets a reply in seconds.
Detail: **Zero customer-side changes · Number stays the same**

**05 · Bot · 0.8s** — *AI responds instantly*
> Answers questions in the customer's language, sends product photos, transcribes voice notes, and handles the boring 90%.
Detail: **0.8s avg reply · 20+ languages · Grounded in your KB**

**06 · ShoppingCart · Real-time** — *Orders & appointments happen automatically*
> The deterministic order flow captures items, addresses, and totals — then syncs directly to Shopify or your calendar.
Detail: **State-machine ordering · Shopify sync · Google Calendar**

**07 · LineChart · Always on** — *Monitor everything from analytics*
> Reply rate, resolution %, orders, campaign ROI, peak hours. Real revenue attribution back to individual conversations.
Detail: **40+ metrics · Live · CSV & API export**

---

## Section 3 — "What it looks like"

Centered header:
- Eyebrow **What it looks like**
- Title: *"The moment you go live,"* gradient **"this is what you see"**

Below, `mt-12 grid gap-8 lg:grid-cols-2`:
- **Left**: small eyebrow *"Customer side · WhatsApp"*, then a full `WhatsAppChat`.
- **Right**: eyebrow *"Your side · Jawabify dashboard"*, then `BrowserFrame url="app.jawabify.com/orders"` containing `OrdersBoard`.

Below, `mt-8` full-width: eyebrow *"And your analytics update in real time"* → `BrowserFrame url="app.jawabify.com/analytics"` with `AnalyticsMockup`.

---

## Section 4 — Final dark CTA

Full-width `rounded-3xl` panel:
- Bg gradient `linear-gradient(135deg, #0A0A22, #1E1240)`.
- Padding `p-10 sm:p-14`, white text, centered.
- H3 Urbanist bold: **Ready to start your setup?**
- Body: *"The first 4 steps take under 15 minutes. The rest happens automatically."*
- CTA: white pill on dark → **Start your setup** + `ArrowRight` → `/auth`.

---

## Acceptance checklist

- [ ] Vertical connector line is a gradient fading to transparent at the bottom.
- [ ] Every step node is a rounded square with a 2 px primary border, not a circle.
- [ ] Time chips ("~2 min", "0.8s", etc.) sit at the top-right of each card.
- [ ] Bottom detail line has a small primary `Check` icon.
- [ ] "What it looks like" splits WhatsApp / Dashboard side-by-side ≥ lg, stacks on mobile.
- [ ] Final CTA is dark with a single white pill button.
