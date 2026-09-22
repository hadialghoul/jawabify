import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_VERTICALS = new Set([
  "ecommerce",
  "restaurant",
  "real_estate",
  "wellness",
  "healthcare",
  "education",
  "service",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { name, vertical } = body ?? {};
    if (!name) {
      return new Response(JSON.stringify({ error: "Missing name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const chosenVertical = typeof vertical === "string" && VALID_VERTICALS.has(vertical)
      ? vertical
      : "ecommerce";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Existing tenant?
    const { data: existingMember } = await supabaseAdmin
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ success: true, tenant_id: existingMember.tenant_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({ name, owner_user_id: user.id, vertical: chosenVertical })
      .select()
      .single();

    if (tenantError) {
      console.error("Tenant creation error:", tenantError);
      return new Response(JSON.stringify({ error: tenantError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: memberError } = await supabaseAdmin
      .from("tenant_members")
      .insert({ tenant_id: tenant.id, user_id: user.id, role: "owner" });

    if (memberError) {
      console.error("Member creation error:", memberError);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Seed restaurant defaults (removable by user later)
    if (chosenVertical === "restaurant") {
      await supabaseAdmin.from("restaurant_tables").insert([
        { tenant_id: tenant.id, label: "T1", seats: 2, sort_order: 1 },
        { tenant_id: tenant.id, label: "T2", seats: 2, sort_order: 2 },
        { tenant_id: tenant.id, label: "T3", seats: 4, sort_order: 3 },
        { tenant_id: tenant.id, label: "T4", seats: 4, sort_order: 4 },
        { tenant_id: tenant.id, label: "T5", seats: 6, sort_order: 5 },
        { tenant_id: tenant.id, label: "T6", seats: 8, sort_order: 6 },
      ]);
    }

    return new Response(JSON.stringify({ success: true, tenant_id: tenant.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-tenant error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
