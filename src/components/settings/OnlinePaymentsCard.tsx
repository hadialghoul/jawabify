import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const asText = (v: any) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v ? String(v) : "");

// Each business pastes its own payment link (Stripe, PayPal, Whish, OMT…).
// When on, the WhatsApp bot asks "How would you like to pay?" after an order/booking.
export function OnlinePaymentsCard() {
  const { tenantId } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["online_payments_enabled", "online_payment_link"])
      .then(({ data }) => {
        const pick = (k: string) => (data || []).find((r: any) => r.key === k)?.value;
        const e = pick("online_payments_enabled");
        setEnabled(e === true || e === "true");
        setLink(asText(pick("online_payment_link")));
      });
  }, [tenantId]);

  const save = async (nextEnabled = enabled) => {
    if (!tenantId) return toast.error("No account selected");
    const trimmed = link.trim();
    if (nextEnabled && !/^https?:\/\/\S+$/i.test(trimmed)) {
      toast.error("Add a valid payment link starting with https://");
      return false;
    }
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      [
        { tenant_id: tenantId, key: "online_payments_enabled", value: nextEnabled },
        { tenant_id: tenantId, key: "online_payment_link", value: trimmed },
      ] as any,
      { onConflict: "tenant_id,key" },
    );
    setSaving(false);
    if (error) { toast.error("Could not save"); return false; }
    toast.success(nextEnabled ? "Online payments on" : "Online payments saved");
    return true;
  };

  const toggle = async (v: boolean) => {
    const prev = enabled;
    setEnabled(v);
    const ok = await save(v);
    if (!ok) setEnabled(prev);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Online payments
        </CardTitle>
        <CardDescription>
          When on, after a customer confirms an order or booking the assistant asks how they want to pay and sends your link if they choose online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="online-pay-toggle">Accept online payments</Label>
          <Switch id="online-pay-toggle" checked={enabled} onCheckedChange={toggle} disabled={saving} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="online-pay-link">Payment link</Label>
          <Input
            id="online-pay-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://buy.stripe.com/... or your PayPal / Whish link"
            className="text-base"
          />
        </div>
        <Button onClick={() => save()} disabled={saving}>Save</Button>
      </CardContent>
    </Card>
  );
}
