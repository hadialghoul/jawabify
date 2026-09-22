import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { Link } from "react-router-dom";
import { Sparkles, Zap, Heart, Rocket, Globe2, ShieldCheck, ArrowRight } from "lucide-react";
import { LogoCloud } from "@/components/marketing/Mockups";
import jawabifyLogo from "@/assets/jawabify-logo.jpg.asset.json";

const values = [
  { icon: Heart, title: "Customer-obsessed", body: "Every feature ships because a real business asked for it. We answer support tickets ourselves." },
  { icon: Zap, title: "Speed as a feature", body: "Fast to set up, fast to reply, fast to iterate. Slow software is broken software." },
  { icon: Sparkles, title: "Radical simplicity", body: "One platform, one plan, no add-ons or surprise fees. Every feature earns its place." },
  { icon: ShieldCheck, title: "Trust by default", body: "Your data is yours. Row-level isolation. No sharing, no training on your conversations." },
  { icon: Globe2, title: "Global from day one", body: "Beirut, Dubai, Cairo, Lagos, São Paulo. If WhatsApp is the primary channel, we're there." },
  { icon: Rocket, title: "Ambition over perfection", body: "We'd rather ship a great v1 today than a perfect v3 next quarter." },
];

const milestones = [
  { year: "2023", title: "The idea", body: "Founders running e-commerce shops on WhatsApp couldn't hire fast enough. AI had just gotten good enough to help." },
  { year: "2024", title: "First 100 businesses", body: "Restaurants, boutiques, and clinics across Lebanon and the UAE. Built the deterministic order engine after seeing chaos in free-form AI ordering." },
  { year: "2025", title: "Enterprise-ready", body: "Multi-tenant architecture, native Meta Cloud API, Shopify OAuth, and campaign infrastructure that scales past 250-message limits." },
  { year: "2026", title: "Now", body: "Thousands of businesses across MENA and beyond. Native support for 20+ languages, industry-specific verticals, mobile app in the works." },
];

export default function About() {
  return (
    <MarketingLayout>
      <SEO
        path="/about"
        title="About Jawabify — Building the Tools We Wish We Had"
        description="Jawabify is a Beirut & Dubai team building AI-powered WhatsApp messaging for businesses across MENA and beyond — meet the team and our mission."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: "https://jawabify.com/about",
          name: "About Jawabify",
          about: { "@type": "Organization", name: "Jawabify", url: "https://jawabify.com" },
        }}
      />
      {/* Hero */}
      <Section className="pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-primary uppercase tracking-widest mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> About Jawabify
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight">
              We build the tools <span className="gradient-text">we wish we had</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Jawabify started because running a business on WhatsApp meant hiring more people, missing more messages, and losing more customers every week. AI finally became good enough to fix that. So we did.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              <Stat v="2,400+" l="businesses" />
              <Stat v="18M+" l="messages/mo" />
              <Stat v="20+" l="languages" />
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-indigo-500/10 to-secondary p-10 grid place-items-center">
              <div className="text-center">
                <div className="mx-auto h-28 w-28 rounded-3xl bg-[hsl(240_45%_5%)] p-4 grid place-items-center shadow-[var(--shadow-elegant)]">
                  <img src={jawabifyLogo.url} alt="Jawabify company logo" className="h-full w-full object-contain" />
                </div>
                <div className="mt-6 font-display text-2xl font-bold">Jawabify</div>
                <div className="text-sm text-muted-foreground mt-1">Beirut · Dubai · Remote</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Mission */}
      <Section>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-white p-10 card-elevated">
            <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Our mission</div>
            <h2 className="font-display text-3xl font-bold">Make world-class customer conversations accessible to every business.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              From the corner restaurant to the growing e-commerce brand. WhatsApp is where your customers are. Jawabify makes sure you're always there too — instantly, in their language, in the tone your brand deserves.
            </p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 text-white noise relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/40 blur-3xl" />
            <div className="text-[11px] uppercase tracking-widest text-white/70 font-semibold mb-3">The team</div>
            <h2 className="font-display text-3xl font-bold">Operators, engineers, designers.</h2>
            <p className="mt-4 text-white/85 leading-relaxed">
              We've spent years shipping AI, messaging infrastructure, and enterprise software at companies you know. Now we build for people who run real businesses on their phones.
            </p>
            <div className="mt-6 text-sm text-white/75">Based between Beirut and Dubai · Serving businesses worldwide</div>
          </div>
        </div>
      </Section>

      {/* Values */}
      <Section>
        <SectionHeader eyebrow="What we believe" title={<>Values that shape <span className="gradient-text">every decision</span></>} />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-white p-6 hover:-translate-y-0.5 transition-transform card-elevated">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mb-4">
                <v.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Timeline */}
      <Section>
        <SectionHeader eyebrow="Journey" title={<>From <span className="gradient-text">day one</span> to today</>} />
        <div className="mt-12 relative max-w-3xl mx-auto">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent" />
          <div className="space-y-6">
            {milestones.map((m) => (
              <div key={m.year} className="relative pl-14">
                <div className="absolute left-0 top-5 h-8 w-8 rounded-full bg-white border-2 border-primary shadow-[var(--shadow-elegant)] grid place-items-center">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <div className="rounded-2xl border border-border bg-white p-6 card-elevated">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">{m.year}</div>
                  <h3 className="mt-1 font-display text-xl font-bold">{m.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Customers */}
      <Section>
        <div className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Trusted by teams across MENA and beyond</div>
        <LogoCloud />
      </Section>

      {/* CTA */}
      <Section>
        <div className="rounded-3xl border border-border bg-white p-10 sm:p-14 text-center card-elevated">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Come build with us</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">We're hiring engineers, designers, and customer partners. Or just try the product — that helps too.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold hover:bg-foreground/90 inline-flex items-center gap-2">
              Try Jawabify <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary">
              Get in touch
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-bold">{v}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">{l}</div>
    </div>
  );
}
