# 01 — Home `/`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/`
- `<title>` — **Jawabify — AI WhatsApp Customer Messaging for Businesses**
- `<meta name="description">` — **Jawabify automates WhatsApp replies, orders, bookings and campaigns with a multilingual AI assistant — live in 10 minutes, in 20+ languages.**
- Canonical + `og:url`: `https://jawabify.com/`
- Wrapper: `Navbar` (fixed) → `<main class="pt-16">` sections below → `Footer`.

---

## Section 1 — Hero

**Framer prompt:**
> Build a hero section with a subtle indigo radial glow behind everything. Two-column layout on desktop (left 1.05fr / right 1fr, `items-center`), single column on mobile with the visual below the copy.

**Background layers (absolute, inside `relative overflow-hidden pt-10 sm:pt-14 pb-16 sm:pb-24`):**
1. Faint grid pattern, opacity 0.6.
2. Radial glow overlay using `--hero-glow`.

**Left column (fade-up animation):**
1. **Announcement pill** — `inline-flex items-center gap-2 rounded-full border border-border bg-white/70 backdrop-blur px-3 py-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground`. Content: 8 px indigo dot with `animate-pulse-soft` + text *"Now with Arabic, Arabizi & 20+ languages"*.
2. **H1** — Urbanist 800, `text-[34px] sm:text-[52px] lg:text-[64px] leading-[1.05] tracking-tight`.
   Copy: **"The AI that runs your entire "** then a `.gradient-text` span **"WhatsApp business"**.
3. **Sub** — `mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl`:
   > *Jawabify replies to every customer, takes orders, books appointments, and runs campaigns — 24/7, in every language, from one AI-powered inbox that feels like your best employee.*
4. **CTA row** — 24 px top margin, `flex flex-col sm:flex-row gap-3`:
   - Primary dark pill → **Start 7-day free trial** + ArrowRight (`/auth`)
   - Secondary white outline pill → **See how it works** + Play icon (`/how-it-works`)
5. **Trust row** — `mt-5 text-xs text-muted-foreground` with 3 items separated by 16 px, each = 14 px emerald `CheckCircle2` + label:
   *No credit card* · *Cancel anytime* · *Live in 10 min*
6. **Inline stats** — `mt-8 sm:mt-10 grid grid-cols-3 gap-4 max-w-md`, each cell = Urbanist bold 24 px value + `text-[11px] uppercase tracking-widest text-muted-foreground` label:
   - **0.8s** — avg reply
   - **94%** — AI resolved
   - **20+** — languages

**Right column (desktop only, `hidden lg:block`, fade-up 150 ms delay):**

Layered product visual with 3 stacked pieces:

1. **Main dashboard** (in `BrowserFrame`, url = `app.jawabify.com/dashboard`, z-10):
   - Grid `[220px_1fr]` × 440 px tall.
   - **Sidebar** (`bg-secondary/30 border-r`): 28 px `Jawabify` logo tile (gradient primary → indigo-600 bg, white `Sparkles` icon) + "Jawabify" bold text. Then nav items — active pill "Inbox 12", muted "Orders 284", "CRM", "Bookings 14", "Analytics", "Campaigns". Active = `bg-primary text-primary-foreground`.
   - **Main pane** (`p-4`): title row "Overview" eyebrow + Urbanist bold "Today · Nov 15", right side `AI online` chip (emerald pill with Bot icon). Below: 3-up stat grid tiny cards (Messages 1,284 +18%, Orders 42 +31%, Revenue $3,410 +22%) — each with `text-[9px]` eyebrow, bold value, tiny green `TrendingUp` delta. Below: a chart card "Messages · last 24h · Peak 8 PM" with an indigo SVG area chart. Below: an order row card — small `ShoppingCart` icon tile + "Order #1052 · Layla N." + "2× Earbuds Pro · $178 · Beirut" + emerald "Confirmed" pill.
2. **Floating WhatsApp chat** — absolutely positioned `-bottom-8 -left-10 w-[280px] z-20 animate-float`. Render the `WhatsAppChat compact` component from the design system.
3. **Floating notification stack** — absolutely positioned `-top-4 -right-4 w-[280px] z-20 animate-float` with 1.5 s delay. Three stacked "new message" toast cards.

**Mobile:** only render `WhatsAppChat compact` on the right below the copy.

**Trust bar** below the hero, `mt-24`:
- Center-aligned eyebrow line: *"Trusted by growing brands across the region"*.
- Then a marquee logo cloud, 30 s linear infinite scroll, showing the 7 brand images from the asset URL list, `h-8` grayscale-to-color on hover.

---

## Section 2 — Live sandbox

Full-width demo iframe/sandbox. In Framer, embed a placeholder rounded-3xl card with dark bg + text *"Try a live conversation with Jawabify AI →"* if you can't recreate the interactive sandbox. Height ~ 620 px.

---

## Section 3 — "3 questions" cards

Grid `gap-6 lg:grid-cols-3`, each card = `rounded-3xl border border-border bg-white p-8 card-elevated hover:-translate-y-1`. Inside:
- Big number top-left in `text-6xl font-black text-primary/10` (hover → primary/20)
- 44 × 44 icon tile top-right (`bg-primary/10`, indigo icon)
- H3 Urbanist bold question
- Body muted-foreground answer
- Tag chips row at the bottom: `text-[10.5px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground`

Cards (copy the exact text):

**01 · Sparkles · What is Jawabify?**
> An AI-powered WhatsApp platform that handles every customer conversation — orders, bookings, questions, and marketing — end to end. One inbox. One AI. Every workflow.
Tags: `AI Assistant`, `Inbox`, `CRM`, `Campaigns`.

**02 · Users · Who is it for?**
> Growing businesses that live on WhatsApp: e-commerce, restaurants, real estate, clinics, salons, schools, and service providers who can't afford to miss a single message.
Tags: `E-commerce`, `Restaurants`, `Real Estate`, `Healthcare`.

**03 · Zap · Why not traditional support?**
> Human agents are slow, expensive, and don't scale. Jawabify replies in seconds, in any language, and never sleeps — cutting response time by 95% and support cost by 80%.
Tags: `0.8s reply`, `24/7`, `80% cheaper`.

---

## Section 4 — Section header "Platform"

Eyebrow **Platform**. H2:
> **Every tool your team needs, <span class="gradient-text">in one place</span>**

Sub: *"See each part of the product. Real dashboards, real conversations, real workflows."*
Align left, `max-w-3xl`.

---

## Section 5 — Alternating feature rows

Six `FeatureRow`s stacked with `space-y-20 sm:space-y-32`. Each row is a 2-column layout (visual + copy) that **alternates side** (rows 1/3/5 = visual on right, rows 2/4/6 = visual on left).

Each copy column has: eyebrow, H2 with `.gradient-text` on the emphasis span, body paragraph, then a horizontal stat strip of 3 label/value pairs, then a CTA link "Explore … →" in primary color.

Rows:

**Row 1 — AI Assistant** *(visual right = `WhatsAppChat` full)*
- Title: *Replies in seconds. In any language.* + gradient **Every time.**
- Body: *The AI reads your catalog, PDFs, Shopify, and FAQ — then responds like a senior agent who's read every document your company has ever written.*
- Bullets: Avg reply **0.8s** · Auto-resolved **94%** · Languages **20+**
- CTA: **Explore the AI →** → `/features`

**Row 2 — Analytics** *(visual left = `BrowserFrame url="app.jawabify.com/analytics"` with a `AnalyticsMockup` — indigo bar chart + line chart + KPI tiles)*
- Title: *Every conversation,* gradient **measured.**
- Body: *Reply rate, resolution time, peak hours, revenue by chat, campaign ROI. The metrics you'd expect from an enterprise suite — without the enterprise price.*
- Bullets: Metrics **40+** · Real-time **Live** · Exports **CSV / API**
- CTA: **See analytics →** → `/features`

**Row 3 — CRM** *(visual right = `BrowserFrame` "app.jawabify.com/crm" showing a customer profile card with avatar, tags "VIP · Beirut", 5-order timeline)*
- Title: *Know every customer* gradient **by name.**
- Body: *Every message becomes a memory. Contacts, tags, order history, lifetime value, campaign engagement, and AI-generated notes — all attached to a phone number.*
- Bullets: Contacts **Unlimited** · Segments **Custom** · Sync **Shopify + CSV**
- CTA: **Explore CRM →**

**Row 4 — Orders** *(visual left = `OrdersBoard` — 3 status columns "Pending / Confirmed / Delivered" with order cards each showing order id, customer, items, price)*
- Title: *Deterministic ordering.* gradient **Never a double-charge.**
- Body: *A state-machine flow — not free-form AI — collects each item, confirms totals, syncs to Shopify, and creates a real order the moment the customer says yes.*
- Bullets: Accuracy **99.9%** · Sync **Shopify** · Statuses **Live**

**Row 5 — Bookings** *(visual right = `CalendarMockup` week grid with color-coded appointment blocks)*
- Title: *Fills your calendar* gradient **while you sleep.**
- Body: *Clinics, salons, restaurants, agencies. The AI checks availability, books the slot, sends reminders, and handles reschedules — all through WhatsApp.*
- Bullets: Bookings **24/7** · No-shows **-38%** · Google Cal **Sync**
- CTA: **See industries →** → `/industries`

**Row 6 — Campaigns** *(visual left = `CampaignBuilder` — a template composer + 3 audience segment cards)*
- Title: *Reach thousands.* gradient **Get real replies.**
- Body: *Broadcast WhatsApp templates to your entire audience with segmentation, opt-out compliance, delivery pacing, and revenue attribution baked in.*
- Bullets: Delivery **99.2%** · Opt-out **Auto STOP** · Templates **Meta-approved**

---

## Section 6 — Team inbox preview

Centered `SectionHeader`:
- Eyebrow **Team inbox**
- Title: *One shared workspace.* gradient **Zero missed messages.**
- Body: *Every chat, every agent, every AI reply — in a single view built for teams.*

Below, full-width `BrowserFrame url="app.jawabify.com/inbox"` with an `InboxMockup` — 3-pane layout (conversation list left, chat middle, contact profile right), height `380 px sm:520 px`.

---

## Section 7 — Why teams switch (6-card bento)

Eyebrow **Why teams switch**. H2: *Built for how businesses* gradient **actually run on WhatsApp**.

Grid `gap-5 md:grid-cols-3` of 6 light `BentoCard`s. Each: 40 × 40 primary/10 icon tile, Urbanist bold `text-lg` title, muted body text.

1. **ShieldCheck** — *Enterprise-grade security* — Row-level tenant isolation, encryption at rest and in transit, GDPR-ready, no data sharing.
2. **Globe2** — *Meta Cloud API native* — Direct integration with the official API — no bridges, no bans, full template compliance.
3. **Bot** — *Grounded, not hallucinating* — Strict retrieval rules. If it isn't in your knowledge base, the AI says so or escalates.
4. **Zap** — *10-minute setup* — Connect Meta, upload your knowledge, go live. No developers required.
5. **Users** — *Human handoff, seamless* — Toggle AI off per chat or auto-escalate on sentiment, keywords, or unresolved intent.
6. **LineChart** — *Real ROI, tracked* — Attribute revenue to individual conversations, campaigns, and AI resolutions.

---

## Section 8 — Testimonials

Eyebrow **Loved by operators**. H2: *Real teams.* gradient **Real results.**

Grid `md:grid-cols-3 gap-5`, each card `rounded-3xl border bg-white p-6 card-elevated`:
- Top: 5 filled indigo `Star` icons (h-4).
- Quote in default foreground (`"…"`).
- Bottom row (border-top divider): left = name + brand, right = metric pill (`bg-primary/10 text-primary text-[11px] px-2.5 py-1 rounded-full`).

1. **Karim Y. · Lumon** · pill **94% AI-resolved**
   > "We stopped hiring agents. Jawabify handles 94% of our WhatsApp traffic and our response time went from 2 hours to under a minute."
2. **Rania A. · Bubbly Bites** · pill **3× more orders**
   > "Orders come in on WhatsApp, land in Shopify, and go to the kitchen — no human touches anything until the food is on the counter."
3. **Marc S. · Cedar Homes** · pill **5× lead speed**
   > "The AI qualifies every real-estate lead in Arabic and English, books the viewing, and only pings me when it's serious. Game changer."

---

## Section 9 — Final dark CTA

Full-width `rounded-3xl` panel with gradient bg `linear-gradient(135deg, #07061A, #0F0A2E, #1E1240)`, 40–56 px padding, white text.

- Absolute purple radial glow top-right, opacity 0.4.
- Grid `lg:grid-cols-[1.3fr_1fr]`.
- Left: 32 px `Sparkles` icon in primary, then H2 *Stop losing customers to* + gradient-invert span **slow replies.** (light text with primary→lavender gradient), then `text-white/70 max-w-lg`:
  > *Set up in 10 minutes. Free for 7 days. $45/month after that. Cancel any time.*
  Then 2 CTAs: **Start free trial** (white pill on dark → `/auth`), **Talk to sales** (ghost border white/20 → `/contact`).
- Right (`hidden lg:block`): `NotificationStack` — 3 stacked message notification cards.

---

## Acceptance checklist

- [ ] Fixed header shows scroll shadow after 8 px of scroll.
- [ ] Hero H1 has an indigo→purple gradient on "WhatsApp business" only.
- [ ] Hero right column is layered (browser frame + floating chat + floating notifications) and only visible ≥ lg.
- [ ] Logo cloud marquees infinitely from right to left, 30 s.
- [ ] 6 feature rows alternate visual side (right/left/right/left/right/left).
- [ ] Every H2 ends with a `.gradient-text` span.
- [ ] Testimonials show 5 filled indigo stars, not outlines.
- [ ] Final CTA panel has a dark 3-stop gradient and a purple glow top-right.
- [ ] All primary CTAs point to `/auth`, secondary CTAs to `/how-it-works` or `/contact`.
- [ ] Fade-up entrance animation runs once per section on scroll into view.
