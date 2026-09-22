import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileUp, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "LBP", "EUR", "GBP", "AED"];

interface PreviewRow {
  name: string;
  price: number;
  currency?: string;
  description?: string | null;
  category?: string | null;
}

export function MenuFileImportCard({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState("");

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) return toast.error("File too large (max 15 MB)");
    setBusy(true);
    setPreview(null);
    setFileName(file.name);
    try {
      const file_base64 = await toBase64(file);
      const { data, error } = await supabase.functions.invoke("import-menu-file", {
        body: { file_base64, mime: file.type, filename: file.name, currency, dry_run: true },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const rows = ((data as any)?.preview ?? []) as PreviewRow[];
      if (!rows.length) throw new Error("No menu items found in this file");
      setPreview(rows);
      toast.success(`Found ${rows.length} item${rows.length === 1 ? "" : "s"} — review and confirm`);
    } catch (e: any) {
      toast.error(e?.message || "Could not read this file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!preview?.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-menu-file", {
        body: { items: preview, currency },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const { inserted = 0, skipped = 0 } = (data as any) || {};
      toast.success(`Imported ${inserted} item${inserted === 1 ? "" : "s"}${skipped ? ` · ${skipped} already existed` : ""}`);
      setPreview(null);
      setFileName("");
      onImported?.();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="font-semibold mb-1">Import menu from file</h4>
      <p className="text-xs text-muted-foreground mb-3">
        Upload your menu as a PDF, photo, or text file. Items, prices and sections are read automatically and you confirm before anything is added.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Default currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-28 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileUp className="h-4 w-4 mr-1.5" />}
          {busy ? "Reading..." : "Choose file"}
        </Button>
        {fileName && !busy && <span className="text-xs text-muted-foreground">{fileName}</span>}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/*,text/plain"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {preview && (
        <div className="mt-4 space-y-3">
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {preview.map((r, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.category || "Uncategorized"}{r.description ? ` — ${r.description}` : ""}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-sm">{r.price.toFixed(2)} {r.currency || currency}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove"
                    onClick={() => setPreview(preview.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmImport} disabled={busy || preview.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Add {preview.length} item{preview.length === 1 ? "" : "s"} to menu
            </Button>
            <Button variant="ghost" onClick={() => { setPreview(null); setFileName(""); }} disabled={busy}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Items that already exist with the same name are skipped.</p>
        </div>
      )}
    </div>
  );
}
