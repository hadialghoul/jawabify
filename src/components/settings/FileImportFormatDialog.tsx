import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const FIELDS: Array<{ field: string; required: boolean; aliases: string[] }> = [
  { field: "Title", required: true, aliases: ["title", "name", "product", "product name"] },
  { field: "Price", required: false, aliases: ["price", "cost", "amount"] },
  { field: "Description", required: false, aliases: ["description", "desc", "details", "body"] },
  { field: "SKU / ID", required: false, aliases: ["sku", "id", "product id"] },
  { field: "Category", required: false, aliases: ["category", "type", "collection"] },
  { field: "Tags", required: false, aliases: ["tags"] },
  { field: "Image URL", required: false, aliases: ["image", "image url", "photo"] },
];

const EXAMPLE = [
  ["Title", "Price", "Description", "Category", "Tags"],
  ["Bunny Projector", "39", "Rechargeable star projector, 8 colors", "Kids", "gift, night light"],
  ["Flat Book Light", "24.99", "Foldable USB-C reading light", "Reading", "usb-c, warm light"],
];

export function downloadCsvTemplate() {
  const rows = [
    ["title", "price", "description", "sku", "category", "tags", "image url"],
    ["Bunny Projector", "39", "Rechargeable star projector, 8 colors", "BUN-01", "Kids", "gift,night light", "https://example.com/bunny.jpg"],
    ["Flat Book Light", "24.99", "Foldable USB-C reading light", "FBL-02", "Reading", "usb-c,warm light", ""],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function FileImportFormatDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Required file format</DialogTitle>
          <DialogDescription>
            Spreadsheets (CSV / Excel) get parsed row by row. Any other file type (PDF, Word, image, audio) is read as free text and our AI pulls products out of it — no format required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold mb-2">Recommended columns for spreadsheets</h4>
            <div className="rounded-md border divide-y">
              {FIELDS.map((f) => (
                <div key={f.field} className="p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.field}</span>
                    <Badge variant={f.required ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {f.required ? "required" : "optional"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Accepted headers:</span>
                    {f.aliases.map((a) => (
                      <code key={a} className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{a}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Example</h4>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {EXAMPLE[0].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE.slice(1).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((c, j) => (
                        <td key={j} className="px-3 py-2">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Header names are case-insensitive. Extra columns are kept and appended to the product's description. Rows without a title are skipped.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={downloadCsvTemplate}>
            <Download className="h-4 w-4 mr-1" /> Download CSV template
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
