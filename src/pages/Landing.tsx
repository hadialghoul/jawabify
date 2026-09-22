import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import LiveDemo from "@/components/demo/LiveDemo";
import ackrabLogo from "@/assets/brands/ackrab.jpg.asset.json";
import mensparksLogo from "@/assets/brands/mensparks.jpg.asset.json";
import tropicalLogo from "@/assets/brands/tropical.jpg.asset.json";
import seaqersLogo from "@/assets/brands/seaqers.jpg.asset.json";
import ibtisamatiLogo from "@/assets/brands/ibtisamati.jpg.asset.json";
import herbalhavenLogo from "@/assets/brands/herbalhaven.jpg.asset.json";
import bubblybitesLogo from "@/assets/brands/bubblybites.jpg.asset.json";
import {
  ArrowRight,
  ShieldCheck,
  Globe,
  Users,
  Brain,
  Mic,
  Image as ImageIcon,
  BookOpen,
  Zap,
  ShoppingBag,
  CalendarCheck,
  Settings as SettingsIcon,
  Upload,
  MessageSquare,
  MessageSquareX,
  Clock,
  Star,
  Rocket,
  Check,
  Menu,
  Crown,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  MapPin,
  Phone,
} from "lucide-react";
import * as React from "react";
import { Helmet } from "react-helmet-async";
import { trackViewContent, trackLead, trackContact, trackInitiateCheckout } from "@/lib/pixel";

const SERIF: React.CSSProperties = { fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, serif" };

const navLinks = [
  { href: "#product", label: "Product" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const Nav = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white md:bg-white/80 md:backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="text-xl font-semibold tracking-tight text-slate-900">
          Jawabify<span className="text-sky-500">.</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] pt-12">
              <nav className="flex flex-col gap-6 text-base font-medium text-slate-600">
                {navLinks.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="hover:text-slate-900">
                    {l.label}
                  </a>
                ))}
                <Link to="/auth" replace onClick={() => trackLead({ content_name: "Mobile Nav Login" })}>
                  <Button variant="outline" className="w-full">Log in</Button>
                </Link>
                <Link to="/auth?mode=signup" replace onClick={() => trackInitiateCheckout({ content_name: "Mobile Nav Start Free" })}>
                  <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white">Start free trial</Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/auth" replace onClick={() => trackLead({ content_name: "Nav Login" })} className="hidden sm:block">
            <Button variant="ghost" className="text-slate-700 hover:text-slate-900">Log in</Button>
          </Link>
          <Link to="/auth?mode=signup" replace onClick={() => trackInitiateCheckout({ content_name: "Nav Start Free" })} className="hidden sm:block">
            <Button className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
              Start free trial
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

const AnnouncementBar = () => (
  <div className="bg-slate-950 text-slate-200 text-center text-xs sm:text-[13px] py-2 px-4">
    <span className="font-medium text-white">Launch offer.</span>{" "}
    <span className="text-slate-300">30% off the first three months. No credit card required.</span>
  </div>
);

const Hero = () => (
  <section className="relative overflow-hidden bg-slate-50 px-6 pt-20 pb-24 sm:pt-24 sm:pb-32">
    <div className="mx-auto max-w-7xl">
      <div className="grid items-center gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 style={SERIF} className="mb-8 text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
            Scale your operations with{" "}
            <span className="italic text-sky-500">intelligent</span> automation.
          </h1>
          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Jawabify turns WhatsApp into a high performance business channel. Automate customer inquiries,
            capture orders, and manage complex workflows without adding headcount.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/auth?mode=signup" replace onClick={() => trackInitiateCheckout({ content_name: "Hero Start Free Trial" })}>
              <Button size="lg" className="rounded-lg bg-slate-900 px-8 py-6 text-base font-semibold text-white shadow-xl shadow-slate-300/60 hover:bg-slate-800">
                Start free trial
              </Button>
            </Link>
            <a href="#sandbox" onClick={() => trackViewContent({ content_name: "Hero See It In Action" })}>
              <Button size="lg" variant="outline" className="rounded-lg border-slate-200 bg-white px-8 py-6 text-base font-semibold text-slate-900 hover:bg-slate-50">
                See it in action
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky-500" /> 7 day free trial</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky-500" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-sky-500" /> Live in five minutes</span>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <div className="pointer-events-none absolute -right-12 -top-12 hidden h-64 w-64 rounded-full bg-sky-100 blur-3xl md:block" />
          <div className="relative z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/40 lg:rotate-[1.5deg]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 font-bold text-white">J</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Jawabify Business</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified account</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="max-w-[85%] rounded-lg rounded-tl-none border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-sm text-slate-700">Hi, do you deliver to Beirut on Sundays?</p>
                </div>
                <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-sky-500 p-3 shadow-sm">
                  <p className="text-sm text-white">Yes, Sunday delivery runs 10am to 6pm across Beirut for a $3 flat fee. Would you like me to start your order?</p>
                </div>
                <div className="max-w-[70%] rounded-lg rounded-tl-none border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-sm text-slate-700">Perfect, please add the Orbit lamp.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const StatStrip = () => (
  <section className="border-y border-slate-200 bg-white">
    <div className="mx-auto grid max-w-7xl grid-cols-2 divide-slate-100 md:grid-cols-4 md:divide-x">
      {[
        { v: "5 sec", l: "Average reply time" },
        { v: "20+", l: "Languages supported" },
        { v: "+47%", l: "Sales lift in 30 days" },
        { v: "24/7", l: "Always on coverage" },
      ].map((s) => (
        <div key={s.l} className="px-6 py-12 text-center">
          <p style={SERIF} className="mb-1 text-4xl font-bold text-slate-900">{s.v}</p>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{s.l}</p>
        </div>
      ))}
    </div>
  </section>
);

const TrustedBy = () => {
  const brands = [
    { name: "Ackrab", logo: ackrabLogo.url },
    { name: "Mensparks", logo: mensparksLogo.url },
    { name: "Tropicalpowders", logo: tropicalLogo.url },
    { name: "Seaqers", logo: seaqersLogo.url },
    { name: "Ibtisamati", logo: ibtisamatiLogo.url },
    { name: "Herbalhaventea", logo: herbalhavenLogo.url },
    { name: "Bubblybites", logo: bubblybitesLogo.url },
  ];
  return (
    <section className="border-b border-slate-200 bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 style={SERIF} className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Trusted by businesses like yours
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Brands already automating customer chats with Jawabify.
          </p>
        </div>
        <div
          className="group relative mt-12 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div className="flex w-max items-center gap-14 py-4 animate-[marquee_30s_linear_infinite] group-hover:[animation-play-state:paused]">
            {[...brands, ...brands].map((b, i) => (
              <div key={`${b.name}-${i}`} className="flex w-32 shrink-0 flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                  <img src={b.logo} alt={`${b.name} logo`} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <span className="text-xs font-medium text-slate-500">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Product = () => {
  const secondary = [
    { icon: Brain, title: "Learns your business", desc: "Point Jawabify at your website, catalog, or FAQ. It reads products, prices, and policies in minutes." },
    { icon: Mic, title: "Understands voice notes", desc: "Transcribes and replies to spoken messages, including Lebanese, Egyptian, and Khaleeji Arabic." },
    { icon: ImageIcon, title: "Sends catalogs and media", desc: "Shares product photos, menus, and location pins directly in the conversation." },
    { icon: BookOpen, title: "Improves over time", desc: "Analyzes past conversations to surface gaps in your knowledge base and refine replies." },
    { icon: Globe, title: "Multilingual by default", desc: "Arabic, English, French, and 20+ other languages. Switches mid conversation without prompting." },
    { icon: Zap, title: "Live in five minutes", desc: "Connect WhatsApp Business, paste your website, publish. No code, no IT project." },
  ];

  return (
    <section id="product" className="border-b border-slate-200 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Product</p>
            <h2 style={SERIF} className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Engineered for the demands of modern business.
            </h2>
            <p className="mt-6 text-slate-600">
              Purpose built tools that give operators transparency and control over every customer conversation.
            </p>
          </div>
          <a href="#pricing" className="group inline-flex items-center gap-2 font-semibold text-sky-600">
            Explore plans
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {secondary.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-7 transition-shadow hover:shadow-md">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-sky-600 ring-1 ring-slate-100">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SandboxSection = () => (
  <section id="sandbox" className="relative overflow-hidden bg-slate-950 py-28 text-white sm:py-36">
    {/* Ambient gradient orbs — Apple-style depth */}
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-500/30 via-cyan-400/10 to-transparent blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 h-[400px] w-[500px] rounded-full bg-sky-600/20 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-[350px] w-[350px] rounded-full bg-cyan-500/15 blur-3xl" />
    </div>
    {/* Subtle grid texture */}
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    />

    <div className="relative mx-auto max-w-5xl px-6">
      <div className="mb-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 md:backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute hidden md:inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
          </span>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
            Powering customer communication for leading brands
          </p>
        </div>
        <h2
          style={SERIF}
          className="bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-5xl font-bold leading-[1.05] tracking-tight text-transparent sm:text-6xl md:text-7xl"
        >
          Try Jawabify.
          <br />
          <span className="italic text-slate-300">Live. Right now.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-slate-400">
          A real conversation with the same intelligence powering thousands of customer chats every day. No signup. No commitment.
        </p>
      </div>

      {/* Fancy layered device frame */}
      <div className="relative mx-auto">
        {/* Outer glow */}
        <div className="pointer-events-none absolute -inset-8 hidden rounded-[2rem] bg-gradient-to-br from-sky-500/30 via-transparent to-cyan-500/20 blur-2xl md:block" />
        {/* Glass frame */}
        <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-3 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7),0_30px_60px_-30px_rgba(14,165,233,0.4)] md:backdrop-blur-xl">
          {/* Top window chrome */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
              sandbox.jawabify.com
            </p>
            <div className="w-12" />
          </div>
          <div className="overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-white/10">
            <LiveDemo />
          </div>
        </div>
        {/* Reflection */}
        <div
          className="pointer-events-none absolute -bottom-24 left-1/2 hidden h-24 w-4/5 -translate-x-1/2 rounded-[50%] opacity-40 blur-2xl md:block"
          style={{ background: "linear-gradient(to bottom, rgba(14,165,233,0.5), transparent)" }}
        />
      </div>
    </div>
  </section>
);

const problems = [
  { icon: Clock, title: "Missed messages are missed sales", desc: "Customers message at 2 AM. By morning they have already bought from your competitor." },
  { icon: MessageSquareX, title: "Repetitive questions drain your team", desc: "Most questions are the same. Pricing, hours, delivery. Your team is exhausted." },
  { icon: Globe, title: "Language barriers kill conversions", desc: "Your customers mix Arabic, English, and French. Generic bots cannot keep up. Jawabify can." },
  { icon: Users, title: "Hiring more staff kills margins", desc: "Every new customer means more support cost. Jawabify scales with zero extra headcount." },
];

const Problem = () => (
  <section id="problem" className="border-b border-slate-200 bg-white py-24 sm:py-32">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">The hidden cost</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          You are losing customers while you sleep
        </h2>
        <p className="mt-6 text-slate-600">
          Every unanswered message is a lost sale. Every slow reply pushes a customer to the next shop.
        </p>
      </div>
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {problems.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-7 transition-shadow hover:shadow-md">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const BeforeAfter = () => (
  <section className="border-b border-slate-200 bg-slate-50 py-24 sm:py-32">
    <div className="mx-auto max-w-6xl px-6">
      <div className="text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Before vs after</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          From chaos to closed deals
        </h2>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Before Jawabify</div>
          <ul className="space-y-3 text-sm text-slate-600">
            {[
              "Hours of unanswered messages stacking up",
              "Customers buying from competitors overnight",
              "Staff answering the same five questions all day",
              "No clue which leads were lost or why",
              "Manual order taking leads to mistakes and refunds",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white shadow-lg shadow-slate-900/10">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-sky-400">After Jawabify</div>
          <ul className="space-y-3 text-sm text-slate-100">
            {[
              "Every message answered in under ten seconds",
              "Orders captured 24/7, even on holidays",
              "AI handles 80% of questions automatically",
              "Dashboard shows revenue, leads, and gaps",
              "Shopify synced orders with zero errors",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const testimonials = [
  {
    quote: "We were missing 40% of orders at night. Jawabify recovered them all in the first week. It paid for itself in three days.",
    name: "Karim Haddad",
    rating: 5,
  },
  {
    quote: "Customers reply in voice notes in Lebanese, and Jawabify understands every single one. I genuinely thought it was a real person.",
    name: "Layla Mansour",
    rating: 5,
  },
  {
    quote: "I replaced two support agents and customer satisfaction went up. The Shopify sync is flawless. Setup took ten minutes.",
    name: "Omar Khoury",
    rating: 5,
  },
];

const Testimonials = () => (
  <section className="border-b border-slate-200 bg-white py-24 sm:py-32">
    <div className="mx-auto max-w-7xl px-6">
      <div className="text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Real customers, real results</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Why businesses switch and stay
        </h2>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <div key={t.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
            <div className="flex gap-0.5">
              {[...Array(t.rating)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-700">"{t.quote}"</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-sky-700" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{t.name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const integrations = [
  { emoji: "🛍️", name: "Shopify", desc: "Sync products, orders and inventory" },
  { emoji: "🧨", name: "WooCommerce", desc: "Full WordPress e-commerce sync" },
  { emoji: "📝", name: "WordPress", desc: "Pull content and product data" },
  { emoji: "💬", name: "WhatsApp Business", desc: "Official Meta Cloud API" },
  { emoji: "📸", name: "Instagram", desc: "DM automation and story replies" },
  { emoji: "📅", name: "Google Calendar", desc: "Auto-sync bookings" },
];

const Integrations = () => (
  <section className="border-b border-slate-200 bg-slate-50 py-24 sm:py-32">
    <div className="mx-auto max-w-6xl px-6">
      <div className="text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Integrations</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Plugs into your stack
        </h2>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((i) => (
          <div key={i.name} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              {i.emoji}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{i.name}</h3>
              <p className="text-xs text-slate-500">{i.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);


const Solutions = () => (
  <section id="solutions" className="border-b border-slate-200 bg-slate-50 py-24 sm:py-32">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Solutions</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Built for how your business operates.
        </h2>
        <p className="mt-6 text-slate-600">
          Whether you sell products or services, Jawabify adapts to your existing workflow.
        </p>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h3 style={SERIF} className="text-2xl font-bold text-slate-900">E-commerce</h3>
          <p className="mt-2 text-sm font-medium text-sky-600">Automate orders and support</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {[
              "Capture orders directly through WhatsApp and Instagram",
              "Share product catalogs with images and pricing",
              "Send order confirmations and status updates",
              "Handle returns and exchanges automatically",
              "Two way sync with Shopify, WooCommerce, and WordPress",
              "Upsell and cross sell based on cart context",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <h3 style={SERIF} className="text-2xl font-bold text-slate-900">Service businesses</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Automate bookings and clients</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {[
              "Book appointments and manage schedules",
              "Send reminders and confirmations",
              "Collect client information automatically",
              "Handle rescheduling and cancellations",
              "Share service menus and pricing",
              "Follow up with clients after each visit",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

type Tier = {
  id: string;
  name: string;
  badge?: string;
  oldPrice?: string;
  price: string;
  priceSuffix?: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  custom?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    oldPrice: "$90",
    price: "$45",
    priceSuffix: "/month",
    tagline: "Everything you need to start replying automatically.",
    features: [
      "Up to 1,000 orders per month",
      "WhatsApp AI auto reply",
      "Multilingual coverage in 20+ languages",
      "Voice note transcription",
      "Shared inbox with order context",
      "Shopify two way sync",
    ],
    cta: "Start free trial",
  },
  {
    id: "growth",
    name: "Growth",
    badge: "Most popular",
    oldPrice: "$140",
    price: "$90",
    priceSuffix: "/month",
    tagline: "Scale without limits. Built for serious operators.",
    features: [
      "Unlimited orders",
      "Bulk campaigns and broadcasts",
      "Automated order confirmation notifications",
      "Priority support",
      "Everything in Starter",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    tagline: "For agencies, multi brand, and high volume operations.",
    features: [
      "Custom volume and SLAs",
      "Dedicated onboarding manager",
      "Multi tenant and multi brand setup",
      "Custom integrations and API access",
      "Instagram AI auto reply",
      "White label and co branding",
      "Security review and DPA",
    ],
    cta: "Contact sales",
    custom: true,
  },
];

const Pricing = () => (
  <section id="pricing" className="border-b border-slate-200 bg-white py-24 sm:py-32">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Pricing</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Transparent pricing that pays for itself.
        </h2>
        <p className="mt-6 text-slate-600">
          Start free for seven days. No credit card required. Cancel anytime.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`relative flex flex-col rounded-2xl border p-8 ${
              tier.highlight
                ? "border-slate-900 bg-slate-950 text-white shadow-2xl"
                : "border-slate-200 bg-white"
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-3 right-6 rounded-full bg-sky-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                {tier.badge}
              </div>
            )}
            <div className="mb-6">
              <h3 className={`text-sm font-semibold uppercase tracking-widest ${tier.highlight ? "text-sky-400" : "text-slate-500"}`}>
                {tier.name}
              </h3>
              <p className={`mt-3 text-sm ${tier.highlight ? "text-slate-300" : "text-slate-600"}`}>
                {tier.tagline}
              </p>
            </div>

            <div className="mb-8 flex items-baseline gap-2">
              {tier.oldPrice && (
                <span className={`text-xl font-medium line-through ${tier.highlight ? "text-slate-500" : "text-slate-400"}`}>
                  {tier.oldPrice}
                </span>
              )}
              <span style={SERIF} className={`text-5xl font-bold ${tier.highlight ? "text-white" : "text-slate-900"}`}>
                {tier.price}
              </span>
              {tier.priceSuffix && (
                <span className={`text-sm ${tier.highlight ? "text-slate-400" : "text-slate-500"}`}>
                  {tier.priceSuffix}
                </span>
              )}
            </div>

            <ul className="mb-8 flex-1 space-y-3 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlight ? "text-sky-400" : "text-sky-500"}`} />
                  <span className={tier.highlight ? "text-slate-200" : "text-slate-700"}>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to={tier.custom ? "/" : "/auth?mode=signup"}
              onClick={() =>
                tier.custom
                  ? trackContact({ content_name: "Pricing Contact Sales" })
                  : trackInitiateCheckout({ content_name: `Pricing ${tier.name} Start Free Trial` })
              }
            >
              <Button
                size="lg"
                className={`w-full rounded-lg font-semibold ${
                  tier.highlight
                    ? "bg-sky-500 text-white hover:bg-sky-400"
                    : tier.custom
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tier.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const HowItWorks = () => {
  const steps = [
    { n: "01", icon: SettingsIcon, title: "Connect WhatsApp", desc: "Link your WhatsApp Business or Instagram account through the official Meta integration." },
    { n: "02", icon: Upload, title: "Train the AI", desc: "Point Jawabify at your website and catalog. It indexes everything in minutes." },
    { n: "03", icon: MessageSquare, title: "Set your voice", desc: "Choose a tone and define escalation rules. The AI speaks the way your team does." },
    { n: "04", icon: Rocket, title: "Go live", desc: "Publish and monitor conversations, orders, and revenue from a single dashboard." },
  ];
  return (
    <section id="how" className="border-b border-slate-200 bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">How it works</p>
          <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
            Live in five minutes.
          </h2>
          <p className="mt-6 text-slate-600">
            No code. No IT project. Just plug in and grow.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="relative rounded-2xl border border-slate-200 bg-white p-7">
              <span style={SERIF} className="absolute right-5 top-3 text-5xl font-bold text-slate-100 select-none">
                {n}
              </span>
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const faqs = [
  { q: "How long does setup take?", a: "About five minutes. Connect your WhatsApp Business number, paste your website URL, and Jawabify trains itself. You can go live the same day." },
  { q: "Does it really understand Arabic and Lebanese?", a: "Yes, including spoken voice notes in Lebanese, Egyptian, and Khaleeji dialects. Jawabify auto detects the language and replies in kind." },
  { q: "Will it sound like a robot to my customers?", a: "No. You set the tone and personality, and the AI mirrors how your team actually talks. Most customers cannot tell it apart from a human agent." },
  { q: "What happens if the AI does not know an answer?", a: "It gracefully hands the conversation to your team and notifies you. You can also configure rules to always escalate refunds, complaints, or VIP customers." },
  { q: "Can I integrate my existing CRM?", a: "Yes. Jawabify connects with Shopify, WooCommerce, HubSpot, and most modern CRMs. All conversations are logged in real time." },
  { q: "Do I need a developer?", a: "No. Every setting is point and click. You connect, train, and go live without writing a single line of code." },
];

const FAQ = () => (
  <section id="faq" className="border-b border-slate-200 bg-white py-24 sm:py-32">
    <div className="mx-auto max-w-3xl px-6">
      <div className="mb-16 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">FAQ</p>
        <h2 style={SERIF} className="text-4xl font-bold text-slate-900 sm:text-5xl">
          Frequently asked questions.
        </h2>
      </div>
      <Accordion type="single" collapsible className="space-y-0">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-b border-slate-200 last:border-b-0">
            <AccordionTrigger className="py-6 text-left text-base font-semibold text-slate-900 hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="pb-6 text-slate-600 leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

const CTA = () => (
  <section className="bg-white pb-24 pt-12 sm:pb-32">
    <div className="mx-auto max-w-7xl px-6">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-12 text-center text-white sm:p-20">
        <div className="pointer-events-none absolute -top-24 right-0 hidden h-96 w-96 translate-x-1/3 rounded-full bg-sky-500/20 blur-3xl md:block" />
        <div className="pointer-events-none absolute -bottom-24 left-0 hidden h-96 w-96 -translate-x-1/3 rounded-full bg-sky-500/10 blur-3xl md:block" />
        <div className="relative">
          <h2 style={SERIF} className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Ready to scale your customer operations?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
            Join over 500 businesses using Jawabify to automate every conversation, in any language, around the clock.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?mode=signup" replace onClick={() => trackInitiateCheckout({ content_name: "Bottom CTA Start Free Trial" })}>
              <Button size="lg" className="rounded-lg bg-white px-10 py-6 text-base font-semibold text-slate-900 hover:bg-slate-100">
                Start free trial
              </Button>
            </Link>
            <a href="mailto:support@jawabify.com" onClick={() => trackContact({ content_name: "Talk to Sales" })}>
              <Button size="lg" variant="outline" className="rounded-lg border-slate-700 bg-transparent px-10 py-6 text-base font-semibold text-white hover:bg-slate-900">
                Talk to sales
              </Button>
            </a>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Seven day free trial. No credit card. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => {
  const linkCls = "text-sm text-slate-400 transition-colors hover:text-white";
  const headerCls = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

  return (
    <footer className="bg-slate-950 pb-20 text-slate-300 md:pb-0">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="text-xl font-semibold text-white">
              Jawabify<span className="text-sky-400">.</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
              AI powered WhatsApp automation for enterprise operators in MENA and beyond.
            </p>

            <div className="mt-6 space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span className="text-sm text-slate-400">Business Centre, Sharjah Publishing City, Sharjah, UAE</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-slate-500" />
                <a href="tel:+971523506806" className={linkCls} onClick={() => trackContact({ content_name: "Footer Phone" })}>
                  +971 52 350 6806
                </a>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {[
                { Icon: Facebook, href: "https://www.facebook.com/", label: "Facebook" },
                { Icon: Instagram, href: "https://www.instagram.com/", label: "Instagram" },
                { Icon: Linkedin, href: "https://www.linkedin.com/", label: "LinkedIn" },
                { Icon: Twitter, href: "https://twitter.com/", label: "X" },
                { Icon: Youtube, href: "https://www.youtube.com/", label: "YouTube" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 lg:col-span-7 lg:grid-cols-4">
            <div>
              <h4 className={headerCls}>Company</h4>
              <ul className="mt-4 space-y-2">
                <li><Link to="/info" className={linkCls}>About</Link></li>
                <li><a href="#how" className={linkCls}>How it works</a></li>
                <li><a href="mailto:partners@jawabify.com" className={linkCls}>Partners</a></li>
                <li><a href="mailto:careers@jawabify.com" className={linkCls}>Careers</a></li>
                <li><a href="mailto:support@jawabify.com" className={linkCls}>Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className={headerCls}>Compare</h4>
              <ul className="mt-4 space-y-2">
                <li><Link to="/info#compare" className={linkCls}>vs Wati</Link></li>
                <li><Link to="/info#compare" className={linkCls}>vs Respond.io</Link></li>
                <li><Link to="/info#compare" className={linkCls}>vs Manychat</Link></li>
                <li><Link to="/info#compare" className={linkCls}>vs Trengo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className={headerCls}>Resources</h4>
              <ul className="mt-4 space-y-2">
                <li><Link to="/info" className={linkCls}>Business API</Link></li>
                <li><Link to="/info" className={linkCls}>Bulk campaigns</Link></li>
                <li><Link to="/info" className={linkCls}>WhatsApp CRM</Link></li>
                <li><Link to="/info" className={linkCls}>AI auto replies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className={headerCls}>Legal</h4>
              <ul className="mt-4 space-y-2">
                <li><Link to="/privacy" className={linkCls}>Privacy</Link></li>
                <li><Link to="/privacy" className={linkCls}>Cookies</Link></li>
                <li><Link to="/privacy" className={linkCls}>Terms</Link></li>
                <li><Link to="/privacy" className={linkCls}>Data protection</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400" /> Meta Business Partner
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-sky-400" /> GDPR compliant
            </span>
          </div>
          <div>© {new Date().getFullYear()} Jawabify. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
};

const StickyMobileCta = () => (
  <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white p-3 md:hidden safe-bottom">
    <Link to="/auth?mode=signup" replace onClick={() => trackInitiateCheckout({ content_name: "Sticky Mobile CTA" })}>
      <Button className="w-full rounded-lg bg-slate-900 text-white hover:bg-slate-800 h-12 text-base">
        Start free trial <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </Link>
  </div>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.955L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FloatingWhatsApp = () => (
  <a
    href="https://wa.me/971523506806"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp"
    onClick={() => trackContact({ method: "WhatsApp" })}
    className="fixed bottom-20 right-4 z-50 md:bottom-8 md:right-8 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-2xl shadow-[#25D366]/30 transition-transform hover:scale-105 active:scale-95"
  >
    <WhatsAppIcon className="h-6 w-6" />
    <span className="hidden md:inline text-sm font-semibold">Chat on WhatsApp</span>
  </a>
);

export default function Landing() {
  useEffect(() => {
    trackViewContent({ content_name: "Landing Page", content_category: "Marketing" });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-white text-slate-900">
      <Helmet>
        <title>Jawabify. Enterprise WhatsApp AI for customer operations.</title>
        <meta name="description" content="Jawabify automates WhatsApp and Instagram replies with AI that takes orders, books appointments, and speaks 20+ languages. Seven day free trial." />
        <link rel="canonical" href="https://jawabify.com/" />
        <meta property="og:title" content="Jawabify. Enterprise WhatsApp AI for customer operations." />
        <meta property="og:description" content="Turn every WhatsApp chat into revenue. Multilingual AI that replies in five seconds, captures orders, and books appointments." />
        <meta property="og:url" content="https://jawabify.com/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap" rel="stylesheet" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Jawabify",
          "serviceType": "AI WhatsApp customer messaging",
          "provider": { "@type": "Organization", "name": "Jawabify", "url": "https://jawabify.com" },
          "areaServed": "Worldwide",
          "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "500" },
          "description": "AI powered WhatsApp automation for customer support, orders, and marketing campaigns."
        })}</script>
      </Helmet>
      <AnnouncementBar />
      <Nav />
      <main className="flex-1 pb-24 md:pb-0" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Hero />
        <StatStrip />
        <TrustedBy />
        <SandboxSection />
        <Problem />
        <BeforeAfter />
        <Product />
        <Testimonials />
        <Solutions />
        <Integrations />
        <Pricing />
        <HowItWorks />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <StickyMobileCta />
      <FloatingWhatsApp />
    </div>
  );
}
