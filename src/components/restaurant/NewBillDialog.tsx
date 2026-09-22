import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMenu } from "@/hooks/useMenu";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";
import { useDefaultDeliveryFee } from "@/hooks/useDefaultDeliveryFee";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BillItem } from "@/hooks/useBills";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (params: {
    table_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    items: BillItem[];
    currency: string;
    notes?: string;
    order_type?: "dine_in" | "pickup" | "delivery";
    delivery_fee?: number;
    delivery_address?: string | null;
    payment_method?: "cod" | "link" | null;
  }) => Promise<any>;
  initial?: { customer_name?: string; customer_phone?: string };
}

export function NewBillDialog({ open, onOpenChange, onCreate, initial }: Props) {
  const { items: menu } = useMenu();
  const { tables } = useRestaurantTables();
  const { defaultFee } = useDefaultDeliveryFee();
  const [orderType, setOrderType] = useState<"dine_in" | "pickup" | "delivery">("dine_in");
  const [tableId, setTableId] = useState<string>("__none__");
  const [name, setName] = useState(initial?.customer_name ?? "");
  const [phone, setPhone] = useState(initial?.customer_phone ?? "");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "link">("cod");
  const [items, setItems] = useState<BillItem[]>([]);
  const [picker, setPicker] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const currency = menu[0]?.currency || "USD";
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const effectiveFee = orderType === "delivery" ? (parseFloat(deliveryFee) || defaultFee || 0) : 0;
  const total = subtotal + effectiveFee;

  const addFromMenu = (id: string) => {
    const m = menu.find((x) => x.id === id);
    if (!m) return;
    setItems((prev) => {
      const existing = prev.find((p) => p.menu_item_id === m.id);
      if (existing) return prev.map((p) => p.menu_item_id === m.id ? { ...p, qty: p.qty + 1 } : p);
      return [...prev, { menu_item_id: m.id, name: m.name, qty: 1, unit_price: m.price }];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New order</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Order type</Label>
            <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">Dine-in</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Customer name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {orderType === "dine_in" && (
            <div>
              <Label>Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No fixed table</SelectItem>
                  {tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {orderType === "delivery" && (
            <>
              <div>
                <Label>Delivery address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <Label>Delivery fee ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Default ${defaultFee.toFixed(2)}`}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>
            </>
          )}

          {(orderType === "delivery" || orderType === "pickup") && (
            <div>
              <Label>Payment</Label>
              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">Cash on delivery</SelectItem>
                  <SelectItem value="link">Payment link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Add menu item</Label>
            <div className="flex gap-2">
              <Select value={picker} onValueChange={(v) => { addFromMenu(v); setPicker(""); }}>
                <SelectTrigger><SelectValue placeholder="Pick from menu" /></SelectTrigger>
                <SelectContent>
                  {menu.filter((m) => m.is_available).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — {m.currency} {m.price.toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setItems([...items, { name: "Custom", qty: 1, unit_price: 0 }])}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {items.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">No items yet</p>}
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2">
                <Input className="flex-1 h-8" value={it.name} onChange={(e) => setItems(items.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))} />
                <Input className="w-14 h-8" type="number" min={1} value={it.qty} onChange={(e) => setItems(items.map((p, i) => i === idx ? { ...p, qty: parseInt(e.target.value) || 1 } : p))} />
                <Input className="w-20 h-8" type="number" step="0.01" value={it.unit_price} onChange={(e) => setItems(items.map((p, i) => i === idx ? { ...p, unit_price: parseFloat(e.target.value) || 0 } : p))} />
                <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            {orderType === "delivery" && (
              <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{currency} {effectiveFee.toFixed(2)}</span></div>
            )}
            <div className="flex items-center justify-between font-semibold pt-1 text-base">
              <span>Total</span><span>{currency} {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (items.length === 0) return toast.error("Add at least one item");
              if (orderType === "delivery" && !address.trim()) return toast.error("Delivery address required");
              setSaving(true);
              try {
                await onCreate({
                  table_id: orderType === "dine_in" && tableId !== "__none__" ? tableId : null,
                  customer_name: name || null,
                  customer_phone: phone || null,
                  items,
                  currency,
                  order_type: orderType,
                  delivery_fee: orderType === "delivery" ? effectiveFee : 0,
                  delivery_address: orderType === "delivery" ? address : null,
                  payment_method: orderType === "dine_in" ? null : paymentMethod,
                });
                toast.success("Order sent to kitchen");
                onOpenChange(false);
                setItems([]);
                setName("");
                setPhone("");
                setAddress("");
                setDeliveryFee("");
              } catch (e: any) { toast.error(e?.message || "Failed"); }
              finally { setSaving(false); }
            }}
          >Send order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
