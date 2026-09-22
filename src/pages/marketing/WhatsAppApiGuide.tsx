import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, Globe2, LineChart, MessageSquare, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { BrowserFrame, CampaignBuilder, InboxMockup, WhatsAppChat } from "@/components/marketing/Mockups";


const guideSections = [
  {
    title: "WhatsApp Business App vs WhatsApp Business API",
    body: "The free WhatsApp Business app is built for owner-operated teams replying manually from one or two phones. The WhatsApp Business API is built for companies that need automation, routing, approved templates, campaign scale, analytics, and multiple agents working from one governed inbox.",
    points: ["Shared team inbox instead of one phone", "AI and workflow automation", "Approved template campaigns", "Analytics, CRM history, and integrations"],
  },
  {
    title: "Why MENA businesses need a different playbook",
    body: "In Lebanon, UAE, Saudi Arabia, Egypt, Jordan, and across the region, customers expect businesses to sell and support directly on WhatsApp. That means Arabic, Arabizi, English, and French conversations often happen in the same inbox — sometimes in the same thread.",
    points: ["20+ language detection and mirroring", "Arabic and Arabizi support", "Region-aware delivery and order policies", "Campaign compliance with opt-outs"],
  },
  {
    title: "How messaging limits grow beyond 250 conversations",
    body: "Meta increases marketing capacity gradually based on quality rating, template performance, opt-out behavior, and delivery reputation. The fastest route is not blasting harder — it is pacing sends, using clear templates, excluding opted-out contacts, and earning higher tiers safely.",
    points: ["STOP handling and opt-out exclusion", "Send pacing by campaign worker", "Template quality monitoring", "Revenue attribution by campaign"],
  },
];

const faq = [
  {
    question: "What is the WhatsApp Business API?",
    answer: "It is Meta's official cloud infrastructure for businesses that need automated WhatsApp support, team inboxes, campaigns, CRM integration, and compliant template messaging.",
  },
  {
    question: "Do I need developers to use the WhatsApp API?",
    answer: "Not with Jawabify. Jawabify handles the Meta connection, inbox, AI setup, knowledge import, campaign tools, and analytics from one dashboard.",
  },
  {
    question: "Can the WhatsApp API support Arabic and Arabizi?",
    answer: "Yes. Jawabify detects and mirrors Arabic, Arabizi, English, French, and 20+ languages so customers are answered in the way they naturally message.",
  },
];

export default function WhatsAppApiGuide() {
  return (
    <MarketingLayout>
      <SEO
        path="/blog/whatsapp-business-api-guide"
        ogType="article"
        image="https://jawabify.com/favicon.png?v=5"
        title="WhatsApp Business API Guide for MENA Businesses | Jawabify"
        description="A practical guide to WhatsApp Business API: automation, campaigns, messaging limits, templates and Arabic support — with setup made simple."
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "The Complete Guide to WhatsApp Business API for MENA Businesses",
            description: "A practical guide to WhatsApp Business API automation, campaigns, templates, limits, and multilingual customer support for MENA companies.",
            author: { "@type": "Organization", name: "Jawabify" },
            publisher: { "@type": "Organization", name: "Jawabify", logo: { "@type": "ImageObject", url: "https://jawabify.com/favicon.png?v=5" } },
            mainEntityOfPage: "https://jawabify.com/blog/whatsapp-business-api-guide",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ]}
      />

      <Section className="pt-24 pb-8">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-primary uppercase tracking-widest mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> WhatsApp API guide
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.02]">
              The complete guide to <span className="gradient-text">WhatsApp Business API</span> for MENA businesses
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Compare the standard WhatsApp Business app with the Cloud API, learn how messaging limits scale, and see how Jawabify turns the API into a working AI support, ordering, CRM, and campaign platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-foreground/90">
                Start 7-day free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary">
                Talk to an expert
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" aria-hidden />
            <div className="relative animate-float">
              <WhatsAppChat compact />
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-5 md:grid-cols-4">
          <Metric icon={MessageSquare} value="0.8s" label="average AI reply" />
          <Metric icon={Globe2} value="20+" label="supported languages" />
          <Metric icon={LineChart} value="100k+" label="daily campaign path" />
          <Metric icon={ShieldCheck} value="Official" label="Meta Cloud API" />
        </div>
      </Section>

      <Section className="pt-8">
        <SectionHeader
          eyebrow="The API explained"
          title={<>What changes when you move from the app to the <span className="gradient-text">Cloud API</span></>}
          description="The API is not just a different login. It unlocks a completely different operating model for sales, support, operations, and marketing."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {guideSections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-border bg-white p-7 card-elevated">
              <h2 className="font-display text-2xl font-bold">{section.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              <ul className="mt-5 space-y-2.5">
                {section.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" /> {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
              <Bot className="h-3.5 w-3.5" /> Jawabify's role
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">You get API power without building API infrastructure.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              The WhatsApp Business API is powerful, but raw API access still leaves you to build auth, webhooks, message storage, agent routing, campaign pacing, template management, AI safety, CRM context, and analytics. Jawabify gives your team those layers from day one.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Meta onboarding and number connection",
                "AI replies grounded in your catalog and FAQ",
                "Shared inbox for human takeover",
                "Orders, appointments, CRM, and campaigns",
                "STOP compliance and opt-out exclusion",
                "Analytics that connect chats to revenue",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary shrink-0" /> {item}
                </div>
              ))}
            </div>
          </div>
          <BrowserFrame url="app.jawabify.com/inbox">
            <InboxMockup className="h-[520px]" />
          </BrowserFrame>
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <BrowserFrame url="app.jawabify.com/campaigns">
            <CampaignBuilder />
          </BrowserFrame>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
              <Zap className="h-3.5 w-3.5" /> Campaign scale
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">How to grow from 250 messages to serious campaign volume.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              WATI-style scale comes from the same fundamentals: verified business setup, clean templates, healthy opt-out rates, good quality rating, controlled pacing, and consistent customer value. Jawabify operationalizes those rules so your campaigns grow without damaging your sender reputation.
            </p>
            <ol className="mt-6 space-y-3">
              {[
                "Segment audiences and exclude customers who replied STOP.",
                "Use clear value-led templates that match customer expectations.",
                "Pace sends instead of flooding the account in one burst.",
                "Measure replies, orders, opt-outs, and revenue after each campaign.",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-foreground">
                  <span className="h-6 w-6 rounded-full bg-foreground text-background grid place-items-center text-[11px] font-bold shrink-0">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 sm:p-14 text-white text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Turn WhatsApp into your operating system.</h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Launch the official WhatsApp Business API, AI replies, campaigns, CRM, and analytics without hiring an engineering team.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth?mode=signup" className="rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/90">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold hover:bg-white/10">
              View pricing
            </Link>
          </div>
        </div>
      </Section>

      {/* Related reading */}
      <Section>
        <SectionHeader eyebrow="Keep reading" title={<>More on WhatsApp, AI, and <span className="gradient-text">growing with Jawabify</span></>} />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Link to="/blog/whatsapp-conversation-pricing-guide" className="group rounded-3xl border border-border bg-white p-7 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">Pricing</div>
            <h3 className="font-display text-xl font-bold group-hover:text-primary transition-colors">WhatsApp Business API pricing guide</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">How Marketing, Utility, Authentication and Service conversations are billed, the 24-hour window, and how to lower your costs.</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Read guide <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></div>
          </Link>
          <Link to="/features" className="group rounded-3xl border border-border bg-white p-7 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">Product</div>
            <h3 className="font-display text-xl font-bold group-hover:text-primary transition-colors">Explore every Jawabify feature</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">AI assistant, analytics, CRM, orders, bookings, campaigns, and the shared inbox — all in one platform.</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">See features <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></div>
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  );
}


function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 card-elevated">
      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mb-4">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="font-display text-3xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}