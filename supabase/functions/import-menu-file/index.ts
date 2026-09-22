import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface MenuRow {
  name: string;
  price: number;
  currency?: string;
  description?: string | null;
  category?: string | null;
}

async function extractText(mime: string, filename: string, base64: string, apiKey: string): Promise<string> {
  const lower = filename.toLowerCase();
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
    const pdf = await getDocumentProxy(bin);
    const { text } = await pdfText(pdf, { mergePages: true });
    const out = (Array.isArray(text) ? text.join("\n") : text) || "";
    if (out.trim().length > 40) return out.slice(0, 50000);
    throw new Error("This PDF has no readable text (it may be a scanned image). Please upload it as an image instead.");
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
    const dataUrl = `data:${mime || "image/png"};base64,${base64}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Read this restaurant menu. List every section and every item with its exact price and description, one item per line." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error(`Could not read image (${r.status})`);
    const j = await r.json();
    return (j?.choices?.[0]?.message?.content || "").slice(0, 50000);
  }

  if (mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(lower)) {
    return new TextDecoder().decode(bin).slice(0, 50000);
  }

  throw new Error("Unsupported file type. Upload a PDF, image, or text file.");
}

async function structureMenu(text: string, apiKey: string, defaultCurrency: string): Promise<MenuRow[]> {
  const prompt = `You are parsing a restaurant menu. Extract EVERY dish/drink item and return ONLY a JSON array, no prose, no code fences.
Each element: {"name": string, "price": number, "currency": string|null, "description": string|null, "category": string|null}
Rules:
- price must be a plain number (no currency symbol). If an item has no price, skip it.
- currency: 3-letter code if visible (USD, LBP, EUR...), otherwise null.
- category is the menu section the item belongs to (e.g. Appetizers, Pizzas, Drinks).
- Never invent items or prices.

MENU TEXT:
${text.slice(0, 24000)}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "google/gemini-3.8-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Menu parsing failed (${r.status})`);
  const j = await r.json();
  let content: string = j?.choices?.[0]?.message?.content || "[]";
  content = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: any[];
  try { arr = JSON.parse(content.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => {
      const price = typeof x?.price === "number" ? x.price : parseFloat(String(x?.price ?? "").replace(/[^\d.]/g, ""));
      if (!x?.name || !String(x.name).trim() || !isFinite(price)) return null;
      return {
        name: String(x.name).trim().slice(0, 200),
        price: Math.round(price * 100) / 100,
        currency: (x.currency ? String(x.currency).toUpperCase().slice(0, 3) : defaultCurrency),
        description: x.description ? String(x.description).slice(0, 500) : null,
        category: x.category ? String(x.category).trim().slice(0, 100) : null,
      } as MenuRow;
    })
    .filter(Boolean) as MenuRow[];
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
    const { file_base64, mime, filename, currency, dry_run, items } = body || {};

    let rows: MenuRow[] = [];
    const defaultCurrency = (currency ? String(currency).toUpperCase().slice(0, 3) : "USD");

    if (Array.isArray(items) && items.length) {
      // Confirmed items coming back from the UI
      rows = items
        .map((x: any) => {
          const price = typeof x?.price === "number" ? x.price : parseFloat(String(x?.price ?? ""));
          if (!x?.name || !isFinite(price)) return null;
          return {
            name: String(x.name).slice(0, 200),
            price: Math.round(price * 100) / 100,
            currency: (x.currency ? String(x.currency).toUpperCase().slice(0, 3) : defaultCurrency),
            description: x.description ? String(x.description).slice(0, 500) : null,
            category: x.category ? String(x.category).slice(0, 100) : null,
          } as MenuRow;
        })
        .filter(Boolean) as MenuRow[];
    } else {
      if (!file_base64 || !filename) return json({ error: "file_base64 and filename required" }, 400);
      const approxBytes = Math.floor((String(file_base64).length * 3) / 4);
      if (approxBytes > 15 * 1024 * 1024) return json({ error: "File too large (max 15 MB)" }, 400);

      const text = await extractText(mime || "", filename, file_base64, LOVABLE_API_KEY);
      if (!text.trim()) return json({ error: "No readable text found in file" }, 400);
      rows = await structureMenu(text, LOVABLE_API_KEY, defaultCurrency);
      if (rows.length === 0) return json({ error: "No menu items could be read from this file" }, 400);
    }

    if (dry_run) return json({ preview: rows, count: rows.length });

    // Resolve / create categories
    const { data: existingCats } = await admin
      .from("menu_categories").select("id,name,sort_order").eq("tenant_id", tenantId);
    const catMap = new Map<string, string>();
    for (const c of existingCats || []) catMap.set(String(c.name).toLowerCase(), c.id);
    let nextSort = (existingCats || []).reduce((m: number, c: any) => Math.max(m, c.sort_order ?? 0), 0);

    const wanted = [...new Set(rows.map((r) => r.category).filter(Boolean) as string[])];
    for (const name of wanted) {
      if (catMap.has(name.toLowerCase())) continue;
      nextSort += 1;
      const { data, error } = await admin
        .from("menu_categories")
        .insert({ tenant_id: tenantId, name, sort_order: nextSort })
        .select("id").single();
      if (!error && data) catMap.set(name.toLowerCase(), data.id);
    }

    // Existing items (skip duplicates by name)
    const { data: existingItems } = await admin
      .from("menu_items").select("id,name,sort_order").eq("tenant_id", tenantId);
    const existingNames = new Set((existingItems || []).map((i: any) => String(i.name).trim().toLowerCase()));
    let itemSort = (existingItems || []).reduce((m: number, i: any) => Math.max(m, i.sort_order ?? 0), 0);

    let inserted = 0;
    let skipped = 0;
    const failed: Array<{ item: string; reason: string }> = [];

    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      if (existingNames.has(key)) { skipped++; continue; }
      itemSort += 1;
      const { error } = await admin.from("menu_items").insert({
        tenant_id: tenantId,
        category_id: r.category ? catMap.get(r.category.toLowerCase()) ?? null : null,
        name: r.name,
        description: r.description,
        price: r.price,
        currency: r.currency || defaultCurrency,
        is_available: true,
        sort_order: itemSort,
      });
      if (error) failed.push({ item: r.name, reason: error.message });
      else { inserted++; existingNames.add(key); }
    }

    return json({ inserted, skipped, failed, categories: wanted.length });
  } catch (err: any) {
    console.error("import-menu-file error:", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
