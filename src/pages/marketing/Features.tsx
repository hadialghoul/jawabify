import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader, BentoCard } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import {
  BrowserFrame, WhatsAppChat, AnalyticsMockup, CrmCard, OrdersBoard,
  CalendarMockup, CampaignBuilder, InboxMockup, FeatureRow,
} from "@/components/marketing/Mockups";
import {
  Bot, ShoppingCart, MessageSquare, Users, LineChart, Calendar, Zap,
  Image as ImageIcon, Mic, Boxes, ShieldCheck, Globe2, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";

const smallFeatures = [
  { icon: Mic, title: "Voice transcription", body: "Voice notes transcribed and answered like any text message. Arabic, English, French." },
  { icon: ImageIcon, title: "Image replies", body: "Send product photos automatically when a customer asks — no manual attachment hunting." },
  { icon: Boxes, title: "Knowledge base", body: "PDFs, spreadsheets, product images, or your website — all become answerable knowledge." },
  { icon: Globe2, title: "20+ languages", body: "Auto-detects and mirrors the customer's language, including Arabizi and dialects." },
  { icon: ShieldCheck, title: "Enterprise security", body: "Row-level tenant isolation, encrypted end-to-end, GDPR-ready audit trails." },
  { icon: Zap, title: "Meta Cloud API", body: "Native official API integration — no bans, no bridges, template-compliant campaigns." },
];

export default function Features() {
  return (
    <MarketingLayout>
      <SEO
        path="/features"
        title="Features — AI WhatsApp Inbox & CRM | Jawabify"
        description="Every Jawabify feature: AI replies in 20+ languages, orders, CRM, analytics, bookings and campaigns — one platform for WhatsApp teams."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Jawabify AI WhatsApp Messaging Platform",
          provider: { "@type": "Organization", name: "Jawabify", url: "https://jawabify.com" },
          areaServed: "Worldwide",
          description: "AI-powered WhatsApp Business platform for customer support, orders, bookings and marketing campaigns.",
          url: "https://jawabify.com/features",
        }}
      />
      {/* Hero */}
      <Section className="pt-24 pb-8">
        <SectionHeader
          as="h1"
          center
          eyebrow="Features"
          title={<>Every tool you need, <span className="gradient-text">nothing you don't</span></>}
          description="A focused platform built for teams that treat WhatsApp as their primary customer channel. Explore every part of the product."
        />
      </Section>

      {/* Feature 1: AI */}
      <Section className="pt-8">
        <FeatureRow
          eyebrow="AI Assistant"
          title={<>Your smartest employee, <span className="gradient-text">on WhatsApp</span></>}
          body="Understands intent, remembers context across 40 messages, mirrors the customer's language, and grounds every answer in your knowledge base. When it isn't sure, it hands off to a human — cleanly."
          bullets={[
            { label: "Avg reply", value: "0.8s" },
            { label: "Auto-resolved", value: "94%" },
            { label: "Context window", value: "40 msgs" },
          ]}
          cta={<Scenario title="Real scenario" body="Customer asks in Arabizi: “fi Blue medium?” — AI answers in the same style, sends the photo, reserves the item, and confirms the order in under 2 seconds." />}
          visual={<WhatsAppChat />}
        />
      </Section>

      {/* Feature 2: Analytics */}
      <Section>
        <FeatureRow
          reverse
          eyebrow="Analytics"
          title={<>The metrics that <span className="gradient-text">move revenue</span></>}
          body="Reply rate, message volume, peak hours, AI resolution %, order status breakdown, top products, returning customer rate, campaign ROI — all in one live dashboard."
          bullets={[
            { label: "KPIs tracked", value: "40+" },
            { label: "Refresh", value: "Live" },
            { label: "Exports", value: "CSV · API" },
          ]}
          cta={<Scenario title="Real scenario" body="A restaurant discovers 68% of orders arrive between 7–9 PM. They shift staffing, cut wait time by half, and add a 6 PM promo campaign that lifts weekday revenue 22%." />}
          visual={<BrowserFrame url="app.jawabify.com/analytics"><AnalyticsMockup /></BrowserFrame>}
        />
      </Section>

      {/* Feature 3: CRM */}
      <Section>
        <FeatureRow
          eyebrow="CRM"
          title={<>A real CRM — <span className="gradient-text">not a contact list</span></>}
          body="Every customer gets a rich profile: order history, lifetime value, tags, campaign engagement, AI-generated behavior notes, and a full conversation timeline going back forever."
          bullets={[
            { label: "Contacts", value: "Unlimited" },
            { label: "Segments", value: "Dynamic" },
            { label: "Merges", value: "Auto" },
          ]}
          cta={<Scenario title="Real scenario" body="AI flags Ahmed as a VIP after his 5th purchase. The next campaign automatically excludes him from the discount blast and sends him a personal early-access template instead." />}
          visual={<BrowserFrame url="app.jawabify.com/crm"><CrmCard /></BrowserFrame>}
        />
      </Section>

      {/* Feature 4: Orders */}
      <Section>
        <FeatureRow
          reverse
          eyebrow="Orders"
          title={<>Deterministic order flow. <span className="gradient-text">Never a double-charge.</span></>}
          body="A state machine — not free-form AI — walks the customer through each item, applies pricing, confirms totals, and syncs the order to Shopify or your spreadsheet in real time."
          bullets={[
            { label: "Accuracy", value: "99.9%" },
            { label: "Sync", value: "Shopify" },
            { label: "Delivery", value: "$3 flat" },
          ]}
          cta={<Scenario title="Real scenario" body="Customer says “2 lanterns + 1 backpack, deliver tomorrow.” The bot confirms items, address, and total ($214). Shopify order #1052 is created before the customer stops typing." />}
          visual={<BrowserFrame url="app.jawabify.com/orders"><OrdersBoard /></BrowserFrame>}
        />
      </Section>

      {/* Feature 5: Bookings */}
      <Section>
        <FeatureRow
          eyebrow="Bookings & reservations"
          title={<>A calendar that <span className="gradient-text">fills itself</span></>}
          body="Clinics, salons, restaurants, agencies. The AI checks availability, books the slot, sends reminders 24h and 1h before, and handles reschedules — all through WhatsApp."
          bullets={[
            { label: "No-shows", value: "-38%" },
            { label: "Reminders", value: "Auto" },
            { label: "Google Cal", value: "Sync" },
          ]}
          cta={<Scenario title="Real scenario" body="A dental clinic goes from 22 no-shows/week to 6. AI books the slot, sends a reminder 24h before, and offers a reschedule link if the patient can't make it." />}
          visual={<BrowserFrame url="app.jawabify.com/calendar"><CalendarMockup /></BrowserFrame>}
        />
      </Section>

      {/* Feature 6: Campaigns */}
      <Section>
        <FeatureRow
          reverse
          eyebrow="Campaigns"
          title={<>Broadcast to thousands. <span className="gradient-text">Get real replies.</span></>}
          body="Segment your audience, pick a Meta-approved template, and send. STOP keywords, delivery pacing, and revenue attribution are all handled automatically."
          bullets={[
            { label: "Delivery", value: "99.2%" },
            { label: "Reach", value: "10k+ / hr" },
            { label: "Opt-out", value: "Auto STOP" },
          ]}
          cta={<Scenario title="Real scenario" body="A boutique sends a Winter Sale to 4,218 contacts on a Friday at 7 PM. 34% reply within the hour, 118 orders come in overnight — attributed back to the campaign." />}
          visual={<BrowserFrame url="app.jawabify.com/campaigns"><CampaignBuilder /></BrowserFrame>}
        />
      </Section>

      {/* Team inbox */}
      <Section>
        <SectionHeader
          center
          eyebrow="Team inbox"
          title={<>One workspace for <span className="gradient-text">every agent, every chat</span></>}
          description="Assign conversations, leave internal notes, tag contacts, and hand off between AI and humans without a single dropped ball."
        />
        <div className="mt-12">
          <BrowserFrame url="app.jawabify.com/inbox"><InboxMockup className="h-[520px]" /></BrowserFrame>
        </div>
      </Section>

      {/* Small feature grid */}
      <Section>
        <SectionHeader
          eyebrow="Everything else"
          title={<>Details that make the <span className="gradient-text">difference</span></>}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {smallFeatures.map((f) => (
            <BentoCard key={f.title}>
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </BentoCard>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="rounded-3xl border border-border bg-white p-10 sm:p-14 text-center card-elevated">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">See it running on your business in minutes</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Connect WhatsApp, import your catalog, and go live the same day.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth?mode=signup" className="rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold hover:bg-foreground/90">
              Start free trial
            </Link>
            <Link to="/how-it-works" className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary inline-flex items-center gap-1.5">
              See how it works <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function Scenario({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">{title}</div>
      <p className="text-sm text-foreground leading-relaxed">{body}</p>
    </div>
  );
}
