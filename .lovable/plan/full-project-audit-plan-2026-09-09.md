# Full Project Audit Plan

Goal: verify every feature, screen, button and background job in Jawabify actually works — not just that it builds. The audit runs in ordered passes so failures are found in dependency order (backend health first, then data rules, then each screen, then the outside integrations).

Nothing is changed during a pass. Each finding is written into `AUDIT.md` at the project root with: area, what was tested, result (pass / broken / unclear), severity, and the fix needed. Fixes happen after each pass is reported, so you approve what gets touched.

---

## Pass 1 — Foundations (health check)
- Build and type check clean, no console or runtime errors on load.
- Backend health: database responsive, no query timeouts, queue depths at zero, no table bloat.
- Scheduled jobs: confirm each one has run recently and succeeded (reminders, follow-ups, order retry, auto-sync, email queue, campaign worker).
- Background function logs reviewed for repeating errors (known open one: WhatsApp `order_confirmation` template missing in `en_US`).
- Security review: every table has row-level protection and correct grants; run the linter and dependency scan.

## Pass 2 — Accounts, roles and access
- Sign up, sign in, sign out, password reset with email verification, Google sign-in.
- Trial start, active/inactive subscription gating, employee blocked from paying, owner sent to checkout.
- Roles: owner, admin, employee, super admin — each sees exactly what it should and nothing more.
- Employee login, session start/stop tracking, deactivated employee loses access immediately.
- Super admin: view all accounts, manage-account mode, banner, exit back, free trial days.
- Cross-account isolation test: confirm one account can never read another's contacts, orders, messages.
- Account deletion and Meta disconnect.

## Pass 3 — Inbox and messaging (the core)
- Incoming WhatsApp and Instagram messages appear live; correct account routing.
- Sending text, emoji, images, voice notes; failed-send retry; delivery/read ticks.
- Unread badges, sorting, search by name and number, channel filter and quick switch.
- Chat assignment: auto-claim on first human reply, claim/release by employee, reassign/hand-off/unassign by admin, assignee chips, All/Mine/Unassigned filters.
- Contact profile: notes, tags, email, address, interested/needs-human flags, opt-out state.
- Per-chat AI toggle actually stops the bot.

## Pass 4 — AI behaviour
- Replies stay one sentence / 15 words, no invented facts.
- Language mirroring, including Arabic and Arabizi.
- Knowledge base answers, image sending only when asked, voice transcription.
- Order recognition and the programmatic order flow: every step, cancel mid-way, duplicate protection, delivery fee, order ID numbering.
- Order lookup by phone and by ID; order status and detail updates.
- Escalation to a human, AI issue reporting.

## Pass 5 — Verticals
For each of restaurant, real estate, healthcare, wellness, education, and the general store view:
- Dashboard numbers match the database.
- Every create/edit/delete dialog saves and reloads correctly.
- Settings page for that vertical saves and takes effect.
- Vertical guards: a restaurant account cannot touch real-estate data.
- Coming-soon states behave for verticals not enabled.

## Pass 6 — Orders, campaigns, CRM
- Orders list, filters, statuses, totals, tracking fields.
- Campaigns: audience building, STOP opt-out message, exclude-opted-out checkbox, send worker progress, per-recipient results.
- CRM: contact import, tags, exports.
- Credits/wallet and transaction records where used.

## Pass 7 — Integrations
- Shopify: install/OAuth, connector screen inside Shopify Admin, no off-platform billing paths exposed, product import at scale (progress, stop/resume, completion), order sync and webhooks, compliance endpoints.
- WhatsApp: number status, quality, template list and the failing template, embedded signup.
- Instagram: connect, webhook, compliance.
- Stripe: checkout, return page, portal, webhook, test-mode banner.
- Email: transactional sends, unsubscribe, suppression, sender domain.

## Pass 8 — Marketing site, SEO, mobile
- Every public page loads, all links and buttons work, no dead routes, 404 behaves.
- Titles, descriptions, social tags, sitemap, robots, structured data, single H1 per page, image alt text.
- Analytics and Meta Pixel fire once, not twice.
- Mobile: safe areas, sticky headers, no input zoom, bottom nav, back button stays in the app.
- Dark mode and theme toggle across every screen.
- Consultation popup and booking form actually deliver the lead.

## Pass 9 — Resilience
- Slow network and offline behaviour, loading states, empty states, error states.
- Long lists and large accounts stay fast.
- Refresh mid-flow, expired session, two tabs open.

---

## How I run it

- Automated where possible: database queries, log reads, security scans, and a scripted browser walking real screens with screenshots as evidence.
- Manual only where a real outside account is required (live WhatsApp message from a phone, a real Shopify install, a real card).
- Order: Pass 1 first because everything else sits on it, then 2 (access) since it gates every screen, then the rest.

## What I need from you

- Permission to sign in as a test account for the authenticated screens.
- Which live phone number and Shopify store I may safely test against.
- Whether I should fix issues as I find them, or collect everything first and fix in one approved batch.

## Output

`AUDIT.md` — one section per pass, every check listed with pass/fail, severity, and recommended fix. Plus a short top summary: what is healthy, what is broken, what to fix first.
