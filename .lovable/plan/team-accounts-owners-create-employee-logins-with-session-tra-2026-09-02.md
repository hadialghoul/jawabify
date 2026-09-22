# Team accounts: owners create employee logins with session tracking

Each account owner becomes the "admin" of their account and can create employee logins. Employees sign in with their own email and password and land inside the owner's account — same data, same dashboards. The owner sees a team page listing every employee with their sign-in / sign-out history and how much work they did in each session.

## What the owner gets

A new **Team** section in Settings (visible only to the account admin):

1. **Members list** — name, email, role (Admin / Employee), status, last seen.
2. **Add employee** — owner enters name, email and an initial password; the employee can sign in immediately. Owner can also reset an employee's password or deactivate/remove them.
3. **Activity log** — per employee: each session's sign-in time, sign-out time (or "still active"), duration, plus messages sent and orders handled during that session. Filterable by employee and date range.

## What employees can do

Employees get the full app for that account — inbox, orders, dashboards, campaigns, settings — except:

- the Team page (cannot create or edit other members)
- billing / subscription pages (Account → subscription, upgrade, cancel)
- deleting the account or disconnecting WhatsApp/Instagram/Shopify

Those show an "Ask your account admin" message instead.

## How sessions are tracked

- A session row is written when the employee's app session starts, with a heartbeat so the "last seen" stays fresh.
- Sign-out closes the session; if the browser is closed without signing out, the session is auto-closed after the heartbeat goes stale (treated as sign-out at the last heartbeat).
- Messages sent and orders created are attributed to the acting member so per-session counts are accurate.

## Technical notes

Database (one migration):

- `tenant_members`: keep the existing `role` text but standardise values to `owner` | `admin` | `employee`; add `display_name`, `email`, `is_active`, `invited_by`, `last_seen_at`. Existing rows become `owner`.
- New `tenant_member_sessions` (tenant_id, member_id, user_id, started_at, last_seen_at, ended_at, end_reason, user_agent) with grants + RLS: a member can insert/update their own session rows; admins of the tenant can read all sessions for their tenant; super admins full access.
- Helper security-definer functions: `is_tenant_admin(tenant_id)` and `tenant_member_role(tenant_id)`, used by RLS on the team tables to avoid recursion.
- Add `sent_by_member_id` to `messages` and `created_by_member_id` to `orders` (nullable) so activity counts can be attributed; an RPC `get_member_activity(tenant_id, from, to)` aggregates sessions with those counts in one call.
- Employee creation happens in a new edge function `manage-team-member` (service role) with actions `create`, `set_password`, `set_active`, `remove`. It verifies the caller's JWT, requires the caller to be owner/admin of the tenant it targets (super admins may pass an explicit tenant, matching the existing `_shared/tenant.ts` pattern), creates the auth user with email confirmed, and inserts the `tenant_members` row. It never returns or logs service-role keys.

Frontend:

- `useAuth` gains `memberRole`, `isTenantAdmin`, `memberId`; loaded in the same query that already resolves `tenant_members`. Acting-as (super admin) continues to grant admin-level access.
- New `src/hooks/useTeam.ts` (members CRUD via the edge function) and `src/hooks/useMemberSession.ts` (start session, heartbeat on an interval, close on sign out and on `pagehide`).
- New `src/components/settings/TeamManager.tsx` (members + add/edit dialogs) and `src/components/settings/TeamActivity.tsx` (session log table), mounted as a Team tab in `Settings.tsx`, gated on `isTenantAdmin`.
- Billing/subscription and destructive integration controls in `Account.tsx`, `Subscribe.tsx` and `Settings.tsx` are wrapped in an admin-only guard; `ProtectedRoute` redirects employees away from `/subscribe`.
- Message and order write paths (`useMessages.ts`, order dialogs, `send-whatsapp`/`send-instagram` callers) pass the current `memberId` so activity is attributed.

Note: employees are real auth users, so email password reset works for them normally.
