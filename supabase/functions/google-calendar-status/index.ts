import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser, disconnectAppUser, appUserReconnectRequired } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser, deleteConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { GOOGLE_CALENDAR_SCOPES } from "../_shared/appUserScopes.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);

    const { action } = await req.json().catch(() => ({ action: "status" }));
    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);

    if (action === "disconnect") {
      if (connectionAPIKey) {
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey, connectorId: CONNECTOR_ID })
          .catch((e) => console.error("gateway disconnect failed", e));
        await deleteConnectionKeyForUser(user.id, CONNECTOR_ID);
      }
      return json({ ok: true, connected: false });
    }

    // status
    if (!connectionAPIKey) return json({ connected: false });
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      // calendar.events scope allows reading primary calendar events (calendarList.list does not).
      path: "/calendar/v3/calendars/primary/events?maxResults=1",
      requiredScopes: GOOGLE_CALENDAR_SCOPES,
    });
    if (await appUserReconnectRequired(res)) return json({ connected: false, reconnectRequired: true });
    if (!res.ok) {
      console.error(`calendar status check failed [${res.status}]: ${await res.text()}`);
      return json({ connected: false });
    }
    return json({ connected: true });
  } catch (e) {
    console.error("google-calendar-status failed", e);
    return json({ error: String(e) }, 500);
  }
});
