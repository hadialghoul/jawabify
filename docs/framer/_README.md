# Jawabify → Framer migration prompts

This folder contains one prompt per public marketing page, plus a shared design system file. Every prompt is written so you can paste it directly into Framer AI's builder to recreate the page as closely as possible to what runs today on **https://jawabify.com**.

## How to use

1. **Start with `00-design-system.md`** — paste it into Framer AI as the *first* build task in a fresh project. It sets up tokens, fonts, and the shared Navbar + Footer that every page reuses.
2. Then process pages in order (`01-home.md` → `08-contact.md`). Each page file is self-contained and refers back to the design system for tokens.
3. Framer AI works best one section at a time. Every page file is already split into **section prompt blocks** — copy them into Framer one block per generation for the closest match.
4. Verify against the **Acceptance checklist** at the bottom of each page file.

## Pages covered

| # | File | Live route |
|---|------|-----------|
| 00 | `00-design-system.md` | tokens + shared shell |
| 01 | `01-home.md` | `/` |
| 02 | `02-features.md` | `/features` |
| 03 | `03-how-it-works.md` | `/how-it-works` |
| 04 | `04-industries.md` | `/industries` |
| 05 | `05-pricing.md` | `/pricing` |
| 06 | `06-about.md` | `/about` |
| 07 | `07-faq.md` | `/faq` |
| 08 | `08-contact.md` | `/contact` |

## Notes

- **Asset URLs** point at the live jawabify.com CDN. Import each URL into Framer's asset library once, then reference the local copy in every page.
- **Backend**: only `/contact` has a live backend call (Supabase `consultation_leads`). The exact snippet is included in `08-contact.md`.
- **Social preview (`og:image`)**: today Lovable hosting injects the OG image at serve time. On Framer you must upload one yourself (1200×630 PNG).
- **Fonts**: Urbanist (display) + Epilogue (body), both from Google Fonts.
