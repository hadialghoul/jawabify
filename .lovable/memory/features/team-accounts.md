---
name: Team accounts & employee logins
description: Owner/admin/employee roles per tenant, employee logins, session + activity tracking
type: feature
---
Each tenant has members in `tenant_members` with role `owner | admin | employee`.

- Owners/admins create employee logins (email + password) via the `manage-team-member` edge function (actions: create, set_password, set_role, set_active, remove). Employees are real auth users attached to the owner's tenant.
- Employees have full app access EXCEPT: Team management, billing/subscription, account deletion, disconnecting WhatsApp/Instagram/Shopify. Gate UI with `isTenantAdmin` from `useAuth`.
- Sessions: `tenant_member_sessions` (started_at, last_seen_at heartbeat every 60s, ended_at, end_reason). Started/closed by `useMemberSession` + `src/lib/memberSession.ts`; sign-out closes the session. Super admins acting as a client do not log sessions.
- Attribution: `messages.sent_by_member_id`, `orders.created_by_member_id`; activity aggregated by RPC `get_member_activity(p_tenant_id, p_from, p_to)`.
- UI: `TeamManager.tsx` (members CRUD) and `TeamActivity.tsx` (sessions + counts) in Settings, admin-only.
- Deactivated members are signed out automatically on load.
