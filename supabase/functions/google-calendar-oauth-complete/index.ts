import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { exchangeAppUserOAuthCode } from "../_shared/appUserConnector.ts";
import { saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Popup page shown after Google redirects back: tells the opener what happened
// and closes itself.
function popupResult(ok: boolean, message: string) {
  const html = `<!doctype html><html><body style="font-family:system-ui;padding:24px;color:#333">
<p>${message}</p>
<script>
  try {
    window.opener && window.opener.postMessage(
      { type: ${ok ? '"appUserConnectorOAuthComplete"' : '"appUserConnectorOAuthFailed"'},
        connectorId: "google_calendar", reason: ${JSON.stringify(message)} }, "*");
  } catch (e) {}
  setTimeout(function () { window.close(); }, ${ok ? 300 : 2500});
</script>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function userIdFromNonce(nonce: string) {
  const admin = adminClient();
  const { data } = await admin
    .from("app_user_oauth_nonces")
    .select("user_id, expires_at")
    .eq("nonce", nonce)
    .eq("connector_id", CONNECTOR_ID)
    .maybeSingle();
  if (!data) return null;
  await admin.from("app_user_oauth_nonces").delete().eq("nonce", nonce);
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  // Browser redirect coming back from Google via the connector gateway.
  if (req.method === "GET") {
    try {
      const nonce = url.searchParams.get("nonce");
      const code = url.searchParams.get("code");
      if (url.searchParams.get("success") === "false") {
        return popupResult(false, url.searchParams.get("error") ?? "Google sign-in was cancelled.");
      }
      if (!nonce || !code) return popupResult(false, "Google sign-in did not return a valid code.");
      const userId = await userIdFromNonce(nonce);
      if (!userId) return popupResult(false, "This sign-in link expired. Please try connecting again.");
      const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
      if (connectorId !== CONNECTOR_ID) return popupResult(false, "Wrong connector returned.");
      await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
      return popupResult(true, "Google Calendar connected. You can close this window.");
    } catch (e) {
      console.error("google-calendar-oauth-complete GET failed", e);
      return popupResult(false, "Could not finish connecting Google Calendar.");
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (connectorId !== CONNECTOR_ID) {
      return new Response(JSON.stringify({ error: "OAuth completion returned the wrong connector" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-calendar-oauth-complete failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
