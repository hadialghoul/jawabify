import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_VERSION = "v21.0";

async function graphGet(path: string, accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}${path}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function addCandidate(candidates: Set<string>, value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value)) candidates.add(value);
}

function decodeJwtSub(token: string): string | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      Math.ceil(payloadPart.length / 4) * 4,
      "=",
    );
    const payload = JSON.parse(atob(padded));
    if (!payload?.sub || (payload.exp && payload.exp * 1000 <= Date.now())) {
      return null;
    }
    return payload.sub as string;
  } catch (e) {
    console.error("JWT decode failed:", e);
    return null;
  }
}

async function resolveWabaId(
  accessToken: string,
  phoneNumberId?: string | null,
) {
  const candidates = new Set<string>();

  const metaAppId = Deno.env.get("META_APP_ID");
  const metaConfigToken = Deno.env.get("META_CONFIG_TOKEN");
  if (metaAppId && metaConfigToken) {
    const debugRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${
        encodeURIComponent(accessToken)
      }&access_token=${metaAppId}|${metaConfigToken}`,
    );
    const debugData = await debugRes.json();
    for (const scope of debugData?.data?.granular_scopes || []) {
      if (scope?.scope === "whatsapp_business_management") {
        for (const id of scope.target_ids || []) addCandidate(candidates, id);
      }
    }
  }

  const assigned = await graphGet(
    "/me/assigned_whatsapp_business_accounts?fields=id,name&limit=100",
    accessToken,
  );
  for (const account of assigned.data?.data || []) {
    addCandidate(candidates, account?.id);
  }

  const businesses = await graphGet(
    "/me/businesses?fields=owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}&limit=100",
    accessToken,
  );
  for (const business of businesses.data?.data || []) {
    for (
      const account of business?.owned_whatsapp_business_accounts?.data || []
    ) addCandidate(candidates, account?.id);
    for (
      const account of business?.client_whatsapp_business_accounts?.data || []
    ) addCandidate(candidates, account?.id);
  }

  const ids = [...candidates];
  if (ids.length === 0) return null;
  if (!phoneNumberId) return ids[0];

  const directPhone = await graphGet(
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    accessToken,
  );
  if (directPhone.ok && directPhone.data?.id === phoneNumberId) return ids[0];

  for (const id of ids) {
    const phones = await graphGet(
      `/${id}/phone_numbers?fields=id,display_phone_number&limit=100`,
      accessToken,
    );
    if (
      (phones.data?.data || []).some((phone: any) =>
        phone?.id === phoneNumberId
      )
    ) return id;
  }

  return ids[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    console.log("[wa-templates] hit", {
      hasAuth: !!authHeader,
      method: req.method,
    });
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (
      !authHeader?.startsWith("Bearer ") || !token || token === "undefined" ||
      token === "null"
    ) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", reason: "no-bearer" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // User-context client (PostgREST validates the JWT signature on every query)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Decode only to identify the row to check; the RLS query below validates the token.
    const userId = decodeJwtSub(token);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", reason: "invalid-token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify the JWT and resolve tenant through the caller's RLS-protected membership row.
    const { data: tenantData, error: tenantErr } = await userClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    const actingTenantHeader = req.headers.get("x-acting-tenant");
    if (tenantErr) {
      console.error("tenant membership auth check failed:", tenantErr);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          reason: "membership-check-failed",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!tenantData) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client bypasses RLS for encrypted tenant credentials only.
    const supabase = createClient(supabaseUrl, serviceKey);

    // Super admins managing a client account may target that account explicitly.
    const effectiveTenantId =
      (await resolveTenantId(supabase, userId, actingTenantHeader)) ?? tenantData.tenant_id;

    // Get tenant credentials
    const { data: cred } = await supabase
      .from("tenant_credentials")
      .select("access_token, waba_id, phone_number_id")
      .eq("tenant_id", effectiveTenantId)
      .eq("provider", "whatsapp_cloud")
      .eq("is_active", true)
      .maybeSingle();

    const envAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const envPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const envWabaId = Deno.env.get("WHATSAPP_WABA_ID");

    if (!cred && !envAccessToken) {
      return new Response(
        JSON.stringify({ error: "No WhatsApp credentials configured. Please connect WhatsApp in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const accessToken = (cred?.access_token && cred.access_token !== "FROM_ENV")
      ? cred.access_token
      : envAccessToken;

    const phoneNumberId =
      (cred?.phone_number_id && cred.phone_number_id !== "FROM_ENV")
        ? cred.phone_number_id
        : envPhoneNumberId;
    let wabaId = cred?.waba_id || envWabaId || null;


    // Auto-derive WABA ID from the token/business assignment if missing.
    if (!wabaId && accessToken) {
      if (phoneNumberId) {
        try {
          const derivedId = await resolveWabaId(accessToken, phoneNumberId);
          if (derivedId) {
            wabaId = derivedId;
            if (cred) {
              await supabase
                .from("tenant_credentials")
                .update({ waba_id: derivedId })
                .eq("tenant_id", effectiveTenantId)
                .eq("provider", "whatsapp_cloud");
            }

          } else {
            console.error("Could not derive WABA ID from token assignments");
          }
        } catch (e) {
          console.error("WABA lookup failed:", e);
        }
      }
    }

    if (!accessToken || !wabaId) {
      return new Response(
        JSON.stringify({
          error:
            "Missing access token or WABA ID. Please reconnect WhatsApp in Settings.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = new URL(req.url);

    // GET ?diagnose=1 = report which granular WhatsApp scopes this token holds
    if (req.method === "GET" && url.searchParams.get("diagnose") === "1") {
      const appId = Deno.env.get("META_APP_ID");
      const appSecret = Deno.env.get("META_APP_SECRET");
      let scopes: any = null;
      if (appId && appSecret) {
        const dbg = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${
            encodeURIComponent(accessToken!)
          }&access_token=${appId}|${appSecret}`,
        );
        const dbgBody = await dbg.json().catch(() => ({}));
        scopes = (dbgBody?.data?.granular_scopes || []).map((s: any) => ({
          scope: s?.scope,
          targets: s?.target_ids || [],
        }));
      }
      return new Response(
        JSON.stringify({ waba_id: wabaId, granular_scopes: scopes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GET = list templates
    if (req.method === "GET") {

      const limit = url.searchParams.get("limit") || "20";
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=${limit}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await metaRes.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST = create template
    if (req.method === "POST") {
      const body = await req.json();
      const { name, category, language, components, waba_id, phone_number_id } =
        body;

      if (typeof waba_id === "string" && /^\d+$/.test(waba_id)) {
        wabaId = waba_id;
      }
      if (
        !phoneNumberId && typeof phone_number_id === "string" &&
        /^\d+$/.test(phone_number_id)
      ) {
        await supabase
          .from("tenant_credentials")
          .update({ phone_number_id })
          .eq("tenant_id", effectiveTenantId)
          .eq("provider", "whatsapp_cloud");
      }

      if (!name || !category || !language || !components) {
        return new Response(
          JSON.stringify({
            error:
              "Missing required fields: name, category, language, components",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, category, language, components }),
        },
      );

      const data = await metaRes.json();
      const status = metaRes.ok ? 200 : metaRes.status;

      // Meta rejects a second template with the same name + language.
      if (data?.error?.error_subcode === 2388024) {
        return new Response(
          JSON.stringify({
            error: {
              ...data.error,
              message:
                `A template named "${name}" already exists in this language. Use a different name (e.g. "${name}_v2") or delete the existing one first.`,
              error_user_msg:
                `A template named "${name}" already exists in this language. Use a different name (e.g. "${name}_v2") or delete the existing one first.`,
            },
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    }

    // DELETE = delete template
    if (req.method === "DELETE") {
      const templateName = url.searchParams.get("name");
      if (!templateName) {
        return new Response(
          JSON.stringify({ error: "Template name required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const templateId = url.searchParams.get("id");

      // Some WABAs are shared with our business rather than owned by the user
      // whose token was captured at signup — that user token can read templates
      // but Meta rejects deletes with OAuthException #100. Retry with our
      // system-user / app tokens, which do hold management rights on the WABA.
      const candidateTokens = [
        accessToken,
        Deno.env.get("META_CONFIG_TOKEN"),
        Deno.env.get("META_SYSTEM_USER_TOKEN"),
        Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
      ].filter((t, i, arr) => !!t && arr.indexOf(t) === i) as string[];

      const deleteOnce = async (token: string, withHsmId: boolean) => {
        const params = new URLSearchParams({ name: templateName });
        if (withHsmId && templateId && /^\d+$/.test(templateId)) {
          params.set("hsm_id", templateId);
        }
        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?${params.toString()}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        const body = await res.json().catch(() => ({}));
        return { res, body };
      };

      const stillExists = async (token: string) => {
        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?limit=200&fields=id,name,status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(body?.data)) return null;
        return body.data.some((t: any) =>
          t?.name === templateName &&
          !String(t?.status || "").toUpperCase().includes("DELETED")
        );
      };

      let metaRes: Response | null = null;
      let data: any = {};
      let deleted = false;

      outer:
      for (const token of candidateTokens) {
        for (const withHsmId of templateId ? [true, false] : [false]) {
          ({ res: metaRes, body: data } = await deleteOnce(token, withHsmId));
          deleted = metaRes.ok && data?.success !== false && !data?.error;
          if (deleted) break outer;
          console.warn("[wa-templates] delete attempt failed", {
            withHsmId,
            error: data?.error?.message,
          });
        }
      }

      // Meta sometimes reports success while keeping the template live; verify.
      if (deleted) {
        const exists = await stillExists(accessToken);
        if (exists === true) {
          deleted = false;
          data = {
            error: {
              message:
                "WhatsApp accepted the request but the template is still active. It may be locked because it was used in a message in the last 30 days — try again later.",
              code: 0,
            },
          };
        }
      }

      if (!deleted) {
        console.error("[wa-templates] delete failed", metaRes?.status, data);
        const code = data?.error?.code;
        const message = code === 100 || code === 200
          ? "WhatsApp rejected the delete: the connected Meta account lacks whatsapp_business_management rights on this WhatsApp Business Account, or the template is owned by Meta (like hello_world). Reconnect WhatsApp in Settings, or delete it from WhatsApp Manager."
          : data?.error?.message ??
            "WhatsApp did not delete this template. It may be in use by a recent message.";
        return new Response(
          JSON.stringify({ error: { message, code } }),
          {
            status: metaRes && !metaRes.ok ? metaRes.status : 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }


      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Template error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
