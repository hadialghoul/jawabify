import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Landing route for the Google Calendar App User Connector OAuth popup.
// The gateway redirects here with ?success=true&code=... — we hand the code to
// the authenticated completion function, then signal the opener and close.
export default function GoogleCalendarReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      reason?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", reason },
        window.location.origin,
      );
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google sign-in did not complete.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        const reason =
          "This connection cannot be used yet: offline access must be enabled on the connector client.";
        setMessage(reason);
        window.opener?.postMessage(
          { type: "appUserConnectorOAuthFailed", connectorId: "google_calendar", reason },
          window.location.origin,
        );
        return;
      }
      setMessage("Google sign-in completed without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    void supabase.functions
      .invoke("google-calendar-oauth-complete", { body: { code } })
      .then(({ error }) => {
        if (error) throw error;
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
      })
      .catch(() => {
        setMessage("Could not finish the connection.");
        notifyOpenerAndClose("appUserConnectorOAuthFailed");
      });
  }, []);

  return <p className="p-6 text-sm text-muted-foreground">{message}</p>;
}
