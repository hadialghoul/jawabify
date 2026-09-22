import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/marketing/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { trackLead, trackViewContent } from "@/lib/pixel";

const BUSINESS_TYPES = [
  "Online store",
  "E-commerce",
  "Restaurant",
  "Real estate",
  "Healthcare",
  "Education",
  "Wellness & beauty",
  "Professional services",
  "Other",
];

type LeadFormState = {
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  businessType: string;
  needs: string;
};

const INITIAL_FORM: LeadFormState = {
  fullName: "",
  businessName: "",
  phone: "",
  email: "",
  businessType: "",
  needs: "",
};

function compactSource(pathname: string, params: URLSearchParams, form: LeadFormState) {
  const attribution = ["utm_source", "utm_campaign", "utm_content", "utm_medium"]
    .map((key) => {
      const value = params.get(key)?.trim();
      return value ? `${key.replace("utm_", "")}:${value.slice(0, 35)}` : null;
    })
    .filter(Boolean)
    .join(",");
  const context = [
    `business:${form.businessName.trim().slice(0, 45) || "not provided"}`,
    `type:${form.businessType.slice(0, 30)}`,
    form.needs.trim() ? `need:${form.needs.trim().replace(/\s+/g, " ").slice(0, 80)}` : null,
  ].filter(Boolean).join("|");

  return `${pathname}${attribution ? `?${attribution}` : ""}|${context}`.slice(0, 255);
}

export default function LeadForm() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackViewContent({ content_name: "Ad Lead Form" });
  }, []);

  const update = (field: keyof LeadFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (fullName.length < 2 || fullName.length > 120) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^[+\d][\d\s().-]{6,39}$/.test(phone)) {
      setError("Please enter a valid phone or WhatsApp number.");
      return;
    }
    if (!form.businessType) {
      setError("Please select your business type.");
      return;
    }

    setSubmitting(true);
    setError("");
    const sourcePath = compactSource(location.pathname, searchParams, form);
    const { error: saveError } = await supabase.from("consultation_leads").insert({
      full_name: fullName,
      email,
      phone: phone.slice(0, 40),
      source_path: sourcePath,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSubmitting(false);

    if (saveError) {
      setError("We couldn't send your details. Please try again.");
      return;
    }

    trackLead({ content_name: "Ad Lead Form", source: searchParams.get("utm_source") || "direct" });
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "lead-welcome",
        recipientEmail: email,
        idempotencyKey: `ad-lead-welcome-${email}-${Date.now()}`,
        templateData: { fullName },
      },
    }).catch(() => undefined);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <SEO
        path="/form"
        title="Get a Free Jawabify Consultation"
        description="Tell us about your business and discover how Jawabify can automate customer conversations, support, and sales."
      />
      <main className="min-h-screen bg-background">
        <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
            <Link to="/" aria-label="Jawabify home" className="inline-flex w-fit items-center gap-3">
              <img src="/apple-touch-icon.png?v=7" alt="Jawabify" className="h-10 w-10 rounded-md bg-foreground p-1 object-contain" />
              <span className="font-display text-xl font-bold">Jawabify</span>
            </Link>

            <div className="my-auto py-12 lg:py-16">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--online-indicator))]" />
                Free business consultation
              </div>
              <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
                Turn every message into a <span className="text-primary">business opportunity.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                Tell us a little about your business. Our team will show you how Jawabify can automate replies, qualify leads, and help you sell around the clock.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "A tailored walkthrough for your business",
                  "Practical automation recommendations",
                  "No commitment and no credit card",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium sm:text-base">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Your information stays private and secure.
            </div>
          </section>

          <section className="flex items-center border-t border-border bg-card px-5 py-10 sm:px-10 lg:border-l lg:border-t-0 lg:px-16">
            <div className="mx-auto w-full max-w-xl">
              {submitted ? (
                <div className="py-12 text-center" aria-live="polite">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="mt-6 font-display text-3xl font-bold">Thank you — we received your details.</h2>
                  <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                    A Jawabify specialist will contact you within one business day to discuss your goals.
                  </p>
                  <Button asChild className="mt-8 h-12 rounded-full px-6">
                    <a href="https://wa.me/971523506806" target="_blank" rel="noreferrer">
                      <MessageCircle /> Message us now
                    </a>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <p className="text-sm font-semibold text-primary">Let's get started</p>
                    <h2 className="mt-1 font-display text-3xl font-bold">Tell us about your business</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Complete the form and our team will contact you within one business day.</p>
                  </div>

                  <form onSubmit={submit} className="space-y-5" noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField label="Full name" htmlFor="lead-full-name">
                        <Input id="lead-full-name" autoComplete="name" maxLength={120} required placeholder="Your full name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="mt-2 h-12 bg-background" />
                      </FormField>
                      <FormField label="Business name" htmlFor="lead-business-name">
                        <Input id="lead-business-name" autoComplete="organization" maxLength={100} placeholder="Your company" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="mt-2 h-12 bg-background" />
                      </FormField>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField label="Phone / WhatsApp" htmlFor="lead-phone">
                        <Input id="lead-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} required placeholder="+971 50 000 0000" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-2 h-12 bg-background" />
                      </FormField>
                      <FormField label="Work email" htmlFor="lead-email">
                        <Input id="lead-email" type="email" inputMode="email" autoComplete="email" maxLength={255} required placeholder="you@company.com" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-2 h-12 bg-background" />
                      </FormField>
                    </div>

                    <FormField label="Business type" htmlFor="lead-business-type">
                      <select id="lead-business-type" required value={form.businessType} onChange={(e) => update("businessType", e.target.value)} className="mt-2 flex h-12 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <option value="">Select your business type</option>
                        {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </FormField>

                    <FormField label="What would you like help with? (optional)" htmlFor="lead-needs">
                      <Textarea id="lead-needs" maxLength={500} value={form.needs} onChange={(e) => update("needs", e.target.value)} placeholder="For example: answering customers faster, capturing leads, or taking orders..." className="mt-2 min-h-24 resize-none bg-background" />
                    </FormField>

                    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

                    <Button type="submit" disabled={submitting} className="h-12 w-full rounded-full text-base font-semibold">
                      {submitting ? <><Loader2 className="animate-spin" /> Sending your details…</> : <>Request my free consultation <ArrowRight /></>}
                    </Button>
                    <p className="text-center text-xs leading-5 text-muted-foreground">
                      By submitting, you agree that Jawabify may contact you about its services. See our <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
                    </p>
                  </form>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}