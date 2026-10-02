import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, openSystemBrowser, waitForSystemBrowserClosed } from "@/lib/mobileBridge";

const CONNECTOR_ID = "google_calendar";

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve();
        return;
      }
      popup.close();
      reject(new Error(event.data?.reason ?? "Google sign-in failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The sign-in window was closed before finishing."));
    }, 500);
  });
}

// Service flow: connect the business's own Google Calendar so confirmed
// bookings are added as calendar events automatically.
export function GoogleCalendarConnect() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "reconnect">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("google-calendar-status", {
      body: { action: "status" },
    });
    if (error || !data) {
      setStatus("disconnected");
      return;
    }
    setStatus(data.connected ? "connected" : data.reconnectRequired ? "reconnect" : "disconnected");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConnect = async () => {
    setBusy(true);
    setNote(null);
    let popup: Window | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authorizationUrl) throw new Error("Could not start Google sign-in.");

      // Native: OAuth must run in the system browser (store / cookie rules).
      // Completion is server-side via nonce, so we just refresh after the browser closes.
      if (isNativeApp()) {
        const closed = waitForSystemBrowserClosed();
        await openSystemBrowser(data.authorizationUrl);
        await closed;
        await refresh();
        setNote("If you finished Google sign-in, your calendar is connected.");
        return;
      }

      popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup) {
        setNote("Popup blocked. Allow popups and try again.");
        return;
      }
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = data.authorizationUrl;
      await completion;
      await refresh();
      setNote("Connected to Google Calendar — new bookings will appear there.");
    } catch (e) {
      popup?.close();
      setNote(e instanceof Error ? e.message : "Could not connect Google Calendar.");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setNote(null);
    try {
      await supabase.functions.invoke("google-calendar-status", { body: { action: "disconnect" } });
      setStatus("disconnected");
      setNote("Google Calendar disconnected.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Google Calendar</CardTitle>
        <CardDescription>
          Confirmed bookings are added to your Google Calendar automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">Checking connection…</p>
        ) : status === "connected" ? (
          <>
            <p className="text-sm">Connected — new bookings sync to your calendar.</p>
            <Button variant="outline" disabled={busy} onClick={onDisconnect}>Disconnect</Button>
          </>
        ) : (
          <>
            {status === "reconnect" && (
              <p className="text-sm">Your Google access needs to be renewed.</p>
            )}
            <Button disabled={busy} onClick={onConnect}>
              {busy ? "Connecting…" : status === "reconnect" ? "Reconnect Google Calendar" : "Connect Google Calendar"}
            </Button>
          </>
        )}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
