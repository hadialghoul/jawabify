# 04 — Industries `/industries`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/industries`
- `<title>` — **Industries — WhatsApp AI for Retail, Restaurants, Real Estate & More | Jawabify**
- `<meta name="description">` — **Purpose-built WhatsApp AI flows for e-commerce, restaurants, real estate, healthcare, wellness, education and services — dashboards tailored to each vertical.**
- Canonical: `https://jawabify.com/industries`

---

## Section 1 — Hero (centered)

- `pt-24 pb-8`
- Eyebrow **Industries**
- H1: *"One platform,"* gradient **"purpose-built flows"**
- Sub: *"Tap any industry to preview the dashboard your team would use every day."*

---

## Section 2 — Industry cards (7 rows)

Layout: single-column list of 7 large cards, `gap-8`. Each card:

- Wrapper: `rounded-3xl border border-border bg-white overflow-hidden card-elevated hover:shadow-elegant`.
- Inner grid `lg:grid-cols-[1.15fr_1fr]`.

**Left half (`p-8 sm:p-10`):**
1. Icon block header — 48 × 48 rounded-2xl tile with `bg-gradient-primary` and white icon, next to it a 2-line title stack: a primary uppercase-widest **tag chip** on top, then Urbanist bold H3 title.
2. **Problem** — eyebrow `text-[11px] uppercase tracking-widest text-muted-foreground` "Problem", then body paragraph in foreground.
3. **Solution** — eyebrow in primary "Solution", body in foreground.
4. **Features** — 2×2 grid of items, each `Check` (emerald) + label in muted-foreground `text-sm`.
5. Bottom row `flex flex-wrap gap-3`:
   - **Stat chip**: `rounded-xl bg-primary/10 px-4 py-2` — big Urbanist primary number + tiny uppercase label.
   - **"See dashboard" button**: dark pill `bg-foreground text-background` + `Eye` icon.
   - **"Start trial →"** primary text link.

**Right half (min-h 380 px):**
- Bg gradient `bg-gradient-to-br from-secondary/60 to-primary/5`.
- Centered scaled-down dashboard preview (the corresponding `RealisticDashboard` for that vertical).
- On hover: dark overlay `bg-foreground/5` fades in with a centered "Preview dashboard" pill (`bg-foreground text-background`, Eye icon).
- Whole half is clickable → opens the modal (see below).

### The 7 industries (in order)

| Icon | Tag | Title | Problem | Solution | Features (4) | Stat |
|------|-----|-------|---------|----------|--------------|------|
| **ShoppingBag** | Shopify-native | **E-commerce** | Cart abandonment, slow support, missed sales on WhatsApp DMs. | AI takes orders in chat, syncs to Shopify, sends tracking, handles returns. | Deterministic order flow · Shopify catalog sync · Delivery tracking replies · Returns automation | **3.4×** more WhatsApp orders |
| **UtensilsCrossed** | Kitchen-ready | **Restaurants** | Phone lines busy, orders lost on paper, tables sitting empty. | Menu on WhatsApp, kitchen tickets printed automatically, table reservations, delivery flows. | Live menu updates · Modifier support · Table reservations · Kitchen ticket printing | **42%** faster order-to-kitchen |
| **Home** | Lead-qualifier | **Real Estate** | Hundreds of tire-kickers, agents burnt out chasing dead leads. | AI qualifies leads by budget & location, books viewings, hands hot prospects to your agents only. | Budget & area qualifying · Google Cal viewing sync · Lead scoring · Agent handoff on hot leads | **5×** qualified viewings/week |
| **Stethoscope** | HIPAA-aware | **Healthcare** | No-shows, reception overwhelmed, patients waiting for confirmations. | Triage, appointments, lab follow-ups — with automatic escalation on urgent symptoms. | 24/7 appointment booking · Automated reminders · Symptom triage · Urgent escalation | **-38%** no-shows |
| **Sparkles** | Membership-friendly | **Wellness** | Reschedules eating your day, memberships not upsold. | AI books sessions, manages reschedules and reminders, upsells packages naturally. | Package management · Reschedule automation · Loyalty upsells · Class waitlists | **+22%** package upsells |
| **GraduationCap** | Parent-friendly | **Education** | Admin drowning in parent questions, applications stalling. | Class info, registration, parent questions answered 24/7 in the family's native language. | Registration workflow · Multilingual replies · Fee reminders · Absence handling | **80%** faster admissions reply |
| **Briefcase** | Any business | **Services** | Agencies, consultants, travel — anyone selling on WhatsApp needs structure. | Configurable flow adapts to any service business selling and delivering on WhatsApp. | Custom booking flows · Quote & invoice replies · Multi-agent inbox · Payment link generation | **10 min** to configure |

---

## Section 3 — Dashboard preview modal

Shared dialog. Opens when user clicks "See dashboard" or the visual preview.

- Max width `max-w-5xl w-[95vw]`, `max-h-[90vh] overflow-y-auto`.
- Header: 40 × 40 gradient tile with the industry icon, tag chip above title, `DialogTitle` = **"{Industry} dashboard"**, `DialogDescription` = the industry's solution paragraph.
- Body: the full-size `RealisticDashboard` preview for that index.
- Footer row: 2-column list of the 4 features + `Check` icons on the left, "Start free trial →" dark pill on the right.

---

## Section 4 — Final dark CTA

Full-width `rounded-3xl` panel with dark gradient bg (`#0A0A22 → #1E1240`), centered:
- H3 Urbanist bold **Don't see your industry?**
- Sub: *"The Services vertical adapts to any business selling on WhatsApp. If it involves messages, orders, or bookings — we can automate it."*
- 2 CTAs: white pill **Talk to us** → `/contact`, ghost white/20 border **Start free trial** → `/auth`.

---

## Acceptance checklist

- [ ] 7 industry cards in a single vertical stack.
- [ ] Each card has a 2-column layout on lg (copy left / preview right).
- [ ] Icon tile uses the primary→purple gradient background.
- [ ] Features list is a 2×2 grid with emerald check icons.
- [ ] Stat chip has an indigo tinted bg (`primary/10`).
- [ ] Hovering the right half fades in a "Preview dashboard" pill.
- [ ] Modal opens with the full-size dashboard for that vertical.
