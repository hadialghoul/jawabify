import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHCSettings } from "@/hooks/useHealthcare";

export function HealthcareSettings() {
  const { settings, save, loading } = useHCSettings();
  const [tone, setTone] = useState("professional");
  const [dur, setDur] = useState("30");
  const [rem, setRem] = useState("24");
  const [fol, setFol] = useState("48");
  const [labMsg, setLabMsg] = useState("");
  const [calendly, setCalendly] = useState("");
  const [gcal, setGcal] = useState("");
  const [sheet, setSheet] = useState("");
  const [labHook, setLabHook] = useState("");
  const [crmHook, setCrmHook] = useState("");
  const [pixel, setPixel] = useState("");
  const [human, setHuman] = useState("");

  useEffect(() => {
    if (!settings) return;
    setTone(settings.bot_tone || "professional");
    setDur(String(settings.appointment_duration_min ?? 30));
    setRem(String(settings.reminder_hours_before ?? 24));
    setFol(String(settings.followup_hours_after ?? 48));
    setLabMsg(settings.lab_message_template || "");
    setCalendly(settings.calendly_url || "");
    setGcal(settings.google_calendar_url || "");
    setSheet(settings.google_sheet_url || "");
    setLabHook(settings.lab_webhook_url || "");
    setCrmHook(settings.crm_webhook_url || "");
    setPixel(settings.meta_ads_pixel || "");
    setHuman(settings.human_transfer_phone || "");
  }, [settings]);

  if (loading || !settings) return <div className="p-4 text-sm text-muted-foreground">Loading healthcare settings…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Healthcare · Bot tone</CardTitle><CardDescription>How the AI should speak to patients.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => save({ bot_tone: tone })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Healthcare · Appointments & reminders</CardTitle><CardDescription>Default duration, reminder, and follow-up timings.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl">
            <div><Label>Duration (min)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
            <div><Label>Reminder (h before)</Label><Input type="number" value={rem} onChange={(e) => setRem(e.target.value)} /></div>
            <div><Label>Follow-up (h after)</Label><Input type="number" value={fol} onChange={(e) => setFol(e.target.value)} /></div>
          </div>
          <Button onClick={() => save({
            appointment_duration_min: parseInt(dur) || 30,
            reminder_hours_before: parseInt(rem) || 24,
            followup_hours_after: parseInt(fol) || 48,
          })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Healthcare · Lab result message</CardTitle><CardDescription>What the AI sends when a result is ready. Use {`{name}`} for the patient name.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={3} value={labMsg} onChange={(e) => setLabMsg(e.target.value)} />
          <Button onClick={() => save({ lab_message_template: labMsg })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Healthcare · Integrations</CardTitle><CardDescription>Booking, lab webhook, CRM, and Meta Ads pixel.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Calendly URL</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." /></div>
          <div><Label>Google Calendar URL</Label><Input value={gcal} onChange={(e) => setGcal(e.target.value)} placeholder="https://calendar.google.com/..." /></div>
          <div><Label>Google Sheet URL</Label><Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/..." /></div>
          <div><Label>Lab results webhook</Label><Input value={labHook} onChange={(e) => setLabHook(e.target.value)} placeholder="https://..." /></div>
          <div><Label>CRM webhook</Label><Input value={crmHook} onChange={(e) => setCrmHook(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Meta Ads pixel ID</Label><Input value={pixel} onChange={(e) => setPixel(e.target.value)} /></div>
          <Button onClick={() => save({
            calendly_url: calendly || null,
            google_calendar_url: gcal || null,
            google_sheet_url: sheet || null,
            lab_webhook_url: labHook || null,
            crm_webhook_url: crmHook || null,
            meta_ads_pixel: pixel || null,
          })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Healthcare · Human handoff</CardTitle><CardDescription>Doctor/nurse phone for urgent cases and escalations.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Human transfer phone</Label><Input value={human} onChange={(e) => setHuman(e.target.value)} placeholder="+961..." /></div>
          <Button onClick={() => save({ human_transfer_phone: human || null })}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
