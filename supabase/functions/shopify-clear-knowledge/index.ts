import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supaAuth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tenantId = await resolveTenantId(admin, user.id, req.headers.get("x-acting-tenant"));
    if (!tenantId) return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 1) Delete ai_knowledge rows of type shopify_product
    await admin.from("ai_knowledge").delete().eq("tenant_id", tenantId).eq("type", "shopify_product");

    // 2) Delete knowledge_images rows whose description contains [shopify:
    const { data: imgs } = await admin
      .from("knowledge_images").select("id, image_url")
      .eq("tenant_id", tenantId).ilike("description", "%[shopify:%");

    const ids = (imgs || []).map((r: any) => r.id);
    if (ids.length) await admin.from("knowledge_images").delete().in("id", ids);

    // 3) Delete storage files
    const { data: files } = await admin.storage.from("chat-media").list("knowledge/shopify", { limit: 1000 });
    if (files && files.length) {
      const paths = files.map((f: any) => `knowledge/shopify/${f.name}`);
      // Chunked
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from("chat-media").remove(paths.slice(i, i + 100));
      }
    }

    // 4) Clear setting
    await admin.from("app_settings").delete().eq("tenant_id", tenantId).eq("key", "shopify_last_imported_at");

    return new Response(JSON.stringify({ ok: true, deleted_images: ids.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
