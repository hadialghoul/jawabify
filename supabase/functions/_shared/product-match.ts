// Shared product matching for pushing local orders to Shopify.
// Large catalogs (10k+ products) can't be paged per order, so we search the
// store by the ordered item's name and score the returned candidates.

import { RestLikeProduct, searchProducts } from "./shopify.ts";

const STOP = new Set(["the", "and", "for", "with", "size", "shoes", "shoe", "pair"]);

export function stripQtyPrefix(s: string): string {
  return String(s || "").toLowerCase().replace(/^\s*\d+\s*x\s*/i, "").trim();
}

export function tokenize(s: string): string[] {
  return stripQtyPrefix(s)
    .replace(/['"’]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** 0..1000 similarity between a requested name and a product title. */
export function scoreTitle(raw: string, title: string): number {
  const t = String(title || "").toLowerCase();
  const r = stripQtyPrefix(raw);
  if (!t || !r) return 0;
  if (r === t) return 1000;
  if (r.includes(t)) return 500 + t.length;
  if (t.includes(r)) return 500 + r.length;
  // Token overlap — handles extra words like a colour the title omits.
  const rt = tokenize(r);
  const tt = new Set(tokenize(t));
  if (rt.length === 0 || tt.size === 0) return 0;
  const hits = rt.filter((tok) => tt.has(tok)).length;
  const ratio = hits / rt.length;
  if (hits < 2 && rt.length > 1) return 0;
  if (ratio < 0.5) return 0;
  return Math.round(ratio * 400) + hits;
}

/**
 * Finds candidate products for an item name. Tries a narrowing title search,
 * then a plain full-text search. `fallback` (a pre-fetched product list) is
 * used when the store search returns nothing.
 */
export async function findCandidates(
  shop: string,
  token: string,
  rawName: string,
  fallback: RestLikeProduct[] = [],
): Promise<RestLikeProduct[]> {
  const tokens = tokenize(rawName);
  const queries: string[] = [];
  if (tokens.length > 0) {
    for (let n = Math.min(tokens.length, 4); n >= 1; n--) {
      queries.push(tokens.slice(0, n).map((t) => `title:${t}*`).join(" AND "));
    }
  }
  const phrase = stripQtyPrefix(rawName);
  if (phrase) queries.push(phrase);

  for (const q of queries) {
    try {
      const r = await searchProducts(shop, token, q, 25);
      if (r.ok && r.products.length > 0) return r.products;
    } catch {
      /* try next query */
    }
  }
  return fallback;
}

/** Best-scoring product for a requested item name, or null. */
export function pickBestProduct(
  rawName: string,
  products: RestLikeProduct[],
): { product: RestLikeProduct; score: number } | null {
  let best: { product: RestLikeProduct; score: number } | null = null;
  for (const p of products) {
    const score = scoreTitle(rawName, p.title);
    if (score > 0 && (!best || score > best.score)) best = { product: p, score };
  }
  return best;
}

/** Searches the store and returns the best matching product for an item name. */
export async function matchProduct(
  shop: string,
  token: string,
  rawName: string,
  fallback: RestLikeProduct[] = [],
): Promise<{ product: RestLikeProduct; score: number } | null> {
  const candidates = await findCandidates(shop, token, rawName, fallback);
  return pickBestProduct(rawName, candidates);
}
