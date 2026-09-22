// Meta Conversions API (server-side) helper for the WhatsApp order flow.
// Requires META_PIXEL_ID and META_CAPI_TOKEN env vars to be set.

const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "";
const META_CAPI_TOKEN = Deno.env.get("META_CAPI_TOKEN") || "";

export async function sendMetaEvent(
  eventName: string,
  eventTime: number,
  userData: { phone?: string; email?: string; fbp?: string; fbc?: string },
  customData?: Record<string, any>,
) {
  if (!META_PIXEL_ID || !META_CAPI_TOKEN) return;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        action_source: "other",
        user_data: {
          ...(userData.phone ? { ph: [await hashPhone(userData.phone)] } : {}),
          ...(userData.email ? { em: [await hashEmail(userData.email)] } : {}),
          ...(userData.fbp ? { fbp: [userData.fbp] } : {}),
          ...(userData.fbc ? { fbc: [userData.fbc] } : {}),
        },
        custom_data: customData || {},
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error("Meta CAPI error:", eventName, res.status, await res.text());
    }
  } catch (err) {
    console.error("Meta CAPI network error:", eventName, err);
  }
}

async function hashPhone(phone: string): Promise<string> {
  const normalized = phone.replace(/\D/g, "");
  return sha256(normalized);
}

async function hashEmail(email: string): Promise<string> {
  return sha256(email.toLowerCase().trim());
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
