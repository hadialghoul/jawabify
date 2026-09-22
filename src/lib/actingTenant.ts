const ACTING_TENANT_KEY = 'jawabify_acting_tenant';

/**
 * Headers that tell edge functions which account to act on when a super admin
 * is managing a client account from Super Admin.
 */
export function actingHeaders(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(ACTING_TENANT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.id ? { 'x-acting-tenant': parsed.id } : {};
  } catch {
    return {};
  }
}
