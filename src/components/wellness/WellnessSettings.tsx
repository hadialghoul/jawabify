import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWellnessSettings } from "@/hooks/useWellness";

export function WellnessSettings() {
  const { settings, save, loading } = useWellnessSettings();
  const [tone, setTone] = useState<"calm"|"energetic"|"luxury">("calm");
  const [dur, setDur] = useState("60");
  const [rem1, setRem1] = useState("24");
  const [rem2, setRem2] = useState("2");
  const [fol, setFol] = useState("24");
  const [curr, setCurr] = useState("USD");
  const [calendly, setCalendly] = useState("");
  const [sheet, setSheet] = useState("");
  const [webhook, setWebhook] = useState("");
  const [pay, setPay] = useState("");
  const [human, setHuman] = useState("");

  useEffect(() => {
    if (!settings) return;
    setTone(settings.bot_tone || "calm");
    setDur(String(settings.session_duration_min ?? 60));
    setRem1(String(settings.reminder_hours_before ?? 24));
    setRem2(String(settings.second_reminder_hours_before ?? 2));
    setFol(String(settings.followup_hours_after ?? 24));
    setCurr(settings.currency || "USD");
    setCalendly(settings.calendly_url || "");
    setSheet(settings.google_sheet_url || "");
    setWebhook(settings.crm_webhook_url || "");
    setPay(settings.payment_link || "");
    setHuman(settings.human_transfer_phone || "");
  }, [settings]);

  if (loading || !settings) return <div className="p-4 text-sm text-muted-foreground">Loading wellness settings…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Wellness · Bot tone</CardTitle><CardDescription>How the AI should speak to your customers.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calm">Calm</SelectItem>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-w-[120px]"><Label>Currency</Label><Input value={curr} onChange={(e) => setCurr(e.target.value)} /></div>
          <Button onClick={() => save({ bot_tone: tone, currency: curr })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Wellness · Sessions & reminders</CardTitle><CardDescription>Default duration, 24h/2h reminders, post-session follow-up.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
            <div><Label>Duration (min)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
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

      <Card>
        <CardHeader><CardTitle>Wellness · Integrations</CardTitle><CardDescription>Optional booking links and CRM webhook.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Calendly URL</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." /></div>
          <div><Label>Google Sheet URL (services sync)</Label><Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/..." /></div>
          <div><Label>Payment link</Label><Input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="https://buy.stripe.com/..." /></div>
          <div><Label>CRM webhook URL</Label><Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://..." /></div>
          <Button onClick={() => save({ calendly_url: calendly || null, google_sheet_url: sheet || null, payment_link: pay || null, crm_webhook_url: webhook || null })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Wellness · Human handoff</CardTitle><CardDescription>Where to forward complaints, VIPs, off-topic requests.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Human transfer phone</Label><Input value={human} onChange={(e) => setHuman(e.target.value)} placeholder="+961..." /></div>
          <Button onClick={() => save({ human_transfer_phone: human || null })}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
