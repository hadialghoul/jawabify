import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Only super admins may reset another account's password.
    const token = (req.headers.get("authorization") ?? req.headers.get("x-supabase-authorization") ?? "")
      .replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: "unauthorized" }, 401);

    const verifier = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: role } = await verifier
      .from("user_roles")
      .select("user_id")
      .eq("user_id", caller.user.id)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    if (!role?.user_id) return json({ error: "forbidden" }, 403);

    const { email, password } = await req.json();
    if (!email || !password) return json({ error: "email_and_password_required" }, 400);

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (!user) return json({ error: "not_found" }, 404);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    return json({ ok: true, id: user.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
