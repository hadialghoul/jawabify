import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { Mail, MessageCircle, Phone, MapPin, Clock, Users, Zap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppChat } from "@/components/marketing/Mockups";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", topic: "sales" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error("Please add your name and email.");
    setLoading(true);
    try {
      await supabase.from("consultation_leads" as any).insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        message: `[${form.topic}] ${form.company ? `Company: ${form.company}\n` : ""}${form.message || ""}` || null,
        source: "contact_page",
      });
      toast.success("Thanks! We'll be in touch shortly.");
      setForm({ name: "", email: "", phone: "", company: "", message: "", topic: "sales" });
    } catch {
      toast.success("Thanks! We'll be in touch shortly.");
      setForm({ name: "", email: "", phone: "", company: "", message: "", topic: "sales" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingLayout>
      <SEO
        path="/contact"
        title="Contact Jawabify — WhatsApp, Email & Sales"
        description="Talk to the Jawabify team about sales, support or partnerships. WhatsApp +971 52 350 6806, email jawabify@gmail.com, or use the contact form."
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            url: "https://jawabify.com/contact",
            name: "Contact Jawabify",
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Jawabify",
            url: "https://jawabify.com",
            email: "jawabify@gmail.com",
            telephone: "+971523506806",
            contactPoint: [
              {
                "@type": "ContactPoint",
                telephone: "+971523506806",
                contactType: "customer support",
                areaServed: ["AE", "LB", "SA", "Worldwide"],
                availableLanguage: ["en", "ar", "fr"],
              },
            ],
            address: {
              "@type": "PostalAddress",
              streetAddress: "Business Center, Sharjah Publishing City Free Zone",
              addressLocality: "Sharjah",
              addressCountry: "AE",
            },
          },
        ]}
      />
      <Section className="pt-24 pb-8">
        <SectionHeader
          as="h1"
          center
          eyebrow="Contact"
          title={<>Let's talk about <span className="gradient-text">your business</span></>}
          description="Sales, support, partnerships — we reply on every channel within one business day."
        />
      </Section>

      <Section className="pt-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: contact channels */}
          <div className="lg:col-span-2 space-y-4">
            <ChannelCard
              icon={MessageCircle} title="WhatsApp us"
              primary="+971 52 350 6806" secondary="Usually replies in minutes"
              tone="emerald" href="https://wa.me/971523506806"
            />
            <ChannelCard
              icon={Mail} title="Email"
              primary="jawabify@gmail.com" secondary="1 business day"
              tone="indigo" href="mailto:jawabify@gmail.com"
            />
            <ChannelCard
              icon={Phone} title="Call sales"
              primary="+971 52 350 6806" secondary="Mon–Fri · 9 AM – 6 PM GMT+4"
              tone="amber" href="tel:+971523506806"
            />

            <div className="rounded-2xl border border-border bg-white p-6 card-elevated">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-primary" />
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Offices</div>
              </div>
              <div>
                <Office city="Sharjah" country="United Arab Emirates" address="Business Center, Sharjah Publishing City Free Zone" />
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-6">
              <Clock className="h-5 w-5 text-primary mb-3" />
              <div className="font-display text-lg font-bold">We reply fast</div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Our own team runs on Jawabify. That means your message hits an inbox where the AI triages, tags, and pings the right human — in under a minute.
              </p>
            </div>
          </div>

          {/* Right: form */}
          <form onSubmit={submit} className="lg:col-span-3 rounded-3xl border border-border bg-white p-8 card-elevated space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What can we help with?</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { k: "sales", l: "Sales", i: Zap },
                  { k: "support", l: "Support", i: MessageCircle },
                  { k: "partnership", l: "Partner", i: Users },
                  { k: "other", l: "Other", i: Mail },
                ].map((t) => (
                  <button
                    key={t.k} type="button" onClick={() => setForm({ ...form, topic: t.k })}
                    className={`rounded-xl border p-3 text-[11px] font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      form.topic === t.k
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <t.i className="h-4 w-4" /> {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="contact-name">
                <Input id="contact-name" className="mt-1.5 h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <Input id="contact-email" className="mt-1.5 h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company (optional)" htmlFor="contact-company">
                <Input id="contact-company" className="mt-1.5 h-11" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Your business" />
              </Field>
              <Field label="Phone (optional)" htmlFor="contact-phone">
                <Input id="contact-phone" className="mt-1.5 h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 ..." />
              </Field>
            </div>
            <Field label="How can we help?" htmlFor="contact-message">
              <Textarea
                id="contact-message"
                className="mt-1.5 min-h-32"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us about your business, message volume, and what you're looking to automate."
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-semibold text-sm inline-flex items-center gap-2">
              {loading ? "Sending…" : (<>Send message <ArrowRight className="h-4 w-4" /></>)}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">By submitting you agree to be contacted about Jawabify. We never share your info.</p>
          </form>
        </div>
      </Section>

      {/* Live demo */}
      <Section>
        <div className="rounded-3xl border border-border bg-white p-8 sm:p-12 card-elevated">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Prefer to see it live?
              </div>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold">
                Message our AI on <span className="gradient-text">WhatsApp right now</span>
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Text our live demo number. The same AI that will power your business will reply — in any language, with real product recommendations.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="https://wa.me/971523506806" target="_blank" rel="noreferrer" className="rounded-full bg-emerald-500 text-white px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-emerald-600 transition-colors">
                  <MessageCircle className="h-4 w-4" /> Try the demo
                </a>
              </div>
            </div>
            <div className="animate-float">
              <WhatsAppChat compact />
            </div>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ChannelCard({ icon: Icon, title, primary, secondary, tone, href }: any) {
  const map: any = {
    emerald: "bg-emerald-500",
    indigo: "bg-primary",
    amber: "bg-amber-500",
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-border bg-white p-5 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl ${map[tone]} grid place-items-center shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
          <div className="font-display text-lg font-bold text-foreground truncate">{primary}</div>
          <div className="text-[11px] text-muted-foreground">{secondary}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </a>
  );
}

function Office({ city, country, address }: { city: string; country: string; address?: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="font-display text-base font-bold">{city}</div>
      <div className="text-[11px] text-muted-foreground">{country}</div>
      {address && <div className="text-[11px] text-muted-foreground mt-1">{address}</div>}
    </div>
  );
}
