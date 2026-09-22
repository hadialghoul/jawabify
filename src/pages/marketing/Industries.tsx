import { useState } from "react";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import {
  ShoppingBag, UtensilsCrossed, Home, Stethoscope, Sparkles,
  GraduationCap, Briefcase, ArrowUpRight, Check, Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RealisticDashboard } from "@/components/marketing/RealisticDashboards";

const industries = [
  {
    icon: ShoppingBag, title: "E-commerce", tag: "Shopify-native",
    problem: "Cart abandonment, slow support, missed sales on WhatsApp DMs.",
    solution: "AI takes orders in chat, syncs to Shopify, sends tracking, handles returns.",
    features: ["Deterministic order flow", "Shopify catalog sync", "Delivery tracking replies", "Returns automation"],
    stat: { v: "3.4×", l: "more WhatsApp orders" },
  },
  {
    icon: UtensilsCrossed, title: "Restaurants", tag: "Kitchen-ready",
    problem: "Phone lines busy, orders lost on paper, tables sitting empty.",
    solution: "Menu on WhatsApp, kitchen tickets printed automatically, table reservations, delivery flows.",
    features: ["Live menu updates", "Modifier support", "Table reservations", "Kitchen ticket printing"],
    stat: { v: "42%", l: "faster order-to-kitchen" },
  },
  {
    icon: Home, title: "Real Estate", tag: "Lead-qualifier",
    problem: "Hundreds of tire-kickers, agents burnt out chasing dead leads.",
    solution: "AI qualifies leads by budget & location, books viewings, hands hot prospects to your agents only.",
    features: ["Budget & area qualifying", "Google Cal viewing sync", "Lead scoring", "Agent handoff on hot leads"],
    stat: { v: "5×", l: "qualified viewings/week" },
  },
  {
    icon: Stethoscope, title: "Healthcare", tag: "HIPAA-aware",
    problem: "No-shows, reception overwhelmed, patients waiting for confirmations.",
    solution: "Triage, appointments, lab follow-ups — with automatic escalation on urgent symptoms.",
    features: ["24/7 appointment booking", "Automated reminders", "Symptom triage", "Urgent escalation"],
    stat: { v: "-38%", l: "no-shows" },
  },
  {
    icon: Sparkles, title: "Wellness", tag: "Membership-friendly",
    problem: "Reschedules eating your day, memberships not upsold.",
    solution: "AI books sessions, manages reschedules and reminders, upsells packages naturally.",
    features: ["Package management", "Reschedule automation", "Loyalty upsells", "Class waitlists"],
    stat: { v: "+22%", l: "package upsells" },
  },
  {
    icon: GraduationCap, title: "Education", tag: "Parent-friendly",
    problem: "Admin drowning in parent questions, applications stalling.",
    solution: "Class info, registration, parent questions answered 24/7 in the family's native language.",
    features: ["Registration workflow", "Multilingual replies", "Fee reminders", "Absence handling"],
    stat: { v: "80%", l: "faster admissions reply" },
  },
  {
    icon: Briefcase, title: "Services", tag: "Any business",
    problem: "Agencies, consultants, travel — anyone selling on WhatsApp needs structure.",
    solution: "Configurable flow adapts to any service business selling and delivering on WhatsApp.",
    features: ["Custom booking flows", "Quote & invoice replies", "Multi-agent inbox", "Payment link generation"],
    stat: { v: "10 min", l: "to configure" },
  },
];

export default function Industries() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex !== null ? industries[openIndex] : null;

  return (
    <MarketingLayout>
      <SEO
        path="/industries"
        title="Industries — WhatsApp AI by Vertical | Jawabify"
        description="Purpose-built WhatsApp AI flows for retail, restaurants, real estate, healthcare, wellness, education and services — dashboards tailored to each vertical."
      />
      <Section className="pt-24 pb-8">
        <SectionHeader
          as="h1"
          center
          eyebrow="Industries"
          title={<>One platform, <span className="gradient-text">purpose-built flows</span></>}
          description="Tap any industry to preview the dashboard your team would use every day."
        />
      </Section>

      {/* Feature preview cards */}
      <Section className="pt-4">
        <div className="grid gap-8">
          {industries.map((ind, i) => (
            <div key={ind.title} className="group rounded-3xl border border-border bg-white overflow-hidden card-elevated hover:shadow-[var(--shadow-elegant)] transition-all">
              <div className="grid lg:grid-cols-[1.15fr_1fr] gap-0">
                <div className="p-8 sm:p-10">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 grid place-items-center shadow-[var(--shadow-elegant)]">
                      <ind.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">{ind.tag}</div>
                      <h2 className="font-display text-2xl font-bold">{ind.title}</h2>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Problem</div>
                      <p className="text-foreground">{ind.problem}</p>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Solution</div>
                      <p className="text-foreground">{ind.solution}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {ind.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 flex flex-wrap items-center gap-3">
                      <div className="rounded-xl bg-primary/10 px-4 py-2">
                        <div className="font-display text-2xl font-bold text-primary">{ind.stat.v}</div>
                        <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">{ind.stat.l}</div>
                      </div>
                      <button
                        onClick={() => setOpenIndex(i)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-all"
                      >
                        <Eye className="h-4 w-4" /> See dashboard
                      </button>
                      <Link to="/auth" className="text-sm font-semibold text-primary hover:gap-2 inline-flex items-center gap-1.5 transition-all">
                        Start trial <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenIndex(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenIndex(i);
                    }
                  }}
                  className="relative bg-gradient-to-br from-secondary/60 to-primary/5 p-6 grid place-items-center min-h-[380px] text-left group/preview cursor-pointer overflow-hidden"
                  aria-label={`Preview ${ind.title} dashboard`}
                >
                  <IndustryVisual index={i} />
                  <div className="absolute inset-0 bg-foreground/0 group-hover/preview:bg-foreground/5 transition-colors grid place-items-center">
                    <span className="opacity-0 group-hover/preview:opacity-100 translate-y-2 group-hover/preview:translate-y-0 transition-all inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-xs font-semibold shadow-lg">
                      <Eye className="h-3.5 w-3.5" /> Preview dashboard
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 sm:p-14 text-white text-center">
          <h2 className="font-display text-3xl font-bold">Don't see your industry?</h2>
          <p className="mt-3 text-white/80 max-w-xl mx-auto">The Services vertical adapts to any business selling on WhatsApp. If it involves messages, orders, or bookings — we can automate it.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold">Talk to us</Link>
            <Link to="/auth?mode=signup" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">Start free trial</Link>
          </div>
        </div>
      </Section>

      {/* Dashboard preview dialog */}
      <Dialog open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 grid place-items-center">
                    <active.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">{active.tag}</div>
                    <DialogTitle className="font-display text-2xl">{active.title} dashboard</DialogTitle>
                  </div>
                </div>
                <DialogDescription>{active.solution}</DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <IndustryDashboardPreview index={openIndex!} />
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {active.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {f}
                    </div>
                  ))}
                </div>
                <Link to="/auth?mode=signup" className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold">
                  Start free trial <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MarketingLayout>
  );
}

function IndustryDashboardPreview({ index }: { index: number }) {
  return <RealisticDashboard index={index} />;
}

function IndustryVisual({ index }: { index: number }) {
  return (
    <div className="w-full origin-top-left scale-[0.88] lg:scale-100">
      <RealisticDashboard index={index} />
    </div>
  );
}
