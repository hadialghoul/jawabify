import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Minus, Trash2, Truck, ShoppingBag, UtensilsCrossed, Search } from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";
import { useDefaultDeliveryFee } from "@/hooks/useDefaultDeliveryFee";

type OrderType = "delivery" | "pickup" | "dine_in";

interface LineItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  custom: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder: (order: {
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    productName: string;
    quantity: number;
    deliveryFee: number;
  }) => void;
  initialData?: { customerName?: string; customerPhone?: string };
}

export function RestaurantNewOrderDialog({ open, onOpenChange, onCreateOrder, initialData }: Props) {
  const { categories, items } = useMenu();
  const { tables } = useRestaurantTables();
  const { defaultFee, saveDefault } = useDefaultDeliveryFee();

  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [customerName, setCustomerName] = useState(initialData?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customerPhone || "");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [tableId, setTableId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill delivery fee from saved default when dialog opens or default loads
  useEffect(() => {
    if (open && orderType === "delivery") {
      setDeliveryFee(String(defaultFee));
    }
  }, [open, defaultFee, orderType]);

  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const totalAmount = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);

  const reset = () => {
    setOrderType("delivery");
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setTableId("");
    setNotes("");
    setLines([]);
    setCustomName("");
    setCustomPrice("");
  };

  const addMenuItem = (itemId: string) => {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.id === it.id);
      if (existing) return prev.map((l) => (l.id === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id: it.id, name: it.name, qty: 1, price: it.price, custom: false }];
    });
    setPickerOpen(false);
  };

  const addCustomLine = () => {
    const n = customName.trim();
    if (!n) return;
    const p = parseFloat(customPrice);
    setLines((prev) => [...prev, { id: `custom-${Date.now()}`, name: n, qty: 1, price: isNaN(p) ? 0 : p, custom: true }]);
    setCustomName("");
    setCustomPrice("");
  };

  const changeQty = (id: string, delta: number) =>
    setLines((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  const updateLinePrice = (id: string, price: number) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, price } : l)));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const itemsRequired = orderType !== "dine_in";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;
    if (itemsRequired && lines.length === 0) return;
    if (orderType === "delivery" && !deliveryAddress.trim()) return;

    const productName = lines.length > 0
      ? lines.map((l) => `${l.qty}× ${l.name}`).join(", ")
      : "Dine-in (no items yet)";
    let addressLine = "";
    if (orderType === "delivery") addressLine = `Delivery · ${deliveryAddress.trim()}`;
    else if (orderType === "pickup") addressLine = "Pickup";
    else {
      const t = tables.find((x) => x.id === tableId);
      addressLine = t ? `Dine-in · Table ${t.label}` : "Dine-in";
    }
    if (totalAmount > 0) addressLine += `\nTotal: $${totalAmount.toFixed(2)}`;
    if (notes.trim()) addressLine += `\nNotes: ${notes.trim()}`;

    const parsedFee = parseFloat(deliveryFee);
    const finalFee = orderType === "delivery" ? (isNaN(parsedFee) ? defaultFee : parsedFee) : 0;

    setIsSubmitting(true);
    await onCreateOrder({
      customerName: customerName.trim(),
      customerAddress: addressLine,
      customerPhone: customerPhone.trim(),
      productName,
      quantity: Math.max(1, totalQty),
      deliveryFee: finalFee,
    });
    setIsSubmitting(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Restaurant Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order type */}
          <div className="space-y-2">
            <Label>Order Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "delivery", label: "Delivery", icon: Truck },
                { v: "pickup", label: "Pickup", icon: ShoppingBag },
                { v: "dine_in", label: "Dine-in", icon: UtensilsCrossed },
              ] as const).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOrderType(v)}
                  className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                    orderType === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="cname">Customer Name</Label>
              <Input id="cname" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Phone</Label>
              <Input id="cphone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
            </div>
          </div>

          {orderType === "delivery" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="addr">Delivery Address</Label>
                <Textarea id="addr" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dfee">Delivery Fee</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                    disabled={isNaN(parseFloat(deliveryFee)) || parseFloat(deliveryFee) === defaultFee}
                    onClick={() => saveDefault(parseFloat(deliveryFee))}
                  >
                    Save as default
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="dfee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Default: ${defaultFee.toFixed(2)} · Pickup &amp; dine-in have no delivery fee.</p>
              </div>
            </>
          )}
          {orderType === "dine_in" && (
            <div className="space-y-1.5">
              <Label>Table</Label>
              <Select value={tableId || "__none__"} onValueChange={(v) => setTableId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No table assigned</SelectItem>
                  {tables.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No tables yet</div>}
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Table {t.label} · {t.seats} seats</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items {!itemsRequired && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}</Label>
              {totalAmount > 0 && <span className="text-xs font-medium">Total: ${totalAmount.toFixed(2)}</span>}
            </div>

            {/* Typeahead picker */}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start font-normal text-muted-foreground">
                  <Search className="mr-2 h-4 w-4" />
                  Type to search menu…
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Search items…" autoFocus />
                  <CommandList>
                    <CommandEmpty>No items found.</CommandEmpty>
                    {categories.map((cat) => {
                      const catItems = items.filter((i) => i.category_id === cat.id && i.is_available);
                      if (catItems.length === 0) return null;
                      return (
                        <CommandGroup key={cat.id} heading={cat.name}>
                          {catItems.map((it) => (
                            <CommandItem key={it.id} value={`${it.name} ${cat.name}`} onSelect={() => addMenuItem(it.id)}>
                              <span className="flex-1">{it.name}</span>
                              <span className="text-xs text-muted-foreground">${it.price.toFixed(2)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })}
                    {items.filter((i) => !i.category_id && i.is_available).length > 0 && (
                      <CommandGroup heading="Uncategorized">
                        {items.filter((i) => !i.category_id && i.is_available).map((it) => (
                          <CommandItem key={it.id} value={it.name} onSelect={() => addMenuItem(it.id)}>
                            <span className="flex-1">{it.name}</span>
                            <span className="text-xs text-muted-foreground">${it.price.toFixed(2)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Custom item with upcharge */}
            <div className="flex gap-2">
              <Input
                placeholder="Custom item (e.g. extra sauce)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomLine(); } }}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="$ +"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomLine(); } }}
                className="w-24"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCustomLine} disabled={!customName.trim()}>Add</Button>
            </div>

            {lines.length > 0 && (
              <div className="rounded-md border divide-y">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {l.name}
                        {l.custom && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">custom</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.price}
                        onChange={(e) => updateLinePrice(l.id, parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 px-1.5 text-xs"
                      />
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(l.id, -1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{l.qty}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(l.id, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Allergies, special requests…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || (itemsRequired && lines.length === 0)}>
              {isSubmitting ? "Creating…" : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
