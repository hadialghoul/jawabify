// Shared Shopify helpers: pinned API version, REST/GraphQL clients, HMAC verification.
// Products are read through the GraphQL Admin API (REST product endpoints are
// deprecated for new apps), but returned in a REST-like shape so existing
// consumers keep working unchanged.

export const SHOPIFY_API_VERSION = "2026-01";

export function isValidShopDomain(shop: string | null | undefined): boolean {
  if (!shop) return false;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop.toLowerCase());
}

/** Normalizes to a canonical domain (alias-resolved) — use for storage/lookups. */
export function normalizeShopDomain(shop: string): string {
  return resolveShopAlias(rawShopDomain(shop));
}

/**
 * Normalizes formatting only, WITHOUT alias resolution. Use this for the
 * /admin/oauth/authorize redirect so the merchant lands on the exact domain
 * they typed (Shopify itself redirects aliases to the permanent domain).
 */
export function rawShopDomain(shop: string): string {
  const raw = String(shop || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return raw.includes(".myshopify.com") ? raw : `${raw}.myshopify.com`;
}


/**
 * Maps a store's alias .myshopify.com domain to its permanent domain.
 * Shopify only accepts /admin/oauth/authorize on the permanent domain, so a
 * merchant typing an alias (e.g. fitbulletlb.myshopify.com) must be redirected
 * to the real one (fitrizer-2.myshopify.com).
 * Configured via SHOPIFY_SHOP_DOMAIN_ALIASES="alias=permanent,alias2=permanent2".
 */
export function resolveShopAlias(domain: string): string {
  const raw = Deno.env.get("SHOPIFY_SHOP_DOMAIN_ALIASES") || "";
  for (const pair of raw.split(",")) {
    const [alias, target] = pair.split("=").map((s) => s.trim().toLowerCase());
    if (alias && target && alias === domain) return target;
  }
  return domain;
}


export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacBytes(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function hmacBase64(secret: string, message: string): Promise<string> {
  return btoa(String.fromCharCode(...(await hmacBytes(secret, message))));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  return Array.from(await hmacBytes(secret, message))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verifies a webhook body signature (base64 HMAC in X-Shopify-Hmac-Sha256). */
export async function verifyWebhookHmac(
  rawBody: string,
  headerHmac: string | null,
  secrets: Array<string | undefined>,
): Promise<boolean> {
  if (!headerHmac) return false;
  for (const secret of secrets) {
    if (!secret) continue;
    if (timingSafeEqual(await hmacBase64(secret, rawBody), headerHmac)) return true;
  }
  return false;
}

/**
 * Verifies the `hmac` query parameter Shopify appends to OAuth redirects and
 * app-load requests: all params except `hmac`/`signature`, sorted, joined.
 */
export async function verifyQueryHmac(
  url: URL,
  secrets: Array<string | undefined>,
): Promise<boolean> {
  const provided = url.searchParams.get("hmac");
  if (!provided) return false;
  const pairs: string[] = [];
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const message = pairs.join("&");
  for (const secret of secrets) {
    if (!secret) continue;
    if (timingSafeEqual(await hmacHex(secret, message), provided.toLowerCase())) return true;
  }
  return false;
}

export interface CustomAppCredential {
  client_id: string;
  client_secret: string;
  shop_domains: string[];
  /** Optional scope override — custom apps must request exactly the scopes
   * configured in their Partner app, otherwise Shopify shows
   * "Oops, something went wrong — Unauthorized Access" on /oauth/authorize. */
  scopes?: string;
}


/** Shoes Bullet store domains (permanent domain + alias the merchant uses). */
const SHOES_BULLET_DOMAINS = ["fitrizer-2.myshopify.com", "fitbulletlb.myshopify.com"];

/**
 * Loads all configured custom-distribution Shopify app credentials.
 * Supports the legacy single-app env block plus indexed blocks (_2, _3, ...).
 *
 * Indexed apps take priority: any shop claimed by an indexed app is removed
 * from the legacy app's domain list, otherwise a store could be sent to the
 * wrong Partner app ("install link is invalid").
 */
export function loadCustomAppCreds(): CustomAppCredential[] {
  const out: CustomAppCredential[] = [];

  // Shoes Bullet custom app (secret saved as SHOPIFY_CLIENT_SECRET_3).
  const app3Id = Deno.env.get("SHOPIFY_CUSTOM_CLIENT_ID_3") || "";
  const app3Secret = Deno.env.get("SHOPIFY_CLIENT_SECRET_3") ||
    Deno.env.get("SHOPIFY_CUSTOM_CLIENT_SECRET_3") || "";
  const app3Domains = (Deno.env.get("SHOPIFY_CUSTOM_SHOP_DOMAINS_3") || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (app3Id && app3Secret) {
    out.push({
      client_id: app3Id,
      client_secret: app3Secret,
      shop_domains: app3Domains.length ? app3Domains : SHOES_BULLET_DOMAINS,
      scopes: (Deno.env.get("SHOPIFY_CUSTOM_SCOPES_3") || "").trim() || undefined,
    });
  }

  for (let i = 2; ; i++) {
    if (i === 3) continue; // handled above
    const client_id = Deno.env.get(`SHOPIFY_CUSTOM_CLIENT_ID_${i}`) || "";
    const client_secret = Deno.env.get(`SHOPIFY_CUSTOM_CLIENT_SECRET_${i}`) || "";
    const shop_domains = (Deno.env.get(`SHOPIFY_CUSTOM_SHOP_DOMAINS_${i}`) || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!client_id || !client_secret || !shop_domains.length) break;
    out.push({
      client_id,
      client_secret,
      shop_domains,
      scopes: (Deno.env.get(`SHOPIFY_CUSTOM_SCOPES_${i}`) || "").trim() || undefined,
    });
  }

  const claimed = new Set(out.flatMap((a) => a.shop_domains));

  const legacyId = Deno.env.get("SHOPIFY_CUSTOM_CLIENT_ID") || "";
  const legacySecret = Deno.env.get("SHOPIFY_CUSTOM_CLIENT_SECRET") || "";
  // Additional shop domains for the legacy app can be appended without editing
  // the original secret (useful when a merchant's real .myshopify.com domain
  // differs from the one first configured).
  const legacyDomains = [
    ...(Deno.env.get("SHOPIFY_CUSTOM_SHOP_DOMAINS") || "").split(","),
    ...(Deno.env.get("SHOPIFY_CUSTOM_SHOP_DOMAINS_EXTRA") || "").split(","),
    ...(Deno.env.get("SHOPIFY_CUSTOM_SHOP_DOMAINS_EXTRA2") || "").split(","),
  ].map((s) => s.trim().toLowerCase()).filter(Boolean)
    .filter((d) => !claimed.has(d));
  if (legacyId && legacySecret && legacyDomains.length) {
    out.push({
      client_id: legacyId,
      client_secret: legacySecret,
      shop_domains: legacyDomains,
      scopes: (Deno.env.get("SHOPIFY_CUSTOM_SCOPES") || "").trim() || undefined,
    });
  }

  return out;
}


export function restUrl(shop: string, endpoint: string): string {
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/${endpoint.replace(/^\//, "")}`;
}

export async function shopifyRest(
  shop: string,
  token: string,
  endpoint: string,
  method = "GET",
  body?: unknown,
): Promise<Response> {
  return await fetch(restUrl(shop, endpoint), {
    method,
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function shopifyGraphQL<T = any>(
  shop: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data?: T; errors?: unknown }> {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.errors) {
    return { ok: false, status: res.status, errors: json?.errors ?? json };
  }
  return { ok: true, status: res.status, data: json?.data as T };
}

const numericId = (gid: string | undefined) =>
  gid ? Number(String(gid).split("/").pop()) : undefined;

export interface RestLikeProduct {
  id: number | undefined;
  title: string;
  handle: string;
  status: string;
  body_html: string;
  product_type?: string;
  vendor?: string;
  tags?: string;
  images: Array<{ id: number | undefined; src: string; alt?: string }>;
  variants: Array<{
    id: number | undefined;
    title: string;
    price: string;
    sku?: string;
    inventory_quantity?: number;
    available?: boolean;
  }>;
}

const PRODUCTS_QUERY = `
query Products($cursor: String, $first: Int!) {
  products(first: $first, after: $cursor, query: "status:active OR status:draft") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      handle
      status
      descriptionHtml
      productType
      vendor
      tags
      media(first: 10) {
        nodes {
          ... on MediaImage { id image { url altText } }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          price
          sku
          inventoryQuantity
          availableForSale
        }
      }
    }
  }
}`;

function mapProductNode(n: any): RestLikeProduct {
  return {
    id: numericId(n.id),
    title: String(n.title || ""),
    handle: String(n.handle || ""),
    status: String(n.status || "ACTIVE").toLowerCase(),
    body_html: String(n.descriptionHtml || ""),
    product_type: n.productType || undefined,
    vendor: n.vendor || undefined,
    tags: Array.isArray(n.tags) ? n.tags.join(", ") : (n.tags || undefined),
    images: (n.media?.nodes || [])
      .filter((m: any) => m?.image?.url)
      .map((m: any) => ({
        id: numericId(m.id),
        src: m.image.url as string,
        alt: m.image.altText || undefined,
      })),
    variants: (n.variants?.nodes || []).map((v: any) => ({
      id: numericId(v.id),
      title: String(v.title || ""),
      price: String(v.price ?? ""),
      sku: v.sku || undefined,
      inventory_quantity: typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : undefined,
      available: v.availableForSale ?? undefined,
    })),
  };
}

/** Fetches ONE page of non-archived products (cursor-based) for chunked jobs. */
export async function fetchProductsPage(
  shop: string,
  token: string,
  cursor: string | null,
  pageSize = 25,
): Promise<{
  ok: boolean;
  status: number;
  products: RestLikeProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
  errors?: unknown;
}> {
  const r = await shopifyGraphQL<any>(shop, token, PRODUCTS_QUERY, {
    cursor,
    first: Math.min(Math.max(pageSize, 1), 50),
  });
  if (!r.ok) {
    return { ok: false, status: r.status, products: [], hasNextPage: false, endCursor: null, errors: r.errors };
  }
  const conn = r.data?.products;
  return {
    ok: true,
    status: 200,
    products: (conn?.nodes || []).map(mapProductNode),
    hasNextPage: Boolean(conn?.pageInfo?.hasNextPage),
    endCursor: conn?.pageInfo?.endCursor ?? null,
  };
}

const PRODUCT_SEARCH_QUERY = PRODUCTS_QUERY
  .replace("query Products($cursor: String, $first: Int!)", "query ProductSearch($q: String!, $first: Int!)")
  .replace(
    'products(first: $first, after: $cursor, query: "status:active OR status:draft")',
    "products(first: $first, query: $q)",
  );

/**
 * Searches the store catalog by a free-text query (Shopify search syntax).
 * Needed for large catalogs where paging every product is impractical.
 */
export async function searchProducts(
  shop: string,
  token: string,
  query: string,
  first = 25,
): Promise<{ ok: boolean; status: number; products: RestLikeProduct[]; errors?: unknown }> {
  const r = await shopifyGraphQL<any>(shop, token, PRODUCT_SEARCH_QUERY, {
    q: query,
    first: Math.min(Math.max(first, 1), 50),
  });
  if (!r.ok) return { ok: false, status: r.status, products: [], errors: r.errors };
  return { ok: true, status: 200, products: (r.data?.products?.nodes || []).map(mapProductNode) };
}

/** Total count of non-archived products (best-effort; null when unavailable). */
export async function fetchProductsCount(shop: string, token: string): Promise<number | null> {
  const r = await shopifyGraphQL<any>(
    shop,
    token,
    `query { productsCount(query: "status:active OR status:draft") { count } }`,
  );
  const c = r.data?.productsCount?.count;
  return typeof c === "number" ? c : null;
}

/** Fetches every non-archived product via GraphQL, mapped to a REST-like shape. */
export async function fetchAllProducts(
  shop: string,
  token: string,
  maxProducts = 5000,
): Promise<{ ok: boolean; status: number; products: RestLikeProduct[]; errors?: unknown }> {
  const out: RestLikeProduct[] = [];
  let cursor: string | null = null;

  while (out.length < maxProducts) {
    const page = await fetchProductsPage(shop, token, cursor, 50);
    if (!page.ok) return { ok: false, status: page.status, products: out, errors: page.errors };
    out.push(...page.products);
    if (!page.hasNextPage) break;
    cursor = page.endCursor;
  }

  return { ok: true, status: 200, products: out };
}

/** All webhook topics this app subscribes to, including mandatory app/uninstalled. */
export const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/cancelled",
  "fulfillments/create",
  "fulfillments/update",
  "app/uninstalled",
  "app_subscriptions/update",
];


export async function registerWebhooks(
  shop: string,
  token: string,
  address: string,
): Promise<Array<{ topic: string; status: number; ok: boolean }>> {
  const out: Array<{ topic: string; status: number; ok: boolean }> = [];
  for (const topic of WEBHOOK_TOPICS) {
    try {
      const r = await shopifyRest(shop, token, "webhooks.json", "POST", {
        webhook: { topic, address, format: "json" },
      });
      out.push({ topic, status: r.status, ok: r.ok || r.status === 422 });
    } catch (e) {
      console.warn(`webhook ${topic} register error:`, e);
      out.push({ topic, status: 0, ok: false });
    }
  }
  return out;
}
