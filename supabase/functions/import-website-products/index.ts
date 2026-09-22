import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Product {
  title: string;
  price?: string;
  compare_price?: string;
  description?: string;
  variants?: string;
  options?: string;
  sizes?: string;
  colors?: string;
  product_type?: string;
  vendor?: string;
  tags?: string;
  sku?: string;
  image_url?: string;
  url?: string;
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JawabifyBot/1.0)",
        Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/**
 * Readable page text. Many modern stores are JavaScript-rendered, so the raw
 * HTML contains no product data at all. When the static HTML looks empty (or
 * shows no price), fall back to a rendering reader that executes the page JS.
 */
async function fetchReadableText(url: string): Promise<string | null> {
  const html = await fetchText(url);
  const staticText = html ? htmlToText(html) : "";
  const looksUsable = staticText.length > 600 && /(\$|USD|EUR|LBP|£|€|\d+[.,]\d{2})/i.test(staticText);
  if (looksUsable) return staticText;

  const rendered = await fetchText(`https://r.jina.ai/${url}`, 30000);
  if (rendered && rendered.trim().length > 200) return rendered.slice(0, 30000);
  return staticText.length >= 80 ? staticText : null;
}

function formatContent(p: Product): string {
  const lines = [`Product: ${p.title}`];
  if (p.price) lines.push(`Price: ${p.price}`);
  if (p.compare_price) lines.push(`Original price: ${p.compare_price}`);
  if (p.product_type) lines.push(`Category: ${p.product_type}`);
  if (p.vendor) lines.push(`Brand: ${p.vendor}`);
  if (p.sizes) lines.push(`Sizes: ${p.sizes}`);
  if (p.colors) lines.push(`Colors: ${p.colors}`);
  if (p.options) lines.push(`Options: ${p.options}`);
  if (p.variants) lines.push(`Variants: ${p.variants}`);
  if (p.sku) lines.push(`SKU: ${p.sku}`);
  if (p.tags) lines.push(`Tags: ${p.tags}`);
  if (p.description) lines.push(`Description: ${p.description}`);
  if (p.url) lines.push(`Link: ${p.url}`);
  if (p.image_url) lines.push(`Image: ${p.image_url}`);
  return lines.join("\n");
}

/** Embeds up to 64 texts in one gateway call. Returns array aligned with input. */
async function embedBatch(texts: string[], apiKey: string): Promise<Array<number[] | null>> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });
    if (!r.ok) return texts.map(() => null);
    const j = await r.json();
    const data = Array.isArray(j?.data) ? j.data : [];
    return texts.map((_, i) => {
      const hit = data.find((d: any) => d?.index === i) ?? data[i];
      return hit?.embedding || null;
    });
  } catch {
    return texts.map(() => null);
  }
}

const SIZE_OPTION = /size|siz|مقاس|قياس|shoe/i;
const COLOR_OPTION = /colou?r|لون/i;

/** Fetch one page of a Shopify storefront JSON feed and map it to products. */
async function fetchShopifyPage(base: string, page: number, currency: string): Promise<Product[] | null> {
  const raw = await fetchText(`${base}?limit=250&page=${page}`);
  if (!raw) return null;
  let data: any;
  try { data = JSON.parse(raw); } catch { return null; }
  const list = Array.isArray(data?.products) ? data.products : null;
  if (!list) return null;

  const out: Product[] = [];
  for (const p of list) {
    const v = Array.isArray(p.variants) ? p.variants : [];
    const opts = Array.isArray(p.options) ? p.options : [];
    const first = v[0] || {};
    const inStock = v.some((x: any) => x.available !== false);

    const optionNames: string[] = opts.map((o: any) => String(o?.name || ""));
    const valuesFor = (test: RegExp): string[] => {
      const idx = optionNames.findIndex((n) => test.test(n));
      if (idx === -1) return [];
      const key = `option${idx + 1}`;
      const available = new Set<string>();
      for (const x of v) {
        const val = x?.[key];
        if (!val) continue;
        if (x.available === false) continue;
        available.add(String(val));
      }
      const all: string[] = Array.isArray(opts[idx]?.values)
        ? opts[idx].values.map((s: any) => String(s))
        : [...available];
      return all.map((val) => (available.size && !available.has(val) ? `${val} (out of stock)` : val));
    };

    const sizes = valuesFor(SIZE_OPTION);
    const colors = valuesFor(COLOR_OPTION);

    out.push({
      title: String(p.title || "").slice(0, 200),
      price: first.price ? `${currency}${first.price}` : undefined,
      compare_price: first.compare_at_price ? `${currency}${first.compare_at_price}` : undefined,
      description: htmlToText(String(p.body_html || "")).slice(0, 1200),
      product_type: p.product_type ? String(p.product_type) : undefined,
      vendor: p.vendor ? String(p.vendor) : undefined,
      tags: Array.isArray(p.tags) ? p.tags.join(", ").slice(0, 300) : (p.tags ? String(p.tags).slice(0, 300) : undefined),
      sku: first.sku ? String(first.sku) : undefined,
      sizes: sizes.length ? sizes.join(", ").slice(0, 500) : undefined,
      colors: colors.length ? colors.join(", ").slice(0, 500) : undefined,
      options: opts.length
        ? opts
            .map((o: any, i: number) =>
              `${o?.name || `Option ${i + 1}`}: ${(Array.isArray(o?.values) ? o.values : []).join(", ")}`,
            )
            .join(" | ")
            .slice(0, 600)
        : undefined,
      variants: v.length > 1
        ? v
            .map((x: any) =>
              `${x.title}${x.sku ? ` [${x.sku}]` : ""}${x.price ? ` (${currency}${x.price})` : ""}${x.available === false ? " - out of stock" : ""}`,
            )
            .join("; ")
            .slice(0, 1500)
        : (inStock ? undefined : "out of stock"),
      image_url: p.images?.[0]?.src || p.image?.src || undefined,
      url: p.handle ? `${base.replace(/\/(collections\/all\/)?products\.json$/, "")}/products/${p.handle}` : undefined,
    });
  }
  return out.filter((p) => p.title);
}

/** Discover likely product URLs from sitemaps + homepage links. */
async function discoverProductUrls(origin: string, max: number): Promise<string[]> {
  const found = new Set<string>();
  const sitemapQueue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/product-sitemap.xml`];
  const seenSitemaps = new Set<string>();

  while (sitemapQueue.length && found.size < max) {
    const sm = sitemapQueue.shift()!;
    if (seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    const xml = await fetchText(sm, 10000);
    if (!xml) continue;
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    for (const loc of locs) {
      if (/\.xml(\.gz)?$/i.test(loc)) {
        if (/product|item|shop|collection/i.test(loc) || seenSitemaps.size < 4) sitemapQueue.push(loc);
        continue;
      }
      if (/\/(products?|product-page|item|shop|p)\//i.test(loc)) {
        found.add(loc);
        if (found.size >= max) break;
      }
    }
  }

  if (found.size === 0) {
    const home = await fetchText(origin);
    if (home) {
      for (const m of home.matchAll(/href=["']([^"']+)["']/gi)) {
        let href = m[1];
        if (href.startsWith("//")) href = `https:${href}`;
        else if (href.startsWith("/")) href = origin + href;
        if (!href.startsWith(origin)) continue;
        if (/\/(products?|product-page|item|shop|p)\//i.test(href)) {
          found.add(href.split("#")[0]);
          if (found.size >= max) break;
        }
      }
    }
  }
  return [...found].slice(0, max);
}

/**
 * Many modern storefronts are JavaScript-rendered single page apps whose catalog
 * lives in a public Supabase table (the raw HTML has no product data at all).
 * Read the site's JS bundle, recover the public API URL + anon key, and pull the
 * catalog straight from the REST API.
 */
const SPA_TABLE_CANDIDATES = [
  "products", "product_variants", "menu_items", "items", "services",
  "listings", "catalog", "shop_items", "inventory", "dishes",
];

function pickField(o: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o?.[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      const s = v.filter((x) => typeof x === "string" || typeof x === "number").join(", ");
      if (s) return s;
      continue;
    }
    if (typeof v === "object") continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
}

async function fetchSpaApiProducts(origin: string, currency: string): Promise<Product[]> {
  const home = await fetchText(origin);
  if (!home) return [];
  const scripts = [...home.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)].map((m) => {
    let s = m[1];
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return origin + s;
    return s;
  }).filter((s) => s.startsWith(origin)).slice(0, 4);

  let apiUrl = "";
  let anonKey = "";
  for (const src of scripts) {
    const js = await fetchText(src, 20000);
    if (!js) continue;
    apiUrl ||= js.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/i)?.[0] || "";
    anonKey ||= js.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/)?.[0] || "";
    if (apiUrl && anonKey) break;
  }
  if (!apiUrl || !anonKey) return [];

  for (const table of SPA_TABLE_CANDIDATES) {
    let rows: any[] = [];
    try {
      const r = await fetch(`${apiUrl}/rest/v1/${table}?select=*&limit=1000`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j)) continue;
      rows = j;
    } catch { continue; }
    if (!rows.length) continue;

    const out: Product[] = [];
    for (const row of rows) {
      const title = pickField(row, ["name", "title", "product_name", "label"]);
      const price = pickField(row, ["price", "unit_price", "amount", "base_price"]);
      if (!title || !price) continue;
      const img = row.image_url || (Array.isArray(row.image_urls) ? row.image_urls[0] : undefined);
      const variants = Array.isArray(row.variants)
        ? row.variants.map((v: any) => (typeof v === "string" ? v : pickField(v, ["name", "title", "label"]) || ""))
            .filter(Boolean).join("; ")
        : undefined;
      out.push({
        title: title.slice(0, 200),
        price: /[^\d.,\s]/.test(price) ? price : `${currency}${price}`,
        compare_price: pickField(row, ["compare_at_price", "compare_price", "old_price"]),
        description: pickField(row, ["description", "details", "summary"])?.slice(0, 1200),
        product_type: pickField(row, ["category", "product_type", "type", "collection"]),
        sizes: pickField(row, ["sizes", "size"]),
        colors: pickField(row, ["colors", "color", "colour"]),
        variants: variants || (row.in_stock === false ? "out of stock" : undefined),
        sku: pickField(row, ["sku", "code"]),
        image_url: typeof img === "string" ? img : undefined,
      });
    }
    if (out.length) return out;
  }
  return [];
}


async function extractProductsFromText(
  text: string,
  apiKey: string,
  sourceUrl?: string,
): Promise<Product[]> {
  const prompt = `Extract every distinct product or service being SOLD in the text below, with its price and available options.
Return ONLY a JSON array, no prose or code fences. Each item:
{"title": string, "price": string|null, "compare_price": string|null, "description": string|null, "sizes": string|null, "colors": string|null, "variants": string|null}
Rules:
- price = the current selling price exactly as shown (keep the currency symbol). compare_price = crossed-out / "was" price if any.
- sizes = comma separated list of sizes exactly as listed (e.g. "39, 40, 41, 42"). colors = comma separated colors.
- variants = other option combinations or per-variant prices if shown.
- Never invent products, prices, sizes or colors. If not stated, use null.
- Ignore navigation, blog posts, policies, reviews and anything not for sale.
- If nothing is for sale in the text, return [].

TEXT:
${text.slice(0, 24000)}`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    let content: string = j?.choices?.[0]?.message?.content || "[]";
    content = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(content.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x: any) => x && typeof x.title === "string" && x.title.trim())
      .map((x: any) => ({
        title: String(x.title).slice(0, 200),
        price: x.price != null ? String(x.price) : undefined,
        compare_price: x.compare_price != null ? String(x.compare_price) : undefined,
        description: x.description ? String(x.description).slice(0, 1500) : undefined,
        sizes: x.sizes ? String(x.sizes).slice(0, 500) : undefined,
        colors: x.colors ? String(x.colors).slice(0, 500) : undefined,
        variants: x.variants ? String(x.variants).slice(0, 2000) : undefined,
        url: sourceUrl,
      }));

  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const supaAuth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tenantId = await resolveTenantId(admin, user.id, req.headers.get("x-acting-tenant"));
    if (!tenantId) return json({ error: "No tenant" }, 400);

    const body = await req.json().catch(() => ({}));

    const purgeAll = async (): Promise<number> => {
      let deleted = 0;
      for (let guard = 0; guard < 500; guard++) {
        const { data: batch, error } = await admin
          .from("ai_knowledge").select("id")
          .eq("tenant_id", tenantId).eq("type", "website_product")
          .limit(500);
        if (error || !batch || batch.length === 0) break;
        const ids = batch.map((r: any) => r.id);
        const { error: delErr } = await admin.from("ai_knowledge").delete().in("id", ids);
        if (delErr) break;
        deleted += ids.length;
        if (batch.length < 500) break;
      }
      return deleted;
    };

    if (body?.mode === "clear") {
      const deleted = await purgeAll();
      return json({ ok: true, deleted });
    }


    let rawUrl = String(body?.url || "").trim();
    // Strip stray trailing characters (e.g. "nozzl3d.co_") that break the host.
    rawUrl = rawUrl.replace(/[\s_,.;:'"<>()\[\]]+$/g, "");
    if (!rawUrl) return json({ error: "URL is required" }, 400);
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`;

    let origin: string;
    try { origin = new URL(rawUrl).origin; } catch { return json({ error: "Invalid URL" }, 400); }

    const currency = String(body?.currency || "$");
    const maxPages = Math.min(Number(body?.max_pages) || 25, 40);




    const insertProducts = async (list: Product[]) => {
      let inserted = 0;
      const failed: Array<{ item: string; reason: string }> = [];
      const BATCH = 64;
      // Dedupe within this payload by title (case-insensitive).
      const seen = new Set<string>();
      const unique = list.filter((p) => {
        const key = p.title.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      for (let i = 0; i < unique.length; i += BATCH) {
        const batch = unique.slice(i, i + BATCH);
        // Drop anything already imported (previous resumable invocation).
        const { data: existingRows } = await admin
          .from("ai_knowledge").select("title")
          .eq("tenant_id", tenantId).eq("type", "website_product")
          .in("title", batch.map((p) => p.title.slice(0, 200)));
        const existingTitles = new Set(
          (existingRows || []).map((r: any) => String(r.title).trim().toLowerCase()),
        );
        const fresh = batch.filter((p) => !existingTitles.has(p.title.trim().toLowerCase()));
        if (!fresh.length) continue;
        const contents = fresh.map((p) => formatContent(p));
        const embeddings = await embedBatch(
          fresh.map((p, k) => `${p.title}\n${contents[k]}`),
          LOVABLE_API_KEY,
        );
        const rows = fresh.map((p, k) => ({
          tenant_id: tenantId,
          title: p.title.slice(0, 200),
          content: contents[k],
          type: "website_product",
          is_active: true,
          embedding: embeddings[k] as any,
        }));
        const { error } = await admin.from("ai_knowledge").insert(rows);
        if (error) {
          for (const row of rows) {
            const { error: e2 } = await admin.from("ai_knowledge").insert(row);
            if (e2) failed.push({ item: row.title, reason: e2.message });
            else inserted++;
          }
        } else {
          inserted += rows.length;
        }
      }
      return { inserted, failed };
    };


    // ---------------------------------------------------------------------
    // Resumable import. The client calls this function repeatedly, passing the
    // cursor back, so each invocation stays well inside the CPU/time budget.
    // cursor = { feed, page, total } ; feed 2 = AI crawl fallback ; null = start
    // ---------------------------------------------------------------------
    const bases = [`${origin}/products.json`, `${origin}/collections/all/products.json`];
    const PAGES_PER_CALL = 2; // 500 products max per invocation

    const cursor = body?.cursor && typeof body.cursor === "object" ? body.cursor : null;
    let feed: number = cursor ? Number(cursor.feed) || 0 : 0;
    let page: number = cursor ? Number(cursor.page) || 1 : 1;
    let total: number = cursor ? Number(cursor.total) || 0 : 0;
    let replaced = 0;

    if (!cursor) {
      // First call: wipe the previous website import for a clean slate.
      // Chunked so 20k+ row catalogs can't time out and leave leftovers.
      replaced = await purgeAll();
    }


    let inserted = 0;
    let withPrice = 0;
    let withSizes = 0;
    const failed: Array<{ item: string; reason: string }> = [];

    // Shopify JSON feeds (paged, resumable)
    while (feed < 2) {
      let pagesDone = 0;
      const pending: Product[] = [];
      let feedFinished = false;

      while (pagesDone < PAGES_PER_CALL) {
        const list = await fetchShopifyPage(bases[feed], page, currency);
        if (list === null || list.length === 0) { feedFinished = true; break; }
        pending.push(...list);
        page++;
        pagesDone++;
        if (list.length < 250) { feedFinished = true; break; }
      }

      if (pending.length) {
        // Dedupe inside this batch by product link (handle) — titles repeat across
        // colour/size listings, so title-based dedupe silently dropped products.
        const seen = new Set<string>();
        const fresh = pending.filter((p) => {
          const key = String((p as any).url || p.title).toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        withPrice += fresh.filter((p) => p.price).length;
        withSizes += fresh.filter((p) => p.sizes).length;
        const res = await insertProducts(fresh);
        inserted += res.inserted;
        failed.push(...res.failed);
        total += res.inserted;
      }

      if (feedFinished) {
        feed++;
        page = 1;
        // Root feed already produced a catalogue → don't re-scan the mirror feed.
        if (feed === 1 && total > 0) feed = 2;
        if (feed >= 2) break;
        continue;
      }

      // More pages left in this feed — hand control back to the client.
      return json({
        done: false,
        cursor: { feed, page, total },
        inserted,
        with_price: withPrice,
        with_sizes: withSizes,
        total_inserted: total,
        source: "shopify_json",
        site: origin,
      });
    }

    // AI crawl fallback (only when the JSON feeds produced nothing at all)
    let source: "shopify_json" | "crawl" | "single_page" | "spa_api" = "shopify_json";
    if (total === 0) {
      const seenTitles = new Set<string>();
      const products: Product[] = [];
      let pagesRead = 0;

      // 0) JS-rendered storefronts backed by a public API: read the catalog directly.
      const spa = await fetchSpaApiProducts(origin, currency);
      if (spa.length) {
        source = "spa_api";
        for (const p of spa) {
          const key = p.title.toLowerCase().trim();
          if (!key || seenTitles.has(key)) continue;
          seenTitles.add(key);
          products.push(p);
        }
      }


      const scan = async (urls: string[]) => {
        for (let i = 0; i < urls.length; i += 3) {
          const batch = urls.slice(i, i + 3);
          const results = await Promise.all(
            batch.map(async (u) => {
              const text = await fetchReadableText(u);
              if (!text) return [] as Product[];
              pagesRead++;
              return await extractProductsFromText(text, LOVABLE_API_KEY, u);
            }),
          );
          for (const list of results) {
            for (const p of list) {
              const key = p.title.toLowerCase().trim();
              if (!key || seenTitles.has(key)) continue;
              seenTitles.add(key);
              products.push(p);
            }
          }
        }
      };

      // 1) Catalogue/listing pages usually contain every product + price on one
      //    page — far cheaper and faster than crawling each product page.
      const listingPages = [...new Set([
        rawUrl,
        `${origin}/shop`,
        `${origin}/store`,
        `${origin}/products`,
        `${origin}/collections/all`,
        `${origin}/menu`,
      ])];
      if (products.length === 0) {
        await scan(listingPages);
        source = "single_page";
      }

      // 2) Only if listings gave (almost) nothing, crawl individual product pages.
      if (products.length < 3 && source !== "spa_api") {
        const urls = (await discoverProductUrls(origin, maxPages)).filter((u) => !listingPages.includes(u));
        if (urls.length) {
          source = "crawl";
          await scan(urls.slice(0, 12));
        }
      }


      if (products.length === 0) {
        return json({
          error: "No products with prices found on that website. Try a direct product/shop page URL, or import a CSV/Excel file instead.",
          pages_read: pagesRead,
          site: origin,
        }, 400);
      }


      withPrice += products.filter((p) => p.price).length;
      withSizes += products.filter((p) => p.sizes).length;
      const res = await insertProducts(products);
      inserted += res.inserted;
      failed.push(...res.failed);
      total += res.inserted;
    }

    return json({
      done: true,
      inserted,
      total_inserted: total,
      replaced,
      failed: failed.slice(0, 20),
      failed_count: failed.length,
      source,
      site: origin,
      with_price: withPrice,
      with_sizes: withSizes,
    });


  } catch (err: any) {
    console.error("import-website-products error:", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
