import { useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarCheck, Loader2, CheckCircle2 } from "lucide-react";
import { trackLead } from "@/lib/pixel";
import { SEO } from "@/components/marketing/SEO";

export default function BookConsultation() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });

  // Preserve campaign attribution so leads can be traced back to the link used.
  const source = searchParams.get("src") || searchParams.get("utm_source");
  const sourcePath = source ? `${location.pathname}?src=${source}` : location.pathname;

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
      source_path: sourcePath.slice(0, 255),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit. Please try again.");
      return;
    }
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "lead-welcome",
        recipientEmail: email,
        idempotencyKey: `lead-welcome-${email}-${Date.now()}`,
        templateData: { fullName: full_name },
      },
    }).catch((e) => console.warn("lead-welcome email failed", e));
    trackLead({ content_name: "Book Consultation Page", source_path: sourcePath });
    toast.success("Thanks! We'll be in touch shortly.");
    setDone(true);
  };

  return (
    <>
      <SEO
        title="Book a Free WhatsApp AI Consultation | Jawabify"
        description="Book a free 15-minute consultation and see how Jawabify automates WhatsApp sales, support, and orders for your business."
        path="/book-consultation"
      />
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {done ? <CheckCircle2 className="h-6 w-6" /> : <CalendarCheck className="h-6 w-6" />}
          </div>
          {done ? (
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground">You're all set</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We've emailed you a booking link. Our team will reach out shortly.
              </p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/">Back to homepage</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-foreground">Book a free consultation</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                See how Jawabify can automate WhatsApp for your business. No credit card required.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bc-name">Full name</Label>
                  <Input
                    id="bc-name"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bc-email">Email</Label>
                  <Input
                    id="bc-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bc-phone">Phone number</Label>
                  <Input
                    id="bc-phone"
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
            </>
          )}
        </div>
      </main>
    </>
  );
}
