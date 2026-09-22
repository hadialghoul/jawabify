// Dev-only: seed a persistent test account so you can preview the dashboard
// without going through Meta embedded signup every time.
//
// Test credentials (idempotent — safe to re-run):
//   email:    test@jawabify.dev
//   password: TestUser1234!
//
// What it sets up:
//   - confirmed auth user
//   - profile with onboarding_completed = true
//   - tenant "Test Restaurant" (vertical: restaurant)
//   - tenant_members link
//   - placeholder active whatsapp_cloud credentials so the dashboard unlocks
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const TEST_EMAIL = 'test@jawabify.dev';
const TEST_PASSWORD = 'TestUser1234!';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Find or create the auth user (admin API has no upsert; list then create).
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === TEST_EMAIL);
    if (existing) {
      userId = existing.id;
      // Make sure the password is what we advertise.
      await admin.auth.admin.updateUserById(userId, {
        password: TEST_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: 'Test User', business_name: 'Test Restaurant' },
      });
      if (error) throw error;
      userId = created.user!.id;
    }

    // 2. Ensure a tenant + membership.
    let tenantId: string | null = null;
    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (member?.tenant_id) {
      tenantId = member.tenant_id;
    } else {
      const { data: tenant, error: tErr } = await admin
        .from('tenants')
        .insert({ name: 'Test Restaurant', vertical: 'restaurant', owner_user_id: userId })
        .select('id')
        .single();
      if (tErr) throw tErr;
      tenantId = tenant.id;
      await admin.from('tenant_members').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' });
    }

    // 3. Profile: mark onboarding complete with sane defaults.
    await admin
      .from('profiles')
      .update({
        onboarding_completed: true,
        country: 'LB',
        city: 'Beirut',
        address: 'Test Address',
        contact_phone: '+96100000000',
        website: 'https://example.com',
        expected_volume: 'Less than 100',
        referral_source: 'Other',
      })
      .eq('user_id', userId);

    // 4. Active placeholder WhatsApp credentials so the dashboard gate opens.
    const { data: cred } = await admin
      .from('tenant_credentials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', 'whatsapp_cloud')
      .maybeSingle();
    if (!cred) {
      await admin.from('tenant_credentials').insert({
        tenant_id: tenantId,
        provider: 'whatsapp_cloud',
        phone_number: '+15550000000',
        phone_number_id: 'TEST_PHONE_NUMBER_ID',
        waba_id: 'TEST_WABA_ID',
        access_token: 'TEST_ACCESS_TOKEN',
        is_active: true,
      });
    } else {
      await admin.from('tenant_credentials').update({ is_active: true }).eq('id', cred.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        tenant_id: tenantId,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
