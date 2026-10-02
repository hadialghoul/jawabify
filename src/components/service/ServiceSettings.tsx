import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWellnessSettings } from "@/hooks/useWellness";
import { GoogleCalendarConnect } from "./GoogleCalendarConnect";
import { LocationHoursCard } from "./LocationHoursCard";

// Settings for "Service Business" accounts (agencies, consultants, trainers, travel…).
// Stored in the same table as wellness settings, but worded around calls, meetings
// and appointments — no spa language, no staff, no session packages.
export function ServiceSettings() {
  const { settings, save, loading } = useWellnessSettings();
  const [tone, setTone] = useState<"calm" | "energetic" | "luxury">("calm");
  const [dur, setDur] = useState("60");
  const [rem1, setRem1] = useState("24");
  const [rem2, setRem2] = useState("2");
  const [fol, setFol] = useState("24");
  const [curr, setCurr] = useState("USD");
  const [calendly, setCalendly] = useState("");
  const [webhook, setWebhook] = useState("");
  const [pay, setPay] = useState("");
  const [human, setHuman] = useState("");

  useEffect(() => {
    if (!settings) return;
    setTone((settings.bot_tone as any) || "calm");
    setDur(String(settings.session_duration_min ?? 60));
    setRem1(String(settings.reminder_hours_before ?? 24));
    setRem2(String(settings.second_reminder_hours_before ?? 2));
    setFol(String(settings.followup_hours_after ?? 24));
    setCurr(settings.currency || "USD");
    setCalendly(settings.calendly_url || "");
    setWebhook(settings.crm_webhook_url || "");
    setPay(settings.payment_link || "");
    setHuman(settings.human_transfer_phone || "");
  }, [settings]);

  if (loading || !settings) return <div className="p-4 text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">How the AI speaks</CardTitle>
          <CardDescription>The tone your assistant uses with clients.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calm">Professional</SelectItem>
                <SelectItem value="energetic">Friendly</SelectItem>
                <SelectItem value="luxury">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-w-[120px]"><Label>Currency</Label><Input value={curr} onChange={(e) => setCurr(e.target.value)} /></div>
          <Button onClick={() => save({ bot_tone: tone, currency: curr })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Bookings &amp; reminders</CardTitle>
          <CardDescription>Default length of a call or meeting, and when clients get reminded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
            <div><Label>Length (min)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
            <div><Label>1st reminder (h)</Label><Input type="number" value={rem1} onChange={(e) => setRem1(e.target.value)} /></div>
            <div><Label>2nd reminder (h)</Label><Input type="number" value={rem2} onChange={(e) => setRem2(e.target.value)} /></div>
            <div><Label>Follow-up (h after)</Label><Input type="number" value={fol} onChange={(e) => setFol(e.target.value)} /></div>
          </div>
          <Button onClick={() => save({
            session_duration_min: parseInt(dur) || 60,
            reminder_hours_before: parseInt(rem1) || 24,
            second_reminder_hours_before: parseInt(rem2) || 2,
            followup_hours_after: parseInt(fol) || 24,
          })}>Save</Button>
        </CardContent>
      </Card>

      <LocationHoursCard settings={settings} save={save as any} />

      <GoogleCalendarConnect />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Booking &amp; payment links</CardTitle>
          <CardDescription>Optional links the AI can share, plus a CRM webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Booking link (Calendly)</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." /></div>
          <div><Label>Payment link</Label><Input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="https://buy.stripe.com/..." /></div>
          <div><Label>CRM webhook URL</Label><Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://..." /></div>
          <Button onClick={() => save({ calendly_url: calendly || null, payment_link: pay || null, crm_webhook_url: webhook || null })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Human handoff</CardTitle>
          <CardDescription>Where to forward complaints, VIPs and anything the AI can't answer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Phone number</Label><Input value={human} onChange={(e) => setHuman(e.target.value)} placeholder="+961..." /></div>
          <Button onClick={() => save({ human_transfer_phone: human || null })}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
