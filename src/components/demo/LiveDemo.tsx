import { useEffect, useRef, useState } from "react";
import { VERTICALS, type Vertical } from "@/lib/verticals";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck, RotateCcw, Pause, Play, ShoppingBag, Utensils, Home, Sparkles, Stethoscope, GraduationCap, Briefcase } from "lucide-react";

type Sender = "customer" | "ai";
type Step = {
  from: Sender;
  text: string;
  delayMs?: number;   // pause before this step
  typingMs?: number;  // AI typing indicator duration
  event?: DashboardEvent;
};

type DashboardEvent =
  | { kind: "field"; key: string; value: string }
  | { kind: "status"; value: string }
  | { kind: "badge"; value: string };

type DashboardState = {
  fields: Record<string, string>;
  status?: string;
  badges: string[];
};

const emptyDash: DashboardState = { fields: {}, badges: [] };

const scripts: Record<Vertical, { title: string; icon: any; steps: Step[]; dashTitle: string; dashSubtitle: string }> = {
  ecommerce: {
    title: "New order",
    dashTitle: "Orders",
    dashSubtitle: "Live from WhatsApp",
    icon: ShoppingBag,
    steps: [
      { from: "customer", text: "hi, do you have the Orbit lamp?", delayMs: 400 },
      { from: "ai", text: "Yes! Orbit Magnetic Wall Lamp — $24.99, on sale for $9.99 🎉", typingMs: 900, delayMs: 500 },
      { from: "customer", text: "ana biddi wehde", delayMs: 1400 },
      { from: "ai", text: "Tamem! Shu ismak el kamel?", typingMs: 900, delayMs: 400, event: { kind: "status", value: "Order started" } },
      { from: "customer", text: "Samer Khoury", delayMs: 1300 },
      { from: "ai", text: "Wein el 3enwen?", typingMs: 800, delayMs: 300, event: { kind: "field", key: "Customer", value: "Samer Khoury" } },
      { from: "customer", text: "Hamra, Beirut, bldg 4", delayMs: 1400 },
      { from: "ai", text: "Raqm el telefon lal delivery?", typingMs: 800, delayMs: 300, event: { kind: "field", key: "Address", value: "Hamra, Beirut, bldg 4" } },
      { from: "customer", text: "76 123 456", delayMs: 1200 },
      { from: "ai", text: "Order: 1× Orbit Lamp — $9.99 + $3 delivery = $12.99. Confirm? (yes/no)", typingMs: 1000, delayMs: 300, event: { kind: "field", key: "Item", value: "1× Orbit Lamp — $9.99" } },
      { from: "customer", text: "yes", delayMs: 1100 },
      { from: "ai", text: "Order confirmed ✅ shukran!", typingMs: 800, delayMs: 300, event: { kind: "status", value: "Confirmed" } },
      { from: "ai", text: "", delayMs: 600, event: { kind: "badge", value: "Synced to Shopify ✓" } },
    ],
  },
  restaurant: {
    title: "New bill",
    dashTitle: "Kitchen board",
    dashSubtitle: "Live orders",
    icon: Utensils,
    steps: [
      { from: "customer", text: "table 6, can we order?", delayMs: 400 },
      { from: "ai", text: "Of course! What would you like?", typingMs: 800 },
      { from: "customer", text: "2 margherita, 1 caesar salad, 3 lemonades", delayMs: 1400 },
      { from: "ai", text: "Got it. Any notes?", typingMs: 900, event: { kind: "field", key: "Table", value: "Table 6" } },
      { from: "customer", text: "one pizza extra cheese", delayMs: 1200 },
      { from: "ai", text: "2× Margherita (1 extra cheese), 1× Caesar, 3× Lemonade = $42. Send to kitchen?", typingMs: 1000, event: { kind: "field", key: "Items", value: "2× Margherita, 1× Caesar, 3× Lemonade" } },
      { from: "customer", text: "yes", delayMs: 1100 },
      { from: "ai", text: "Sent to kitchen 👨‍🍳", typingMs: 700, event: { kind: "status", value: "In kitchen" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "badge", value: "Total $42.00" } },
    ],
  },
  real_estate: {
    title: "New lead",
    dashTitle: "Leads",
    dashSubtitle: "Hot prospects",
    icon: Home,
    steps: [
      { from: "customer", text: "hi, is the 2BR in Achrafieh still available?", delayMs: 400 },
      { from: "ai", text: "Yes! $1,200/mo, 95 sqm, furnished. Want to book a viewing?", typingMs: 900 },
      { from: "customer", text: "yes, tomorrow afternoon", delayMs: 1300 },
      { from: "ai", text: "Great — what's your name?", typingMs: 700, event: { kind: "field", key: "Property", value: "2BR Achrafieh — $1,200" } },
      { from: "customer", text: "Rania Haddad", delayMs: 1200 },
      { from: "ai", text: "Booked: tomorrow 4pm. Agent will call you 🕓", typingMs: 900, event: { kind: "field", key: "Lead", value: "Rania Haddad" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "status", value: "Viewing booked · Tue 4pm" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "badge", value: "Assigned to agent" } },
    ],
  },
  wellness: {
    title: "New appointment",
    dashTitle: "Today's schedule",
    dashSubtitle: "Bookings",
    icon: Sparkles,
    steps: [
      { from: "customer", text: "hi, can I book a deep tissue massage friday?", delayMs: 400 },
      { from: "ai", text: "Yes! Friday I have 11am, 2pm or 5pm. Which works?", typingMs: 900 },
      { from: "customer", text: "2pm please", delayMs: 1200 },
      { from: "ai", text: "Perfect. What name should I put it under?", typingMs: 800, event: { kind: "field", key: "Service", value: "Deep tissue · 60min" } },
      { from: "customer", text: "Lara Nassar", delayMs: 1200 },
      { from: "ai", text: "Booked ✅ Friday 2pm — see you soon!", typingMs: 800, event: { kind: "field", key: "Client", value: "Lara Nassar · Fri 2pm" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "status", value: "Reminder scheduled" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "badge", value: "Added to calendar" } },
    ],
  },
  healthcare: {
    title: "New appointment",
    dashTitle: "Today's patients",
    dashSubtitle: "Bookings & triage",
    icon: Stethoscope,
    steps: [
      { from: "customer", text: "I've had a bad cough 3 days, can I see the doctor?", delayMs: 400 },
      { from: "ai", text: "Sorry to hear. Any fever or shortness of breath?", typingMs: 900 },
      { from: "customer", text: "mild fever yesterday", delayMs: 1200 },
      { from: "ai", text: "Noted. Dr. Karam has 10:30am and 3pm today — which?", typingMs: 1000, event: { kind: "field", key: "Symptoms", value: "Cough 3d, mild fever" } },
      { from: "customer", text: "10:30", delayMs: 1100 },
      { from: "ai", text: "Name please?", typingMs: 700 },
      { from: "customer", text: "Omar Fakhoury", delayMs: 1200 },
      { from: "ai", text: "Booked ✅ Today 10:30 with Dr. Karam.", typingMs: 800, event: { kind: "field", key: "Patient", value: "Omar Fakhoury · 10:30" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "status", value: "Triage: routine" } },
    ],
  },
  education: {
    title: "New registration",
    dashTitle: "Registrations",
    dashSubtitle: "This week",
    icon: GraduationCap,
    steps: [
      { from: "customer", text: "hello, when does the Saturday coding class start?", delayMs: 400 },
      { from: "ai", text: "Saturdays 10am–12pm, starts Nov 8. Ages 10–14. Want to register?", typingMs: 1000 },
      { from: "customer", text: "yes for my son", delayMs: 1200 },
      { from: "ai", text: "Great — child's name and age?", typingMs: 800, event: { kind: "field", key: "Class", value: "Coding · Sat 10am" } },
      { from: "customer", text: "Ziad, 11", delayMs: 1200 },
      { from: "ai", text: "Parent contact number?", typingMs: 700, event: { kind: "field", key: "Student", value: "Ziad · 11" } },
      { from: "customer", text: "70 998 776", delayMs: 1100 },
      { from: "ai", text: "Registered ✅ We'll send the reminder Friday.", typingMs: 900, event: { kind: "field", key: "Parent", value: "+961 70 998 776" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "badge", value: "Seat confirmed" } },
    ],
  },
  service: {
    title: "New booking",
    dashTitle: "Bookings",
    dashSubtitle: "Consultations & sessions",
    icon: Briefcase,
    steps: [
      { from: "customer", text: "hi, I need a marketing strategy session", delayMs: 400 },
      { from: "ai", text: "Sure — I have Tuesday 2pm or Thursday 10am. Which works?", typingMs: 1000 },
      { from: "customer", text: "Tuesday 2pm", delayMs: 1200 },
      { from: "ai", text: "Great. What's your full name and company?", typingMs: 800, event: { kind: "field", key: "Slot", value: "Tue 2pm · 60 min" } },
      { from: "customer", text: "Rania Haddad, Bloom Agency", delayMs: 1300 },
      { from: "ai", text: "Perfect. A $50 deposit holds the slot. Send confirmation?", typingMs: 900, event: { kind: "field", key: "Client", value: "Rania Haddad, Bloom Agency" } },
      { from: "customer", text: "yes", delayMs: 1100 },
      { from: "ai", text: "Booked ✅ See you Tuesday at 2pm.", typingMs: 800, event: { kind: "status", value: "Confirmed" } },
      { from: "ai", text: "", delayMs: 500, event: { kind: "badge", value: "Payment link sent" } },
    ],
  },
};

type Bubble = { id: number; from: Sender; text: string };

function useDemoPlayer(vertical: Vertical) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [dash, setDash] = useState<DashboardState>(emptyDash);
  const [typing, setTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [done, setDone] = useState(false);
  const stepIdxRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const script = scripts[vertical].steps;
  const [tick, setTick] = useState(0);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    clearTimer();
    stepIdxRef.current = 0;
    idRef.current = 0;
    setMessages([]);
    setDash(emptyDash);
    setTyping(false);
    setDone(false);
    setIsPlaying(true);
    setTick((x) => x + 1);
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical]);

  useEffect(() => {
    if (!isPlaying || done) return;
    const step = script[stepIdxRef.current];
    if (!step) {
      setDone(true);
      return;
    }
    const commit = (s: Step) => {
      if (s.text) {
        idRef.current += 1;
        setMessages((m) => [...m, { id: idRef.current, from: s.from, text: s.text }]);
      }
      if (s.event) {
        const e = s.event;
        setDash((d) => {
          if (e.kind === "field") return { ...d, fields: { ...d.fields, [e.key]: e.value } };
          if (e.kind === "status") return { ...d, status: e.value };
          return { ...d, badges: [...d.badges, e.value] };
        });
      }
      stepIdxRef.current += 1;
      timerRef.current = window.setTimeout(() => setTick((x) => x + 1), 50);
    };
    const runStep = () => {
      if (step.from === "ai" && step.text && step.typingMs) {
        setTyping(true);
        timerRef.current = window.setTimeout(() => {
          setTyping(false);
          commit(step);
        }, step.typingMs);
      } else {
        commit(step);
      }
    };
    timerRef.current = window.setTimeout(runStep, step.delayMs ?? 500);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, isPlaying, done]);

  return {
    messages,
    dash,
    typing,
    isPlaying,
    done,
    togglePlay: () => setIsPlaying((p) => !p),
    restart: reset,
  };
}

function PhoneFrame({ children, vertical }: { children: React.ReactNode; vertical: Vertical }) {
  const meta = VERTICALS.find((v) => v.id === vertical)!;
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[2.2rem] border border-border/60 bg-[#0b141a] p-2 shadow-2xl">
      <div className="overflow-hidden rounded-[1.8rem] bg-[#efeae2]">
        {/* WA header */}
        <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
            {meta.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">Jawabify AI</div>
            <div className="truncate text-[11px] opacity-80">online</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChatBody({ messages, typing }: { messages: Bubble[]; typing: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);
  return (
    <div
      className="h-[440px] overflow-y-auto px-3 py-3"
      style={{
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="flex flex-col gap-1.5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[13px] leading-snug shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200 ${
              m.from === "customer"
                ? "self-start bg-white text-[#111b21]"
                : "self-end bg-[#d9fdd3] text-[#111b21]"
            }`}
          >
            <div className="whitespace-pre-wrap">{m.text}</div>
            <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-[#667781]">
              <span>now</span>
              {m.from === "ai" && <CheckCheck className="h-3 w-3 text-sky-500" />}
            </div>
          </div>
        ))}
        {typing && (
          <div className="self-end rounded-lg bg-[#d9fdd3] px-3 py-2 shadow-sm">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:240ms]" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function DashboardCard({ vertical, dash }: { vertical: Vertical; dash: DashboardState }) {
  const s = scripts[vertical];
  const Icon = s.icon;
  const hasContent = Object.keys(dash.fields).length > 0 || dash.status || dash.badges.length > 0;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.dashTitle}</div>
          <div className="text-sm text-muted-foreground/80">{s.dashSubtitle}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 min-h-[280px]">
        {!hasContent ? (
          <div className="flex h-full min-h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
            Waiting for the first message…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {s.title}
            </div>
            <div className="divide-y divide-border/50 rounded-lg border border-border/40 bg-background">
              {Object.entries(dash.fields).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-3 py-2 text-sm animate-in fade-in slide-in-from-right-1 duration-300">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
            {dash.status && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary animate-in fade-in duration-300">
                <Check className="h-4 w-4" /> {dash.status}
              </div>
            )}
            {dash.badges.map((b) => (
              <div key={b} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 animate-in fade-in zoom-in-95 duration-300">
                <Check className="h-3 w-3" /> {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveDemo() {
  return (
    <section id="demo" className="border-t border-border/60 bg-muted/30 py-14 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live sandbox
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Walk around a real dashboard
            </h2>
            <p className="mt-3 text-muted-foreground">
              Open the full Jawabify shell with fake messages arriving live. Click chats, reply, mark leads, change order status — all in your browser. No signup, no card.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>✓ Switch between 6 business types</li>
              <li>✓ Watch AI reply to incoming WhatsApp messages</li>
              <li>✓ Interact with the same UI real customers use</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="/sandbox">Open live sandbox →</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/auth?mode=signup">Start free trial</a>
              </Button>
            </div>
          </div>

          <a href="/sandbox" className="group block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl transition hover:shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border/60 bg-primary px-4 py-2 text-primary-foreground">
              <div className="flex gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="ml-2 text-xs font-medium">jawabify.com/sandbox</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] bg-background">
              <div className="flex flex-col items-center gap-2 bg-[#0f1a2b] py-3 text-white/70">
                {[MessageIcon, DashIcon, PkgIcon, StarIcon].map((I, i) => (
                  <div key={i} className={`flex h-9 w-9 items-center justify-center rounded-lg ${i === 0 ? "bg-primary text-primary-foreground" : ""}`}>
                    <I />
                  </div>
                ))}
              </div>
              <div className="p-3">
                {[
                  { n: "Sarah K.", t: "hi, do you have the Orbit lamp?", u: 2 },
                  { n: "Omar D.", t: "does it come in black?", u: 0 },
                  { n: "Lara N.", t: "when will it arrive?", u: 1 },
                ].map((c) => (
                  <div key={c.n} className="flex items-center gap-2 border-b border-border/50 py-2 last:border-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{c.n[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{c.n}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{c.t}</div>
                    </div>
                    {c.u > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{c.u}</span>}
                  </div>
                ))}
                <div className="mt-3 rounded-lg bg-primary/10 p-2 text-center text-xs font-semibold text-primary group-hover:bg-primary/20">
                  Click to enter →
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

const MessageIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const DashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
const PkgIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
const StarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>;
