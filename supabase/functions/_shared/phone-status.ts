const TIER_CAP: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: Number.POSITIVE_INFINITY,
};

export async function fetchPhoneStatus(supabase: any, tenantId: string) {
  const { data: cred } = await supabase
    .from('tenant_credentials')
    .select('phone_number_id, access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'whatsapp_cloud')
    .eq('is_active', true)
    .maybeSingle();
  if (!cred) return null;
  const phoneNumberId = cred.phone_number_id && cred.phone_number_id !== 'FROM_ENV'
    ? cred.phone_number_id : Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = cred.access_token && cred.access_token !== 'FROM_ENV'
    ? cred.access_token : Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) return null;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number,name_status,status,platform_type,throughput,code_verification_status,is_official_business_account`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message || 'Meta API error', tier: null, quality: null, dailyCap: null };
  }
  const tier = data.messaging_limit_tier || null;
  const dailyCap = tier && TIER_CAP[tier] !== undefined ? TIER_CAP[tier] : null;
  return {
    tier,
    quality: data.quality_rating || null,
    dailyCap,
    verifiedName: data.verified_name || null,
    displayPhoneNumber: data.display_phone_number || null,
    nameStatus: data.name_status || null,
    // Connection diagnostics: a number that is not CONNECTED / not registered on the
    // Cloud API platform silently stops receiving inbound messages (senders see one check).
    connectionStatus: data.status || null,
    platformType: data.platform_type || null,
    throughput: data.throughput?.level || null,
    codeVerificationStatus: data.code_verification_status || null,
  };

}
