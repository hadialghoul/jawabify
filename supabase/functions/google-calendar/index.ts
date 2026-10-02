// Google Calendar OAuth 2.0 connect flow, wired into this app's tenant/auth model.
//
// Routes (all served from this one function, matching this repo's shopify-oauth pattern):
//   POST /google-calendar            { action: "connect" }     -> { authUrl }
//   GET  /google-calendar/callback   ?code=...&state=...        -> self-closing popup page
//   POST /google-calendar            { action: "status" }      -> { connected, email?, reconnectRequired? }
//   POST /google-calendar            { action: "disconnect" }  -> { ok: true, connected: false }
//
// The refresh token is only ever read/written server-side and is stored
// AES-256-GCM encrypted in tenant_credentials.refresh_token_encrypted.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildAuthUrl,
  exchangeCode,
  fetchGoogleEmail,
  getAccessToken,
  probeConnected,
  revokeAndClear,
  saveConnection,
} from "../_shared/googleCalendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Self-closing popup that reports back to the window that opened it.
function popup(ok: boolean, message: string) {
  const html = `<!doctype html><html><body style="font-family:system-ui;padding:24px">
<p>${message}</p><script>
try { window.opener && window.opener.postMessage(
  { type: ${ok ? '"googleCalendarConnected"' : '"googleCalendarFailed"'}, reason: ${JSON.stringify(message)} }, "*"); } catch(e){}
setTimeout(function(){window.close()}, ${ok ? 300 : 2500});
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function newState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ─── CALLBACK: Google redirects here with ?code=&state= (no auth header) ───
    if (req.method === "GET" && path.endsWith("/callback")) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const oauthError = url.searchParams.get("error");

      if (oauthError || !code || !state) {
        return popup(false, "Google sign-in was cancelled.");
      }

      const { data: stateRow } = await supabaseAdmin
        .from("google_oauth_states")
        .select("tenant_id, expires_at")
        .eq("state", state)
        .maybeSingle();
      // One-time use: delete immediately so a replayed callback can't succeed.
      await supabaseAdmin.from("google_oauth_states").delete().eq("state", state);

      if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
        return popup(false, "This sign-in link expired. Please try again.");
      }

      let tokens: { access_token: string; refresh_token?: string };
      try {
        tokens = await exchangeCode(code);
      } catch {
        return popup(false, "Could not finish connecting Google Calendar.");
      }
      if (!tokens.refresh_token) {
        return popup(false, "Google did not return offline access. Try again.");
      }

      const googleEmail = await fetchGoogleEmail(tokens.access_token);
      const { error: upsertErr } = await saveConnection(supabaseAdmin, stateRow.tenant_id, tokens.refresh_token, googleEmail);
      if (upsertErr) {
        console.error("Failed to save Google refresh token", upsertErr);
        return popup(false, "Could not finish connecting Google Calendar.");
      }

      return popup(true, "Google Calendar connected. You can close this window.");
    }

    // ─── Everything else requires a signed-in user ───
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: tenantId, error: tenantErr } = await supabaseAdmin.rpc("get_user_tenant_id", {
      p_user_id: user.id,
    });
    if (tenantErr || !tenantId) return json({ error: "No tenant for this user" }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ─── STEP 1: build the Google consent URL ───
    if (req.method === "POST" && action === "connect") {
      if (!Deno.env.get("GOOGLE_CLIENT_ID") || !Deno.env.get("GOOGLE_CLIENT_SECRET")) {
        return json({ error: "Google credentials are not configured" }, 500);
      }
      const state = newState();
      const { error: stateErr } = await supabaseAdmin.from("google_oauth_states").insert({
        state,
        tenant_id: tenantId,
        user_id: user.id,
      });
      if (stateErr) {
        console.error("Failed to store google oauth state", stateErr);
        return json({ error: "Could not start the Google connection" }, 500);
      }
      return json({ authUrl: buildAuthUrl(state) });
    }

    // ─── Connection status: connected / not connected / needs reconnect ───
    if (req.method === "POST" && action === "status") {
      const { data: cred } = await supabaseAdmin
        .from("tenant_credentials")
        .select("refresh_token_encrypted, google_email")
        .eq("tenant_id", tenantId)
        .eq("provider", "google_calendar")
        .eq("is_active", true)
        .maybeSingle();
      if (!cred?.refresh_token_encrypted) return json({ connected: false });

      const accessToken = await getAccessToken(supabaseAdmin, tenantId);
      if (!accessToken) return json({ connected: false, reconnectRequired: true });

      const ok = await probeConnected(accessToken);
      if (!ok) return json({ connected: false, reconnectRequired: true });
      return json({ connected: true, email: cred.google_email });
    }

    // ─── Disconnect ───
    if (req.method === "POST" && action === "disconnect") {
      const { error: updateErr } = await revokeAndClear(supabaseAdmin, tenantId);
      if (updateErr) return json({ error: "Could not disconnect" }, 500);
      return json({ ok: true, connected: false });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("google-calendar error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

