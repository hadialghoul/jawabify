import { Link } from "react-router-dom";
import {
  ArrowRight, Play, Bot, ShoppingCart, MessageSquare, Users, LineChart, Calendar,
  Zap, ShieldCheck, Globe2, Sparkles, CheckCircle2, Star, ArrowUpRight, TrendingUp,
} from "lucide-react";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Section, SectionHeader, BentoCard } from "@/components/marketing/Primitives";
import { SEO } from "@/components/marketing/SEO";
import {
  BrowserFrame, WhatsAppChat, AnalyticsMockup, CrmCard, OrdersBoard,
  CalendarMockup, CampaignBuilder, InboxMockup, NotificationStack, LogoCloud, FeatureRow,
} from "@/components/marketing/Mockups";
import { useLocalCurrency } from "@/lib/localCurrency";
import LiveDemo from "@/components/demo/LiveDemo";

export default function Home() {
  const { format, isUsd } = useLocalCurrency();
  return (
    <MarketingLayout>
      <SEO
        path="/"
        title="Jawabify — AI WhatsApp Customer Messaging for Businesses"
        description="Jawabify automates WhatsApp replies, orders, bookings and campaigns with a multilingual AI assistant — live in 10 minutes, in 20+ languages."
      />
      {/* ------------------------- HERO ------------------------- */}
      <section className="relative overflow-hidden pt-10 sm:pt-14 pb-16 sm:pb-24">
        <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--hero-glow)" }} aria-hidden />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid gap-10 lg:gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
            {/* Left: copy */}
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 backdrop-blur px-3 py-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground mb-5 sm:mb-6">
                <span className="flex h-2 w-2"><span className="animate-pulse rounded-full h-2 w-2 bg-primary" /></span>
                <span className="truncate">Now with Arabic, Arabizi & 20+ languages</span>
              </div>
              <h1 className="font-display text-[34px] sm:text-[52px] lg:text-[64px] leading-[1.05] font-extrabold tracking-tight text-foreground">
                The AI that runs your entire <span className="gradient-text">WhatsApp business</span>
              </h1>
              <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Jawabify replies to every customer, takes orders, books appointments, and runs campaigns — 24/7, in every language, from one AI-powered inbox that feels like your best employee.
              </p>
              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                <Link to="/auth" className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold hover:bg-foreground/90 shadow-[var(--shadow-elegant)] transition-all">
                  Start 7-day free trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link to="/how-it-works" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                  <Play className="h-4 w-4" /> See how it works
                </Link>
              </div>
              <div className="mt-5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Cancel anytime</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Live in 10 min</span>
              </div>

              {/* Inline stats */}
              <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-4 max-w-md">
                <HeroStat value="0.8s" label="avg reply" />
                <HeroStat value="94%" label="AI resolved" />
                <HeroStat value="20+" label="languages" />
              </div>
            </div>

            {/* Right: layered product visual */}
            <div className="relative animate-fade-up" style={{ animationDelay: "150ms" }}>
              {/* Mobile: simple WhatsApp chat only */}
              <div className="lg:hidden">
                <WhatsAppChat compact />
              </div>
              {/* Desktop: layered dashboard */}
              <div className="relative hidden lg:block">
                {/* Main dashboard */}
                <BrowserFrame url="app.jawabify.com/dashboard" className="relative z-10">
                  <div className="grid grid-cols-[220px_1fr] h-[440px]">
                    <aside className="border-r border-border bg-secondary/30 p-3 space-y-1">
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-indigo-600 grid place-items-center">
                          <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="font-display font-bold text-sm">Jawabify</span>
                      </div>
                      {[
                        { icon: MessageSquare, label: "Inbox", count: 12, active: true },
                        { icon: ShoppingCart, label: "Orders", count: 284 },
                        { icon: Users, label: "CRM", count: null },
                        { icon: Calendar, label: "Bookings", count: 14 },
                        { icon: LineChart, label: "Analytics", count: null },
                        { icon: Zap, label: "Campaigns", count: null },
                      ].map((n) => (
                        <div key={n.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] ${n.active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                          <n.icon className="h-3.5 w-3.5" />
                          <span className="flex-1">{n.label}</span>
                          {n.count !== null && <span className={`text-[10px] px-1.5 rounded-full ${n.active ? "bg-white/20" : "bg-secondary"}`}>{n.count}</span>}
                        </div>
                      ))}
                    </aside>
                    <div className="p-4 overflow-hidden">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-foreground/80">Overview</div>
                          <div className="font-display font-bold text-base">Today · Nov 15</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Bot className="h-3 w-3" /> AI online
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { l: "Messages", v: "1,284", d: "+18%" },
                          { l: "Orders", v: "42", d: "+31%" },
                          { l: "Revenue", v: "$3,410", d: "+22%" },
                        ].map((s) => (
                          <div key={s.l} className="rounded-lg border border-border p-2">
                            <div className="text-[9px] text-foreground/80 uppercase tracking-widest">{s.l}</div>
                            <div className="font-display font-bold text-sm mt-0.5">{s.v}</div>
                            <div className="text-[9px] text-emerald-600 flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" /> {s.d}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-border p-3 mb-2">
                        <div className="flex items-center justify-between text-[10px] mb-1.5">
                          <span className="font-semibold">Messages · last 24h</span>
                          <span className="text-foreground/80">Peak 8 PM</span>
                        </div>

                        <svg viewBox="0 0 100 30" className="w-full h-14">
                          <defs>
                            <linearGradient id="hgrad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stopColor="hsl(243 75% 59%)" stopOpacity="0.35" />
                              <stop offset="1" stopColor="hsl(243 75% 59%)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d="M0 22 L8 18 L16 20 L24 15 L32 12 L40 14 L48 8 L56 5 L64 9 L72 4 L80 6 L88 10 L100 14 L100 30 L0 30 Z" fill="url(#hgrad)" />
                          <path d="M0 22 L8 18 L16 20 L24 15 L32 12 L40 14 L48 8 L56 5 L64 9 L72 4 L80 6 L88 10 L100 14" fill="none" stroke="hsl(243 75% 59%)" strokeWidth="1.2" />
                        </svg>
                      </div>
                      <div className="rounded-lg border border-border p-2.5 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center"><ShoppingCart className="h-3.5 w-3.5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold truncate">Order #1052 · Layla N.</div>
                          <div className="text-[10px] text-foreground/80 truncate">2× Earbuds Pro · $178 · Beirut</div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Confirmed</span>
                      </div>

                    </div>
                  </div>
                </BrowserFrame>

                {/* Floating WhatsApp chat card */}
                <div className="hidden sm:block absolute -bottom-8 -left-10 w-[280px] z-20 animate-float">
                  <WhatsAppChat compact />
                </div>

                {/* Floating notification stack */}
                <div className="hidden md:block absolute -top-4 -right-4 w-[280px] z-20 animate-float" style={{ animationDelay: "1.5s" }}>
                  <NotificationStack />
                </div>
              </div>
            </div>
          </div>

          {/* Trust bar */}
          <div className="mt-24">
            <h2 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
              Trusted by growing brands across the region
            </h2>
            <LogoCloud />
          </div>
        </div>
      </section>

      {/* ------------------------- LIVE SANDBOX ------------------------- */}
      <h2 className="sr-only">Try Jawabify live</h2>
      <LiveDemo />



      {/* ------------------------- 3 QUESTIONS ------------------------- */}
      <Section className="pt-4">
        <h2 className="sr-only">What Jawabify is and who it's for</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <QCard num="01" icon={Sparkles} q="What is Jawabify?"
            a="An AI-powered WhatsApp platform that handles every customer conversation — orders, bookings, questions, and marketing — end to end. One inbox. One AI. Every workflow."
            tags={["AI Assistant", "Inbox", "CRM", "Campaigns"]} />
          <QCard num="02" icon={Users} q="Who is it for?"
            a="Growing businesses that live on WhatsApp: e-commerce, restaurants, real estate, clinics, salons, schools, and service providers who can't afford to miss a single message."
            tags={["E-commerce", "Restaurants", "Real Estate", "Healthcare"]} />
          <QCard num="03" icon={Zap} q="Why not traditional support?"
            a="Human agents are slow, expensive, and don't scale. Jawabify replies in seconds, in any language, and never sleeps — cutting response time by 95% and support cost by 80%."
            tags={["0.8s reply", "24/7", "80% cheaper"]} />
        </div>
      </Section>

      {/* ------------------------- ALTERNATING FEATURE ROWS ------------------------- */}
      <Section>
        <SectionHeader
          eyebrow="Platform"
          title={<>Every tool your team needs, <span className="gradient-text">in one place</span></>}
          description="See each part of the product. Real dashboards, real conversations, real workflows."
        />
      </Section>

      <Section className="pt-0 space-y-20 sm:space-y-32">
        <FeatureRow
          eyebrow="AI Assistant"
          title={<>Replies in seconds. In any language. <span className="gradient-text">Every time.</span></>}
          body="The AI reads your catalog, PDFs, Shopify, and FAQ — then responds like a senior agent who's read every document your company has ever written."
          bullets={[
            { label: "Avg reply", value: "0.8s" },
            { label: "Auto-resolved", value: "94%" },
            { label: "Languages", value: "20+" },
          ]}
          cta={<Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">Explore the AI <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<WhatsAppChat />}
        />

        <FeatureRow
          reverse
          eyebrow="Analytics"
          title={<>Every conversation, <span className="gradient-text">measured.</span></>}
          body="Reply rate, resolution time, peak hours, revenue by chat, campaign ROI. The metrics you'd expect from an enterprise suite — without the enterprise price."
          bullets={[
            { label: "Metrics", value: "40+" },
            { label: "Real-time", value: "Live" },
            { label: "Exports", value: "CSV / API" },
          ]}
          cta={<Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">See analytics <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<BrowserFrame url="app.jawabify.com/analytics"><AnalyticsMockup /></BrowserFrame>}
        />

        <FeatureRow
          eyebrow="CRM"
          title={<>Know every customer <span className="gradient-text">by name.</span></>}
          body="Every message becomes a memory. Contacts, tags, order history, lifetime value, campaign engagement, and AI-generated notes — all attached to a phone number."
          bullets={[
            { label: "Contacts", value: "Unlimited" },
            { label: "Segments", value: "Custom" },
            { label: "Sync", value: "Shopify + CSV" },
          ]}
          cta={<Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">Explore CRM <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<BrowserFrame url="app.jawabify.com/crm"><CrmCard /></BrowserFrame>}
        />

        <FeatureRow
          reverse
          eyebrow="Orders"
          title={<>Deterministic ordering. <span className="gradient-text">Never a double-charge.</span></>}
          body="A state-machine flow — not free-form AI — collects each item, confirms totals, syncs to Shopify, and creates a real order the moment the customer says yes."
          bullets={[
            { label: "Accuracy", value: "99.9%" },
            { label: "Sync", value: "Shopify" },
            { label: "Statuses", value: "Live" },
          ]}
          cta={<Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">See orders <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<BrowserFrame url="app.jawabify.com/orders"><OrdersBoard /></BrowserFrame>}
        />

        <FeatureRow
          eyebrow="Bookings"
          title={<>Fills your calendar <span className="gradient-text">while you sleep.</span></>}
          body="Clinics, salons, restaurants, agencies. The AI checks availability, books the slot, sends reminders, and handles reschedules — all through WhatsApp."
          bullets={[
            { label: "Bookings", value: "24/7" },
            { label: "No-shows", value: "-38%" },
            { label: "Google Cal", value: "Sync" },
          ]}
          cta={<Link to="/industries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">See industries <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<BrowserFrame url="app.jawabify.com/calendar"><CalendarMockup /></BrowserFrame>}
        />

        <FeatureRow
          reverse
          eyebrow="Campaigns"
          title={<>Reach thousands. <span className="gradient-text">Get real replies.</span></>}
          body="Broadcast WhatsApp templates to your entire audience with segmentation, opt-out compliance, delivery pacing, and revenue attribution baked in."
          bullets={[
            { label: "Delivery", value: "99.2%" },
            { label: "Opt-out", value: "Auto STOP" },
            { label: "Templates", value: "Meta-approved" },
          ]}
          cta={<Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">Explore campaigns <ArrowUpRight className="h-4 w-4" /></Link>}
          visual={<BrowserFrame url="app.jawabify.com/campaigns"><CampaignBuilder /></BrowserFrame>}
        />
      </Section>

      {/* ------------------------- INBOX PREVIEW ------------------------- */}
      <Section>
        <SectionHeader
          center
          eyebrow="Team inbox"
          title={<>One shared workspace. <span className="gradient-text">Zero missed messages.</span></>}
          description="Every chat, every agent, every AI reply — in a single view built for teams."
        />
        <div className="mt-12">
          <BrowserFrame url="app.jawabify.com/inbox"><InboxMockup className="h-[380px] sm:h-[520px]" /></BrowserFrame>
        </div>
      </Section>

      {/* ------------------------- WHY JAWABIFY ------------------------- */}
      <Section>
        <SectionHeader
          eyebrow="Why teams switch"
          title={<>Built for how businesses <span className="gradient-text">actually run on WhatsApp</span></>}
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Enterprise-grade security", body: "Row-level tenant isolation, encryption at rest and in transit, GDPR-ready, no data sharing." },
            { icon: Globe2, title: "Meta Cloud API native", body: "Direct integration with the official API — no bridges, no bans, full template compliance." },
            { icon: Bot, title: "Grounded, not hallucinating", body: "Strict retrieval rules. If it isn't in your knowledge base, the AI says so or escalates." },
            { icon: Zap, title: "10-minute setup", body: "Connect Meta, upload your knowledge, go live. No developers required." },
            { icon: Users, title: "Human handoff, seamless", body: "Toggle AI off per chat or auto-escalate on sentiment, keywords, or unresolved intent." },
            { icon: LineChart, title: "Real ROI, tracked", body: "Attribute revenue to individual conversations, campaigns, and AI resolutions." },
          ].map((f) => (
            <BentoCard key={f.title}>
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mb-4"><f.icon className="h-5 w-5 text-primary" /></div>
              <h3 className="font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </BentoCard>
          ))}
        </div>
      </Section>

      {/* ------------------------- TESTIMONIALS ------------------------- */}
      <Section>
        <SectionHeader eyebrow="Loved by operators" title={<>Real teams. <span className="gradient-text">Real results.</span></>} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { name: "Karim Y.", quote: "We stopped hiring agents. Jawabify handles 94% of our WhatsApp traffic and our response time went from 2 hours to under a minute.", metric: "94% AI-resolved" },
            { name: "Rania A.", quote: "Orders come in on WhatsApp, land in Shopify, and go to the kitchen — no human touches anything until the food is on the counter.", metric: "3× more orders" },
            { name: "Marc S.", quote: "The AI qualifies every real-estate lead in Arabic and English, books the viewing, and only pings me when it's serious. Game changer.", metric: "5× lead speed" },
          ].map((t) => (
            <div key={t.name} className="rounded-3xl border border-border bg-white p-6 card-elevated">
              <div className="flex text-primary mb-3">{[0,1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-primary" />)}</div>
              <p className="text-foreground leading-relaxed">"{t.quote}"</p>
              <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">{t.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------- CTA ------------------------- */}
      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(240_45%_6%)] via-[hsl(243_60%_10%)] to-[hsl(258_60%_15%)] p-10 sm:p-16 text-white noise">
          <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse 60% 60% at 80% 20%, hsl(258 80% 65% / 0.4), transparent 60%)" }} />
          <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
            <div>
              <Sparkles className="h-8 w-8 mb-6 text-primary" />
              <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
                Stop losing customers to <span className="gradient-text-invert">slow replies.</span>
              </h2>
              <p className="mt-4 text-white/70 text-lg max-w-lg">Set up in 10 minutes. Free for 7 days. {format(45)}/month after that. Cancel any time.{!isUsd && " Billed in USD."}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth?mode=signup" className="rounded-full bg-white text-[hsl(240_45%_6%)] px-6 py-3 text-sm font-semibold hover:bg-white/90 inline-flex items-center gap-2">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/contact" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">
                  Talk to sales
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <NotificationStack />
            </div>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-foreground/80 mt-0.5">{label}</div>
    </div>
  );
}


function QCard({ num, q, a, tags, icon: Icon }: { num: string; q: string; a: string; tags: string[]; icon: any }) {
  return (
    <div className="group relative rounded-3xl border border-border bg-white p-8 card-elevated hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] transition-all duration-300">
      <div className="flex items-start justify-between">
        <div aria-hidden="true" className="font-display text-6xl font-black text-primary/50 group-hover:text-primary/60 transition-colors">{num}</div>
        <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center"><Icon className="h-5 w-5 text-primary" /></div>
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">{q}</h3>
      <p className="mt-3 text-foreground/80 leading-relaxed">{a}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="text-[10.5px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{t}</span>
        ))}
      </div>
    </div>
  );
}

