import type { Bill, BillItem } from "@/hooks/useBills";

type PrintableBill = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type?: string | null;
  payment_method?: string | null;
  delivery_address?: string | null;
  delivery_fee?: number;
  currency: string;
  total: number;
  notes?: string | null;
  items: BillItem[];
  tableLabel?: string | null;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export function printInvoice(bill: PrintableBill, businessName = "Invoice") {
  const subtotal = bill.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const fee = Number(bill.delivery_fee ?? 0);
  const total = Number(bill.total ?? subtotal + fee);
  const cur = bill.currency || "USD";
  const when = new Date(bill.created_at || Date.now());
  const ref = bill.id ? bill.id.slice(0, 8).toUpperCase() : "—";

  const rows = bill.items
    .map(
      (i) => `<tr>
        <td>${esc(i.qty)}×</td>
        <td>${esc(i.name)}</td>
        <td class="r">${(i.qty * i.unit_price).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Order ${esc(ref)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; color: #111; width: 80mm; }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  .meta { font-size: 11px; text-align: center; color: #555; margin-bottom: 10px; }
  .block { font-size: 11px; margin-bottom: 8px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 3px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .sep { border-top: 1px dashed #999; margin: 8px 0; }
  .tot { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .tot.big { font-size: 15px; font-weight: 700; }
  .foot { text-align: center; font-size: 11px; color: #555; margin-top: 12px; }
  @media print { @page { margin: 4mm; } body { width: auto; padding: 0; } }
</style></head><body>
  <h1>${esc(businessName)}</h1>
  <div class="meta">Order #${esc(ref)}<br/>${esc(when.toLocaleString())}</div>
  <div class="block">
    <div><strong>${esc(bill.customer_name || "Walk-in")}</strong></div>
    ${bill.customer_phone ? `<div>${esc(bill.customer_phone)}</div>` : ""}
    ${bill.order_type ? `<div>Type: ${esc(String(bill.order_type).replace("_", " "))}</div>` : ""}
    ${bill.tableLabel ? `<div>Table: ${esc(bill.tableLabel)}</div>` : ""}
    ${bill.delivery_address ? `<div>Address: ${esc(bill.delivery_address)}</div>` : ""}
    ${bill.payment_method ? `<div>Payment: ${bill.payment_method === "cod" ? "Cash on delivery" : "Payment link"}</div>` : ""}
    ${bill.notes ? `<div>Notes: ${esc(bill.notes)}</div>` : ""}
  </div>
  <div class="sep"></div>
  <table>${rows}</table>
  <div class="sep"></div>
  <div class="tot"><span>Subtotal</span><span>${cur} ${subtotal.toFixed(2)}</span></div>
  ${fee > 0 ? `<div class="tot"><span>Delivery</span><span>${cur} ${fee.toFixed(2)}</span></div>` : ""}
  <div class="tot big"><span>Total</span><span>${cur} ${total.toFixed(2)}</span></div>
  <div class="foot">Thank you!</div>
  <script>window.onload = function(){ window.focus(); window.print(); setTimeout(function(){ window.close(); }, 500); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    frame.srcdoc = html;
    setTimeout(() => frame.remove(), 3000);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export type { Bill };
