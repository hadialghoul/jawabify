import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { MessageCircle, Mail, ArrowRight, Sparkles, ShieldCheck, Globe2, Bot, Zap, CreditCard } from "lucide-react";

const groups = [
  {
    icon: Sparkles,
    title: "Getting started",
    items: [
      { q: "Do I need to change my WhatsApp number?", a: "No. We connect via the official Meta WhatsApp Business Cloud API. You keep your number and your customers keep messaging you as usual." },
      { q: "Do I need to delete my WhatsApp account?", a: "Yes. Because a phone number can only be used once on Meta for WhatsApp, you cannot use the same number on both personal WhatsApp and Jawabify. If you want to use your existing personal number, you must delete your personal WhatsApp account first." },
      { q: "How long does setup take?", a: "Most businesses go live in 10–30 minutes. Connect Meta, upload your knowledge base, and the AI starts replying immediately." },
      { q: "Do I need a developer?", a: "No. The entire setup is self-serve through our dashboard. If you'd like white-glove help, our Enterprise plan includes it." },
    ],
  },
  {
    icon: Bot,
    title: "AI behavior",
    items: [
      { q: "What languages does the AI speak?", a: "20+ including English, Arabic (both standard and Arabizi), French, Spanish, Portuguese, and more. It auto-detects and mirrors the customer's language." },
      { q: "Will the AI make things up?", a: "No. Jawabify uses strict grounding rules — if a piece of information isn't in your knowledge base or catalog, the AI either says so or escalates to a human. We call this deterministic behavior." },
      { q: "Can I hand off to a human agent?", a: "Yes. Toggle AI off per conversation, or configure automatic escalation on keywords, sentiment, or unresolved intents. Your team picks up right where the AI left off." },
      { q: "Can I control the tone of the AI?", a: "Yes. Set formal, friendly, playful, or any brand voice. Provide sample chats and the AI matches your existing style." },
    ],
  },
  {
    icon: Zap,
    title: "Integrations",
    items: [
      { q: "Does it integrate with Shopify?", a: "Yes — native OAuth integration syncs your product catalog, creates real orders, and pulls fulfillment status back into WhatsApp automatically." },
      { q: "Can I connect Google Calendar?", a: "Yes. Bookings created via WhatsApp sync bi-directionally with Google Calendar so your team sees everything in one place." },
      { q: "What about other platforms?", a: "We support CSV import/export for CRMs, Zapier-compatible webhooks, and a REST API for custom integrations. Enterprise plans include bespoke integrations." },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Security & compliance",
    items: [
      { q: "How is my data secured?", a: "Multi-tenant row-level security, encryption at rest and in transit, audited edge functions, and no data sharing across tenants. Ever." },
      { q: "Do you train AI on my conversations?", a: "No. Your conversations are used only to serve your customers. We never share, sell, or train foundational models on your data." },
      { q: "What about GDPR and data deletion?", a: "GDPR-ready by design. Every tenant can export or delete their data at any time from the dashboard." },
    ],
  },
  {
    icon: Globe2,
    title: "Campaigns & compliance",
    items: [
      { q: "What about STOP keywords and opt-outs?", a: "We handle STOP, UNSUBSCRIBE, and CANCEL keywords automatically per tenant. Campaigns exclude opted-out contacts with a single checkbox." },
      { q: "Can I scale past the 250-message limit?", a: "Yes. Our campaign worker respects Meta's tier system and automatically paces sends. As your quality rating grows, your limits grow — we help you get to 100k+/day." },
      { q: "Are templates approved by Meta?", a: "Every campaign template you create is submitted to Meta for approval. We help you write templates that pass on the first try." },
    ],
  },
  {
    icon: CreditCard,
    title: "Pricing & billing",
    items: [
      { q: "Is there a free trial?", a: "Yes — 7 days, no credit card required. Full feature access." },
      { q: "What happens after the trial?", a: "You choose a plan or your account pauses. No auto-charging without your input. Your data stays intact." },
      { q: "Can I cancel anytime?", a: "One click in Settings. No cancellation fees, no lock-in." },
      { q: "Are Meta WhatsApp fees included?", a: "No. Meta charges you separately for conversations at their standard rates (typically $0.005–$0.10 per conversation). We pass this through at cost." },
    ],
  },
];

export default function FAQ() {
  return (
    <MarketingLayout>
      <SEO
        path="/faq"
        title="FAQ — Common Questions about Jawabify WhatsApp AI"
        description="Answers about setup, AI behavior, integrations, security, campaigns, and pricing for the Jawabify WhatsApp AI platform."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups.flatMap((g) =>
            g.items.map((it) => ({
              "@type": "Question",
              name: it.q,
              acceptedAnswer: { "@type": "Answer", text: it.a },
            })),
          ),
        }}
      />
      <Section className="pt-24 pb-8">
        <SectionHeader
          as="h1"
          center
          eyebrow="FAQ"
          title={<>Questions, <span className="gradient-text">answered</span></>}
          description="Everything you need to know before starting your trial. Still curious? We're one message away."
        />
      </Section>

      <Section className="pt-8">
        <div className="grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
          {groups.map((g) => (
            <div key={g.title} className="rounded-3xl border border-border bg-white p-6 sm:p-8 card-elevated">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <g.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold">{g.title}</h2>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {g.items.map((f, i) => (
                  <AccordionItem key={i} value={`${g.title}-${i}`} className="border-b border-border last:border-0">
                    <AccordionTrigger className="text-left font-semibold text-sm sm:text-base hover:no-underline py-4">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </Section>

      {/* Support CTA */}
      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 sm:p-14 text-white">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold">Still have questions?</h2>
              <p className="mt-3 text-white/80">Our team replies within one business day on every channel — WhatsApp, email, or a live call.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/contact" className="rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold inline-flex items-center gap-2">
                  Contact us <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/auth?mode=signup" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">
                  Start free trial
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              <a href="https://wa.me/971523506806" target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-emerald-500 grid place-items-center"><MessageCircle className="h-5 w-5 text-white" /></div>
                <div className="flex-1">
                   <div className="text-xs text-white/75">WhatsApp us</div>
                  <div className="font-semibold text-sm">+971 52 350 6806</div>
                </div>
                 <ArrowRight className="h-4 w-4 text-white/75" />
              </a>
              <a href="mailto:hello@jawabify.com" className="flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-primary grid place-items-center"><Mail className="h-5 w-5 text-white" /></div>
                <div className="flex-1">
                   <div className="text-xs text-white/75">Email support</div>
                  <div className="font-semibold text-sm">hello@jawabify.com</div>
                </div>
                 <ArrowRight className="h-4 w-4 text-white/75" />
              </a>
            </div>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
