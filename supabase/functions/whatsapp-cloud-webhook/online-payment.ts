// Tenant-configured online payment link (Settings → Online payments).
// Stateless: the amount travels inside the button id, so any vertical can ask
// "How would you like to pay?" after an order/booking and the router answers.

export interface PayCtx {
  supabase: any;
  tenantId: string;
  contactId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
}

const asBool = (v: any) => v === true || v === "true";
const asText = (v: any) => (typeof v === "string" ? v.replace(/^"|"$/g, "").trim() : v ? String(v) : "");

/** Returns the payment link only when the tenant switched online payments on. */
export async function getOnlinePaymentLink(supabase: any, tenantId: string | null | undefined): Promise<string | null> {
  if (!tenantId) return null;
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", ["online_payments_enabled", "online_payment_link"]);
  const pick = (k: string) => (data || []).find((r: any) => r.key === k)?.value;
  if (!asBool(pick("online_payments_enabled"))) return null;
  const link = asText(pick("online_payment_link"));
  return /^https?:\/\//i.test(link) ? link : null;
}

async function logOut(ctx: PayCtx, content: string) {
  await ctx.supabase.from("messages").insert({ contact_id: ctx.contactId, content, direction: "outgoing", status: "sent" });
}

async function sendText(ctx: PayCtx, body: string) {
  await fetch(`https://graph.facebook.com/v21.0/${ctx.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: ctx.phoneNumber, type: "text", text: { body } }),
  });
  await logOut(ctx, body);
}

const fmt = (amount: number, currency: string) => `${currency === "USD" ? "$" : currency + " "}${amount.toFixed(2)}`;

/** Ask the customer how they want to pay. No-op when online payments are off. */
export async function askPaymentMethod(
  ctx: PayCtx,
  opts: { total?: number | null; currency?: string; ref?: string | number | null; lang?: "ar" | "en"; inPersonLabel?: string },
): Promise<boolean> {
  const link = await getOnlinePaymentLink(ctx.supabase, ctx.tenantId);
  if (!link) return false;
  const ar = opts.lang === "ar";
  const amt = Number(opts.total) > 0 ? Number(opts.total).toFixed(2) : "";
  const cur = (opts.currency || "USD").replace(/[^A-Za-z]/g, "").slice(0, 3) || "USD";
  const ref = String(opts.ref ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const suffix = `|${amt}|${cur}|${ref}|${ar ? "ar" : "en"}`;
  const body = ar ? "كيف بتحب تدفع؟" : "How would you like to pay?";
  const buttons = [
    { id: `pay_online${suffix}`, title: ar ? "الدفع أونلاين" : "Pay online" },
    { id: `pay_cash${suffix}`, title: opts.inPersonLabel || (ar ? "الدفع عند الاستلام" : "Cash on delivery") },
  ];
  const res = await fetch(`https://graph.facebook.com/v21.0/${ctx.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: ctx.phoneNumber, type: "interactive",
      interactive: { type: "button", body: { text: body }, action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
    }),
  });
  if (!res.ok) {
    // Buttons failed — just send the link so the customer can still pay.
    await sendText(ctx, (ar ? "تقدر تدفع أونلاين هون: " : "You can pay online here: ") + link);
    return true;
  }
  await logOut(ctx, `${body}\n• ${buttons.map((b) => b.title).join("\n• ")}`);
  return true;
}

/** Handles a tap on the payment buttons. Returns true when it consumed the reply. */
export async function handlePaymentReply(ctx: PayCtx, replyId: string | null | undefined): Promise<boolean> {
  if (!replyId || !(replyId.startsWith("pay_online|") || replyId.startsWith("pay_cash|"))) return false;
  const [kind, amt, cur, ref, lang] = replyId.split("|");
  const ar = lang === "ar";
  const refTxt = ref ? ` #${ref}` : "";
  if (kind === "pay_cash") {
    await sendText(ctx, ar ? "تمام، الدفع عند الاستلام 👍" : "Great, you'll pay on delivery/in person 👍");
    return true;
  }
  const link = await getOnlinePaymentLink(ctx.supabase, ctx.tenantId);
  if (!link) {
    await sendText(ctx, ar ? "الدفع أونلاين مش متوفر حالياً، فيك تدفع عند الاستلام." : "Online payment isn't available right now — you can pay on delivery/in person.");
    return true;
  }
  const amount = Number(amt);
  const amtTxt = amount > 0 ? (ar ? ` المبلغ: ${fmt(amount, cur || "USD")}.` : ` Amount: ${fmt(amount, cur || "USD")}.`) : "";
  await sendText(
    ctx,
    ar
      ? `ادفع${refTxt ? ` للطلب${refTxt}` : ""} من هون: ${link}${amtTxt}`
      : `Pay${refTxt ? ` for order${refTxt}` : ""} here: ${link}${amtTxt}`,
  );
  return true;
}

/** Prompt addon for AI-driven verticals (bookings) when online payments are on. */
export function onlinePaymentPrompt(link: string | null): string {
  if (!link) return "";
  return `\n\nONLINE PAYMENTS: This business accepts online payment. After a booking/order is confirmed, ask whether the customer prefers to pay online or in person. If online, share exactly this link: ${link} (with the amount if known). Never invent other payment links.`;
}
