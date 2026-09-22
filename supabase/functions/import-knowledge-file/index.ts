import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StructuredRow {
  title: string;
  price?: string;
  description?: string;
  sku?: string;
  category?: string;
  tags?: string;
  image_url?: string;
  extras?: Record<string, string>;
}

function formatProductContent(p: StructuredRow): string {
  const lines: string[] = [`Product: ${p.title}`];
  if (p.price) lines.push(`Price: ${p.price}`);
  if (p.sku) lines.push(`SKU: ${p.sku}`);
  if (p.category) lines.push(`Category: ${p.category}`);
  if (p.tags) lines.push(`Tags: ${p.tags}`);
  if (p.description) lines.push(`Description: ${p.description}`);
  if (p.image_url) lines.push(`Image: ${p.image_url}`);
  if (p.extras) {
    for (const [k, v] of Object.entries(p.extras)) lines.push(`${k}: ${v}`);
  }
  return lines.join("\n");
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!r.ok) { console.error("embed failed:", r.status, await r.text()); return null; }
    const j = await r.json();
    return j.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("embed error:", e);
    return null;
  }
}

async function extractTextFromFile(mime: string, filename: string, base64: string, apiKey: string): Promise<string> {
  const lower = filename.toLowerCase();
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Plain text / markdown / html
  if (mime.startsWith("text/") || /\.(txt|md|markdown|html?|json|xml)$/i.test(lower)) {
    let text = new TextDecoder().decode(bin);
    if (/\.html?$/i.test(lower) || mime.includes("html")) {
      text = text.replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
    }
    return text.slice(0, 50000);
  }

  // PDF via unpdf
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
      const pdf = await getDocumentProxy(bin);
      const { text } = await extractText(pdf, { mergePages: true });
      return (Array.isArray(text) ? text.join("\n") : text).slice(0, 50000);
    } catch (e) {
      console.error("pdf extract failed:", e);
      throw new Error("Couldn't read PDF");
    }
  }

  // DOCX via mammoth
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    try {
      const mammoth: any = await import("npm:mammoth@1.8.0");
      const result = await mammoth.extractRawText({ buffer: bin });
      return (result?.value || "").slice(0, 50000);
    } catch (e) {
      console.error("docx extract failed:", e);
      throw new Error("Couldn't read Word document");
    }
  }

  // Images → Gemini vision (via chat completions)
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
            { type: "text", text: "Read every product, price, and description visible in this image. Return the raw text and structured info you can see, in plain text. If it's a menu or catalog, list each item on its own line." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error(`Image read failed (${r.status})`);
    const j = await r.json();
    return (j?.choices?.[0]?.message?.content || "").slice(0, 50000);
  }

  // Audio → Gemini transcription
  if (mime.startsWith("audio/") || /\.(mp3|wav|webm|m4a|ogg|aac|flac)$/i.test(lower)) {
    let fmt = "webm";
    if (/mp3/i.test(mime) || lower.endsWith(".mp3")) fmt = "mp3";
    else if (/wav/i.test(mime) || lower.endsWith(".wav")) fmt = "wav";
    else if (/m4a|mp4/i.test(mime) || lower.endsWith(".m4a")) fmt = "m4a";
    else if (/ogg/i.test(mime) || lower.endsWith(".ogg")) fmt = "ogg";
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio. Then list any products, prices, or offers mentioned, one per line." },
            { type: "input_audio", input_audio: { data: base64, format: fmt } },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error(`Audio read failed (${r.status})`);
    const j = await r.json();
    return (j?.choices?.[0]?.message?.content || "").slice(0, 50000);
  }

  // Fallback: try UTF-8
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bin);
    const printable = text.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, "").trim();
    if (printable.length > 100) return printable.slice(0, 50000);
  } catch {}
  throw new Error(`Unsupported file type: ${mime || "unknown"}`);
}

async function structureWithAI(text: string, apiKey: string): Promise<StructuredRow[]> {
  const prompt = `Extract every distinct product/item/service from the text below and return ONLY a JSON array. Each item: {"title": string, "price": string|null, "description": string|null, "category": string|null, "tags": string[]|null, "image_url": string|null}. If nothing product-like is present, return []. No prose, no code fences.\n\nTEXT:\n${text.slice(0, 20000)}`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) { console.error("structure failed:", r.status, await r.text()); return []; }
    const j = await r.json();
    let content: string = j?.choices?.[0]?.message?.content || "[]";
    content = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(content.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr.filter((x: any) => x && typeof x.title === "string" && x.title.trim()).map((x: any) => ({
      title: String(x.title).slice(0, 200),
      price: x.price != null ? String(x.price) : undefined,
      description: x.description ? String(x.description) : undefined,
      category: x.category ? String(x.category) : undefined,
      tags: Array.isArray(x.tags) ? x.tags.join(", ") : undefined,
      image_url: x.image_url ? String(x.image_url) : undefined,
    }));
  } catch (e) {
    console.error("structure error:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supaAuth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tenantId = await resolveTenantId(admin, user.id, req.headers.get("x-acting-tenant"));
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const mode = body?.mode;

    if (mode === "clear") {
      const { data: existing } = await admin
        .from("ai_knowledge").select("id")
        .eq("tenant_id", tenantId).in("type", ["file_product", "file_document"]);
      const ids = (existing || []).map((r: any) => r.id);
      if (ids.length) await admin.from("ai_knowledge").delete().in("id", ids);
      return new Response(JSON.stringify({ ok: true, deleted: ids.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let products: StructuredRow[] = [];
    let resolvedMode: "structured" | "unstructured" = "structured";
    let fallbackDoc: { title: string; content: string } | null = null;

    if (mode === "structured") {
      products = Array.isArray(body?.rows) ? body.rows : [];
    } else if (mode === "unstructured") {
      resolvedMode = "unstructured";
      const { file_base64, mime, filename } = body || {};
      if (!file_base64 || !filename) {
        return new Response(JSON.stringify({ error: "file_base64 and filename required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const approxBytes = Math.floor((file_base64.length * 3) / 4);
      if (approxBytes > 20 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "File too large (max 20 MB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await extractTextFromFile(mime || "", filename, file_base64, LOVABLE_API_KEY);
      if (!text.trim()) {
        return new Response(JSON.stringify({ error: "No readable text found in file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      products = await structureWithAI(text, LOVABLE_API_KEY);
      if (products.length === 0) {
        fallbackDoc = { title: `File: ${filename}`, content: text.slice(0, 20000) };
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const failed: Array<{ item: string; reason: string }> = [];
    let inserted = 0;

    if (fallbackDoc) {
      const embedding = await embed(`${fallbackDoc.title}\n${fallbackDoc.content}`, LOVABLE_API_KEY);
      const { error } = await admin.from("ai_knowledge").insert({
        tenant_id: tenantId, title: fallbackDoc.title, content: fallbackDoc.content,
        type: "file_document", is_active: true, embedding: embedding as any,
      });
      if (error) failed.push({ item: fallbackDoc.title, reason: error.message });
      else inserted++;
    } else {
      for (const p of products) {
        if (!p.title?.trim()) { failed.push({ item: "(no title)", reason: "missing title" }); continue; }
        const content = formatProductContent(p);
        const embedding = await embed(`${p.title}\n${content}`, LOVABLE_API_KEY);
        const { error } = await admin.from("ai_knowledge").insert({
          tenant_id: tenantId, title: p.title.slice(0, 200), content,
          type: "file_product", is_active: true, embedding: embedding as any,
        });
        if (error) failed.push({ item: p.title, reason: error.message });
        else inserted++;
      }
    }

    return new Response(JSON.stringify({ inserted, failed, mode: resolvedMode }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("import-knowledge-file error:", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
