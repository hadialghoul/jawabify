import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchPhoneStatus } from '../_shared/phone-status.ts';
import { notifyTenantApp } from '../_shared/app-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // For each tenant with an active sending/scheduled campaign, check quality.
  const { data: tenants } = await supabase
    .from('campaigns')
    .select('tenant_id')
    .in('status', ['sending', 'scheduled']);
  const unique = Array.from(new Set((tenants || []).map((t: any) => t.tenant_id))) as string[];

  const paused: string[] = [];
  for (const tenantId of unique) {
    try {
      const status = await fetchPhoneStatus(supabase, tenantId);
      if (status && status.quality === 'RED') {
        const { data: affected } = await supabase
          .from('campaigns')
          .update({
            status: 'paused', auto_paused: true,
            paused_reason: 'Auto-paused: WhatsApp quality rating is RED',
          })
          .eq('tenant_id', tenantId)
          .in('status', ['sending', 'scheduled'])
          .select('id');
        if (affected && affected.length) paused.push(tenantId);
      }
    } catch (e) {
      console.error('quality check failed for tenant', tenantId, e);
    }
  }

  // Connection health: notify tenants whose WhatsApp link is broken and needs
  // re-linking (expired/revoked token, deleted phone number, etc.).
  const dropped: string[] = [];
  const { data: connected } = await supabase
    .from('tenant_credentials')
    .select('tenant_id')
    .eq('provider', 'whatsapp_cloud')
    .eq('is_active', true);
  const connectedTenants = Array.from(new Set((connected || []).map((c: any) => c.tenant_id))) as string[];
  for (const tenantId of connectedTenants) {
    try {
      const status = await fetchPhoneStatus(supabase, tenantId);
      const reason = !status
        ? 'WhatsApp credentials are missing or incomplete'
        : (status as any).error
          ? String((status as any).error)
          : null;
      if (!reason) continue;
      dropped.push(tenantId);
      console.log('[app-push] call site: connection_dropped', { tenant: tenantId, reason });
      await notifyTenantApp(supabase, tenantId, {
        eventType: 'connection_dropped',
        title: 'Action needed',
        body: `WhatsApp connection issue: ${reason}. Re-link your number in Settings.`,
        url: '/settings',
      });
    } catch (e) {
      console.error('connection check failed for tenant', tenantId, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: unique.length, paused, dropped }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
