import { useState } from "react";
import { useBills, type Bill } from "@/hooks/useBills";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, ChevronRight, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";
import { NewBillDialog } from "./NewBillDialog";
import { printInvoice } from "@/lib/printInvoice";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";

const COLUMNS: { key: Bill["status"]; label: string; tone: string }[] = [
  { key: "new", label: "New", tone: "border-emerald-500/40 bg-emerald-50/50" },
  { key: "in_kitchen", label: "In Kitchen", tone: "border-orange-500/40 bg-orange-50/50" },
  { key: "served", label: "Served", tone: "border-blue-500/40 bg-blue-50/50" },
  { key: "paid", label: "Paid", tone: "border-muted bg-muted/30" },
];

const NEXT: Partial<Record<Bill["status"], Bill["status"]>> = {
  new: "in_kitchen",
  in_kitchen: "served",
  served: "paid",
};

export function BillsBoard() {
  const { bills, createBill, updateStatus, removeBill, loading } = useBills();
  const { tables } = useRestaurantTables();
  const [open, setOpen] = useState(false);

  const doPrint = (b: Bill) => {
    const tableLabel = b.table_id ? tables.find((t) => t.id === b.table_id)?.label ?? null : null;
    printInvoice({ ...b, tableLabel });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 sm:p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Orders</h3>
          <p className="text-sm text-muted-foreground">Orders fire here from WhatsApp or staff — move through stages.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New order
        </Button>
      </div>


      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 min-h-full">
            {COLUMNS.map((col) => {
              const colBills = bills.filter((b) => b.status === col.key);
              return (
                <div key={col.key} className={`rounded-lg border-2 ${col.tone} p-2 flex flex-col`}>
                  <div className="flex items-center justify-between px-1 pb-2 sticky top-0">
                    <h4 className="font-semibold text-sm">{col.label}</h4>
                    <span className="text-xs text-muted-foreground">{colBills.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colBills.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Nothing here</p>
                    )}
                    {colBills.map((b) => (
                      <div key={b.id} className="rounded-md bg-card border p-2.5 shadow-sm space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold flex items-center gap-1 flex-wrap">
                            {b.customer_name || "Walk-in"}
                            {b.source === "ai" && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.5 text-[10px]">
                                <Sparkles className="h-2.5 w-2.5" /> AI
                              </span>
                            )}
                            {b.order_type && (
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] capitalize">
                                {b.order_type.replace("_", " ")}
                              </span>
                            )}
                            {b.payment_method && (
                              <span className="rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] uppercase">
                                {b.payment_method}
                              </span>
                            )}
                            {(b as any).needs_human && (
                              <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] uppercase" title={(b as any).handoff_reason || "handoff"}>
                                ⚠ Human
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground">{format(new Date(b.created_at), "HH:mm")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.customer_phone || "—"}
                        </div>
                        {b.delivery_address && (
                          <div className="text-xs text-muted-foreground italic">📍 {b.delivery_address}</div>
                        )}
                        <ul className="text-xs space-y-0.5">
                          {b.items.map((i) => (
                            <li key={i.id} className="flex justify-between">
                              <span>{i.qty}× {i.name}</span>
                              <span className="text-muted-foreground">{(i.qty * i.unit_price).toFixed(2)}</span>
                            </li>
                          ))}
                          {b.delivery_fee > 0 && (
                            <li className="flex justify-between text-muted-foreground">
                              <span>Delivery</span>
                              <span>{b.delivery_fee.toFixed(2)}</span>
                            </li>
                          )}
                        </ul>
                        <div className="flex items-center justify-between border-t pt-1.5">
                          <span className="text-sm font-semibold">{b.currency} {b.total.toFixed(2)}</span>
                          <div className="flex gap-1">
                            {NEXT[b.status] && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateStatus(b.id, NEXT[b.status]!)}>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Print invoice" onClick={() => doPrint(b)}>
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { if (confirm("Delete bill?")) removeBill(b.id); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewBillDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={async (p) => {
          const bill: any = await createBill(p);
          const subtotal = p.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
          printInvoice({
            id: bill?.id ?? "",
            created_at: bill?.created_at ?? new Date().toISOString(),
            customer_name: p.customer_name,
            customer_phone: p.customer_phone,
            order_type: p.order_type ?? null,
            payment_method: p.payment_method ?? null,
            delivery_address: p.delivery_address ?? null,
            delivery_fee: p.delivery_fee ?? 0,
            currency: p.currency,
            total: subtotal + (p.order_type === "delivery" ? p.delivery_fee ?? 0 : 0),
            notes: p.notes ?? null,
            items: p.items,
            tableLabel: p.table_id ? tables.find((t) => t.id === p.table_id)?.label ?? null : null,
          });
          return bill;
        }}
      />
    </div>
  );
}
