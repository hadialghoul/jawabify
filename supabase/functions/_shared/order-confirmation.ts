// Sends the tenant's WhatsApp "order confirmation" utility template for a new
// Shopify order and mirrors it into the chat thread.
// Used by both shopify-webhook (instant) and shopify-auto-sync (fallback when
// Shopify webhook deliveries fail HMAC verification or never arrive).

export async function sendOrderConfirmation(
  supabase: any,
  tenantId: string,
  args: { phone: string; name: string; orderNumber: string; total: string },
): Promise<{ sent: boolean; reason?: string }> {
  if (!args.phone) return { sent: false, reason: "no_phone" };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("order_confirmation_template_name, order_confirmation_template_language")
    .eq("id", tenantId)
    .maybeSingle();

  const templateName =
    tenant?.order_confirmation_template_name ||
    Deno.env.get("ORDER_CONFIRMATION_TEMPLATE_NAME") ||
    "order_confirmation";
  const language =
    tenant?.order_confirmation_template_language ||
    Deno.env.get("ORDER_CONFIRMATION_TEMPLATE_LANGUAGE") ||
    "en_US";

  const { data: credRow } = await supabase
    .from("tenant_credentials")
    .select("phone_number_id, access_token, waba_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "whatsapp_cloud")
    .eq("is_active", true)
    .maybeSingle();

  const phoneNumberId =
    credRow?.phone_number_id && credRow.phone_number_id !== "FROM_ENV"
      ? credRow.phone_number_id
      : Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken =
    credRow?.access_token && credRow.access_token !== "FROM_ENV"
      ? credRow.access_token
      : Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId || !accessToken) {
    console.warn("WhatsApp credentials missing for tenant", tenantId);
    return { sent: false, reason: "no_whatsapp_credentials" };
  }

  const cleaned = args.phone.replace("whatsapp:", "").replace(/\D/g, "");
  if (cleaned.length < 8) return { sent: false, reason: "invalid_phone" };

  const params = [args.name, args.orderNumber, args.total].map((v) => ({
    type: "text",
    text: String(v || ""),
  }));

  // Meta rejects a template that is not approved in the requested language
  // (error 132001). Ask the WhatsApp Business account which languages of this
  // template are actually approved instead of brute-forcing one order at a time.
  const approved = await approvedLanguages(
    supabase,
    tenantId,
    credRow?.waba_id,
    accessToken,
    templateName,
  );
  if (approved && approved.length === 0) {
    return { sent: false, reason: "template_not_approved" };
  }

  const candidates = approved && approved.length > 0
    ? [...new Set([...(approved.includes(language) ? [language] : []), ...approved])]
    : [...new Set([language, "en", "en_US", "ar"])];
  let lastReason = "template_send_failed";


  for (const code of candidates) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleaned,
        type: "template",
        template: {
          name: templateName,
          language: { code },
          components: [{ type: "body", parameters: params }],
        },
      }),
    });
    const result = await res.json();

    if (res.ok) {
      if (code !== language) {
        await supabase
          .from("tenants")
          .update({ order_confirmation_template_language: code })
          .eq("id", tenantId);
      }
      return await recordThread(supabase, tenantId, cleaned, args, result);
    }

    lastReason = result?.error?.message || lastReason;
    const missingTranslation = result?.error?.code === 132001;
    console.error("WhatsApp template send failed", { templateName, language: code, result });
    if (!missingTranslation) break;
  }

  return { sent: false, reason: lastReason };
}

const CACHE_KEY = "order_confirmation_template_langs";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Approved language codes for this template on the tenant's WhatsApp Business
 * account. Returns [] when the template does not exist / is not approved, and
 * null when we cannot tell (no WABA id or Graph error) so the caller can still
 * try the historical fallbacks. Cached for six hours per tenant so a burst of
 * orders does not hammer Graph or fill the logs.
 */
async function approvedLanguages(
  supabase: any,
  tenantId: string,
  wabaId: string | null | undefined,
  accessToken: string,
  templateName: string,
): Promise<string[] | null> {
  if (!wabaId) return null;

  const { data: cacheRow } = await supabase
    .from("app_settings")
    .select("id, value, updated_at")
    .eq("tenant_id", tenantId)
    .eq("key", CACHE_KEY)
    .maybeSingle();

  const cached = cacheRow?.value as { template?: string; languages?: string[] } | null;
  const fresh = cacheRow?.updated_at &&
    Date.now() - new Date(cacheRow.updated_at).getTime() < CACHE_TTL_MS;
  if (fresh && cached?.template === templateName && Array.isArray(cached.languages)) {
    return cached.languages;
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,language,status&limit=200&name=${
      encodeURIComponent(templateName)
    }`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  if (!res.ok || !Array.isArray(data?.data)) {
    console.warn("Could not list WhatsApp templates", {
      tenantId,
      reason: data?.error?.message,
    });
    return null;
  }

  const languages = data.data
    .filter((t: any) => t?.name === templateName && t?.status === "APPROVED")
    .map((t: any) => String(t.language));

  if (languages.length === 0) {
    console.warn(
      `Order confirmations skipped: template "${templateName}" is not approved on this WhatsApp account`,
      { tenantId },
    );
  }

  const value = { template: templateName, languages };
  if (cacheRow?.id) {
    await supabase
      .from("app_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", cacheRow.id);
  } else {
    await supabase
      .from("app_settings")
      .insert({ tenant_id: tenantId, key: CACHE_KEY, value });
  }

  return languages;
}


async function recordThread(
  supabase: any,
  tenantId: string,
  cleaned: string,
  args: { name: string; orderNumber: string; total: string },
  result: any,
): Promise<{ sent: boolean; reason?: string }> {

  // Persist in chat thread if we have a matching contact
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone_number", cleaned)
    .maybeSingle();
  if (contact?.id) {
    await supabase.from("messages").insert({
      contact_id: contact.id,
      content: `Hi ${args.name}, your order #${args.orderNumber} has been received. Total: ${args.total}. We'll notify you when it ships.`,
      direction: "outgoing",
      status: "sent",
      twilio_sid: result.messages?.[0]?.id || null,
    });
  }

  return { sent: true };
}
