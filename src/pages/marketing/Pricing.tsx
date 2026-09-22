import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocalCurrency } from "@/lib/localCurrency";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const starter = [
  "Up to 1,000 orders per month",
  "WhatsApp AI auto-reply",
  "20+ languages incl. Arabic & Arabizi",
  "Voice note transcription",
  "Shared inbox with order context",
  "Shopify two-way sync",
];

const growth = [
  "Everything in Starter",
  "Unlimited orders",
  "Bulk campaigns & broadcasts",
  "Automated order confirmations",
  "Full CRM & 40+ analytics metrics",
  "Priority support",
];

const enterprise = [
  "Everything in Growth",
  "Dedicated success manager",
  "Custom AI training on your archives",
  "SLA & priority 24/7 support",
  "SSO, advanced roles & audit logs",
  "Custom integrations (ERP, POS, CRM)",
  "White-label options",
  "Volume discounts on Meta fees",
];

const compare = [
  { row: "AI auto-replies", starter: "Unlimited", growth: "Unlimited", ent: "Unlimited" },
  { row: "Orders / month", starter: "1,000", growth: "Unlimited", ent: "Unlimited" },
  { row: "Languages", starter: "20+", growth: "20+", ent: "20+ + custom dialects" },
  { row: "Bulk campaigns", starter: "—", growth: "Unlimited*", ent: "Unlimited" },
  { row: "Team seats", starter: "Unlimited", growth: "Unlimited", ent: "Unlimited + SSO" },
  { row: "Shopify integration", starter: "Native", growth: "Native", ent: "Native + custom" },
  { row: "Analytics retention", starter: "3 months", growth: "12 months", ent: "Unlimited" },
  { row: "Support SLA", starter: "2 business days", growth: "1 business day", ent: "1 hour · 24/7" },
  { row: "Onboarding", starter: "Self-serve", growth: "Self-serve + docs", ent: "White-glove" },
];

const faqs = [
  { q: "What's the difference between Starter and Growth?", a: "Starter is capped at 1,000 orders/month and does not include bulk campaigns — perfect for small shops just getting started. Growth adds unlimited orders, campaigns, and priority support for teams that need to scale." },
  { q: "What happens after the free trial?", a: "Your account pauses until you choose a plan. Nothing is charged automatically without your input. Your data stays intact." },
  { q: "Can I cancel or switch plans anytime?", a: "Absolutely. One click in Settings. No cancellation fees, no lock-in, and you keep access until the end of your billing period." },
  { q: "Do you charge per seat or per message?", a: "No. Flat monthly pricing with unlimited seats and unlimited contacts. Meta charges you separately for WhatsApp conversation fees at their standard rates (paid to Meta at cost)." },
];

export default function Pricing() {
  const { format, isUsd, currency } = useLocalCurrency();
  return (
    <MarketingLayout>
      <SEO
        path="/pricing"
        title="Pricing — Starter, Growth & Enterprise plans | Jawabify"
        description="Three simple plans from $45/month with a 7-day free trial. Unlimited AI replies, orders, CRM and campaigns — no per-seat or per-message fees."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Jawabify",
          description: "AI-powered WhatsApp Business platform with unlimited replies, orders, CRM and campaigns.",
          brand: { "@type": "Brand", name: "Jawabify" },
          offers: [
            { "@type": "Offer", name: "Starter", price: "45", priceCurrency: "USD", url: "https://jawabify.com/pricing", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "Growth", price: "90", priceCurrency: "USD", url: "https://jawabify.com/pricing", availability: "https://schema.org/InStock" },
          ],
        }}
      />
      <Section className="pt-24">
        <SectionHeader
          as="h1"
          center
          eyebrow="Pricing"
          title={<>Three plans. <span className="gradient-text">Pays for itself in days.</span></>}
          description="No per-seat fees. No per-message markups. Pick the plan that fits — upgrade anytime."
        />
      </Section>

      {/* Cards */}
      <Section className="pt-0">
        <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto items-start">
          {/* Starter */}
          <div className="rounded-3xl border border-border bg-white p-8 card-elevated">
            <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground">Starter</div>
            <div className="mt-6 flex items-baseline gap-2">
              <div className="text-xl font-medium line-through text-muted-foreground/70">{format(90)}</div>
              <div className="font-display text-5xl font-bold">{format(45)}</div>
              <div className="text-muted-foreground">/ month</div>
            </div>
            <p className="mt-2 text-muted-foreground text-sm">Everything you need to start replying automatically.</p>
            <Link to="/auth?mode=signup" className="mt-8 inline-flex w-full justify-center items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground">What's included</div>
            <ul className="mt-3 space-y-2.5">
              {starter.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Growth — highlighted */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-8 text-white noise lg:-mt-4">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">Growth</div>
                <div className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-white px-2 py-0.5 text-[10px] font-semibold"><Sparkles className="h-3 w-3" /> Most popular</div>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <div className="text-xl font-medium line-through text-white/50">{format(140)}</div>
                <div className="font-display text-5xl font-black">{format(90)}</div>
                <div className="text-white/80">/ month</div>
              </div>
              <p className="mt-2 text-white/80 text-sm">Scale without limits. Built for serious operators.</p>
              <Link to="/auth?mode=signup" className="mt-8 inline-flex w-full justify-center items-center gap-2 rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold hover:bg-white/90 transition-colors">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-6 text-[11px] uppercase tracking-widest text-white/70">What's included</div>
              <ul className="mt-3 space-y-2.5">
                {growth.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/85">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl border border-border bg-white p-8 card-elevated">
            <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground">Enterprise</div>
            <div className="mt-6 font-display text-4xl font-bold">Custom</div>
            <p className="mt-2 text-muted-foreground text-sm">For agencies, multi-brand, and high-volume operations.</p>
            <Link to="/contact" className="mt-8 inline-flex w-full justify-center items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors">
              Talk to sales <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground">What's included</div>
            <ul className="mt-3 space-y-2.5">
              {enterprise.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Comparison */}
      <Section>
        <SectionHeader eyebrow="Compare" title={<>Full breakdown, <span className="gradient-text">side by side</span></>} />
        <div className="mt-10 rounded-3xl border border-border bg-white overflow-hidden card-elevated">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-sm">
            <div className="p-4 bg-secondary/40 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Feature</div>
            <div className="p-4 bg-secondary/40 text-[11px] font-semibold uppercase tracking-widest text-foreground">Starter · {format(45)}/mo</div>
            <div className="p-4 bg-secondary/40 text-[11px] font-semibold uppercase tracking-widest text-foreground">Growth · {format(90)}/mo</div>
            <div className="p-4 bg-secondary/40 text-[11px] font-semibold uppercase tracking-widest text-foreground">Enterprise</div>
            {compare.map((r, i) => (
              <div key={i} className="contents">
                <div className="p-4 border-t border-border font-medium">{r.row}</div>
                <div className="p-4 border-t border-border text-muted-foreground">{r.starter}</div>
                <div className="p-4 border-t border-border text-muted-foreground">{r.growth}</div>
                <div className="p-4 border-t border-border text-muted-foreground">{r.ent}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">* Meta rate limits apply per template category. We help you scale your messaging tier as your quality rating grows.</p>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeader center eyebrow="Pricing FAQ" title={<>Common <span className="gradient-text">pricing questions</span></>} />
        <div className="mt-10 max-w-3xl mx-auto rounded-3xl border border-border bg-white p-2 sm:p-4 card-elevated">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border last:border-0">
                <AccordionTrigger className="px-4 sm:px-6 py-5 text-left font-display text-base sm:text-lg font-semibold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="px-4 sm:px-6 pb-5 text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          {isUsd
            ? "Prices in USD. Meta WhatsApp conversation fees billed separately by Meta at cost."
            : `Prices shown in ${currency.code} are indicative — billing is charged in USD ($45 / $90). Meta WhatsApp conversation fees billed separately by Meta at cost.`}
        </div>
      </Section>
    </MarketingLayout>
  );
}
