import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization, x-acting-tenant",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Stop billing before any data is removed so a deleted account is never charged again.
async function cancelSubscriptionsFor(admin: any, userIds: string[]) {
  if (!userIds.length) return [];
  const canceled: string[] = [];

  const { data: rows } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, environment")
    .in("user_id", userIds);

  for (const env of ["live", "sandbox"] as StripeEnv[]) {
    let stripe: ReturnType<typeof createStripeClient>;
    try {
      stripe = createStripeClient(env);
    } catch {
      continue;
    }
    const ids = (rows ?? [])
      .filter((r: any) => r.environment === env && r.stripe_subscription_id)
      .map((r: any) => r.stripe_subscription_id as string);

    for (const id of new Set(ids)) {
      try {
        const sub = await stripe.subscriptions.retrieve(id);
        if (["canceled", "incomplete_expired"].includes(sub.status)) continue;
        await stripe.subscriptions.cancel(id, { prorate: false });
        canceled.push(id);
      } catch (e) {
        console.error(`delete-tenant: cancel ${id} (${env}) failed`, (e as Error).message);
      }
    }
  }
  return canceled;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id ?? "");
    if (!tenantId) return json({ error: "Missing tenant_id" }, 400);

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, owner_user_id")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) return json({ error: "Account not found" }, 404);

    // Members of this account, so their logins go away with the data.
    const { data: members } = await admin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenantId);

    const userIds = Array.from(
      new Set([
        ...(members ?? []).map((m: any) => m.user_id).filter(Boolean),
        tenant.owner_user_id,
      ].filter(Boolean) as string[]),
    );

    // Never delete the caller's own account, and never wipe another super admin.
    const { data: superRoles } = userIds.length
      ? await admin.from("user_roles").select("user_id").eq("role", "super_admin").in("user_id", userIds)
      : { data: [] as any[] };
    const protectedIds = new Set<string>([caller.id, ...(superRoles ?? []).map((r: any) => r.user_id)]);
    if (protectedIds.has(caller.id) && userIds.includes(caller.id)) {
      return json({ error: "You cannot delete your own account from here." }, 400);
    }

    const canceledSubscriptions = await cancelSubscriptionsFor(admin, userIds).catch(() => []);

    // Tables that carry tenant_id without a cascading link to tenants.
    await admin.from("campaigns").delete().eq("tenant_id", tenantId);
    await admin.from("push_attempts").delete().eq("tenant_id", tenantId);
    await admin.from("shopify_oauth_states").delete().eq("tenant_id", tenantId);
    await admin.from("shopify_pending_installs").delete().eq("tenant_id", tenantId);

    // Everything else (contacts, messages, orders, menus, settings, credentials,
    // members, wallets, vertical data…) cascades off this row.
    const { error: delErr } = await admin.from("tenants").delete().eq("id", tenantId);
    if (delErr) return json({ error: delErr.message }, 400);

    const deletedUsers: string[] = [];
    for (const uid of userIds) {
      if (protectedIds.has(uid)) continue;
      await admin.from("subscriptions").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("user_id", uid);
      await admin.from("user_roles").delete().eq("user_id", uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) console.error(`delete-tenant: auth user ${uid}`, error.message);
      else deletedUsers.push(uid);
    }

    return json({
      ok: true,
      tenant: tenant.name,
      deletedUsers: deletedUsers.length,
      canceledSubscriptions,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
