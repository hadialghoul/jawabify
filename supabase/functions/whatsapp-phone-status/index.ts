import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchPhoneStatus } from "../_shared/phone-status.ts";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      console.warn('no-bearer');
      return json({ error: 'Unauthorized' }, 401);
    }
    // Verify with the service client (works with legacy + asymmetric signing keys)
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    let userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }
    if (!userId) {
      console.warn('auth failed', claimsErr?.message);
      return json({ error: 'Unauthorized' }, 401);
    }

    const tenantId = await resolveTenantId(supabase, userId, req.headers.get('x-acting-tenant'));
    if (!tenantId) return json({ error: 'No tenant' }, 400);

    const status = await fetchPhoneStatus(supabase, tenantId);
    if (!status) return json({ error: 'WhatsApp not connected' }, 400);
    return json(status);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
