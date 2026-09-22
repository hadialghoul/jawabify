import { createClient } from "npm:@supabase/supabase-js@2";

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

type Action = "create" | "set_password" | "set_role" | "set_active" | "remove";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "") as Action;

    // Resolve target tenant: caller's own membership, or an explicit tenant when
    // the caller is a super admin (Super Admin "Manage account").
    const { data: membership } = await admin
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", caller.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isSuperAdmin = !!roleRow;

    const requested = body.tenant_id ? String(body.tenant_id) : null;
    let tenantId = membership?.tenant_id ?? null;
    if (requested && requested !== membership?.tenant_id) {
      if (!isSuperAdmin) return json({ error: "Forbidden" }, 403);
      tenantId = requested;
    }
    if (!tenantId) return json({ error: "No account found" }, 400);

    const callerIsAdmin =
      isSuperAdmin ||
      (membership?.tenant_id === tenantId && ["owner", "admin"].includes(String(membership?.role)));
    if (!callerIsAdmin) return json({ error: "Forbidden" }, 403);

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const displayName = String(body.display_name ?? "").trim();
      const role = ["admin", "employee"].includes(String(body.role)) ? String(body.role) : "employee";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!displayName) return json({ error: "Enter the employee's name" }, 400);

      let userId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      if (createErr) {
        const msg = String(createErr.message ?? "");
        if (!/already|registered|exists/i.test(msg)) return json({ error: msg }, 400);
        // Existing auth user — reuse it only if it isn't already in another account.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: "That email is already taken" }, 400);
        const { data: otherMember } = await admin
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", existing.id)
          .maybeSingle();
        if (otherMember && otherMember.tenant_id !== tenantId) {
          return json({ error: "That email already belongs to another account" }, 400);
        }
        userId = existing.id;
        await admin.auth.admin.updateUserById(existing.id, { password });
      } else {
        userId = created.user?.id ?? null;
      }

      if (!userId) return json({ error: "Could not create the employee login" }, 500);

      const { data: member, error: memberErr } = await admin
        .from("tenant_members")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            role,
            display_name: displayName,
            email,
            is_active: true,
            invited_by: caller.id,
          },
          { onConflict: "tenant_id,user_id" },
        )
        .select()
        .single();
      if (memberErr) return json({ error: memberErr.message }, 400);

      return json({ ok: true, member });
    }

    // Remaining actions operate on an existing member of this tenant.
    const memberId = String(body.member_id ?? "");
    if (!memberId) return json({ error: "Missing member" }, 400);

    const { data: target } = await admin
      .from("tenant_members")
      .select("id, tenant_id, user_id, role")
      .eq("id", memberId)
      .maybeSingle();
    if (!target || target.tenant_id !== tenantId) return json({ error: "Member not found" }, 404);
    if (target.role === "owner" && action !== "set_password") {
      return json({ error: "The account owner cannot be changed" }, 400);
    }

    if (action === "set_password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_role") {
      const role = ["admin", "employee"].includes(String(body.role)) ? String(body.role) : null;
      if (!role) return json({ error: "Invalid role" }, 400);
      const { error } = await admin.from("tenant_members").update({ role, updated_at: new Date().toISOString() }).eq("id", memberId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_active") {
      const isActive = !!body.is_active;
      const { error } = await admin
        .from("tenant_members")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", memberId);
      if (error) return json({ error: error.message }, 400);
      if (!isActive) {
        await admin
          .from("tenant_member_sessions")
          .update({ ended_at: new Date().toISOString(), end_reason: "deactivated" })
          .eq("member_id", memberId)
          .is("ended_at", null);
      }
      return json({ ok: true });
    }

    if (action === "remove") {
      await admin.from("tenant_members").delete().eq("id", memberId);
      await admin.auth.admin.deleteUser(target.user_id).catch(() => {});
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
