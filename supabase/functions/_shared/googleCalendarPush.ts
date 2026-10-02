// Pushes a confirmed booking to the tenant owner's Google Calendar.
// Fire-and-forget: booking flow must never fail because of calendar sync.
import { callAsAppUser, appUserReconnectRequired } from "./appUserConnector.ts";
import { getConnectionKeyForUser } from "./appUserConnections.ts";
import { GOOGLE_CALENDAR_SCOPES } from "./appUserScopes.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

interface BookingEvent {
  serviceName: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: string; // ISO
  durationMin: number;
  notes?: string | null;
}

export async function pushBookingToGoogleCalendar(
  supabaseAdmin: any,
  tenantId: string,
  booking: BookingEvent,
): Promise<void> {
  try {
    // Find the tenant owner (fallback: any member) and their stored connection key.
    const { data: members } = await supabaseAdmin
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId);
    if (!members?.length) return;
    const owner = members.find((m: any) => m.role === "owner") ?? members[0];

    const connectionAPIKey = await getConnectionKeyForUser(owner.user_id, CONNECTOR_ID);
    if (!connectionAPIKey) return; // calendar not connected — nothing to do

    const start = new Date(booking.scheduledAt);
    const end = new Date(start.getTime() + booking.durationMin * 60_000);
    const event = {
      summary: `${booking.serviceName} — ${booking.customerName}`,
      description:
        `Customer: ${booking.customerName}\nPhone: ${booking.customerPhone}` +
        (booking.notes ? `\nNotes: ${booking.notes}` : "") +
        `\n\nBooked via Jawabify`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary/events",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      },
      requiredScopes: GOOGLE_CALENDAR_SCOPES,
    });

    if (await appUserReconnectRequired(res)) {
      console.warn(`google_calendar push: reconnect required for user ${owner.user_id}`);
      return;
    }
    if (!res.ok) {
      console.error(`google_calendar push failed [${res.status}]: ${await res.text()}`);
    }
  } catch (e) {
    console.error("google_calendar push error", e);
  }
}
