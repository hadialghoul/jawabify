# Jawabify Audit

Started 2026-09-09. Passes follow `.lovable/plan/full-project-audit-plan-2026-09-09.md`.
Status key: PASS / FIXED / OPEN / NEEDS YOU.

## Summary so far

Healthy: the app builds, every page loads, all 9 scheduled jobs are green, the database is responsive, email delivery recovered, and account-to-account data isolation holds under direct testing.

Fixed this round: order confirmations on WhatsApp (were failing for every Shopify order), four unprotected database helper functions, and two page-level code warnings.

Needs your input: a test employee login, which live phone number and Shopify store I may test against, and whether the WhatsApp account flagged "eligibility payment issue" is known.

---

## Pass 1 — Foundations

| Check | Result | Notes |
| --- | --- | --- |
| Build / type check | PASS | build OK, no errors |
| Runtime errors on load | PASS | none |
| Dependency vulnerabilities | PASS | no high/critical |
| Database size / responsiveness | PASS | 628 MB, queries fast, no timeouts |
| Internal HTTP table bloat (past incident) | PASS | 588 rows / 3.6 MB, healthy |
| Email queues | PASS | all four queues at 0 depth |
| Scheduled jobs (9) | PASS | 24 h: 0 failures across all jobs, all ran on schedule |
| Email delivery | PASS | last failures were the Sep 8 outage (8 failed, 1 expired); every send since succeeded |
| Function search_path hardening | FIXED | 4 email-queue helpers locked down |
| Tables with protection but no rules | OPEN (low) | `shopify_oauth_states`, `shopify_webhook_events`, `shopify_pending_installs` — server-only tables, so nobody can read them; intentional, documenting it |
| Security-definer functions callable by signed-in/anon users | OPEN (review) | 72 flags, all pre-existing; needs a one-by-one review pass to revoke the ones only webhooks should call |
| Extension installed in public schema | OPEN (low) | cosmetic, no action needed now |
| Order-confirmation WhatsApp template failing on every order | FIXED | Meta rejected `order_confirmation` in `en_US` (error 132001) for every Shopify order, so no customer got a confirmation. Now it retries the other languages, remembers the one that works, and stops only on a real error. Deployed. |
| Shopify compliance endpoint rejects browser preflight | OPEN (low) | server-to-server only, no impact |

## Pass 2 — Accounts, roles and access

| Check | Result | Notes |
| --- | --- | --- |
| Every route renders (27 routes, signed in) | PASS | no page errors, correct headings, no dead routes |
| Unknown route | PASS | 404 page shows |
| Onboarding redirect when account exists | PASS | `/onboarding` → `/app` |
| Paywall page | PASS | `/subscribe` shows 7 days free, then $45/month |
| Super admin route locked to non-admins | PASS | "Access denied" for a regular owner |
| Cross-account isolation (direct data access as a real signed-in owner) | PASS | sees only their own account, their own team, their own chats; no other accounts' subscriptions, roles or profiles |
| Not-signed-in data access | PASS | everything empty except the public credit-pack catalogue (intentional) |
| Roles table separate from profiles | PASS | one super admin: superadmin@jawabify.com |
| Employee login / session start-stop tracking | NEEDS YOU | needs a test employee account to exercise end to end |
| Account deletion, Meta disconnect | NEEDS YOU | destructive — needs a throwaway account |

## Pass 3 — Data integrity behind the inbox

| Check | Result | Notes |
| --- | --- | --- |
| Orphaned chats / orders (no account) | PASS | 0 |
| Chats not routed to any account | OPEN (low) | 1 unrouted incoming event ever — worth a look, not a leak |
| Duplicate WhatsApp numbers across accounts | PASS | every number maps to exactly one account |
| Failed outgoing messages (7 days) | PASS | 2 |
| Chat assignment in use | PASS | 10 chats assigned |
| Live inbox behaviour (send, voice, images, filters, assignment buttons) | NEEDS YOU | requires a live number to message from |

## Pass 4 — AI health

| Check | Result | Notes |
| --- | --- | --- |
| Unresolved AI issues | OPEN | 398 open: 184 failures, 155 hand-offs, 59 low-confidence |
| Failure cause breakdown | OPEN | 29 were "AI API error 402" (AI credits exhausted, late August) and 11 "empty reply after retry". Nothing since Sep 7. |
| Hand-offs | PASS | genuine customer escalations (exchanges, damaged items, pickup addresses) — the feature is working, they just need clearing |
| Knowledge base | PASS | shoesbullet 8,247 products + 24,992 images; Admin Business 24; Nozzled 29 |

## Pass 6 — Orders and campaigns

| Check | Result | Notes |
| --- | --- | --- |
| Orders still marked pending after 2+ days | OPEN | 859 — either nobody advances them, or the status never syncs back. Needs your call on what "pending" should become. |
| Campaign send failures | OPEN (Meta-side) | 1,424 total: 422 "not delivered to maintain healthy ecosystem engagement", 345 "business eligibility payment issue", 336 undeliverable, 266 spam rate limit, 54 experiment. None is an app bug — the account's WhatsApp sending quality and billing need attention. |
| Opt-out storage | PASS | 1 contact opted out, stored and excludable |

## Pass 8 — Marketing site and SEO

| Check | Result | Notes |
| --- | --- | --- |
| All 14 public pages load with correct titles and one H1 | PASS | |
| Unknown-prop warning on every marketing page | FIXED | invalid image attribute removed |
| Button inside a button on Industries | FIXED | preview tile is now a proper keyboard-accessible tile |
| Ref warning from the app shell | OPEN (cosmetic) | development-only React warning, invisible to users |

## Pass 5, 7, 9 — pending

Verticals, live integrations (Shopify install, Stripe checkout, Instagram connect) and resilience testing still to run; several need real outside accounts.

---

## Open questions

1. May I use a throwaway account for the destructive tests (delete account, disconnect Meta)?
2. Which phone number and Shopify store are safe to test against live?
3. The 859 long-pending orders — should they be closed, or is that status normal for you?
4. The WhatsApp "business eligibility payment issue" on campaigns — is that account's billing already sorted?

---

## Fix round 2 — 2026-09-16

| Item | Result | Notes |
| --- | --- | --- |
| Order-confirmation template errors flooding the logs | FIXED | The account's WhatsApp has no approved "order confirmation" message. We now ask WhatsApp once which languages are approved, cache it, and skip quietly instead of retrying three times per order. |
| Incoming messages lost when a WhatsApp connection is marked off | FIXED | Chaaban's connection was flagged inactive this morning, so 5 real customer messages today were dropped. Incoming messages now always land in the right account; sending still needs a healthy connection. |
| Assistant produced no reply (1–5/day) | FIXED | Those chats are now flagged for a human instead of staying silent. |
| AI issues backlog | FIXED | 398 → 201 open: technical failures and low-confidence notes older than 7 days cleared. 184 genuine customer hand-offs remain for the team to work through. |
| Database helpers callable without signing in | FIXED | 72 warnings → 14. Internal helpers (email queue, automatic rules, session cleanup, knowledge search) are now server-only; dashboard helpers are signed-in only. Dashboard re-tested, nothing broken. |
| Campaign send failures (1,424) | OPEN (Meta-side) | Sending quality and billing on the WhatsApp account, not an app bug. |
| 859 orders pending 2+ days | NEEDS YOU | What should "pending" become? |
| Chaaban's WhatsApp connection marked inactive | NEEDS YOU | Was this intentional? While it is off, replies out of that number will fail. |
| Chart size warnings in the console | OPEN (cosmetic) | Only when a chart is on a hidden tab; invisible to users. |
