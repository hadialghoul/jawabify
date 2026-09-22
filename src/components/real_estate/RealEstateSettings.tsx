import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRealEstateSettings } from "@/hooks/useRealEstateSettings";

export function RealEstateSettings() {
  const { settings, save, loading } = useRealEstateSettings();
  const [areas, setAreas] = useState("");
  const [calendly, setCalendly] = useState("");
  const [sheet, setSheet] = useState("");
  const [webhook, setWebhook] = useState("");
  const [human, setHuman] = useState("");
  const [dur, setDur] = useState("30");
  const [rem, setRem] = useState("2");
  const [fol, setFol] = useState("24");
  const [curr, setCurr] = useState("USD");

  useEffect(() => {
    if (!settings) return;
    setAreas((settings.areas_covered || []).join(", "));
    setCalendly(settings.calendly_url || "");
    setSheet(settings.google_sheet_url || "");
    setWebhook(settings.crm_webhook_url || "");
    setHuman(settings.human_transfer_phone || "");
    setDur(String(settings.viewing_duration_min ?? 30));
    setRem(String(settings.reminder_hours_before ?? 2));
    setFol(String(settings.followup_hours_after ?? 24));
    setCurr(settings.currency || "USD");
  }, [settings]);

  if (loading || !settings) return <div className="p-4 text-sm text-muted-foreground">Loading real-estate settings…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Real Estate · Coverage</CardTitle>
          <CardDescription>Areas the AI qualifies leads for. Outside → polite decline or handoff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Areas covered (comma-separated)</Label><Input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Achrafieh, Hamra, Verdun" /></div>
          <div><Label>Currency</Label><Input value={curr} onChange={(e) => setCurr(e.target.value)} className="max-w-[120px]" /></div>
          <Button onClick={() => save({ areas_covered: areas.split(",").map((s) => s.trim()).filter(Boolean), currency: curr })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Real Estate · Viewings</CardTitle><CardDescription>Default duration and reminder/follow-up timing.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <div><Label>Duration (min)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
            <div><Label>Reminder (h before)</Label><Input type="number" value={rem} onChange={(e) => setRem(e.target.value)} /></div>
            <div><Label>Follow-up (h after)</Label><Input type="number" value={fol} onChange={(e) => setFol(e.target.value)} /></div>
          </div>
          <Button onClick={() => save({ viewing_duration_min: parseInt(dur) || 30, reminder_hours_before: parseInt(rem) || 2, followup_hours_after: parseInt(fol) || 24 })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Real Estate · Integrations</CardTitle><CardDescription>Optional external links.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Google Sheet URL (listings sync)</Label><Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></div>
          <div><Label>Calendly URL (alternative booking)</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." /></div>
          <div><Label>CRM webhook URL</Label><Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://..." /></div>
          <Button onClick={() => save({ google_sheet_url: sheet || null, calendly_url: calendly || null, crm_webhook_url: webhook || null })}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Real Estate · Human handoff</CardTitle><CardDescription>Where to forward complaints, VIPs, off-topic requests.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Human transfer phone</Label><Input value={human} onChange={(e) => setHuman(e.target.value)} placeholder="+961..." /></div>
          <Button onClick={() => save({ human_transfer_phone: human || null })}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
