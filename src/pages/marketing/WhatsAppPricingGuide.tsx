import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, DollarSign, Info, LineChart, MessageSquare, ShieldCheck, Sparkles, Timer, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import { BrowserFrame, CampaignBuilder, WhatsAppChat } from "@/components/marketing/Mockups";

const categories = [
  {
    key: "Marketing",
    icon: Sparkles,
    purpose: "Promotions, offers, product launches, cart nudges — anything designed to drive interest or sales.",
    initiated: "Business-initiated with an approved template.",
    example: "'Flash sale — 20% off tan crossbody bags today only.'",
    pricing: "Highest per-conversation rate. Priced separately per country and updated by Meta throughout the year.",
    tips: ["Segment tightly and exclude opted-out contacts", "Use clear value in the first line", "Pace sends to protect quality rating"],
  },
  {
    key: "Utility",
    icon: CheckCircle2,
    purpose: "Order updates, appointment confirmations, delivery notifications, account alerts — transactional messages tied to a real user action.",
    initiated: "Business-initiated with an approved utility template.",
    example: "'Order #1042 is out for delivery. Track it here.'",
    pricing: "Mid-tier rate. Cheaper than Marketing and often bundled with Service inside the 24-hour window.",
    tips: ["Trigger from real events (order, booking, payment)", "Match the template wording to the trigger", "Include order or reference IDs for context"],
  },
  {
    key: "Authentication",
    icon: ShieldCheck,
    purpose: "One-time passwords, login codes, transaction verification — anything the user must confirm to complete an action.",
    initiated: "Business-initiated with an approved authentication template.",
    example: "'Your verification code is 918273. Do not share it.'",
    pricing: "Priced per country and generally lower than Marketing. Often has stricter template formatting rules.",
    tips: ["Keep codes short-lived", "Use the authentication template category, not utility", "Never mix OTPs with promotional copy"],
  },
  {
    key: "Service",
    icon: MessageSquare,
    purpose: "Free-form customer support replies inside the 24-hour customer service window — the customer messages first, you reply.",
    initiated: "Customer-initiated. No template required inside the window.",
    example: "Customer: 'Is the tan bag still in stock?' → Business: 'Yes, tan is in stock, same-day delivery in Beirut.'",
    pricing: "Cheapest category. Meta gives every business a monthly free-tier allowance of service conversations.",
    tips: ["Answer within the 24-hour window to stay free-form", "After 24h you must use a template", "Route to human when AI is unsure"],
  },
];

const faq = [
  {
    question: "What are WhatsApp's four conversation categories?",
    answer: "Meta bills WhatsApp Business API messages in four categories: Marketing, Utility, Authentication, and Service. Each has its own use case, template rules, and per-country pricing.",
  },
  {
    question: "How does the 24-hour customer service window work?",
    answer: "When a customer messages your business, a 24-hour window opens. Inside it, you can reply with free-form messages billed as Service conversations. Outside it, you must send an approved template.",
  },
  {
    question: "Are Service conversations really free?",
    answer: "Meta gives each business a monthly free-tier allowance of Service conversations. Once you exceed the allowance, Service conversations bill at Meta's per-country Service rate — still the cheapest category.",
  },
  {
    question: "How is a WhatsApp conversation counted?",
    answer: "A conversation is a 24-hour session that starts when the first template or customer-initiated message is delivered. All messages inside that window count as one conversation for that category.",
  },
  {
    question: "Which category is cheapest?",
    answer: "Service is the cheapest, followed by Authentication and Utility, with Marketing as the highest-priced category. Exact rates depend on the customer's country.",
  },
  {
    question: "How does Jawabify help reduce WhatsApp costs?",
    answer: "Jawabify keeps most conversations inside the 24-hour Service window with AI replies, uses Utility templates for order and booking updates, and paces Marketing campaigns to protect your quality rating and per-message rate.",
  },
];

export default function WhatsAppPricingGuide() {
  return (
    <MarketingLayout>
      <SEO
        path="/blog/whatsapp-conversation-pricing-guide"
        ogType="article"
        image="https://jawabify.com/favicon.png?v=5"
        title="WhatsApp Business API Pricing Guide 2026 | Jawabify"
        description="How WhatsApp Business API pricing works: Marketing, Utility, Authentication and Service conversations, the 24-hour window and how to lower costs."
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "WhatsApp Business API Pricing: The Complete Guide to Conversation-Based Fees",
            description: "A practical guide to Meta's WhatsApp Business API pricing model — the four conversation categories, the 24-hour window, free-tier Service messages, and how to control costs.",
            author: { "@type": "Organization", name: "Jawabify" },
            publisher: { "@type": "Organization", name: "Jawabify", logo: { "@type": "ImageObject", url: "https://jawabify.com/favicon.png?v=5" } },
            mainEntityOfPage: "https://jawabify.com/blog/whatsapp-conversation-pricing-guide",
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> WhatsApp API pricing
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.02]">
              WhatsApp Business API <span className="gradient-text">conversation-based pricing</span>, explained
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              A plain-English guide to how Meta bills WhatsApp Business API messages — Marketing, Utility, Authentication and Service conversations, the 24-hour window, and the tactics operators use to keep costs low.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-foreground/90">
                Start 7-day free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold hover:bg-secondary">
                See Jawabify pricing
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
          <Metric icon={MessageSquare} value="4" label="conversation categories" />
          <Metric icon={Timer} value="24h" label="customer service window" />
          <Metric icon={DollarSign} value="Free tier" label="service conversations" />
          <Metric icon={LineChart} value="Per country" label="marketing rate" />
        </div>
      </Section>

      <Section className="pt-8">
        <SectionHeader
          eyebrow="Pricing 101"
          title={<>Meta bills <span className="gradient-text">conversations</span>, not individual messages</>}
          description="A conversation is a 24-hour session between your business and a customer. Every message inside that window bills as one conversation in one of four categories."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {categories.map((c) => (
            <article key={c.key} className="rounded-3xl border border-border bg-white p-7 card-elevated">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold">{c.key}</h2>
              </div>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{c.purpose}</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-primary font-semibold">Who starts it</dt>
                  <dd className="mt-1 text-foreground">{c.initiated}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-primary font-semibold">Example</dt>
                  <dd className="mt-1 text-foreground italic">{c.example}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-primary font-semibold">Pricing</dt>
                  <dd className="mt-1 text-foreground">{c.pricing}</dd>
                </div>
              </dl>
              <ul className="mt-5 space-y-2">
                {c.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" /> {tip}
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
              <Timer className="h-3.5 w-3.5" /> 24-hour window
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">The 24-hour customer service window is the single most important cost lever.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every time a customer messages your business, a 24-hour window opens. Inside it, you can send unlimited free-form replies — billed at the cheapest Service rate, and often free thanks to Meta's monthly Service allowance. Once the window closes, any message you send must use an approved template and billed as Marketing, Utility, or Authentication.
            </p>
            <ol className="mt-6 space-y-3">
              {[
                "Customer sends the first message → 24-hour window opens.",
                "Replies inside the window are Service conversations (free-form, cheapest).",
                "After 24 hours, business-initiated messages require an approved template.",
                "Utility templates cover order and booking follow-ups at a lower rate than Marketing.",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-foreground">
                  <span className="h-6 w-6 rounded-full bg-foreground text-background grid place-items-center text-[11px] font-bold shrink-0">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
          <BrowserFrame url="app.jawabify.com/inbox">
            <WhatsAppChat />
          </BrowserFrame>
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="How to spend less"
          title={<>Six ways operators keep <span className="gradient-text">WhatsApp API costs</span> under control</>}
          description="You can't change Meta's rate card, but you can control which category most of your conversations fall into."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Bot, title: "Use AI inside the 24-hour window", body: "Automate customer questions so most conversations stay in the cheap Service category instead of drifting into paid templates." },
            { icon: CheckCircle2, title: "Prefer Utility templates for updates", body: "Order confirmations, delivery updates and appointment reminders belong in Utility, not Marketing." },
            { icon: Sparkles, title: "Segment Marketing campaigns", body: "Fewer, more relevant Marketing sends mean higher conversion per paid conversation and better quality rating." },
            { icon: ShieldCheck, title: "Respect STOP replies", body: "Excluding opted-out contacts protects quality rating and prevents wasted Marketing conversations." },
            { icon: LineChart, title: "Measure revenue per conversation", body: "Attribute orders back to specific chats and campaigns so you can cut the ones that don't pay for themselves." },
            { icon: Zap, title: "Pace sends, don't blast", body: "Meta rewards steady, high-quality sending with higher messaging tiers and better rates over time." },
          ].map((t) => (
            <div key={t.title} className="rounded-3xl border border-border bg-white p-6 card-elevated">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mb-4">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <BrowserFrame url="app.jawabify.com/campaigns">
            <CampaignBuilder />
          </BrowserFrame>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
              <DollarSign className="h-3.5 w-3.5" /> Rate reality check
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">Rates change — Meta updates the price list per country throughout the year.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              This guide covers the pricing model, not a fixed rate card. Meta publishes and updates per-country rates for each conversation category, and those rates shift over time. Build your operation around the model — Service inside the window, Utility for events, Marketing for demand — and your costs stay predictable even when individual rates move.
            </p>
            <div className="mt-6 inline-flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-foreground">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p>Always confirm the current per-country rate for your target markets in the Meta Business Help Center before you plan a large Marketing campaign.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Common questions" title={<>WhatsApp API pricing <span className="gradient-text">FAQ</span></>} />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {faq.map((item) => (
            <div key={item.question} className="rounded-2xl border border-border bg-white p-6 card-elevated">
              <h3 className="font-display text-lg font-bold">{item.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] to-[hsl(258_60%_15%)] p-10 sm:p-14 text-white text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Predictable WhatsApp costs, starting today.</h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            Jawabify keeps most conversations inside the free 24-hour Service window with AI, uses Utility templates for order updates, and paces Marketing campaigns to protect your rate.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth?mode=signup" className="rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/90">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/blog/whatsapp-business-api-guide" className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold hover:bg-white/10">
              Read the API guide
            </Link>
          </div>
        </div>
      </Section>

      {/* Related reading */}
      <Section>
        <SectionHeader eyebrow="Keep reading" title={<>More on WhatsApp, AI, and <span className="gradient-text">growing with Jawabify</span></>} />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Link to="/blog/whatsapp-business-api-guide" className="group rounded-3xl border border-border bg-white p-7 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">Setup</div>
            <h3 className="font-display text-xl font-bold group-hover:text-primary transition-colors">WhatsApp Business API guide</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">How the Cloud API differs from the free app, how messaging limits scale, and how Jawabify turns it into a working AI inbox.</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Read guide <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></div>
          </Link>
          <Link to="/how-it-works" className="group rounded-3xl border border-border bg-white p-7 card-elevated hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition-all">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">Product</div>
            <h3 className="font-display text-xl font-bold group-hover:text-primary transition-colors">How Jawabify works</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">The seven-step timeline from connecting WhatsApp to going live with AI replies, orders, bookings, and campaigns.</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">See setup <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></div>
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
