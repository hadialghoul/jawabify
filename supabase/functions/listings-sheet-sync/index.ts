// Listings Google Sheet sync — for each real-estate tenant with google_sheet_url
// configured, fetch the public CSV export and upsert listings by external_ref.
//
// Expected CSV columns (header row, case-insensitive):
//   ref, kind (buy|rent), property_type, title, description, price, currency,
//   bedrooms, bathrooms, area_sqm, area_name, region, image_url, status
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function toCsvExportUrl(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!m) return null;
  const sheetId = m[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { buf += '"'; i++; }
      else if (ch === '"') inQ = false;
      else buf += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(buf); buf = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (buf.length || cur.length) { cur.push(buf); rows.push(cur); cur = []; buf = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else buf += ch;
    }
  }
  if (buf.length || cur.length) { cur.push(buf); rows.push(cur); }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supabase
    .from("real_estate_settings")
    .select("tenant_id, google_sheet_url")
    .not("google_sheet_url", "is", null);

  const results: any[] = [];
  for (const s of settings ?? []) {
    const csvUrl = toCsvExportUrl(s.google_sheet_url);
    if (!csvUrl) { results.push({ tenant: s.tenant_id, error: "bad_url" }); continue; }
    try {
      const r = await fetch(csvUrl);
      if (!r.ok) { results.push({ tenant: s.tenant_id, error: `fetch_${r.status}` }); continue; }
      const text = await r.text();
      const rows = parseCsv(text);
      let upserted = 0;
      for (const row of rows) {
        const ref = row.ref || row.external_ref;
        if (!ref) continue;
        const images = row.image_url ? [{ url: row.image_url }] : [];
        const payload: any = {
          tenant_id: s.tenant_id,
          external_source: "sheet",
          external_ref: ref,
          kind: (row.kind || "buy").toLowerCase() === "rent" ? "rent" : "buy",
          property_type: row.property_type || "apartment",
          title: row.title || `Listing ${ref}`,
          description: row.description || null,
          price: row.price ? parseFloat(row.price) : null,
          currency: row.currency || "USD",
          bedrooms: row.bedrooms ? parseInt(row.bedrooms) : null,
          bathrooms: row.bathrooms ? parseInt(row.bathrooms) : null,
          area_sqm: row.area_sqm ? parseFloat(row.area_sqm) : null,
          area_name: row.area_name || null,
          region: row.region || null,
          images,
          status: (row.status || "active").toLowerCase(),
        };
        const { error } = await supabase
          .from("listings")
          .upsert(payload, { onConflict: "tenant_id,external_ref" });
        if (!error) upserted++;
        else console.error("listing upsert", ref, error.message);
      }
      results.push({ tenant: s.tenant_id, upserted, total: rows.length });
    } catch (e) {
      results.push({ tenant: s.tenant_id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
