import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Day = { open: string; close: string; closed: boolean };
type Hours = Record<string, Day>;

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const ZONES = [
  "Asia/Beirut", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "Europe/Paris",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
];

const defaultHours = (): Hours =>
  Object.fromEntries(DAYS.map(([k]) => [k, { open: "09:00", close: "17:00", closed: k === "sun" }]));

interface Props {
  settings: any;
  save: (patch: Record<string, unknown>) => Promise<unknown> | void;
}

export function LocationHoursCard({ settings, save }: Props) {
  const [address, setAddress] = useState("");
  const [maps, setMaps] = useState("");
  const [tz, setTz] = useState("Asia/Beirut");
  const [hours, setHours] = useState<Hours>(defaultHours());

  useEffect(() => {
    setAddress(settings?.address || "");
    setMaps(settings?.maps_url || "");
    setTz(settings?.timezone || "Asia/Beirut");
    const h = settings?.opening_hours;
    setHours(h && Object.keys(h).length ? { ...defaultHours(), ...h } : defaultHours());
  }, [settings]);

  const patch = (k: string, v: Partial<Day>) => setHours((h) => ({ ...h, [k]: { ...h[k], ...v } }));
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Location &amp; opening hours</CardTitle>
        <CardDescription>The assistant shares these with clients and books times in this time zone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city" /></div>
        <div><Label>Google Maps link</Label><Input value={maps} onChange={(e) => setMaps(e.target.value)} placeholder="https://maps.google.com/..." /></div>
        <div className="max-w-xs">
          <Label>Time zone</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{zones.map((z) => <SelectItem key={z} value={z}>{z.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Opening hours</Label>
          {DAYS.map(([k, name]) => (
            <div key={k} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm">{name}</span>
              <Switch checked={!hours[k].closed} onCheckedChange={(on) => patch(k, { closed: !on })} />
              {hours[k].closed ? (
                <span className="text-sm text-muted-foreground">Closed</span>
              ) : (
                <>
                  <Input type="time" className="w-32" value={hours[k].open} onChange={(e) => patch(k, { open: e.target.value })} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" className="w-32" value={hours[k].close} onChange={(e) => patch(k, { close: e.target.value })} />
                </>
              )}
            </div>
          ))}
        </div>
        <Button onClick={() => save({ address: address || null, maps_url: maps || null, timezone: tz, opening_hours: hours })}>Save</Button>
      </CardContent>
    </Card>
  );
}
