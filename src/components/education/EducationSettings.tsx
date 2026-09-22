import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEduSettings } from "@/hooks/useEducation";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function EducationSettings() {
  const { settings, save, loading } = useEduSettings();
  const [tone, setTone] = useState("friendly");
  const [langs, setLangs] = useState<string[]>(["en","ar","fr"]);
  const [remH, setRemH] = useState("1");
  const [dayBefore, setDayBefore] = useState(true);
  const [pday, setPday] = useState("5");
  const [pmsg, setPmsg] = useState("");
  const [trialMin, setTrialMin] = useState("30");
  const [enrollMsg, setEnrollMsg] = useState("");
  const [calendly, setCalendly] = useState("");
  const [gcal, setGcal] = useState("");
  const [sheet, setSheet] = useState("");
  const [payTpl, setPayTpl] = useState("");
  const [crmHook, setCrmHook] = useState("");
  const [pixel, setPixel] = useState("");
  const [human, setHuman] = useState("");

  useEffect(() => {
    if (!settings) return;
    setTone(settings.bot_tone || "friendly");
    setLangs(settings.languages || ["en","ar","fr"]);
    setRemH(String(settings.reminder_hours_before ?? 1));
    setDayBefore(!!settings.day_before_reminder);
    setPday(String(settings.progress_day_of_week ?? 5));
    setPmsg(settings.progress_message_template || "");
    setTrialMin(String(settings.trial_class_minutes ?? 30));
    setEnrollMsg(settings.enrollment_confirmation_template || "");
    setCalendly(settings.calendly_url || "");
    setGcal(settings.google_calendar_url || "");
    setSheet(settings.google_sheet_url || "");
    setPayTpl(settings.payment_link_template || "");
    setCrmHook(settings.crm_webhook_url || "");
    setPixel(settings.meta_ads_pixel || "");
    setHuman(settings.human_transfer_phone || "");
  }, [settings]);

  if (loading || !settings) return <div className="p-4 text-sm text-muted-foreground">Loading education settings…</div>;

  const toggleLang = (l: string) => setLangs((cur) => cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Education · Bot voice</CardTitle><CardDescription>How the AI speaks to parents and students.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Languages</Label>
              <div className="flex gap-3 pt-2 text-sm">
                {(["en","ar","fr"] as const).map((l) => (
                  <label key={l} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={langs.includes(l)} onChange={() => toggleLang(l)} />
                    <span className="uppercase">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={() => save({ bot_tone: tone, languages: langs })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reminders</CardTitle><CardDescription>Class reminder timing and day-before alerts.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Hours before class</Label><Input type="number" value={remH} onChange={(e) => setRemH(e.target.value)} /></div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={dayBefore} onCheckedChange={setDayBefore} />
              <Label>Also send a day-before reminder</Label>
            </div>
            <div><Label>Trial class duration (min)</Label><Input type="number" value={trialMin} onChange={(e) => setTrialMin(e.target.value)} /></div>
          </div>
          <Button onClick={() => save({ reminder_hours_before: Number(remH), day_before_reminder: dayBefore, trial_class_minutes: Number(trialMin) })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Weekly progress message</CardTitle><CardDescription>Sent to parents once per week. Use {"{parent}"} and {"{student}"} placeholders.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Day of week</Label>
              <Select value={pday} onValueChange={setPday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Template</Label><Textarea rows={3} value={pmsg} onChange={(e) => setPmsg(e.target.value)} /></div>
          <Button onClick={() => save({ progress_day_of_week: Number(pday), progress_message_template: pmsg })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Enrollment confirmation</CardTitle><CardDescription>Message sent when a student is confirmed. Use {"{student}"}, {"{course}"}, {"{start_date}"}.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={3} value={enrollMsg} onChange={(e) => setEnrollMsg(e.target.value)} />
          <Button onClick={() => save({ enrollment_confirmation_template: enrollMsg })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>Calendar, sheets, payment links, ads & escalation.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Calendly URL</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} /></div>
            <div><Label>Google Calendar URL</Label><Input value={gcal} onChange={(e) => setGcal(e.target.value)} /></div>
            <div><Label>Google Sheet URL</Label><Input value={sheet} onChange={(e) => setSheet(e.target.value)} /></div>
            <div><Label>Payment link template</Label><Input placeholder="https://pay.example.com/{course}" value={payTpl} onChange={(e) => setPayTpl(e.target.value)} /></div>
            <div><Label>CRM webhook</Label><Input value={crmHook} onChange={(e) => setCrmHook(e.target.value)} /></div>
            <div><Label>Meta Ads pixel</Label><Input value={pixel} onChange={(e) => setPixel(e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Human transfer phone</Label><Input placeholder="+9617…" value={human} onChange={(e) => setHuman(e.target.value)} /></div>
          </div>
          <Button onClick={() => save({
            calendly_url: calendly || null, google_calendar_url: gcal || null, google_sheet_url: sheet || null,
            payment_link_template: payTpl || null, crm_webhook_url: crmHook || null, meta_ads_pixel: pixel || null,
            human_transfer_phone: human || null,
          })}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
