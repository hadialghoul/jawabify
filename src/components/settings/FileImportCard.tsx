import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, Trash2, FileText, Info, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileImportFormatDialog, downloadCsvTemplate } from "./FileImportFormatDialog";
import { actingHeaders } from '@/lib/actingTenant';

interface ParsedProduct {
  title: string;
  price?: string;
  description?: string;
  sku?: string;
  category?: string;
  tags?: string;
  image_url?: string;
  extras?: Record<string, string>;
}

interface ImportResult {
  inserted: number;
  failed: Array<{ item: string; reason: string }>;
  mode: "structured" | "unstructured";
}

const HEADER_MAP: Record<string, keyof ParsedProduct> = {
  title: "title", name: "title", product: "title", "product name": "title",
  price: "price", cost: "price", amount: "price",
  description: "description", desc: "description", details: "description", body: "description",
  sku: "sku", id: "sku", "product id": "sku",
  category: "category", type: "category", collection: "category",
  tags: "tags",
  image: "image_url", "image url": "image_url", photo: "image_url",
};

const SPREADSHEET_EXT = /\.(csv|xlsx|xls|xlsm|ods|tsv)$/i;
const MAX_BYTES = 20 * 1024 * 1024;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === "\t") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); rows.push(row); row = []; cur = "";
      } else cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function extractRows(matrix: string[][]): ParsedProduct[] {
  if (matrix.length === 0) return [];
  const header = matrix[0].map((h) => h.trim().toLowerCase());
  const mapped: (keyof ParsedProduct | null)[] = header.map((h) => HEADER_MAP[h] || null);
  const extraHeaders: (string | null)[] = header.map((h, i) => (mapped[i] ? null : matrix[0][i]));

  const products: ParsedProduct[] = [];
  for (const r of matrix.slice(1)) {
    const p: ParsedProduct = { title: "" };
    const extras: Record<string, string> = {};
    for (let i = 0; i < r.length; i++) {
      const val = (r[i] ?? "").toString().trim();
      if (!val) continue;
      const key = mapped[i];
      if (key) (p as any)[key] = val;
      else if (extraHeaders[i]) extras[extraHeaders[i] as string] = val;
    }
    if (Object.keys(extras).length) p.extras = extras;
    if (p.title) products.push(p);
  }
  return products;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

export function FileImportCard({ embedded = false }: { embedded?: boolean } = {}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [structured, setStructured] = useState<ParsedProduct[] | null>(null);
  const [isSpreadsheet, setIsSpreadsheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [existingCount, setExistingCount] = useState(0);

  const loadCount = async () => {
    const { count } = await supabase
      .from("ai_knowledge")
      .select("id", { count: "exact", head: true })
      .in("type", ["file_product", "file_document"]);
    setExistingCount(count || 0);
  };
  useEffect(() => { loadCount(); }, []);

  const reset = () => {
    setFile(null);
    setStructured(null);
    setIsSpreadsheet(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (f: File) => {
    if (f.size > MAX_BYTES) {
      toast.error("File too large (max 20 MB)");
      return;
    }
    setFile(f);
    setResult(null);
    const isSheet = SPREADSHEET_EXT.test(f.name) || /sheet|excel|csv/i.test(f.type);
    setIsSpreadsheet(isSheet);
    if (isSheet) {
      try {
        let matrix: string[][];
        if (/\.csv$|\.tsv$/i.test(f.name) || f.type.includes("csv")) {
          matrix = parseCsv(await f.text());
        } else {
          const buf = await f.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: "", blankrows: false });
          matrix = rows.map((r) => (r ?? []).map((c) => (c == null ? "" : String(c))));
        }
        const products = extractRows(matrix);
        setStructured(products);
        if (products.length === 0) toast.error("No rows with a title were found. Click 'See required format'.");
      } catch (e: any) {
        toast.error(e?.message || "Could not read file");
        setStructured(null);
      }
    } else {
      setStructured(null);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      let payload: any;
      if (isSpreadsheet && structured) {
        if (structured.length === 0) { toast.error("Nothing to import"); setImporting(false); return; }
        payload = { mode: "structured", rows: structured, filename: file.name };
      } else {
        const base64 = await fileToBase64(file);
        payload = { mode: "unstructured", file_base64: base64, mime: file.type || "application/octet-stream", filename: file.name };
      }
      const { data, error } = await supabase.functions.invoke("import-knowledge-file", { headers: actingHeaders(), body: payload });
      if (error) throw error;
      setResult(data as ImportResult);
      toast.success(`Imported ${data.inserted} item${data.inserted === 1 ? "" : "s"}`);
      await loadCount();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const runClear = async () => {
    if (!confirm("Remove all file-imported knowledge? This cannot be undone.")) return;
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-knowledge-file", { headers: actingHeaders(), body: { mode: "clear" } });
      if (error) throw error;
      toast.success(`Cleared ${data.deleted} entries`);
      reset();
      await loadCount();
    } catch (e: any) {
      toast.error(e?.message || "Clear failed");
    } finally {
      setClearing(false);
    }
  };

  const Shell = embedded ? "div" : Card;
  const Body = embedded ? "div" : CardContent;

  return (
    <Shell {...(embedded ? {} : {})}>
      {!embedded && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import from file
          </CardTitle>
        </CardHeader>
      )}
      <Body className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Upload any file — spreadsheet, PDF, Word, image, screenshot, or audio. We'll extract the products and add them to your AI's knowledge.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setFormatOpen(true)}>
            <Info className="h-4 w-4 mr-1" /> See required format
          </Button>
          <Button size="sm" variant="outline" onClick={downloadCsvTemplate}>
            <Download className="h-4 w-4 mr-1" /> Download CSV template
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <FileUp className="h-4 w-4 mr-1" /> Choose file
          </Button>
          {existingCount > 0 && (
            <Button size="sm" variant="outline" onClick={runClear} disabled={clearing || importing} className="text-destructive hover:text-destructive">
              {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Clear file imports
            </Button>
          )}
        </div>

        {existingCount > 0 && (
          <p className="text-xs text-muted-foreground">{existingCount} file-imported entr{existingCount === 1 ? "y" : "ies"} in your knowledge base.</p>
        )}

        {file && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4" />
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground">· {(file.size / 1024).toFixed(1)} KB</span>
            </div>
            {isSpreadsheet && structured && (
              <>
                <div>{structured.length} product{structured.length === 1 ? "" : "s"} detected</div>
                {structured.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-0.5 text-muted-foreground">
                    {structured.slice(0, 5).map((p, i) => (
                      <div key={i} className="truncate">• {p.title}{p.price ? ` — $${p.price}` : ""}</div>
                    ))}
                    {structured.length > 5 && <div className="opacity-60">+ {structured.length - 5} more…</div>}
                  </div>
                )}
              </>
            )}
            {!isSpreadsheet && (
              <div className="text-muted-foreground">
                Will be read as free text on the server and our AI will extract products from it.
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={runImport}
                disabled={importing || (isSpreadsheet && (!structured || structured.length === 0))}
              >
                {importing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Importing…</> : (
                  isSpreadsheet && structured
                    ? `Import ${structured.length} product${structured.length === 1 ? "" : "s"}`
                    : "Import as knowledge"
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={importing}>Cancel</Button>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md border p-3 text-xs space-y-2 bg-muted/30">
            <p className="font-medium">Imported {result.inserted} entr{result.inserted === 1 ? "y" : "ies"} ({result.mode === "structured" ? "from spreadsheet" : "AI extraction"}).</p>
            {result.failed.length > 0 && (
              <>
                <p className="text-destructive font-medium">Couldn't import {result.failed.length} item(s):</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                  {result.failed.map((f, i) => (
                    <div key={i}>• "{f.item}" — {f.reason}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <FileImportFormatDialog open={formatOpen} onOpenChange={setFormatOpen} />
      </Body>
    </Shell>
  );
}
