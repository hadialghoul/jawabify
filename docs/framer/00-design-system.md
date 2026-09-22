# 00 — Shared design system

Paste this into Framer AI first. It defines the tokens, fonts, and the two shared shell components (Navbar + Footer) that every marketing page reuses.

---

## 0.1 Framer AI system prompt

> Build a design system for a premium SaaS marketing site called **Jawabify**. It's an AI WhatsApp platform for businesses. The style is *Midnight Indigo*: near-white background with a light indigo tint, deep indigo primary, and a very dark near-black surface for CTAs and footers. Type-forward, generous spacing, soft elegant shadows, pill-shaped buttons, `rounded-3xl` cards. Never use pure black or pure white — use the tokens below.

---

## 0.2 Color tokens (HSL + hex)

Register every value below as a color style in Framer.

| Token | HSL | Hex | Where used |
|-------|-----|-----|------------|
| `background` | `240 33% 98%` | `#F7F7FB` | page bg |
| `foreground` | `240 40% 8%` | `#0E0E1B` | body text, dark buttons |
| `primary` | `243 75% 59%` | `#4F46E5` | brand indigo |
| `primary-glow` | `258 80% 65%` | `#8B5CF6` | gradient end |
| `secondary` | `240 20% 96%` | `#F1F1F7` | soft chips, section bg |
| `muted-foreground` | `240 10% 42%` | `#6B6B7B` | body/muted text |
| `border` | `240 15% 91%` | `#E5E5EE` | card + input borders |
| `accent` | `243 100% 97%` | `#EFEEFF` | pill / hover surface |
| `ink-950` | `240 45% 4%` | `#07061A` | footer & dark CTAs (start) |
| `ink-900` | `240 45% 6%` | `#0A0A22` | footer & dark CTAs (mid) |
| `ink-800` | `258 60% 15%` | `#1E1240` | dark CTA gradient end |
| `emerald-500` | `158 64% 52%` | `#22C55E` | success check icons |

**Gradients**
- `--gradient-primary` = `linear-gradient(135deg, #4F46E5, #8B5CF6)` → used behind icon tiles and as `.gradient-text` (background-clip: text)
- `--hero-glow` = `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,70,229,.18), transparent 70%)` — absolute overlay on hero
- Dark CTA panels use `linear-gradient(135deg, #0A0A22, #1E1240)`

**Shadows**
- `shadow-elegant` = `0 20px 60px -25px rgba(79,70,229,.35)`
- `shadow-card` = `0 1px 2px rgba(41,41,64,.04), 0 8px 24px -12px rgba(41,41,64,.08)`
- Card hover: `translateY(-2px)` + swap to `shadow-elegant`, 300ms ease

---

## 0.3 Typography

Load two Google Fonts:
- **Urbanist** — weights 600, 700, 800, 900 → assign to `font-display` (all H1/H2/H3, stat numbers, prices)
- **Epilogue** — weights 400, 500, 600 → body default

Scale:

| Style | Class equivalent | Values |
|-------|-----------------|--------|
| H1 hero | `text-[34px] sm:text-[52px] lg:text-[64px]` | Urbanist 800, `leading-[1.05]`, `tracking-tight` |
| H1 page | `text-5xl sm:text-6xl` | Urbanist 700, `tracking-tight` |
| H2 section | `text-4xl sm:text-5xl` | Urbanist 700 |
| H3 card | `text-2xl` / `text-xl` / `text-lg` | Urbanist 700 |
| Body large | `text-lg` | Epilogue 400, `leading-relaxed`, muted-foreground |
| Body | `text-sm` / `text-base` | Epilogue 400 |
| Eyebrow | `text-xs uppercase tracking-widest` | Epilogue 600, color = primary |
| Small caps label | `text-[10px]–[11px] uppercase tracking-widest` | 600 |

**Gradient text** — wrap the emphasis span with `.gradient-text`:
```css
background: var(--gradient-primary);
-webkit-background-clip: text;
background-clip: text;
color: transparent;
```
The gradient span is almost always the *last 2–4 words* of a headline.

---

## 0.4 Layout & spacing

- Page container: `max-w-7xl` (1280 px), horizontal padding **20 px** mobile / **32 px** ≥ sm.
- Section vertical padding: `py-14 sm:py-28` (56 / 112 px).
- Grid gaps: 20–32 px (`gap-5`, `gap-6`, `gap-8`).
- Radius: cards `2rem` (`rounded-3xl`), inputs `.9rem` (`rounded-xl`), buttons full-pill.
- Breakpoints (Tailwind): sm 640, md 768, lg 1024, xl 1280.

---

## 0.5 Animation constants

- **Fade-up on scroll into view**: opacity 0→1, y +12→0, 500ms cubic-bezier(.16,1,.3,1). Apply to every section headline and first card in a grid.
- **`animate-fade-up`** (hero): same, 700 ms, staggered by 150 ms for the right column.
- **`animate-float`**: y ±6 px, 6s ease-in-out infinite alternate. Used for floating WhatsApp chat and notification stack.
- **`animate-pulse-soft`**: opacity 1↔.5, 1.5 s ease-in-out infinite. Used on live status dots.
- **Marquee** (logo cloud): translateX 0 → -50%, 30s linear infinite; duplicate the child row and hide overflow.
- **Card hover lift**: `-translate-y-0.5` + `shadow-elegant`, 300 ms.

---

## 0.6 Reusable components

Build these once in Framer, then reuse.

### `Eyebrow` pill
Small `text-xs uppercase tracking-widest` label, in a `border border-border bg-white rounded-full px-3 py-1` pill, with a 6 px indigo dot on the left. Text color = primary.

### `Button` variants
- **Primary dark pill**: `bg-foreground text-background rounded-full px-6 py-3 text-sm font-semibold`, hover `bg-foreground/90`, right-side icon `ArrowRight` (14 px, hover translate-x +2 px). Cast a `shadow-elegant`.
- **Secondary white outline pill**: `border border-border bg-white rounded-full px-6 py-3 text-sm font-semibold`, hover `bg-secondary`.
- **On-dark primary**: `bg-white text-ink-900 rounded-full px-6 py-3 font-semibold`.
- **Ghost on dark**: `border border-white/20 text-white rounded-full px-6 py-3 hover:bg-white/10`.

### `BentoCard` (3 tones)
- **light** (default): `rounded-3xl border border-border bg-white p-6 sm:p-8 shadow-card`, hover `-translate-y-0.5 shadow-elegant`.
- **dark**: `bg-ink-900 border-white/10 text-white`.
- **primary**: `bg-gradient-primary text-white border-transparent`.

Icon tile inside a card: `h-10 w-10 rounded-xl bg-primary/10 grid place-items-center` with a 20 px `lucide-react` icon in primary.

### `BrowserFrame`
Screenshot wrapper simulating a browser window:
- Outer: `rounded-2xl border border-border bg-white shadow-elegant overflow-hidden`
- Top bar: 40 px tall, `bg-secondary/60`, 3 traffic-light dots (10 px, `#ff5f57`, `#febc2e`, `#28c840`) on the left, a pill in the middle showing `url` prop text in mono font at 11 px muted.
- Content area = children.

### `WhatsAppChat` mockup
Portrait chat card:
- Rounded 24 px, drop shadow.
- WhatsApp header row: dark green (`#075E54`) bar 44 px tall with avatar circle, name "Jawabify · Ackrab", green "online" dot.
- Body: light chat pattern (`#ECE5DD` tint), 5 message bubbles alternating:
  - customer (white, left, rounded-2xl): "hi, is the blue backpack in stock?"
  - AI (green `#DCF8C6`, right): "Yes! Blue medium is in stock — $49. Want me to reserve one?"
  - customer: "yes 2 pcs, deliver to Beirut"
  - AI: "Confirmed 2× Blue backpack + $3 delivery = **$101**. Address?" (bold)
  - customer voice note bubble with 12 s duration
- Footer: composer bar with attach + mic icons.
- Prop `compact` shrinks to 320 px wide, 380 px tall.

### `Navbar` (shared)
Fixed header, 64 px tall, `z-50`.

- Background: transparent by default; when `scrollY > 8` add `bg-white/80 backdrop-blur-xl border-b border-border/60`.
- Left: logo — 36 × 36 rounded-md image on a 4 px `#07061A` padding tile (use asset URL `https://jawabify.com/favicon.png`), links to `/`.
- Center (≥ lg): 8 nav links in a row, each `px-3 py-1.5 text-sm rounded-full`. Inactive = muted-foreground; active = `bg-secondary text-foreground`.
  - Home `/`, Features `/features`, How it works `/how-it-works`, Industries `/industries`, Pricing `/pricing`, About `/about`, FAQ `/faq`, Contact `/contact`.
- Right (≥ lg): "Log in" (secondary white outline pill) → `/auth`, then "Start free trial" (primary dark pill with `ArrowUpRight` icon) → `/auth`.
- Below lg: hamburger button → slide-down panel with same links stacked, `border-t border-border bg-white/95 backdrop-blur-xl`, plus the two CTAs at the bottom.

### `Footer` (shared)
Dark section at the very bottom of every page.

- `bg-ink-950` (`hsl(240 45% 5%)`) with a radial indigo glow overlay: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,70,229,.25), transparent 70%)`, opacity 0.4.
- Inner container `max-w-7xl` padded `py-16`, grid `gap-10 md:grid-cols-4`.
- **Col 1 (span 2)**: white-tile logo (invert=true → no dark padding), then description:
  > "The AI WhatsApp platform for modern businesses. Automate replies, take orders, and run campaigns — all in one inbox."
  Then address block with `MapPin` icon:
  > **Business Center, Sharjah Publishing City Free Zone**
  > Sharjah, United Arab Emirates
  Then primary CTA "Start free trial" (white pill on dark).
- **Col 2 "Product"**: Features, How it works, Industries, Pricing.
- **Col 3 "Company"**: About, FAQ, Contact, WhatsApp API guide, Privacy.
- All link colors: `white/80` idle, `white` hover.
- Bottom bar: divider `border-white/10`, then row `© {year} Jawabify. All rights reserved.` on the left, `Built for WhatsApp Business Cloud API` on the right. Text `text-xs text-white/70`.

---

## 0.7 Assets (import these URLs into Framer)

| Asset | URL |
|-------|-----|
| Logo (square) | `https://jawabify.com/favicon.png` |
| Favicon `.ico` | `https://jawabify.com/favicon.ico` |
| OG image | `https://jawabify.com/og-image.png` |
| Brand — Ackrab | `https://jawabify.com/brands/ackrab.jpg` |
| Brand — Bubbly Bites | `https://jawabify.com/brands/bubblybites.jpg` |
| Brand — Herbal Haven | `https://jawabify.com/brands/herbalhaven.jpg` |
| Brand — Ibtisamati | `https://jawabify.com/brands/ibtisamati.jpg` |
| Brand — Men Sparks | `https://jawabify.com/brands/mensparks.jpg` |
| Brand — Seaqers | `https://jawabify.com/brands/seaqers.jpg` |
| Brand — Tropical | `https://jawabify.com/brands/tropical.jpg` |

> If any brand image 404s on your Framer domain, upload the local copy from `src/assets/brands/*.jpg` in the source repo.

---

## 0.8 SEO / head pattern per page

Every page must set:
```html
<title>{{title}}</title>
<meta name="description" content="{{description}}" />
<link rel="canonical" href="https://jawabify.com{{path}}" />
<meta property="og:title" content="{{title}}" />
<meta property="og:description" content="{{description}}" />
<meta property="og:url" content="https://jawabify.com{{path}}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```
Exact title/description strings are provided in each page file.

---

## 0.9 Icons

All icons are from **lucide-react**. Framer has a built-in Lucide integration — use it 1:1. Icon sizes: 12/14/16/20/24 px depending on context (details in each page prompt).
