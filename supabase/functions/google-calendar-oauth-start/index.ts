import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeAppUserOAuth } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { GOOGLE_CALENDAR_SCOPES } from "../_shared/appUserScopes.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    const clientAPIKey = Deno.env.get("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY");
    if (!clientAPIKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY is not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The OAuth popup returns to an edge function (not an app route) so the flow
    // works from any origin, including previews without deep-link routing.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const nonce = crypto.randomUUID();
    const { error: nonceError } = await admin.from("app_user_oauth_nonces").insert({
      nonce, user_id: user.id, connector_id: CONNECTOR_ID,
    });
    if (nonceError) throw nonceError;
    const returnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth-complete?nonce=${nonce}`;

    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: user.id,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_CALENDAR_SCOPES },
    });
    return new Response(JSON.stringify({ authorizationUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-calendar-oauth-start failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
