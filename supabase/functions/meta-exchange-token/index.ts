import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_VERSION = "v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Always answer 200 with success:false so the browser shows a real reason
// instead of "Edge Function returned a non-2xx status code".
function fail(error: string, details?: unknown) {
  console.error("meta-exchange-token failure:", error, JSON.stringify(details ?? {}));
  return json({ success: false, error, details: details ?? null }, 200);
}

function addCandidate(candidates: Set<string>, value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value)) candidates.add(value);
}

async function graphGet(path: string, accessToken: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: { message: String(e) } } };
  }
}

async function getAssignedWabaIds(accessToken: string, metaAppId: string, metaAppSecret: string) {
  const candidates = new Set<string>();

  try {
    const debugUrl = `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${metaAppId}|${metaAppSecret}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();
    for (const scope of debugData?.data?.granular_scopes || []) {
      if (scope?.scope === "whatsapp_business_management" || scope?.scope === "whatsapp_business_messaging") {
        for (const id of scope.target_ids || []) addCandidate(candidates, id);
      }
    }
  } catch (e) {
    console.error("debug_token failed:", String(e));
  }

  const assigned = await graphGet("/me/assigned_whatsapp_business_accounts?fields=id,name&limit=100", accessToken);
  for (const account of assigned.data?.data || []) addCandidate(candidates, account?.id);

  const businesses = await graphGet(
    "/me/businesses?fields=owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}&limit=100",
    accessToken,
  );
  for (const business of businesses.data?.data || []) {
    for (const account of business?.owned_whatsapp_business_accounts?.data || []) addCandidate(candidates, account?.id);
    for (const account of business?.client_whatsapp_business_accounts?.data || []) addCandidate(candidates, account?.id);
  }

  return [...candidates];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return fail("Your session expired. Please sign in again and retry the connection.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAppId = Deno.env.get("META_APP_ID");
    // Meta's code -> token exchange requires the literal App Secret
    // (App Settings > Basic). META_CONFIG_TOKEN is kept only as a legacy fallback.
    const metaAppSecret = Deno.env.get("META_APP_SECRET") || Deno.env.get("META_CONFIG_TOKEN");
    if (!metaAppId || !metaAppSecret) {
      return fail("WhatsApp app credentials are not configured. Please contact support.");
    }


    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !user) {
      return fail("Your session expired. Please sign in again and retry the connection.");
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return fail("Invalid request body");
    }
    const { code, waba_id, phone_number_id } = payload;
    // Super admins managing a client account send the target account in a header.
    const tenant_id = req.headers.get("x-acting-tenant") || payload.tenant_id;
    if (!code || !tenant_id) return fail("Missing code or tenant_id");


    // Membership check (super admins may connect on behalf of any tenant).
    const [{ data: membership }, { data: roleRow }] = await Promise.all([
      supabaseAdmin
        .from("tenant_members")
        .select("tenant_id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle(),
    ]);
    if (!membership && !roleRow) {
      return fail("This account is not allowed to connect WhatsApp for that workspace.");
    }

    // Step 1: short-lived code -> user token
    const tokenUrl = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      return fail(
        tokenData?.error?.message ||
          "Meta rejected the login code. Please close the popup and try connecting again.",
        tokenData?.error,
      );
    }

    // Step 2: try to upgrade to a long-lived token (non-fatal if it fails)
    let accessToken = tokenData.access_token as string;
    try {
      const longLivedRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${accessToken}`,
      );
      const longLivedData = await longLivedRes.json();
      if (longLivedRes.ok && longLivedData?.access_token) accessToken = longLivedData.access_token;
      else console.error("long-lived exchange failed:", JSON.stringify(longLivedData?.error ?? {}));
    } catch (e) {
      console.error("long-lived exchange threw:", String(e));
    }

    let wabaId = typeof waba_id === "string" && /^\d+$/.test(waba_id) ? waba_id : null;
    let phoneNumberId = typeof phone_number_id === "string" && /^\d+$/.test(phone_number_id) ? phone_number_id : null;
    let phoneNumber: string | null = null;
    const lookupErrors: unknown[] = [];

    // Step 3: resolve WABA + phone number
    const wabaCandidates = wabaId ? [wabaId] : await getAssignedWabaIds(accessToken, metaAppId, metaAppSecret);
    for (const candidate of wabaCandidates) {
      const phones = await graphGet(
        `/${candidate}/phone_numbers?fields=id,display_phone_number&limit=100`,
        accessToken,
      );
      if (!phones.ok) {
        lookupErrors.push(phones.data?.error ?? phones.data);
        continue;
      }
      const list = phones.data?.data || [];
      const matchingPhone = phoneNumberId ? list.find((p: any) => p?.id === phoneNumberId) : list[0];
      if (matchingPhone) {
        wabaId = candidate;
        phoneNumberId = matchingPhone.id;
        phoneNumber = matchingPhone.display_phone_number ?? null;
        break;
      }
      // WABA exists but the phone list is empty / not yet visible: keep the IDs
      // Embedded Signup already gave us so the connection can still complete.
      if (!wabaId) wabaId = candidate;
    }

    if (!wabaId || !phoneNumberId) {
      return fail(
        "We could not find your WhatsApp Business account or phone number. Make sure you finished adding a phone number in the Meta popup and that the number is not already used on the WhatsApp app, then try again.",
        { wabaCandidates, lookupErrors },
      );
    }

    // Step 4: make sure our app receives this WABA's webhooks (best effort)
    try {
      const subRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const subData = await subRes.json();
      if (!subRes.ok) console.error("subscribed_apps failed:", JSON.stringify(subData?.error ?? subData));
    } catch (e) {
      console.error("subscribed_apps threw:", String(e));
    }

    // Step 4b: register the phone number on the Cloud API (required before it can
    // send or receive messages). Non-fatal: we still save the connection.
    let registrationWarning: string | null = null;
    try {
      const regRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
        },
      );
      const regData = await regRes.json();
      if (!regRes.ok) {
        const err = regData?.error ?? {};
        console.error("register failed:", JSON.stringify(err));
        if (err?.error_subcode === 2388001 || /existing WhatsApp account/i.test(err?.error_user_msg ?? "")) {
          registrationWarning =
            "This number is still active in the WhatsApp app. Open WhatsApp on the phone using this number, go to Settings > Account > Delete my account, wait ~3 minutes, then click Connect again.";
        } else if (err?.error_subcode !== 2388004 /* already registered */) {
          registrationWarning =
            err?.error_user_msg ||
            err?.message ||
            "We could not activate this number for messaging. Please try connecting again.";
        }
      }
    } catch (e) {
      console.error("register threw:", String(e));
    }

    // Step 5: persist credentials

    const record = {
      tenant_id,
      provider: "whatsapp_cloud",
      access_token: accessToken,
      phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      waba_id: wabaId,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("tenant_credentials")
      .upsert(record, { onConflict: "tenant_id,provider", ignoreDuplicates: false });

    if (upsertError) {
      console.error("Upsert error, trying update:", upsertError);
      const { error: updateError, count } = await supabaseAdmin
        .from("tenant_credentials")
        .update(record, { count: "exact" })
        .eq("tenant_id", tenant_id)
        .eq("provider", "whatsapp_cloud");
      if (updateError || !count) {
        const { error: insertError } = await supabaseAdmin.from("tenant_credentials").insert(record);
        if (insertError) {
          return fail("Could not save your WhatsApp connection. Please try again.", insertError.message);
        }
      }
    }

    return json({
      success: true,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      warning: registrationWarning,
    });

  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unexpected error while connecting WhatsApp");
  }
});
