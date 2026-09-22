# 06 — About `/about`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/about`
- `<title>` — **About Jawabify — Building the Tools We Wish We Had**
- `<meta name="description">` — **Jawabify is a Beirut & Dubai team building AI-powered WhatsApp messaging for businesses across MENA and beyond — meet the team and our mission.**
- Canonical: `https://jawabify.com/about`
- **JSON-LD** (AboutPage):
  ```json
  {"@context":"https://schema.org","@type":"AboutPage","url":"https://jawabify.com/about","name":"About Jawabify","about":{"@type":"Organization","name":"Jawabify","url":"https://jawabify.com"}}
  ```

---

## Section 1 — Hero (split)

- `pt-24`, 2-col grid `lg:grid-cols-[1.2fr_1fr] items-center gap-12`.

**Left column:**
- Eyebrow pill: **About Jawabify**
- H1 (Urbanist bold `text-5xl sm:text-6xl tracking-tight`):
  > **We build the tools** + gradient **we wish we had**
- Body `mt-6 text-lg text-muted-foreground leading-relaxed`:
  > *Jawabify started because running a business on WhatsApp meant hiring more people, missing more messages, and losing more customers every week. AI finally became good enough to fix that. So we did.*
- Stats row `mt-8 grid grid-cols-3 gap-4 max-w-md`:
  - **2,400+** businesses
  - **18M+** messages/mo
  - **20+** languages

**Right column:**
- Square card `aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-indigo-500/10 to-secondary p-10 grid place-items-center`.
- Inside, centered stack:
  - 112 × 112 rounded-3xl dark tile (`bg-ink-950`, `p-4`, `shadow-elegant`) with the Jawabify logo (`https://jawabify.com/favicon.png`).
  - Below: Urbanist bold `text-2xl` **Jawabify**.
  - Below: muted-foreground `text-sm` — *"Beirut · Dubai · Remote"*.

---

## Section 2 — Mission + Team split (2 cards)

Grid `lg:grid-cols-2 gap-6`.

**Card A (light):** `rounded-3xl border border-border bg-white p-10 card-elevated`
- Eyebrow (primary) — **Our mission**
- H3 Urbanist bold `text-3xl` — **Make world-class customer conversations accessible to every business.**
- Body muted-foreground:
  > *From the corner restaurant to the growing e-commerce brand. WhatsApp is where your customers are. Jawabify makes sure you're always there too — instantly, in their language, in the tone your brand deserves.*

**Card B (dark, with glow):** `rounded-3xl bg-gradient-to-br from-[#0A0A22] to-[#1E1240] p-10 text-white relative overflow-hidden`
- Absolute `-top-10 -right-10 h-40 w-40 rounded-full bg-primary/40 blur-3xl`.
- Eyebrow (white/70) — **The team**
- H3 Urbanist bold — **Operators, engineers, designers.**
- Body white/85:
  > *We've spent years shipping AI, messaging infrastructure, and enterprise software at companies you know. Now we build for people who run real businesses on their phones.*
- Footer line white/75 `text-sm` — *"Based between Beirut and Dubai · Serving businesses worldwide"*

---

## Section 3 — Values (6-card grid)

Eyebrow **What we believe**. H2: *"Values that shape"* gradient **"every decision"**.

Grid `gap-5 md:grid-cols-2 lg:grid-cols-3`. Each card: `rounded-2xl border border-border bg-white p-6 card-elevated hover:-translate-y-0.5`, 40 × 40 primary/10 icon tile, Urbanist bold H4 `text-lg`, muted body.

1. **Heart** — *Customer-obsessed* — Every feature ships because a real business asked for it. We answer support tickets ourselves.
2. **Zap** — *Speed as a feature* — Fast to set up, fast to reply, fast to iterate. Slow software is broken software.
3. **Sparkles** — *Radical simplicity* — One platform, one plan, no add-ons or surprise fees. Every feature earns its place.
4. **ShieldCheck** — *Trust by default* — Your data is yours. Row-level isolation. No sharing, no training on your conversations.
5. **Globe2** — *Global from day one* — Beirut, Dubai, Cairo, Lagos, São Paulo. If WhatsApp is the primary channel, we're there.
6. **Rocket** — *Ambition over perfection* — We'd rather ship a great v1 today than a perfect v3 next quarter.

---

## Section 4 — Timeline / Journey

Eyebrow **Journey**. H2: *"From"* gradient **"day one"** *"to today"*.

Container: `max-w-3xl mx-auto relative`.
- Absolute vertical connector on the left (`left-4 top-0 bottom-0 w-px`) with gradient `from-primary via-primary/40 to-transparent`.
- 4 milestone rows, `space-y-6`. Each row: `relative pl-14`.
  - Absolute circle node `left-0 top-5 h-8 w-8 rounded-full bg-white border-2 border-primary shadow-elegant` with a small 8 × 8 primary dot centered.
  - Card `rounded-2xl border border-border bg-white p-6 card-elevated`.
    - Eyebrow (primary) year
    - H4 Urbanist bold `text-xl`
    - Body muted-foreground `text-sm`

**Milestones:**

- **2023 — The idea** — *Founders running e-commerce shops on WhatsApp couldn't hire fast enough. AI had just gotten good enough to help.*
- **2024 — First 100 businesses** — *Restaurants, boutiques, and clinics across Lebanon and the UAE. Built the deterministic order engine after seeing chaos in free-form AI ordering.*
- **2025 — Enterprise-ready** — *Multi-tenant architecture, native Meta Cloud API, Shopify OAuth, and campaign infrastructure that scales past 250-message limits.*
- **2026 — Now** — *Thousands of businesses across MENA and beyond. Native support for 20+ languages, industry-specific verticals, mobile app in the works.*

---

## Section 5 — Customer logos strip

Center-aligned eyebrow *"Trusted by teams across MENA and beyond"*, then the same `LogoCloud` marquee as the home page (7 brand assets).

---

## Section 6 — Final light-card CTA

Centered white card `rounded-3xl border border-border bg-white p-10 sm:p-14 card-elevated`:
- H2 **Come build with us**
- Body: *We're hiring engineers, designers, and customer partners. Or just try the product — that helps too.*
- 2 CTAs: primary dark pill **Try Jawabify** + ArrowRight → `/auth`; secondary outline **Get in touch** → `/contact`.

---

## Acceptance checklist

- [ ] Hero is a split with a square gradient card on the right containing the dark logo tile.
- [ ] Mission (light) and Team (dark) cards sit side-by-side on lg.
- [ ] Dark team card has a purple radial glow behind it.
- [ ] Values grid is 6 items, 3 columns on lg.
- [ ] Timeline uses circular nodes (not squares) with a small dot inside.
- [ ] Same brand marquee as the home page.
