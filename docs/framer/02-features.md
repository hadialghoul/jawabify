# 02 — Features `/features`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/features`
- `<title>` — **Features — AI WhatsApp Inbox, Orders, CRM & Campaigns | Jawabify**
- `<meta name="description">` — **Every Jawabify feature: AI replies in 20+ languages, order taking, CRM, analytics, appointment booking, campaigns and voice/image support.**
- Canonical: `https://jawabify.com/features`
- **JSON-LD** (`application/ld+json`):
  ```json
  {"@context":"https://schema.org","@type":"Service","name":"Jawabify AI WhatsApp Messaging Platform","provider":{"@type":"Organization","name":"Jawabify","url":"https://jawabify.com"},"areaServed":"Worldwide","description":"AI-powered WhatsApp Business platform for customer support, orders, bookings and marketing campaigns.","url":"https://jawabify.com/features"}
  ```

---

## Section 1 — Hero (centered)

- Section top padding `pt-24 pb-8`.
- Centered `SectionHeader`:
  - Eyebrow: **Features**
  - H1 (`as="h1"`): *"Every tool you need,"* + gradient **"nothing you don't"**.
  - Sub: *"A focused platform built for teams that treat WhatsApp as their primary customer channel. Explore every part of the product."*

---

## Sections 2–7 — Feature rows (6 total)

Each row is a full `Section` containing a `FeatureRow` component (2-column, `items-center`, gap 40–48 px). Rows alternate `reverse` (visual left) each row.

Every row uses this layout:
- Copy side (max-w-xl):
  - Eyebrow (primary)
  - H2 (Urbanist bold, `text-4xl sm:text-5xl`) with `.gradient-text` span
  - Body paragraph, muted-foreground, `leading-relaxed`
  - 3-up stats row (thin dividers between): label small caps + Urbanist value
  - `Scenario` callout card (see spec below)
- Visual side: the referenced mockup, at ~ 480 px wide, floats slightly on hover.

**Scenario card**: `rounded-2xl border bg-secondary/40 p-4`. Eyebrow "Real scenario" in primary uppercase-widest, then body in `text-sm text-foreground leading-relaxed`.

### Row 1 — AI Assistant *(visual right = `WhatsAppChat`)*

- Eyebrow: **AI Assistant**
- Title: *"Your smartest employee,"* gradient **"on WhatsApp"**
- Body:
  > *Understands intent, remembers context across 40 messages, mirrors the customer's language, and grounds every answer in your knowledge base. When it isn't sure, it hands off to a human — cleanly.*
- Stats: Avg reply **0.8s** · Auto-resolved **94%** · Context window **40 msgs**
- Scenario:
  > *Customer asks in Arabizi: "fi Blue medium?" — AI answers in the same style, sends the photo, reserves the item, and confirms the order in under 2 seconds.*

### Row 2 — Analytics *(visual left = `BrowserFrame` + `AnalyticsMockup`)*

- Eyebrow **Analytics**
- Title: *"The metrics that"* gradient **"move revenue"**
- Body: *Reply rate, message volume, peak hours, AI resolution %, order status breakdown, top products, returning customer rate, campaign ROI — all in one live dashboard.*
- Stats: KPIs tracked **40+** · Refresh **Live** · Exports **CSV · API**
- Scenario: *A restaurant discovers 68% of orders arrive between 7–9 PM. They shift staffing, cut wait time by half, and add a 6 PM promo campaign that lifts weekday revenue 22%.*

### Row 3 — CRM *(visual right = `BrowserFrame` + `CrmCard`)*

- Eyebrow **CRM**
- Title: *"A real CRM —"* gradient **"not a contact list"**
- Body: *Every customer gets a rich profile: order history, lifetime value, tags, campaign engagement, AI-generated behavior notes, and a full conversation timeline going back forever.*
- Stats: Contacts **Unlimited** · Segments **Dynamic** · Merges **Auto**
- Scenario: *AI flags Ahmed as a VIP after his 5th purchase. The next campaign automatically excludes him from the discount blast and sends him a personal early-access template instead.*

### Row 4 — Orders *(visual left = `OrdersBoard` kanban)*

- Eyebrow **Orders**
- Title: *"Deterministic order flow."* gradient **"Never a double-charge."**
- Body: *A state machine — not free-form AI — walks the customer through each item, applies pricing, confirms totals, and syncs the order to Shopify or your spreadsheet in real time.*
- Stats: Accuracy **99.9%** · Sync **Shopify** · Delivery **$3 flat**
- Scenario: *Customer says "2 lanterns + 1 backpack, deliver tomorrow." The bot confirms items, address, and total ($214). Shopify order #1052 is created before the customer stops typing.*

### Row 5 — Bookings *(visual right = `CalendarMockup`)*

- Eyebrow **Bookings & reservations**
- Title: *"A calendar that"* gradient **"fills itself"**
- Body: *Clinics, salons, restaurants, agencies. The AI checks availability, books the slot, sends reminders 24h and 1h before, and handles reschedules — all through WhatsApp.*
- Stats: No-shows **-38%** · Reminders **Auto** · Google Cal **Sync**
- Scenario: *A dental clinic goes from 22 no-shows/week to 6. AI books the slot, sends a reminder 24h before, and offers a reschedule link if the patient can't make it.*

### Row 6 — Campaigns *(visual left = `CampaignBuilder`)*

- Eyebrow **Campaigns**
- Title: *"Broadcast to thousands."* gradient **"Get real replies."**
- Body: *Segment your audience, pick a Meta-approved template, and send. STOP keywords, delivery pacing, and revenue attribution are all handled automatically.*
- Stats: Delivery **99.2%** · Reach **10k+ / hr** · Opt-out **Auto STOP**
- Scenario: *A boutique sends a Winter Sale to 4,218 contacts on a Friday at 7 PM. 34% reply within the hour, 118 orders come in overnight — attributed back to the campaign.*

---

## Section 8 — Team inbox

Centered header:
- Eyebrow **Team inbox**
- Title: *"One workspace for"* gradient **"every agent, every chat"**
- Body: *Assign conversations, leave internal notes, tag contacts, and hand off between AI and humans without a single dropped ball.*

Below: full-width `BrowserFrame url="app.jawabify.com/inbox"` with `InboxMockup`, `h-[520px]`.

---

## Section 9 — Small features grid ("Everything else")

Eyebrow **Everything else**. H2: *"Details that make the"* gradient **"difference"**.

Grid `gap-5 sm:grid-cols-2 lg:grid-cols-3` of 6 light BentoCards. Each: `bg-primary/10 rounded-xl` icon tile → title → body.

1. **Mic** — *Voice transcription* — Voice notes transcribed and answered like any text message. Arabic, English, French.
2. **Image (ImageIcon)** — *Image replies* — Send product photos automatically when a customer asks — no manual attachment hunting.
3. **Boxes** — *Knowledge base* — PDFs, spreadsheets, product images, or your website — all become answerable knowledge.
4. **Globe2** — *20+ languages* — Auto-detects and mirrors the customer's language, including Arabizi and dialects.
5. **ShieldCheck** — *Enterprise security* — Row-level tenant isolation, encrypted end-to-end, GDPR-ready audit trails.
6. **Zap** — *Meta Cloud API* — Native official API integration — no bans, no bridges, template-compliant campaigns.

---

## Section 10 — Final CTA (light card)

Centered white card `rounded-3xl border border-border bg-white p-10 sm:p-14 card-elevated`:
- H2 (Urbanist bold): **See it running on your business in minutes**
- Body: *Connect WhatsApp, import your catalog, and go live the same day.*
- 2 CTAs: Primary dark pill **Start free trial** → `/auth`; Secondary white outline **See how it works** + `ArrowUpRight` → `/how-it-works`.

---

## Acceptance checklist

- [ ] 6 feature rows alternate visual side.
- [ ] Every H2 ends with a `.gradient-text` emphasis span.
- [ ] Each row includes a "Real scenario" callout card on soft secondary bg.
- [ ] 3 stats per row are inline with a small vertical divider between.
- [ ] Small features grid is 6 cards, 3 columns on desktop.
- [ ] Team inbox `BrowserFrame` is 520 px tall.
- [ ] Final CTA is a light card (not dark).
