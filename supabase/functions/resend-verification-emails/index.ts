import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const emails: string[] | undefined = Array.isArray(body.emails)
      ? body.emails.map((e: string) => String(e).toLowerCase())
      : undefined;
    const delayMs = Number(body.delay_ms ?? 1500);
    const redirectTo = String(body.redirect_to ?? "https://jawabify.com/onboarding");

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Collect all users (paginated)
    const all: { id: string; email: string; confirmed: boolean; created_at: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) {
        if (!u.email) continue;
        all.push({
          id: u.id,
          email: u.email,
          confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
          created_at: u.created_at,
        });
      }
      if (data.users.length < 200) break;
    }

    let targets = all.filter((u) => !u.confirmed);
    if (emails) targets = targets.filter((u) => emails.includes(u.email.toLowerCase()));

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        total_users: all.length,
        unverified: targets.length,
        targets: targets.map((t) => ({ email: t.email, created_at: t.created_at })),
      });
    }

    const results: { email: string; sent: boolean; error?: string }[] = [];
    for (const u of targets) {
      const { error } = await anon.auth.resend({
        type: "signup",
        email: u.email,
        options: { emailRedirectTo: redirectTo },
      });
      results.push({ email: u.email, sent: !error, error: error?.message });
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }

    return json({
      ok: true,
      attempted: results.length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
