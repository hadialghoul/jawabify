import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchProductsPage, fetchProductsCount } from "../_shared/shopify.ts";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.error("Embedding failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding exception:", e);
    return null;
  }
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatMetafieldValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try { return flattenJsonToText(JSON.parse(t)); } catch { /* fallthrough */ }
    }
    return stripHtml(t);
  }
  if (typeof v === "object") return flattenJsonToText(v);
  return String(v);
}

function flattenJsonToText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return stripHtml(node);
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map(flattenJsonToText).filter(Boolean).join("\n");
  if (typeof node === "object") {
    if (node.question || node.answer) {
      const q = flattenJsonToText(node.question);
      const a = flattenJsonToText(node.answer);
      return `Q: ${q}\nA: ${a}`;
    }
    if (node.children) return flattenJsonToText(node.children);
    if (node.text) return stripHtml(node.text);
    return Object.values(node).map(flattenJsonToText).filter(Boolean).join("\n");
  }
  return "";
}

async function fetchProductMetafields(shop: string, token: string, productId: string): Promise<any[]> {
  try {
    const r = await fetch(
      `https://${shop}/admin/api/2026-01/products/${productId}/metafields.json?limit=250`,
      { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } },
    );
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.metafields) ? j.metafields : [];
  } catch { return []; }
}

// Scrape the public product page and extract FAQ-style Q&A blocks the merchant
// added in their theme (e.g. "Most Common Questions", "Frequently Asked Questions").
async function fetchProductPageFaqs(shop: string, handle: string): Promise<string[]> {
  if (!handle) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://${shop}/products/${handle}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 JawabifyBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!r.ok) return [];
    return extractFaqsFromHtml(await r.text());
  } catch { return []; }
}

function extractFaqsFromHtml(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ");

  const out: string[] = [];
  let m: RegExpExecArray | null;

  const reA = /Question\s*\d+\s*[:\-]\s*([^\n]{3,400}?)\s*\n+\s*Answer\s*\d+\s*[:\-]\s*([^\n]{10,1500})/gi;
  while ((m = reA.exec(text)) !== null) {
    out.push(`Q: ${m[1].trim().replace(/\s+/g, " ")}\nA: ${m[2].trim().replace(/\s+/g, " ")}`);
  }

  const reB = /(?:^|\n)\s*\d+\s+([A-Z][^\n?]{5,250}\?)\s*\n+\s*([^\n]{20,1500})/g;
  while ((m = reB.exec(text)) !== null) {
    const q = m[1].trim().replace(/\s+/g, " ");
    const a = m[2].trim().replace(/\s+/g, " ");
    if (!/cart|subtotal|checkout|add to cart|log in|sign in/i.test(a)) out.push(`Q: ${q}\nA: ${a}`);
  }

  const faqHdr = /(Frequently Asked Questions|Most Common Questions|Commonly Asked Questions|Common Questions|FAQs?)/i;
  if (faqHdr.test(text)) {
    const idx = text.search(faqHdr);
    const section = text.slice(idx, idx + 8000);
    const reC = /(?:^|\n)\s*([A-Z][^\n?]{8,250}\?)\s*\n+\s*([^\n]{20,1500})/g;
    while ((m = reC.exec(section)) !== null) {
      const q = m[1].trim().replace(/\s+/g, " ");
      const a = m[2].trim().replace(/\s+/g, " ");
      if (!/cart|subtotal|checkout|add to cart|log in|sign in/i.test(a)) out.push(`Q: ${q}\nA: ${a}`);
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const qa of out) {
    const k = qa.split("\n")[0].toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(qa);
    if (deduped.length >= 25) break;
  }
  return deduped;
}



function buildProductText(p: any, metafields: any[] = [], pageFaqs: string[] = []): string {
  const lines: string[] = [];
  lines.push(`Product: ${p.title}`);
  if (p.vendor) lines.push(`Brand: ${p.vendor}`);
  if (p.product_type) lines.push(`Type: ${p.product_type}`);
  if (p.tags) lines.push(`Tags: ${p.tags}`);
  if (p.handle) lines.push(`Handle: ${p.handle}`);

  const variants = p.variants || [];
  if (variants.length) {
    const prices = variants.map((v: any) => parseFloat(v.price)).filter((n: number) => !isNaN(n));
    const compareAts = variants.map((v: any) => parseFloat(v.compare_at_price)).filter((n: number) => !isNaN(n) && n > 0);
    if (prices.length) {
      const min = Math.min(...prices), max = Math.max(...prices);
      let priceLine = `Price: ${min === max ? `$${min}` : `$${min} - $${max}`}`;
      if (compareAts.length) {
        const cMin = Math.min(...compareAts), cMax = Math.max(...compareAts);
        const wasMax = Math.max(...compareAts);
        if (wasMax > Math.min(...prices)) {
          priceLine += ` (used to be ${cMin === cMax ? `$${cMin}` : `$${cMin} - $${cMax}`}, now on sale)`;
        }
      }
      lines.push(priceLine);
    }
    const variantLines = variants.map((v: any) => {
      const t = v.title && v.title !== "Default Title" ? v.title : "Default";
      // Only Shopify variants that actually TRACK inventory carry a meaningful
      // quantity. Untracked variants always report 0, which previously marked a
      // whole catalog "out of stock" and made the bot refuse every product.
      const tracked = !!v.inventory_management;
      const oversell = String(v.inventory_policy || "").toLowerCase() === "continue";
      const stock = !tracked || oversell
        ? "in stock"
        : ((v.inventory_quantity ?? 0) > 0 ? `${v.inventory_quantity} in stock` : "out of stock");
      const sku = v.sku ? ` SKU:${v.sku}` : "";
      const cap = parseFloat(v.compare_at_price);
      const wasPart = !isNaN(cap) && cap > parseFloat(v.price) ? ` (was $${cap})` : "";
      return `  - ${t} $${v.price}${wasPart}${sku} ${stock}`.trim();
    });
    lines.push("Variants:");
    lines.push(...variantLines);
  }

  const desc = stripHtml(p.body_html || "");
  if (desc) lines.push(`Description: ${desc}`);

  const faqLines: string[] = [...pageFaqs];
  const otherLines: string[] = [];
  if (metafields.length) {
    for (const mf of metafields) {
      const key = String(mf.key || "").toLowerCase();
      const ns = String(mf.namespace || "").toLowerCase();
      const val = formatMetafieldValue(mf.value);
      if (!val) continue;
      const isFaq = /faq|question|qa|q_and_a|commonly[_-]?asked/.test(key) || /faq|question/.test(ns);
      if (isFaq) faqLines.push(val);
      else if (!/^gid:\/\//.test(val)) otherLines.push(`${mf.namespace}.${mf.key}: ${val}`);
    }
  }
  if (faqLines.length) {
    lines.push("Commonly Asked Questions:");
    lines.push(...faqLines);
  }
  if (otherLines.length) {
    lines.push("Additional Info:");
    lines.push(...otherLines);
  }


  return lines.join("\n");
}

async function downloadWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function extToContentType(ext: string): string {
  const m: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif",
  };
  return m[ext.toLowerCase()] || "image/jpeg";
}

function shopifyCompatibleImageUrl(src: string): { fetchUrl: string; ext: string } {
  const origExtMatch = src.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  const origExt = (origExtMatch?.[1] || "jpg").toLowerCase();
  const unsupported = ["webp", "avif", "gif", "bmp", "tif", "tiff", "svg"];
  if (!unsupported.includes(origExt)) return { fetchUrl: src, ext: origExt };

  try {
    const url = new URL(src);
    url.searchParams.set("format", "jpg");
    return { fetchUrl: url.toString(), ext: "jpg" };
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return { fetchUrl: `${src}${separator}format=jpg`, ext: "jpg" };
  }
}

const STATUS_KEY = "shopify_import_status";

async function upsertSetting(admin: any, tenantId: string, key: string, value: string) {
  const { data: existing } = await admin
    .from("app_settings").select("id").eq("key", key).eq("tenant_id", tenantId).maybeSingle();
  if (existing) await admin.from("app_settings").update({ value }).eq("id", existing.id);
  else await admin.from("app_settings").insert({ key, value, tenant_id: tenantId } as any);
}

async function readStatus(admin: any, tenantId: string): Promise<any | null> {
  const { data } = await admin
    .from("app_settings").select("value").eq("key", STATUS_KEY).eq("tenant_id", tenantId).maybeSingle();
  if (!data?.value) return null;
  const raw = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
  try { return JSON.parse(raw.replace(/^"|"$/g, "")); } catch { return null; }
}


const CHUNK_SIZE = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }

    // Internal chunk hand-off: authenticated with the service-role key so the
    // chain never dies when the merchant's login token expires mid-import.
    const internalKey = req.headers.get("x-internal-resume");
    const isInternal = Boolean(internalKey) && internalKey === SERVICE_KEY;

    let tenantId: string | null = null;
    const actingTenant = req.headers.get("x-acting-tenant");

    if (isInternal) {
      tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : null;
    } else {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supaAuth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userErr } = await supaAuth.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      tenantId = await resolveTenantId(admin, user.id, actingTenant);
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body?.mode === "status") {
      const status = await readStatus(admin, tenantId);
      return new Response(JSON.stringify(status || { state: "idle" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual stop: the running chunk sees this before starting the next batch.
    if (body?.mode === "stop") {
      const status = await readStatus(admin, tenantId);
      await upsertSetting(admin, tenantId, STATUS_KEY, JSON.stringify({
        ...(status || {}),
        state: "stopped",
        stop_requested: true,
        updated_at: new Date().toISOString(),
      }));
      return new Response(JSON.stringify({ stopped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isResume = body?.resume === true;
    const prev = await readStatus(admin, tenantId);
    if (!isResume && prev?.state === "running" &&
        Date.now() - new Date(prev.updated_at || 0).getTime() < 3 * 60 * 1000) {
      return new Response(JSON.stringify({ started: false, state: "running", ...prev }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { data: cred } = await admin
      .from("tenant_credentials")
      .select("access_token, shop_domain")
      .eq("tenant_id", tenantId).eq("provider", "shopify").eq("is_active", true).maybeSingle();
    if (!cred?.access_token || !cred?.shop_domain) {
      return new Response(JSON.stringify({ error: "Shopify not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chunk state: carried in the status row so each invocation resumes where
    // the previous one stopped (a single request can't process a big catalog
    // before the platform's wall-clock limit).
    let cursor: string | null = isResume ? (prev?.cursor ?? null) : null;
    const counters = {
      products: isResume ? (prev?.imported?.products ?? 0) : 0,
      images: isResume ? (prev?.imported?.images ?? 0) : 0,
      skipped_existing_images: isResume ? (prev?.imported?.skipped_existing_images ?? 0) : 0,
    };
    const failed: Array<{ product: string; product_id: string; reason: string }> =
      isResume && Array.isArray(prev?.failed) ? prev.failed.slice(0, 200) : [];
    let total: number | null = isResume ? (prev?.total ?? null) : null;
    const startedAt: string = (isResume && prev?.started_at) || new Date().toISOString();
    let batches: number = isResume ? (prev?.batches ?? 0) : 0;
    let runs: number = isResume ? (prev?.runs ?? 1) + 1 : 1;
    const startedProducts = counters.products;
    const runStart = Date.now();
    // Large catalogs skip the (slow) product-page FAQ scrape so 8k products stay feasible.
    const fastMode: boolean = isResume
      ? Boolean(prev?.fast_mode)
      : false; // set right after the total is known

    let fast = fastMode;
    let lastTitle: string = isResume ? (prev?.last_product ?? "") : "";

    const statusPayload = (extra: Record<string, unknown>) => {
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      const doneNow = counters.products;
      const rate = elapsedMs > 0 ? (doneNow / (elapsedMs / 1000)) : 0; // products/sec overall
      const remaining = total != null ? Math.max(total - doneNow, 0) : null;
      return {
        total,
        processed: doneNow,
        imported: { ...counters },
        failed: failed.slice(0, 200),
        cursor,
        started_at: startedAt,
        updated_at: new Date().toISOString(),
        batches,
        runs,
        batch_size: CHUNK_SIZE,
        fast_mode: fast,
        last_product: lastTitle,
        elapsed_ms: elapsedMs,
        products_per_min: Math.round(rate * 60 * 10) / 10,
        eta_seconds: remaining != null && rate > 0 ? Math.round(remaining / rate) : null,
        ...extra,
      };
    };

    const writeStatus = (extra: Record<string, unknown>) =>
      upsertSetting(admin, tenantId, STATUS_KEY, JSON.stringify(statusPayload(extra)));

    if (!isResume) {
      total = await fetchProductsCount(cred.shop_domain, cred.access_token);
      fast = (total ?? 0) > 400;
    }
    // Always clear any earlier stop request so a resume actually runs.
    await writeStatus({ state: "running", stop_requested: false });


    const stopRequested = async (): Promise<boolean> => {
      const s = await readStatus(admin, tenantId);
      return Boolean(s?.stop_requested) || s?.state === "stopped";
    };

    // Wall-clock budget for one invocation; we hand off well before the
    // platform limit so a batch is never cut in half.
    const RUN_BUDGET_MS = 100_000;

    const run = async () => {
      const { data: existingImgs } = await admin
        .from("knowledge_images")
        .select("description")
        .eq("tenant_id", tenantId)
        .ilike("description", "%[shopify:%");
      const existingTags = new Set<string>(
        (existingImgs || []).map((r: any) => {
          const m = String(r.description || "").match(/\[shopify:(\d+):(\d+)\]/);
          return m ? `${m[1]}:${m[2]}` : "";
        }).filter(Boolean)
      );

      let hasNextPage = true;

      while (hasNextPage) {
        if (await stopRequested()) {
          await writeStatus({ state: "stopped", stop_requested: true, stopped_reason: "Stopped by you" });
          return;
        }

        const page = await fetchProductsPage(cred.shop_domain, cred.access_token, cursor, CHUNK_SIZE);
        if (!page.ok) {
          console.error("Shopify products query failed", page.errors);
          throw new Error(`Shopify fetch failed: ${page.status}`);
        }
        const products = page.products.filter((p: any) => p.status !== "archived");

        for (const p of products) {
          const title = String(p.title || "Untitled");
          const pid = String(p.id);
          lastTitle = title;

          const metafields = await fetchProductMetafields(cred.shop_domain, cred.access_token, pid);
          const pageFaqs = fast ? [] : await fetchProductPageFaqs(cred.shop_domain, String(p.handle || ""));
          const text = buildProductText(p, metafields, pageFaqs);

          if (!stripHtml(p.body_html || "")) {
            failed.push({ product: title, product_id: pid, reason: "Empty description" });
          }
          const variantsNoPrice = (p.variants || []).filter((v: any) => !v.price);
          if (variantsNoPrice.length) {
            failed.push({ product: title, product_id: pid, reason: "Variant missing price" });
          }

          const embedding = await generateEmbedding(`${title}\n${text}`, LOVABLE_API_KEY);
          if (!embedding) {
            failed.push({ product: title, product_id: pid, reason: "Embedding generation failed" });
          }

          const row: any = {
            tenant_id: tenantId,
            title,
            content: text,
            is_active: true,
            type: "shopify_product",
            shopify_product_id: pid,
          };
          if (embedding) row.embedding = embedding as any;

          const { data: existing } = await admin
            .from("ai_knowledge")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("shopify_product_id", pid)
            .maybeSingle();

          if (existing) await admin.from("ai_knowledge").update(row).eq("id", existing.id);
          else await admin.from("ai_knowledge").insert(row);
          counters.products++;

          const imgs = Array.isArray(p.images) ? p.images : [];
          if (imgs.length === 0) {
            failed.push({ product: title, product_id: pid, reason: "No images on product" });
          }

          for (let i = 0; i < imgs.length; i += 10) {
            const slice = imgs.slice(i, i + 10);
            await Promise.all(slice.map(async (im: any) => {
              const imageId = String(im.id || "");
              const src: string = im.src || "";
              if (!imageId || !src) return;
              const tag = `${pid}:${imageId}`;
              if (existingTags.has(tag)) { counters.skipped_existing_images++; return; }

              try {
                const { fetchUrl, ext } = shopifyCompatibleImageUrl(src);
                const resp = await downloadWithTimeout(fetchUrl, 5000);
                if (!resp.ok) {
                  failed.push({ product: title, product_id: pid, reason: `Image download failed (HTTP ${resp.status})` });
                  return;
                }
                const bytes = new Uint8Array(await resp.arrayBuffer());
                const path = `knowledge/shopify/${pid}-${imageId}.${ext}`;
                const { error: upErr } = await admin.storage.from("chat-media").upload(path, bytes, {
                  contentType: extToContentType(ext),
                  upsert: true,
                });
                if (upErr) {
                  failed.push({ product: title, product_id: pid, reason: `Image upload failed: ${upErr.message}` });
                  return;
                }
                const { data: pub } = admin.storage.from("chat-media").getPublicUrl(path);
                await admin.from("knowledge_images").insert({
                  tenant_id: tenantId,
                  image_url: pub.publicUrl,
                  label: title,
                  description: `${title} [shopify:${pid}:${imageId}]`,
                  is_active: true,
                } as any);
                existingTags.add(tag);
                counters.images++;
              } catch (e: any) {
                const reason = e?.name === "AbortError" ? "Image timed out" : `Image download failed: ${e?.message || e}`;
                failed.push({ product: title, product_id: pid, reason });
              }
            }));
          }
        }

        batches++;
        hasNextPage = Boolean(page.hasNextPage && page.endCursor);
        cursor = hasNextPage ? page.endCursor : null;
        await writeStatus({ state: hasNextPage ? "running" : "running" });

        if (!hasNextPage) break;

        // Hand off to a fresh invocation before this one runs out of time.
        if (Date.now() - runStart > RUN_BUDGET_MS) {
          const next = await fetch(`${SUPABASE_URL}/functions/v1/shopify-import-knowledge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_KEY}`,
              "apikey": SERVICE_KEY,
              "x-internal-resume": SERVICE_KEY,
            },
            body: JSON.stringify({ resume: true, tenant_id: tenantId }),
          });
          if (!next.ok) {
            const t = await next.text().catch(() => "");
            throw new Error(`Chunk hand-off failed (${next.status}): ${t.slice(0, 200)}`);
          }
          return;
        }
      }

      const nowIso = new Date().toISOString();
      await upsertSetting(admin, tenantId, "shopify_last_imported_at", nowIso);
      await writeStatus({ state: "done", last_imported_at: nowIso, cursor: null });
    };

    const job = run().catch(async (e: any) => {
      console.error("shopify import chunk failed:", e);
      await writeStatus({
        state: "error",
        error: e?.message || String(e),
      }).catch(() => {});
    });
    (globalThis as any).EdgeRuntime?.waitUntil?.(job);

    return new Response(JSON.stringify({
      started: true, state: "running", resumed: isResume,
      total, processed: counters.products, batch_size: CHUNK_SIZE, fast_mode: fast,
    }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("shopify-import-knowledge error:", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

