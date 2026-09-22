import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDefaultDeliveryFee } from "@/hooks/useDefaultDeliveryFee";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRestaurantSettings, type OpeningHours } from "@/hooks/useRestaurantSettings";

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export function RestaurantSettings() {
  const { tenantId } = useAuth();
  const { defaultFee, saveDefault, loading } = useDefaultDeliveryFee();
  const { settings, save, loading: settingsLoading } = useRestaurantSettings();

  const [fee, setFee] = useState<string>("");
  const [upsell, setUpsell] = useState(true);

  const [eta, setEta] = useState("");
  const [specials, setSpecials] = useState("");
  const [hours, setHours] = useState<OpeningHours>({} as OpeningHours);
  const [maxParty, setMaxParty] = useState<string>("10");
  const [reminderHrs, setReminderHrs] = useState<string>("2");
  const [kitchenPhone, setKitchenPhone] = useState("");
  const [humanPhone, setHumanPhone] = useState("");

  useEffect(() => {
    if (!loading) setFee(String(defaultFee));
  }, [defaultFee, loading]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["ai_upsell_enabled", "restaurant_upsell_enabled"])
      .then(({ data }) => {
        const rows = data || [];
        const primary = rows.find((r: any) => r.key === "ai_upsell_enabled")?.value;
        if (primary !== undefined && primary !== null) {
          setUpsell(primary === true || primary === "true");
          return;
        }
        const legacy = rows.find((r: any) => r.key === "restaurant_upsell_enabled")?.value;
        if (legacy !== undefined && legacy !== null) {
          setUpsell(legacy === true || legacy === "true");
        }
      });
  }, [tenantId]);

  useEffect(() => {
    if (!settings) return;
    setEta(settings.eta_text ?? "");
    setSpecials(settings.daily_specials ?? "");
    setHours(settings.opening_hours ?? ({} as OpeningHours));
    setMaxParty(String(settings.max_party_size ?? 10));
    setReminderHrs(String(settings.reminder_hours_before ?? 2));
    setKitchenPhone(settings.kitchen_notify_phone ?? "");
    setHumanPhone(settings.human_transfer_phone ?? "");
  }, [settings]);

  const toggleUpsell = async (v: boolean) => {
    if (!tenantId) return;
    setUpsell(v);
    // Keep the global switch (Settings → AI Auto-Replies) and the legacy
    // restaurant-only key in sync so both screens show the same state.
    await supabase.from("app_settings").upsert(
      [
        { tenant_id: tenantId, key: "ai_upsell_enabled", value: v as any },
        { tenant_id: tenantId, key: "restaurant_upsell_enabled", value: v as any },
      ],
      { onConflict: "tenant_id,key" },
    );
    toast.success(v ? "Upsell enabled" : "Upsell disabled");
  };


  const saveHours = () => save({ opening_hours: hours });
  const saveReservationsCfg = () =>
    save({
      max_party_size: parseInt(maxParty) || 10,
      reminder_hours_before: parseInt(reminderHrs) || 2,
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Fee and ETA used by the AI when taking delivery orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Default delivery fee</Label>
            <div className="flex gap-2 mt-1.5 max-w-xs">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <Button onClick={() => saveDefault(parseFloat(fee) || 0)}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Applied only to delivery orders. Pickup and dine-in have no fee.
            </p>
          </div>

          <div>
            <Label>Estimated delivery time</Label>
            <div className="flex gap-2 mt-1.5 max-w-xs">
              <Input
                placeholder="e.g. 30-45 min"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
              />
              <Button onClick={() => save({ eta_text: eta })} disabled={settingsLoading}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Sent to the customer in the order confirmation.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium text-sm">AI upsell</p>
              <p className="text-xs text-muted-foreground">
                Suggests one extra item once per order (drink, side, dessert).
              </p>
            </div>
            <Switch checked={upsell} onCheckedChange={toggleUpsell} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily specials</CardTitle>
          <CardDescription>Short text the AI may mention when relevant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            placeholder="e.g. Today: 20% off mezze platter until 5pm"
            value={specials}
            onChange={(e) => setSpecials(e.target.value)}
          />
          <Button className="mt-2" onClick={() => save({ daily_specials: specials || null })}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
          <CardDescription>Reservations outside these hours are politely declined.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map((d) => {
            const h = hours[d.key] ?? { open: "11:00", close: "23:00" };
            return (
              <div key={d.key} className="flex items-center gap-2">
                <div className="w-12 text-sm">{d.label}</div>
                <Switch
                  checked={!h.closed}
                  onCheckedChange={(v) =>
                    setHours({ ...hours, [d.key]: { ...h, closed: !v } })
                  }
                />
                <Input
                  type="time"
                  className="w-28"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => setHours({ ...hours, [d.key]: { ...h, open: e.target.value } })}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-28"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => setHours({ ...hours, [d.key]: { ...h, close: e.target.value } })}
                />
              </div>
            );
          })}
          <Button className="mt-2" onClick={saveHours}>Save hours</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
          <CardDescription>Large groups auto-escalate. Reminders are sent before the booking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <Label>Max party size</Label>
              <Input
                type="number"
                min={1}
                value={maxParty}
                onChange={(e) => setMaxParty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Beyond this → human takes over.</p>
            </div>
            <div>
              <Label>Reminder (hours before)</Label>
              <Input
                type="number"
                min={0}
                value={reminderHrs}
                onChange={(e) => setReminderHrs(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={saveReservationsCfg}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Human handoff</CardTitle>
          <CardDescription>Where to forward custom requests, complaints, VIPs, and large groups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Human transfer phone</Label>
            <Input
              placeholder="+9613xxxxxxx"
              value={humanPhone}
              onChange={(e) => setHumanPhone(e.target.value)}
            />
          </div>
          <div>
            <Label>Kitchen / ops phone (optional)</Label>
            <Input
              placeholder="+9613xxxxxxx"
              value={kitchenPhone}
              onChange={(e) => setKitchenPhone(e.target.value)}
            />
          </div>
          <Button
            onClick={() =>
              save({
                human_transfer_phone: humanPhone || null,
                kitchen_notify_phone: kitchenPhone || null,
              })
            }
          >
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
