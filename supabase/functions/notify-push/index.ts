// notify-push — sends an Expo push notification when:
//   • a new INCOMING WhatsApp message arrives  (messages INSERT)
//   • a contact is escalated to a human         (contacts UPDATE: needs_human false -> true)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: string;
  priority: "high";
  data: Record<string, unknown>;
};

type Alert = {
  tenantId: string | null;
  title: string;
  body: string;
  channelId: "messages" | "escalations";
  contactId: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function preview(text: string | null | undefined, mediaType: string | null | undefined): string {
  if (mediaType?.startsWith("image")) return "📷 Photo";
  if (mediaType?.startsWith("audio")) return "🎤 Voice message";
  if (mediaType?.startsWith("video")) return "🎥 Video";
  const t = (text ?? "").trim();
  if (!t) return "New message";
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

async function getContact(contactId: string): Promise<{ tenantId: string | null; name: string } | null> {
  const { data, error } = await admin
    .from("contacts")
    .select("id,name,phone_number,tenant_id")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    console.error("[notify-push] contact lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  const name = (data.name && String(data.name).trim()) || data.phone_number || "New contact";
  return { tenantId: data.tenant_id ?? null, name };
}

async function buildAlert(payload: any): Promise<Alert | null> {
  const table = payload?.table;
  const record = payload?.record ?? {};
  const oldRecord = payload?.old_record ?? {};

  if (table === "messages") {
    if (record.direction !== "incoming") return null;
    const contactId = record.contact_id;
    if (!contactId) return null;
    const contact = await getContact(contactId);
    if (!contact) return null;
    return {
      tenantId: record.tenant_id ?? contact.tenantId,
      title: contact.name,
      body: preview(record.content, record.media_type),
      channelId: "messages",
      contactId,
    };
  }

  if (table === "contacts") {
    const becameEscalated = record.needs_human === true && oldRecord.needs_human !== true;
    if (!becameEscalated) return null;
    const contactId = record.id;
    if (!contactId) return null;
    const name = (record.name && String(record.name).trim()) || record.phone_number || "A contact";
    return {
      tenantId: record.tenant_id ?? null,
      title: "🙋 Needs a human",
      body: `${name} was escalated — tap to take over`,
      channelId: "escalations",
      contactId,
    };
  }

  return null;
}

async function tokensForTenant(tenantId: string | null): Promise<string[]> {
  let query = admin.from("push_tokens").select("token,tenant_id");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) {
    console.error("[notify-push] token lookup failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r: any) => r.token as string)
    .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"));
}

async function sendExpo(messages: ExpoMessage[]): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[notify-push] Expo error", res.status, out);
        errors += chunk.length;
        continue;
      }
      sent += chunk.length;
    } catch (e) {
      console.error("[notify-push] Expo request failed:", e);
      errors += chunk.length;
    }
  }
  return { sent, errors };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("NOTIFY_PUSH_SECRET");
  if (secret && req.headers.get("x-notify-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const alert = await buildAlert(payload);
  if (!alert) return json({ skipped: true, reason: "no notification needed" });

  const tokens = await tokensForTenant(alert.tenantId);
  if (tokens.length === 0) {
    return json({ skipped: true, reason: "no push tokens for tenant", tenantId: alert.tenantId });
  }

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    title: alert.title,
    body: alert.body,
    sound: "default",
    channelId: alert.channelId,
    priority: "high",
    data: { contactId: alert.contactId, kind: alert.channelId },
  }));

  const result = await sendExpo(messages);
  console.log(`[notify-push] ${alert.channelId} -> ${result.sent} sent, ${result.errors} errors`);
  return json({ ok: true, ...result, recipients: tokens.length });
});
