import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
  /** Override the tenant contacts are imported into (Super Admin). */
  tenantId?: string;
}


interface ParsedRow {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  tags?: string[];
}

const NAME_KEYS = ["name", "full name", "fullname", "contact", "contact name"];
const PHONE_KEYS = ["phone", "phone number", "phonenumber", "number", "whatsapp", "msisdn", "mobile", "tel"];
const EMAIL_KEYS = ["email", "e-mail", "mail", "email address"];
const ADDRESS_KEYS = ["address", "location", "city", "area", "region"];
const NOTES_KEYS = ["notes", "note", "comment", "comments", "remarks"];
const TAGS_KEYS = ["tags", "tag", "labels", "label", "segment"];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const DEFAULT_COUNTRY_CODE = "961"; // Lebanon

const sanitizePhone = (v: string) =>
  v
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-\.\(\)\/]/g, "")
    .trim();

const digitsOnly = (v: string) => sanitizePhone(v).replace(/\D/g, "");

function normalizePhone(raw: string): string | null {
  let digits = digitsOnly(raw);
  if (!digits) return null;

  // Drop leading 00 (international exit code) or 0 (trunk prefix)
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < 6 || digits.length > 15) return null;

  // If no explicit country code, assume default country (Lebanon).
  // Local numbers are 7-8 digits after the trunk prefix.
  if (!digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    if (digits.length <= 8) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
  }
  return "+" + digits;
}

// Returns possible phone_number values that could match the normalized input.
// This catches contacts stored with +, 00, trunk zero, or raw local digits.
function phoneLookupVariants(raw: string): string[] {
  const canonical = normalizePhone(raw);
  if (!canonical) return [];
  const digits = digitsOnly(canonical);
  const variants = new Set<string>();
  variants.add(canonical);
  variants.add(digits);
  variants.add("00" + digits);
  if (canonical.startsWith("+" + DEFAULT_COUNTRY_CODE)) {
    const local = canonical.slice(1 + DEFAULT_COUNTRY_CODE.length);
    variants.add("0" + local);
    variants.add(local);
  }
  return Array.from(variants);
}

function matchingKeys(raw: string): string[] {
  const canonical = normalizePhone(raw);
  if (!canonical) return [];
  return Array.from(new Set([canonical, digitsOnly(canonical)]));
}


function extractRows(matrix: string[][]): { rows: ParsedRow[]; skipped: number; total: number } {
  if (matrix.length === 0) return { rows: [], skipped: 0, total: 0 };
  const header = matrix[0].map((h) => h.trim().toLowerCase());
  let nameIdx = header.findIndex((h) => NAME_KEYS.includes(h));
  let phoneIdx = header.findIndex((h) => PHONE_KEYS.includes(h));
  const emailIdx = header.findIndex((h) => EMAIL_KEYS.includes(h));
  const addressIdx = header.findIndex((h) => ADDRESS_KEYS.includes(h));
  const notesIdx = header.findIndex((h) => NOTES_KEYS.includes(h));
  const tagsIdx = header.findIndex((h) => TAGS_KEYS.includes(h));

  let dataRows = matrix.slice(1);
  // If no header detected, auto-detect the phone column by sampling values
  if (phoneIdx === -1) {
    dataRows = matrix;
    const sample = matrix.slice(0, Math.min(20, matrix.length));
    const colCount = Math.max(...sample.map((r) => r.length));
    let bestCol = -1;
    let bestScore = 0;
    for (let c = 0; c < colCount; c++) {
      let score = 0;
      for (const r of sample) {
        if (normalizePhone((r[c] ?? "").toString())) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    phoneIdx = bestCol === -1 ? (colCount > 1 ? 1 : 0) : bestCol;
    nameIdx = phoneIdx === 0 ? (colCount > 1 ? 1 : -1) : 0;
  }

  const seen = new Map<string, ParsedRow>();
  let skipped = 0;
  for (const r of dataRows) {
    const phoneRaw = (r[phoneIdx] ?? "").toString();
    const nameRaw = nameIdx >= 0 ? (r[nameIdx] ?? "").toString() : "";
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      skipped++;
      continue;
    }
    const cell = (idx: number) => (idx >= 0 ? (r[idx] ?? "").toString().trim() : "");
    const tagsRaw = cell(tagsIdx);
    seen.set(phone, {
      phone,
      name: nameRaw.trim(),
      email: cell(emailIdx) || undefined,
      address: cell(addressIdx) || undefined,
      notes: cell(notesIdx) || undefined,
      tags: tagsRaw
        ? tagsRaw
            .split(/[;,|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });
  }
  return { rows: Array.from(seen.values()), skipped, total: dataRows.length };
}

// vCard (.vcf) — exported from phones/Google Contacts
function extractVcards(text: string): ParsedRow[] {
  const out = new Map<string, ParsedRow>();
  for (const card of text.split(/BEGIN:VCARD/i).slice(1)) {
    const nameMatch = card.match(/^FN[^:\r\n]*:(.*)$/im) || card.match(/^N[^:\r\n]*:(.*)$/im);
    const name = (nameMatch?.[1] || '').replace(/;+/g, ' ').trim();
    for (const tel of card.match(/^TEL[^:\r\n]*:(.*)$/gim) || []) {
      const phone = normalizePhone(tel.split(':').slice(1).join(':'));
      if (phone && !out.has(phone)) out.set(phone, { phone, name });
    }
  }
  return Array.from(out.values());
}

// Last resort for any other file (txt, json, pdf-ish text, chat exports…):
// scan every line for a phone number and take nearby text as the name.
function extractFreeText(text: string): { rows: ParsedRow[]; skipped: number; total: number } {
  const lines = text.split(/[\r\n]+/).filter((l) => l.trim().length > 0);
  const out = new Map<string, ParsedRow>();
  let skipped = 0;
  for (const line of lines) {
    const m = line.match(/(\+?\d[\d\s\-\.\(\)\/]{5,20}\d)/);
    if (!m) { skipped++; continue; }
    const phone = normalizePhone(m[1]);
    if (!phone) { skipped++; continue; }
    const name = line
      .replace(m[1], ' ')
      .replace(/["'{}\[\],;:|]/g, ' ')
      .replace(/\b(name|phone|number|tel|mobile|whatsapp|contact)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!out.has(phone)) out.set(phone, { phone, name: /[a-z\u0600-\u06FF]/i.test(name) ? name : '' });
  }
  return { rows: Array.from(out.values()), skipped, total: lines.length };
}

export function ImportContactsDialog({ open, onOpenChange, onImported, tenantId: tenantIdProp }: Props) {
  const { tenantId: authTenantId } = useAuth();
  const tenantId = tenantIdProp || authTenantId;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; skipped: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);


  const reset = () => {
    setFileName("");
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const name = file.name.toLowerCase();
      const isExcel =
        name.endsWith(".xlsx") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsm") ||
        name.endsWith(".ods") ||
        file.type.includes("sheet") ||
        file.type.includes("excel");

      if (isExcel) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        });
        const matrix = rows.map((r) => (r ?? []).map((c) => (c == null ? "" : String(c))));
        setParsed(extractRows(matrix));
        return;
      }

      const text = await file.text();

      // vCard export
      if (/BEGIN:VCARD/i.test(text)) {
        const rows = extractVcards(text);
        setParsed({ rows, skipped: 0, total: rows.length });
        if (rows.length === 0) toast.error("No phone numbers found in that file");
        return;
      }

      // CSV / TSV style tables
      const matrix = parseCsv(text);
      const table = extractRows(matrix);
      if (table.rows.length > 0) {
        setParsed(table);
        return;
      }

      // Anything else: scan the text for phone numbers
      const free = extractFreeText(text);
      setParsed(free);
      if (free.rows.length === 0) toast.error("No phone numbers found in that file");
    } catch (e: any) {
      toast.error(e?.message || "Could not read file");
      setParsed(null);
    }
  };


  const handleImport = async () => {
    if (!tenantId || !parsed || parsed.rows.length === 0) return;
    setImporting(true);
    try {
      let inserted = 0;
      let updated = 0;
      let failed = 0;
      let unchanged = 0;
      // Build a broad set of lookup variants so contacts stored in any format
      // (E.164, +, 00, trunk zero, spaces, dashes) are all found.
      const lookupPhones = new Set<string>();
      for (const r of parsed.rows) {
        for (const v of phoneLookupVariants(r.phone)) lookupPhones.add(v);
      }

      // Phone numbers are unique per account, so only compare against this account.
      // The same number may legitimately exist in another account.
      const { data: existing, error: existingError } = await supabase
        .from("contacts")
        .select("id, phone_number, name, tenant_id, email, address, notes, tags")
        .eq("tenant_id", tenantId)
        .in("phone_number", Array.from(lookupPhones));
      if (existingError) throw existingError;

      // Normalize stored numbers to the same canonical key so every format matches.
      const existingMap = new Map<string, any>();
      for (const c of existing ?? []) {
        for (const key of matchingKeys(c.phone_number ?? "")) {
          if (!existingMap.has(key)) existingMap.set(key, c);
        }
      }



      // Insert one-by-one so a single duplicate doesn't fail the whole batch
      for (const r of parsed.rows) {
        const keys = matchingKeys(r.phone);
        const ex = keys.map((k) => existingMap.get(k)).find((c) => c);
        if (ex) {

          // Treat placeholder names (empty, or just the phone number / "ig:123")
          // as missing so an imported real name always wins.
          const cur = (ex.name ?? '').trim();
          const curDigits = cur.replace(/\D/g, '');
          const isPlaceholder =
            !cur ||
            !/[a-z\u0600-\u06FF]/i.test(cur) ||
            (curDigits.length >= 6 &&
              (curDigits === (ex.phone_number ?? '').replace(/\D/g, '') ||
                curDigits === r.phone.replace(/\D/g, '')));
          const patch: Record<string, any> = {};
          if (r.name && r.name !== cur && isPlaceholder) patch.name = r.name;
          if (r.email && !(ex.email ?? "").trim()) patch.email = r.email;
          if (r.address && !(ex.address ?? "").trim()) patch.address = r.address;
          if (r.notes && !(ex.notes ?? "").trim()) patch.notes = r.notes;
          const exTags: string[] = Array.isArray(ex.tags) ? ex.tags : [];
          const newTags = (r.tags ?? []).filter((t) => !exTags.includes(t));
          if (newTags.length) patch.tags = [...exTags, ...newTags];
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from("contacts").update(patch).eq("id", ex.id);
            if (error) failed++;
            else updated++;
          } else {
            unchanged++;
          }
          continue;
        }
        const { error } = await supabase.from("contacts").insert({
          phone_number: r.phone,
          name: r.name || null,
          tenant_id: tenantId,
          email: r.email || null,
          address: r.address || null,
          notes: r.notes || null,
          tags: Array.from(new Set(["csv_import", ...(r.tags ?? [])])),
        } as any);
        if (error) {
          if ((error as any).code === "23505") unchanged++;
          else failed++;
        } else {
          inserted++;
        }
      }

      toast.success(
        `Imported ${inserted}, updated ${updated}${failed ? `, failed ${failed}` : ""}${
          unchanged ? `, already current ${unchanged}` : ""
        }${
          parsed.skipped ? `, invalid rows ${parsed.skipped}` : ""
        }`,
      );
      onImported?.();
      // Refresh the contact list everywhere (inbox + CRM) so imported clients show up now.
      window.dispatchEvent(new CustomEvent("jawabify:contacts-imported"));
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };


  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Upload any file — CSV, Excel, vCard, or plain text. Phone numbers are required;
            names are optional. Extra columns are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {fileName || "Choose a file"}
            </Button>


          </div>

          {parsed && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" />
                {parsed.rows.length} valid · {parsed.skipped} skipped · {parsed.total} total
              </div>
              {parsed.rows.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <div key={i} className="truncate">
                      {r.phone} {r.name && <span className="opacity-70">— {r.name}</span>}
                    </div>
                  ))}
                  {parsed.rows.length > 5 && (
                    <div className="opacity-60">+ {parsed.rows.length - 5} more…</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || parsed.rows.length === 0 || importing}
          >
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {parsed?.rows.length ? `(${parsed.rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
