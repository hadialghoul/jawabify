# Super Admin: View and manage any account (full control)

Let a super admin open any client account and use it exactly as that client does — chats, orders, dashboards, settings — without logging in as them. Full control: they can send messages, edit settings, and fix data on the client's behalf.

## How it works for the user

1. In Super Admin, the Tenants and Users tables get a "Manage account" button on each row.
2. Clicking it opens the normal app (`/app`) rendered with that account's data.
3. A persistent bar at the top shows "Acting as <Account name>" with an "Exit" button that returns to Super Admin, so it's always obvious you are inside a client account.
4. Everything works normally: sending WhatsApp messages, AI toggles, knowledge base, menus, orders, campaigns, vertical settings.

## Backend access rules

Most tenant tables today only allow rows where the tenant matches the signed-in user's own tenant, so a super admin currently sees and can change nothing for other accounts. One migration fixes this:

- Add a security-definer helper that returns true when the row's tenant is the user's own tenant **or** the user has the `super_admin` role.
- Add full-access (view, create, edit, delete) policies for super admins on the tenant-scoped tables that lack them: ai_knowledge, app_settings, knowledge_images, campaigns, campaign_recipients, bills, bill_items, menu_categories, menu_items, restaurant_tables, reservations, education_courses/enrollments/leads/settings, healthcare_appointments/doctors/lab_results/leads/settings/specialties, push_tokens, email_send_log.
- Extend the existing super-admin view-only policies on contacts, messages, orders and order_sessions to also allow create/edit/delete.
- Regular tenant users are unaffected — their policies stay scoped to their own tenant.

Note this is a real privilege grant: any super_admin account can read and modify every client's data, so super_admin should stay limited to your own staff accounts.

## Technical notes

- `src/hooks/useAuth.tsx`: add `actingTenantId`, `actingTenantName`, `isActingAs`, `startActingAs(tenantId, name)`, `stopActingAs()`. The exported `tenantId` returns the acting tenant when active, so all existing hooks (`useMessages`, `useOrders`, `useMenu`, vertical hooks, `Settings.tsx`, etc.) pick up the target account with no changes. State persists in `sessionStorage` and clears on sign out.
- `useTenantVertical` resolves from the effective tenant id, so the correct vertical dashboard renders.
- Outgoing WhatsApp sends and other edge-function calls already take the tenant id from the client, so they follow the acting tenant automatically; where a function derives the tenant from the caller's membership, it will accept an explicit `tenant_id` and authorize it when the caller has the `super_admin` role (`send-whatsapp`, `send-campaign`, knowledge import/embed).
- New `src/components/ActingAsBanner.tsx` rendered from `ProtectedRoute` when `isActingAs` is true; it replaces the existing "Back to Super Admin" pill in that state.
- `ProtectedRoute`: while acting as another tenant, skip the subscription gate and the credentials gate so the account opens regardless of its billing state.
- `src/pages/SuperAdmin.tsx`: "Manage account" buttons in the Tenants and Users tables; for a user row the tenant is resolved via `tenant_members`, and rows without a tenant show the button disabled.
