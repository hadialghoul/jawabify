import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarCheck, Loader2 } from "lucide-react";
import { trackLead } from "@/lib/pixel";


const STORAGE_KEY = "jawabify_consult_popup_shown";
const DELAY_MS = 60_000;

// Pages that indicate a signed-in / product context — skip the popup there.
const EXCLUDED_PREFIXES = [
  "/auth",
  "/app",
  "/account",
  "/settings",
  "/tutorials",
  "/onboarding",
  "/super-admin",
  "/subscribe",
  "/checkout",
  "/reset-password",
  "/book-consultation",
];

export default function ConsultationPopup() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });

  const excluded =
    !!user ||
    loading ||
    EXCLUDED_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

  useEffect(() => {
    if (excluded) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "true") return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const t = window.setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(STORAGE_KEY, "true");
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [excluded, location.pathname]);

  // Reflect the booking path in the address bar while the popup is open so the
  // modal is trackable/shareable, without unmounting the current page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;
    const previousUrl = window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState(window.history.state, "", "/book-consultation");
    return () => {
      window.history.replaceState(window.history.state, "", previousUrl);
    };
  }, [open]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const full_name = form.full_name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!full_name || !email || !phone) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("consultation_leads").insert({
      full_name: full_name.slice(0, 120),
      email: email.slice(0, 255),
      phone: phone.slice(0, 40),
      source_path: location.pathname,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit. Please try again.");
      return;
    }
    // Fire-and-forget welcome email with booking CTA.
    supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'lead-welcome',
        recipientEmail: email,
        idempotencyKey: `lead-welcome-${email}-${Date.now()}`,
        templateData: { fullName: full_name },
      },
    }).catch((e) => console.warn('lead-welcome email failed', e));
    trackLead({ content_name: 'Consultation Popup', source_path: location.pathname });
    localStorage.setItem(STORAGE_KEY, "true");
    toast.success("Thanks! We'll be in touch shortly.");
    setOpen(false);

  };

  if (excluded) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center text-xl">Book a free consultation</DialogTitle>
          <DialogDescription className="text-center">
            See how Jawabify can automate WhatsApp for your business. No credit card required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cpop-name">Full name</Label>
            <Input
              id="cpop-name"
              autoComplete="name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpop-email">Email</Label>
            <Input
              id="cpop-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpop-phone">Phone number</Label>
            <Input
              id="cpop-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+971 ..."
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book my free consultation"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We'll only use your info to reach out about your consultation.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
