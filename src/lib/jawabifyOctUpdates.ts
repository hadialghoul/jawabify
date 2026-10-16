import * as XLSX from 'xlsx';
import { actingHeaders } from './actingTenant';
import { invokeErrorMessage } from './functionError';
import { supabase } from './supabase';

export const VERVE_TENANT_ID = '5d01aeb3-72b5-4903-b068-8939a977db21';

export const SOURCE_LABELS: Record<string, string> = {
  ad: 'Ad',
  social_post: 'Social post',
  campaign: 'Campaign',
  website: 'Website',
  google: 'Google',
  link: 'Tagged link',
  organic: 'Organic / direct',
};

export function sourceLabel(type?: string | null) {
  if (!type) return 'Unknown';
  return SOURCE_LABELS[type] || type;
}

export function adsManagerUrl(adId: string) {
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${encodeURIComponent(adId)}`;
}

async function call<T = any>(name: string, body: Record<string, unknown>, actingTenantId?: string | null): Promise<T> {
  const headers = actingTenantId ? { 'x-acting-tenant': actingTenantId } : actingHeaders();
  const { data, error } = await supabase.functions.invoke(name, { body, headers });
  if (error || (data as any)?.error) throw new Error(await invokeErrorMessage(error, data));
  return data as T;
}

export function normalizeShop(shop: string) {
  return shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function normalizePhone(raw: string, defaultCc = '961'): string | null {
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 7 || digits.length === 8) digits = defaultCc + digits;
    digits = `+${digits}`;
  }
  const body = digits.slice(1);
  return /^\d{8,15}$/.test(body) ? digits : null;
}

export function parsePastedNumbers(text: string) {
  const seen = new Set<string>();
  const phones: string[] = [];
  let skipped = 0;
  for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
    const phone = normalizePhone(part);
    if (!phone || seen.has(phone)) {
      skipped += 1;
      continue;
    }
    seen.add(phone);
    phones.push(phone);
  }
  return { phones, skipped };
}

const PHONE_HEADERS = ['phone', 'mobile', 'number', 'whatsapp', 'tel', 'رقم', 'هاتف', 'موبايل'];
const NAME_HEADERS = ['name', 'full name', 'customer', 'client', 'الاسم', 'اسم'];

export function importCampaignBuffer(buf: ArrayBuffer) {
  const workbook = XLSX.read(buf, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
  if (!rows.length) throw new Error('The file is empty');
  const head = rows[0].map((cell: any) => String(cell).trim().toLowerCase());
  const find = (keys: string[]) => head.findIndex((cell) => keys.some((key) => cell === key || cell.includes(key)));
  const phoneIndex = find(PHONE_HEADERS);
  const nameIndex = find(NAME_HEADERS);
  if (phoneIndex < 0) throw new Error('No phone column found');
  const seen = new Set<string>();
  const phones: string[] = [];
  const names: string[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const phone = normalizePhone(String(row[phoneIndex] ?? ''));
    if (!phone || seen.has(phone)) {
      skipped += 1;
      continue;
    }
    seen.add(phone);
    phones.push(phone);
    names.push(nameIndex >= 0 ? String(row[nameIndex] ?? '').trim() : '');
  }
  return { phones, names, summary: `Imported ${phones.length} · skipped ${skipped} invalid/duplicate` };
}

export function splitKnownContacts(
  phones: string[],
  names: string[],
  contacts: { id: string; phone: string }[],
) {
  const byPhone = new Map(contacts.map((contact) => [normalizePhone(contact.phone) || contact.phone, contact.id]));
  const contactIds: string[] = [];
  const manualPhones: string[] = [];
  const manualNames: string[] = [];
  phones.forEach((phone, index) => {
    const id = byPhone.get(phone);
    if (id) contactIds.push(id);
    else {
      manualPhones.push(phone);
      manualNames.push(names[index] || '');
    }
  });
  return { contactIds, manualPhones, manualNames };
}

export function cancelSubscription(environment: 'live' | 'sandbox' = 'live') {
  return call('cancel-subscription', { environment });
}

export async function renewSubscription(environment: 'live' | 'sandbox' = 'live') {
  const data = await call<{ ok?: boolean; approval_url?: string; plan?: string }>('cancel-subscription', {
    action: 'renew',
    environment,
  });
  if (data.approval_url) return { kind: 'shopify_approval' as const, url: data.approval_url, plan: data.plan };
  return { kind: 'renewed' as const };
}

export async function connectShopify(shop: string, clientId: string, secret: string, actingTenantId?: string | null) {
  const normalized = normalizeShop(shop);
  const trimmed = secret.trim();
  const body = trimmed.startsWith('shpat_')
    ? { shop: normalized, access_token: trimmed }
    : { shop: normalized, client_id: clientId.trim(), client_secret: trimmed };
  const data = await call<{ approval_url?: string; shop_name?: string; shop_domain?: string }>(
    'shopify-connect-token',
    body,
    actingTenantId,
  );
  if (data.approval_url) return { kind: 'approval' as const, url: data.approval_url };
  return { kind: 'connected' as const, label: data.shop_name || data.shop_domain || normalized };
}

export function refreshInsights(contactId: string, actingTenantId?: string | null) {
  return call<{ profile: Record<string, unknown>; updated_at: string }>(
    'enterprise-customer-profile',
    { contact_id: contactId },
    actingTenantId,
  );
}

export const getCommerceStatus = (actingTenantId?: string | null) =>
  call<{ enabled?: boolean; shopify_cart_link_enabled?: boolean }>(
    'enterprise-commerce-catalog',
    { action: 'status' },
    actingTenantId,
  );

export const setMetaCatalogEnabled = (enabled: boolean, actingTenantId?: string | null) =>
  call('enterprise-commerce-catalog', { action: 'set', enabled: enabled === true }, actingTenantId);

export const setShopifyCartLinkEnabled = (enabled: boolean, actingTenantId?: string | null) =>
  call(
    'enterprise-commerce-catalog',
    { action: 'set', key: 'shopify_cart_link_enabled', enabled: enabled === true },
    actingTenantId,
  );

export const checkCommerceCatalog = (actingTenantId?: string | null) =>
  call<Record<string, any>>('enterprise-commerce-catalog', { action: 'check' }, actingTenantId);
