# 08 — Contact `/contact`

*Load tokens and shared components from `00-design-system.md`.*

## Page identity

- Route: `/contact`
- `<title>` — **Contact Jawabify — WhatsApp, Email & Sales**
- `<meta name="description">` — **Talk to the Jawabify team about sales, support or partnerships. WhatsApp +971 52 350 6806, email jawabify@gmail.com, or use the contact form.**
- Canonical: `https://jawabify.com/contact`
- **JSON-LD** (2 objects):
  ```json
  [
    {"@context":"https://schema.org","@type":"ContactPage","url":"https://jawabify.com/contact","name":"Contact Jawabify"},
    {"@context":"https://schema.org","@type":"Organization","name":"Jawabify","url":"https://jawabify.com","email":"jawabify@gmail.com","telephone":"+971523506806","contactPoint":[{"@type":"ContactPoint","telephone":"+971523506806","contactType":"customer support","areaServed":["AE","LB","SA","Worldwide"],"availableLanguage":["en","ar","fr"]}],"address":{"@type":"PostalAddress","streetAddress":"Business Center, Sharjah Publishing City Free Zone","addressLocality":"Sharjah","addressCountry":"AE"}}
  ]
  ```

---

## Section 1 — Hero (centered)

- `pt-24 pb-8`
- Eyebrow **Contact**
- H1: *"Let's talk about"* gradient **"your business"**
- Sub: *"Sales, support, partnerships — we reply on every channel within one business day."*

---

## Section 2 — Split (channels + form)

Grid `gap-8 lg:grid-cols-5`.

### Left column (`lg:col-span-2 space-y-4`)

Three "channel cards" — anchor tags styled as `rounded-2xl border border-border bg-white p-5 card-elevated hover:-translate-y-0.5 hover:shadow-elegant`. Each has a 48 × 48 colored icon tile, a small caps title, an Urbanist bold primary line, a tiny muted subtitle, and an ArrowRight on the right.

1. **Emerald tile · MessageCircle · WhatsApp us**
   - Primary: **+971 52 350 6806**
   - Sub: *Usually replies in minutes*
   - `href="https://wa.me/971523506806"` (target `_blank`)
2. **Indigo primary tile · Mail · Email**
   - Primary: **jawabify@gmail.com**
   - Sub: *1 business day*
   - `href="mailto:jawabify@gmail.com"`
3. **Amber tile · Phone · Call sales**
   - Primary: **+971 52 350 6806**
   - Sub: *Mon–Fri · 9 AM – 6 PM GMT+4*
   - `href="tel:+971523506806"`

**Offices card** (`rounded-2xl border border-border bg-white p-6 card-elevated`):
- Header: 16 px primary `MapPin` + eyebrow "Offices".
- Body — Office chip: `rounded-xl bg-secondary/40 p-3`:
  - Urbanist bold `text-base` — **Sharjah**
  - `text-[11px] muted-foreground` — **United Arab Emirates**
  - `text-[11px] muted-foreground mt-1` — **Business Center, Sharjah Publishing City Free Zone**

**"We reply fast" callout** (`rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-6`):
- 20 px primary `Clock`.
- Urbanist bold `text-lg` — **We reply fast**.
- Body muted-foreground `text-sm`:
  > *Our own team runs on Jawabify. That means your message hits an inbox where the AI triages, tags, and pings the right human — in under a minute.*

### Right column — Form (`lg:col-span-3 rounded-3xl border border-border bg-white p-8 card-elevated space-y-5`)

**Topic selector** — 4-cell grid (`grid-cols-4 gap-2`) above the fields.
Each cell = `rounded-xl border p-3 text-[11px] font-semibold flex flex-col items-center gap-1.5`:
- **Sales** (Zap icon)
- **Support** (MessageCircle)
- **Partner** (Users)
- **Other** (Mail)

Selected state: `border-primary bg-primary/5 text-primary`.
Unselected: `border-border text-muted-foreground hover:bg-secondary/50`.

**Fields** (each = eyebrow label + shadcn `Input`/`Textarea`, `h-11` for inputs):

- Row 1 (2 cols): **Name** *(required)* placeholder `Your full name` · **Email** *(required, type email)* placeholder `you@company.com`
- Row 2 (2 cols): **Company (optional)** placeholder `Your business` · **Phone (optional)** placeholder `+971 ...`
- Row 3 (full): **How can we help?** `Textarea min-h-32`, placeholder `Tell us about your business, message volume, and what you're looking to automate.`

**Submit button**: full-width `h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-semibold text-sm`.
Label idle: **Send message** + `ArrowRight`. Loading: **Sending…**.

**Disclaimer**: `text-[11px] text-muted-foreground text-center` — *"By submitting you agree to be contacted about Jawabify. We never share your info."*

**Backend wiring (Framer code component):**

```tsx
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  "https://qemxlbjwpxyljkansqsl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbXhsYmp3cHh5bGprYW5zcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTgwNzEsImV4cCI6MjA4MTUzNDA3MX0.YZ7bs6m2UvzM8WDx_ui2kPWHmValHIXLI6ProoSWOmA"
)

// on submit:
await supabase.from("consultation_leads").insert({
  name: form.name,
  email: form.email,
  phone: form.phone || null,
  message: `[${form.topic}] ${form.company ? `Company: ${form.company}\n` : ""}${form.message || ""}`,
  source: "contact_page",
})
```

Show a success toast on either success OR error: **"Thanks! We'll be in touch shortly."** (the live site always shows success to avoid leaking backend state).

---

## Section 3 — Live demo callout

Full-width white card `rounded-3xl border bg-white p-8 sm:p-12 card-elevated`, grid `lg:grid-cols-[1.2fr_1fr] items-center gap-10`.

**Left:**
- Chip `bg-primary/10 text-primary rounded-full px-3 py-1 text-[11px] uppercase tracking-widest` — small dot + **Prefer to see it live?**
- H3 Urbanist bold `text-3xl sm:text-4xl`: *"Message our AI on"* gradient **"WhatsApp right now"**
- Body muted-foreground:
  > *Text our live demo number. The same AI that will power your business will reply — in any language, with real product recommendations.*
- CTA: emerald-500 pill `rounded-full bg-emerald-500 text-white px-6 py-3 hover:bg-emerald-600` — `MessageCircle` + **Try the demo** → `https://wa.me/971523506806`.

**Right:** `WhatsAppChat compact` with `animate-float`.

---

## Acceptance checklist

- [ ] Left column has 3 channel cards (emerald / indigo / amber tiles), an Offices card, and a "We reply fast" tinted callout.
- [ ] Right column form spans 3/5 columns on lg and has the topic selector as a 4-up grid on top.
- [ ] Selected topic tile uses `border-primary bg-primary/5 text-primary`.
- [ ] Submit button is full-width, dark, pill-shaped, height 48 px.
- [ ] On submit, the form inserts into `consultation_leads` and toasts "Thanks! We'll be in touch shortly."
- [ ] Live demo section has the WhatsAppChat floating on the right with `animate-float`.
- [ ] Two JSON-LD blocks are injected (ContactPage + Organization).
