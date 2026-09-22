// Resolves which tenant an authenticated caller may act on.
// Regular users are locked to their own membership. Super admins may pass an
// explicit tenant_id to act on any account (Super Admin "Manage account").
export async function resolveTenantId(
  admin: { from: (t: string) => any },
  userId: string,
  requestedTenantId?: string | null,
): Promise<string | null> {
  const { data: membership } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!requestedTenantId || requestedTenantId === membership?.tenant_id) {
    return membership?.tenant_id ?? null;
  }

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (roleRow) return requestedTenantId;
  return membership?.tenant_id ?? null;
}
