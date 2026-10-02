// Google Calendar REST helpers shared by the google-calendar edge function and
// any booking flow that wants to push confirmed bookings to a tenant's calendar.
// Plain fetch calls only (no googleapis dependency) — matches the rest of this repo.
import { decryptSecret, encryptSecret } from "./googleCrypto.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

type AdminClient = { from: (table: string) => any };

function creds() {
  const client_id = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const client_secret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirect_uri = Deno.env.get("GOOGLE_REDIRECT_URI")!;
  return { client_id, client_secret, redirect_uri };
}

export function buildAuthUrl(state: string): string {
  const { client_id, redirect_uri } = creds();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", client_id);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline"); // required to get a refresh_token
  url.searchParams.set("prompt", "consent"); // ensures refresh_token on reconnect
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string }> {
  const { client_id, client_secret, redirect_uri } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return res.json();
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

export async function saveConnection(
  admin: AdminClient,
  tenantId: string,
  refreshToken: string,
  googleEmail: string | null,
) {
  const encrypted = await encryptSecret(refreshToken);
  return admin.from("tenant_credentials").upsert(
    {
      tenant_id: tenantId,
      provider: "google_calendar",
      refresh_token_encrypted: encrypted,
      google_email: googleEmail,
      is_active: true,
    },
    { onConflict: "tenant_id,provider" },
  );
}

// Returns null when there's no connection, or when the refresh token was revoked (caller shows "reconnect").
export async function getAccessToken(admin: AdminClient, tenantId: string): Promise<string | null> {
  const { data: cred } = await admin
    .from("tenant_credentials")
    .select("refresh_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .eq("is_active", true)
    .maybeSingle();
  if (!cred?.refresh_token_encrypted) return null;

  const { client_id, client_secret } = creds();
  const refreshToken = await decryptSecret(cred.refresh_token_encrypted);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (res.status === 400 || res.status === 401) return null; // revoked -> reconnect needed
  if (!res.ok) throw new Error(`token refresh failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

// Probes with the granted scope; calendarList.list would 403 under calendar.events.
export async function probeConnected(accessToken: string): Promise<boolean> {
  const res = await fetch(`${EVENTS_URL}?maxResults=1`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.ok;
}

export async function revokeAndClear(admin: AdminClient, tenantId: string) {
  const { data: cred } = await admin
    .from("tenant_credentials")
    .select("refresh_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  if (cred?.refresh_token_encrypted) {
    try {
      const refreshToken = await decryptSecret(cred.refresh_token_encrypted);
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch (e) {
      console.error("Google token revoke failed (continuing to clear locally):", String(e));
    }
  }

  return admin
    .from("tenant_credentials")
    .update({ is_active: false, refresh_token_encrypted: null })
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar");
}

export interface CalendarBooking {
  serviceName: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: string;
  durationMin: number;
  notes?: string | null;
  timeZone?: string;
}

// Fire-and-forget: a calendar failure must never fail the booking it's called from.
export async function pushBookingToGoogleCalendar(admin: AdminClient, tenantId: string, booking: CalendarBooking) {
  try {
    const accessToken = await getAccessToken(admin, tenantId);
    if (!accessToken) return; // not connected, or needs reconnect

    const start = new Date(booking.scheduledAt);
    const end = new Date(start.getTime() + booking.durationMin * 60_000);
    const tz = booking.timeZone ?? "Asia/Beirut";

    const res = await fetch(EVENTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${booking.serviceName} — ${booking.customerName}`,
        description: `Customer: ${booking.customerName}\nPhone: ${booking.customerPhone}` +
          (booking.notes ? `\nNotes: ${booking.notes}` : ""),
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
      }),
    });
    if (!res.ok) console.error(`calendar push failed [${res.status}]: ${await res.text()}`);
  } catch (e) {
    console.error("calendar push error", e); // never rethrow — booking must still succeed
  }
}
