import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { Link } from "react-router-dom";
import {
  ArrowRight, Plug, Brain, Sparkles, MessageSquare, Bot,
  ShoppingCart, LineChart, Check,
} from "lucide-react";
import {
  BrowserFrame, WhatsAppChat, AnalyticsMockup, OrdersBoard,
} from "@/components/marketing/Mockups";

const steps = [
  {
    n: "01", icon: Plug, title: "Connect WhatsApp",
    body: "Sign in with Meta. We provision your WhatsApp Business Cloud API in one click — no phone-switching, no waiting for approvals.",
    detail: "Meta OAuth · Number verified in ~2 min · Existing number, no changes",
    time: "~2 min",
  },
  {
    n: "02", icon: Brain, title: "Upload your business knowledge",
    body: "Import PDFs, spreadsheets, product images, or paste your website URL. Connect Shopify with one click for live catalog sync.",
    detail: "Drag & drop · Shopify OAuth · PDF, DOCX, CSV, XLSX supported",
    time: "~5 min",
  },
  {
    n: "03", icon: Sparkles, title: "Train the AI on your voice",
    body: "Tell it your tone, business hours, delivery policy, and escalation rules. It reads examples of past chats and adapts to your style.",
    detail: "Guided setup · Test in sandbox before going live",
    time: "~5 min",
  },
  {
    n: "04", icon: MessageSquare, title: "Customers start chatting",
    body: "Nothing changes for your customers — same number, same WhatsApp. But now every message gets a reply in seconds.",
    detail: "Zero customer-side changes · Number stays the same",
    time: "Instant",
  },
  {
    n: "05", icon: Bot, title: "AI responds instantly",
    body: "Answers questions in the customer's language, sends product photos, transcribes voice notes, and handles the boring 90%.",
    detail: "0.8s avg reply · 20+ languages · Grounded in your KB",
    time: "0.8s",
  },
  {
    n: "06", icon: ShoppingCart, title: "Orders & appointments happen automatically",
    body: "The deterministic order flow captures items, addresses, and totals — then syncs directly to Shopify or your calendar.",
    detail: "State-machine ordering · Shopify sync · Google Calendar",
    time: "Real-time",
  },
  {
    n: "07", icon: LineChart, title: "Monitor everything from analytics",
    body: "Reply rate, resolution %, orders, campaign ROI, peak hours. Real revenue attribution back to individual conversations.",
    detail: "40+ metrics · Live · CSV & API export",
    time: "Always on",
  },
];

export default function HowItWorks() {
  return (
    <MarketingLayout>
      <SEO
        path="/how-it-works"
        title="How Jawabify Works — Set Up WhatsApp AI in Under an Hour"
        description="See how Jawabify connects to WhatsApp, learns your business, and starts answering, ordering and booking automatically — step by step."
      />
      <Section className="pt-24">
        <SectionHeader
          as="h1"
          center
          eyebrow="How it works"
          title={<>From zero to fully automated <span className="gradient-text">in under an hour</span></>}
          description="No integrations to build. No developers required. Follow the timeline below and go live today."
        />
      </Section>

      {/* Timeline */}
      <Section className="pt-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 sm:left-8 top-8 bottom-8 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent" />
          <ol className="space-y-6">
            {steps.map((s, i) => (
              <li key={s.n} className="relative pl-16 sm:pl-24">
                {/* Node */}
                <div className="absolute left-0 top-4 h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-white border-2 border-primary shadow-[var(--shadow-elegant)] grid place-items-center">
                  <s.icon className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
                </div>
                <div className="rounded-3xl border border-border bg-white p-6 sm:p-8 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Step {s.n}</div>
                      <h2 className="font-display text-2xl font-bold">{s.title}</h2>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-secondary text-muted-foreground shrink-0">{s.time}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.body}</p>
                  <div className="mt-4 flex items-center gap-2 text-[12px] text-primary">
                    <Check className="h-3.5 w-3.5" /> {s.detail}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* What it looks like */}
      <Section>
        <SectionHeader
          center
          eyebrow="What it looks like"
          title={<>The moment you go live, <span className="gradient-text">this is what you see</span></>}
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Customer side · WhatsApp</div>
            <WhatsAppChat />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Your side · Jawabify dashboard</div>
            <BrowserFrame url="app.jawabify.com/orders"><OrdersBoard /></BrowserFrame>
          </div>
        </div>
        <div className="mt-8">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">And your analytics update in real time</div>
          <BrowserFrame url="app.jawabify.com/analytics"><AnalyticsMockup /></BrowserFrame>
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 sm:p-14 text-white text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Ready to start your setup?</h2>
          <p className="mt-3 text-white/80">The first 4 steps take under 15 minutes. The rest happens automatically.</p>
          <Link to="/auth" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold hover:bg-white/90">
            Start your setup <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  );
}
