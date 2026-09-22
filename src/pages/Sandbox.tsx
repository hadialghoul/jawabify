import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { VERTICALS, type Vertical } from "@/lib/verticals";
import {
  MessageSquare,
  LayoutDashboard,
  Package,
  Users,
  Star,
  Flag,
  Megaphone,
  Bot,
  BotOff,
  CalendarDays,
  BookOpen,
  LayoutGrid,
  Home as HomeIcon,
  UserPlus,
  HeartPulse,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Sparkles,
  Send,
  Paperclip,
  ArrowLeft,
  Plus,
  RotateCcw,
  X,
  CheckCheck,
  Zap,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================
type Sender = "customer" | "agent" | "ai";
interface Msg {
  id: string;
  from: Sender;
  text: string;
  ts: number;
}
interface ScriptTurn {
  c: string; // customer message
  a: string; // AI reply
}
interface Contact {
  id: string;
  name: string;
  phone: string;
  aiEnabled: boolean;
  interested: boolean;
  needsHuman: boolean;
  unread: number;
  messages: Msg[];
  script: ScriptTurn[]; // ordered follow-up turns
  step: number; // next script index to play
}

interface OrderItem {
  id: string;
  customer: string;
  item: string;
  qty: number;
  total: number;
  status: "pending" | "confirmed" | "shipped";
  createdAt: number;
}
interface Appt {
  id: string;
  name: string;
  service: string;
  when: string;
  status: "upcoming" | "done";
}

interface RailItem {
  key: string;
  label: string;
  icon: any;
}

// ============================================================================
// Seed data per vertical
// ============================================================================
const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => Date.now();

function seedFor(vertical: Vertical): { contacts: Contact[]; orders: OrderItem[]; appts: Appt[] } {
  const base = (
    name: string,
    phone: string,
    msgs: Array<[Sender, string, number]>,
    script: ScriptTurn[] = [],
  ): Contact => ({
    id: rid(),
    name,
    phone,
    aiEnabled: true,
    interested: false,
    needsHuman: false,
    unread: 0,
    messages: msgs.map(([f, t, ago]) => ({ id: rid(), from: f, text: t, ts: now() - ago })),
    script,
    step: 0,
  });


  if (vertical === "ecommerce") {
    return {
      contacts: [
        base(
          "Sarah K.",
          "+961 76 123 456",
          [
            ["customer", "hi, do you have the Orbit lamp?", 1000 * 60 * 8],
            ["ai", "Yes! Orbit Magnetic Wall Lamp — $24.99, on sale $9.99 🎉", 1000 * 60 * 7],
            ["customer", "biddi wehde", 1000 * 60 * 6],
            ["ai", "Tamem! Shu ismak el kamel?", 1000 * 60 * 5],
          ],
          [
            { c: "Sarah Khoury", a: "Perfect. What's the delivery address?" },
            { c: "Achrafieh, Rue Sursock, bldg 12", a: "Got it. Best number to reach you on delivery?" },
            { c: "same number", a: "Order confirmed ✅ Orbit Lamp × 1 — $9.99 + $3 delivery. See you in 2–3 days!" },
          ],
        ),
        base(
          "Omar D.",
          "+961 71 998 220",
          [
            ["customer", "does the Orbit lamp come in black?", 1000 * 60 * 30],
            ["ai", "Yes — black and white are both in stock.", 1000 * 60 * 29],
          ],
          [
            { c: "ok black then, biddi tnen", a: "Two black Orbit lamps — $19.98. Want to place the order?" },
            { c: "yes", a: "Great — what's your full name?" },
          ],
        ),
        base(
          "Lara N.",
          "+961 3 445 100",
          [
            ["customer", "when will my order arrive?", 1000 * 60 * 60 * 2],
            ["ai", "Delivery takes 2–3 business days. Free over $50 🚚", 1000 * 60 * 60 * 2],
          ],
          [
            { c: "any tracking?", a: "Yes — I'll send the tracking link the moment it ships." },
            { c: "shukran", a: "Anytime 🙌" },
          ],
        ),
        base(
          "Rania H.",
          "+961 70 331 002",
          [
            ["customer", "can I pay cash on delivery?", 1000 * 60 * 60 * 5],
            ["ai", "Yes, cash on delivery is available across Lebanon.", 1000 * 60 * 60 * 5],
          ],
          [
            { c: "great, I want the Book Light", a: "Book Light — $12.99. What's the delivery address?" },
          ],
        ),
      ],
      orders: [
        { id: rid(), customer: "Fatima M.", item: "Orbit Lamp × 2", qty: 2, total: 22.98, status: "pending", createdAt: now() - 1000 * 60 * 15 },
        { id: rid(), customer: "Ziad K.", item: "Book Light × 1", qty: 1, total: 12.99, status: "confirmed", createdAt: now() - 1000 * 60 * 60 },
        { id: rid(), customer: "Nour S.", item: "Solar Panel × 1", qty: 1, total: 45.0, status: "shipped", createdAt: now() - 1000 * 60 * 60 * 4 },
      ],
      appts: [],
    };
  }
  if (vertical === "restaurant") {
    return {
      contacts: [
        base(
          "Table 6",
          "+961 76 200 011",
          [
            ["customer", "can we order?", 1000 * 60 * 3],
            ["ai", "Of course! What would you like?", 1000 * 60 * 2],
          ],
          [
            { c: "2 margheritas and a caesar", a: "Got it — 2× Margherita, 1× Caesar. $34. Sending to kitchen?" },
            { c: "yes send", a: "Sent to kitchen 👨‍🍳 ETA 15 min." },
          ],
        ),
        base(
          "Karim (delivery)",
          "+961 3 887 665",
          [
            ["customer", "1 margherita, 2 cokes", 1000 * 60 * 25],
            ["ai", "Got it — $18. Confirm to send to kitchen?", 1000 * 60 * 24],
          ],
          [
            { c: "yes, deliver to Achrafieh rue Huvelin", a: "Confirmed ✅ driver leaves in ~20 min." },
          ],
        ),
        base(
          "Sami (reservation)",
          "+961 70 445 002",
          [
            ["customer", "table for 4 tonight 8pm?", 1000 * 60 * 60],
            ["ai", "Booked ✅ table for 4 at 8pm.", 1000 * 60 * 59],
          ],
          [
            { c: "can we make it 8:30?", a: "Moved to 8:30pm ✅ see you tonight!" },
          ],
        ),
      ],
      orders: [
        { id: rid(), customer: "Table 3", item: "2× Margherita, 1× Caesar", qty: 3, total: 34, status: "pending", createdAt: now() - 1000 * 60 * 5 },
        { id: rid(), customer: "Karim (delivery)", item: "1× Margherita, 2× Coke", qty: 3, total: 18, status: "confirmed", createdAt: now() - 1000 * 60 * 20 },
      ],
      appts: [
        { id: rid(), name: "Sami (4 pax)", service: "Reservation", when: "Tonight 8:00pm", status: "upcoming" },
        { id: rid(), name: "Nadia (2 pax)", service: "Reservation", when: "Tonight 9:30pm", status: "upcoming" },
      ],
    };
  }
  if (vertical === "real_estate") {
    return {
      contacts: [
        base(
          "Rania H.",
          "+961 70 331 002",
          [
            ["customer", "is the 2BR in Achrafieh still available?", 1000 * 60 * 10],
            ["ai", "Yes! $1,200/mo, 95sqm. Want to book a viewing?", 1000 * 60 * 9],
          ],
          [
            { c: "yes, tomorrow afternoon?", a: "I have 4pm or 5pm tomorrow — which works?" },
            { c: "4pm", a: "Booked ✅ viewing tomorrow 4pm. Agent Karim will meet you there." },
          ],
        ),
        base(
          "Ahmad F.",
          "+961 3 550 220",
          [
            ["customer", "any studios under $600?", 1000 * 60 * 45],
            ["ai", "Yes, we have 3 options in Hamra and Badaro.", 1000 * 60 * 44],
          ],
          [
            { c: "send me the Hamra one", a: "Hamra studio — $550/mo, 42sqm, furnished. Want a viewing?" },
            { c: "friday morning?", a: "Fri 11am works ✅ Agent Lea will meet you." },
          ],
        ),
      ],
      orders: [],
      appts: [
        { id: rid(), name: "Rania Haddad", service: "Viewing — 2BR Achrafieh", when: "Tomorrow 4:00pm", status: "upcoming" },
        { id: rid(), name: "Ahmad Farah", service: "Viewing — Studio Hamra", when: "Fri 11:00am", status: "upcoming" },
      ],
    };
  }
  if (vertical === "wellness") {
    return {
      contacts: [
        base(
          "Lara N.",
          "+961 3 445 100",
          [
            ["customer", "can I book a deep tissue Friday?", 1000 * 60 * 12],
            ["ai", "Friday I have 11am, 2pm or 5pm. Which works?", 1000 * 60 * 11],
          ],
          [
            { c: "2pm please", a: "Booked ✅ Deep Tissue · 60min Fri 2pm. See you then!" },
            { c: "can I add a facial after?", a: "Yes — Hydrating Facial 30min right after, $45. Add it?" },
          ],
        ),
        base(
          "Maya K.",
          "+961 76 001 445",
          [
            ["customer", "do you do facials?", 1000 * 60 * 40],
            ["ai", "Yes, classic and hydrating — $45 & $60.", 1000 * 60 * 39],
          ],
          [
            { c: "hydrating, saturday morning", a: "Sat 11am works ✅ what name should I book under?" },
            { c: "Maya Khoury", a: "Booked ✅ Hydrating Facial Sat 11am." },
          ],
        ),
      ],
      orders: [],
      appts: [
        { id: rid(), name: "Lara Nassar", service: "Deep Tissue · 60min", when: "Fri 2:00pm", status: "upcoming" },
        { id: rid(), name: "Maya Khoury", service: "Hydrating Facial", when: "Sat 11:00am", status: "upcoming" },
      ],
    };
  }
  if (vertical === "healthcare") {
    return {
      contacts: [
        base(
          "Omar F.",
          "+961 71 220 998",
          [
            ["customer", "bad cough 3 days, mild fever", 1000 * 60 * 6],
            ["ai", "Dr. Karam has 10:30am and 3pm today — which?", 1000 * 60 * 5],
          ],
          [
            { c: "10:30 please", a: "Booked ✅ Dr. Karam today 10:30am. Please arrive 10 min early." },
          ],
        ),
        base(
          "Nour A.",
          "+961 3 776 220",
          [
            ["customer", "when do lab results come back?", 1000 * 60 * 90],
            ["ai", "Usually 24–48h. I'll ping you as soon as they're in.", 1000 * 60 * 89],
          ],
          [
            { c: "any update?", a: "Just came in — I'll forward the PDF now." },
          ],
        ),
      ],
      orders: [],
      appts: [
        { id: rid(), name: "Omar Fakhoury", service: "Dr. Karam · General", when: "Today 10:30am", status: "upcoming" },
        { id: rid(), name: "Layla Saad", service: "Dr. Antoun · Follow-up", when: "Today 3:00pm", status: "upcoming" },
      ],
    };
  }
  // education
  return {
    contacts: [
      base(
        "Rana (parent)",
        "+961 70 998 776",
        [
          ["customer", "when does Saturday coding start?", 1000 * 60 * 20],
          ["ai", "Sat 10am–12pm, starts Nov 8. Ages 10–14.", 1000 * 60 * 19],
        ],
        [
          { c: "what's the fee?", a: "$180 for the 8-week term, materials included." },
          { c: "ok register my son Ziad, 11", a: "Registered ✅ Ziad, Sat 10am. Reminder will go out Fri evening." },
        ],
      ),
      base(
        "Ziad (student)",
        "+961 3 220 445",
        [
          ["customer", "is the physics tutor available?", 1000 * 60 * 55],
          ["ai", "Yes — Thu 5pm or Sat 3pm work.", 1000 * 60 * 54],
        ],
        [
          { c: "thursday 5pm", a: "Booked ✅ Physics tutoring Thu 5pm with Mr. Antoun." },
        ],
      ),
    ],
    orders: [],
    appts: [
      { id: rid(), name: "Ziad (11)", service: "Coding · Sat 10am", when: "Sat Nov 8", status: "upcoming" },
      { id: rid(), name: "Layan (13)", service: "Physics tutoring", when: "Thu 5pm", status: "upcoming" },
    ],
  };
}


// ============================================================================
// Rail items per vertical
// ============================================================================
function railFor(vertical: Vertical): RailItem[] {
  const chats = { key: "chats", label: "Chats", icon: MessageSquare };
  const home = { key: "home", label: "Overview", icon: LayoutDashboard };
  const crm = { key: "crm", label: "CRM", icon: Users };
  const flagged = { key: "flagged", label: "Flagged", icon: Flag };
  const campaigns = { key: "campaigns", label: "Campaigns", icon: Megaphone };

  switch (vertical) {
    case "ecommerce":
      return [chats, home, { key: "orders", label: "Orders", icon: Package }, crm, { key: "interested", label: "Interested", icon: Star }, flagged, campaigns, { key: "ai", label: "AI", icon: Bot }];
    case "restaurant":
      return [chats, home, { key: "orders", label: "Bills", icon: Package }, { key: "res", label: "Reservations", icon: CalendarDays }, { key: "menu", label: "Menu", icon: BookOpen }, { key: "tables", label: "Tables", icon: LayoutGrid }, crm, flagged];
    case "real_estate":
      return [chats, home, { key: "listings", label: "Listings", icon: HomeIcon }, { key: "viewings", label: "Viewings", icon: CalendarDays }, { key: "leads", label: "Leads", icon: UserPlus }, { key: "agents", label: "Agents", icon: Briefcase }, crm, flagged];
    case "wellness":
      return [chats, home, { key: "appts", label: "Calendar", icon: CalendarDays }, { key: "services", label: "Catalog", icon: Sparkles }, { key: "leads", label: "Leads", icon: HeartPulse }, { key: "staff", label: "Staff", icon: Users }, crm, flagged, campaigns];
    case "healthcare":
      return [chats, home, { key: "appts", label: "Calendar", icon: CalendarDays }, { key: "attention", label: "Attention", icon: HeartPulse }, { key: "doctors", label: "Team", icon: Stethoscope }, { key: "leads", label: "Leads", icon: UserPlus }, { key: "labs", label: "Labs", icon: Sparkles }, crm, flagged, campaigns];
    case "education":
      return [chats, home, { key: "classes", label: "Courses", icon: BookOpen }, { key: "regs", label: "Enrollments", icon: GraduationCap }, { key: "leads", label: "Leads", icon: UserPlus }, crm, flagged, campaigns];
  }
}

// Ambient generic ticklers used only as a last resort when every contact has
// exhausted their scripted turns. Kept short so they never sound absurd for a
// given vertical.
const AMBIENT: Record<Vertical, { c: string; a: string }> = {
  ecommerce: { c: "any update on my order?", a: "Just checked — packed and out for delivery tomorrow 🚚" },
  restaurant: { c: "are you still open?", a: "Yes, kitchen closes at 11pm — want to order?" },
  real_estate: { c: "anything new this week?", a: "Two new listings just came in — want me to send them?" },
  wellness: { c: "any openings today?", a: "Yes — 3pm and 6pm are free. Which works?" },
  healthcare: { c: "can I move my appointment?", a: "Sure — what day and time works better?" },
  education: { c: "any spots left?", a: "Yes, 2 seats left in the Saturday class." },
  service: { c: "are you available this week?", a: "Yes — I have a few slots open. What day works best?" },
};


// ============================================================================
// The sandbox
// ============================================================================
const STORAGE = "jawabify-sandbox-v1";

export default function Sandbox() {
  const [vertical, setVertical] = useState<Vertical>("ecommerce");
  const [rail, setRail] = useState<string>("chats");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalAi, setGlobalAi] = useState(true);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [showMobileList, setShowMobileList] = useState(true);

  // seed on vertical change
  useEffect(() => {
    const s = seedFor(vertical);
    setContacts(s.contacts);
    setOrders(s.orders);
    setAppts(s.appts);
    setActiveId(s.contacts[0]?.id ?? null);
    setRail("chats");
  }, [vertical]);

  // scheduled incoming messages — always coherent with the target contact's script
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.hidden || contacts.length === 0) return;
      simulateIncoming();
    }, 28_000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, contacts.length]);

  function advanceScript(contactId: string) {
    let turn: ScriptTurn | null = null;
    let targetName = "";
    let aiOn = true;
    setContacts((cs) => {
      const target = cs.find((c) => c.id === contactId);
      if (!target) return cs;
      const scripted = target.script[target.step];
      turn = scripted ?? AMBIENT[vertical];
      targetName = target.name;
      aiOn = target.aiEnabled;
      return cs.map((c) =>
        c.id === contactId
          ? {
              ...c,
              unread: activeId === c.id ? 0 : c.unread + 1,
              step: scripted ? c.step + 1 : c.step,
              messages: [...c.messages, { id: rid(), from: "customer", text: turn!.c, ts: now() }],
            }
          : c,
      );
    });
    if (!turn) return;
    const t = turn as ScriptTurn;
    if (activeId !== contactId) {
      toast(`New message from ${targetName}`, { description: t.c });
    }
    if (globalAi && aiOn) {
      window.setTimeout(() => {
        setContacts((cs) =>
          cs.map((c) =>
            c.id === contactId
              ? { ...c, messages: [...c.messages, { id: rid(), from: "ai", text: t.a, ts: now() }] }
              : c,
          ),
        );
      }, 2200);
    }
  }

  function sendReply(contactId: string, text: string) {
    setContacts((cs) => cs.map((c) => (c.id === contactId ? { ...c, messages: [...c.messages, { id: rid(), from: "agent", text, ts: now() }] } : c)));
  }

  function openChat(id: string) {
    setActiveId(id);
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    setShowMobileList(false);
  }

  function toggleAi(id: string) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, aiEnabled: !c.aiEnabled } : c)));
  }
  function toggleInterested(id: string) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, interested: !c.interested } : c)));
    toast.success("Contact updated");
  }
  function toggleHuman(id: string) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, needsHuman: !c.needsHuman } : c)));
  }
  function bumpOrder(id: string) {
    setOrders((os) =>
      os.map((o) => (o.id === id ? { ...o, status: o.status === "pending" ? "confirmed" : o.status === "confirmed" ? "shipped" : "pending" } : o)),
    );
  }
  function reset() {
    const s = seedFor(vertical);
    setContacts(s.contacts);
    setOrders(s.orders);
    setAppts(s.appts);
    setActiveId(s.contacts[0]?.id ?? null);
    toast.success("Sandbox reset");
  }
  function simulateIncoming() {
    // Read the freshest contacts inside the state updater so the interval
    // can't pin us to a stale snapshot (which would repeat the same turn).
    setContacts((cs) => {
      if (cs.length === 0) return cs;
      const withScript = cs.filter((c) => c.step < c.script.length);
      const pool = withScript.length > 0 ? withScript : cs;
      const target = pool[Math.floor(Math.random() * pool.length)];
      queueMicrotask(() => advanceScript(target.id));
      return cs;
    });
  }



  const active = contacts.find((c) => c.id === activeId) ?? null;
  const railItems = useMemo(() => railFor(vertical), [vertical]);
  const badges: Record<string, number> = {
    chats: contacts.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0),
    interested: contacts.filter((c) => c.interested).length,
    flagged: contacts.filter((c) => c.needsHuman).length,
    orders: orders.filter((o) => o.status === "pending").length,
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground overflow-hidden">
      <Helmet>
        <title>Jawabify — Live Sandbox</title>
        <meta name="description" content="Try Jawabify — walk around a real dashboard with live fake conversations. No signup." />
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      {/* Top banner */}
      {bannerOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            <Zap className="h-3 w-3" /> SANDBOX
          </span>
          <span className="hidden text-muted-foreground sm:inline">You're exploring a live demo — nothing is saved.</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as Vertical)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Switch vertical"
            >
              {VERTICALS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.emoji} {v.label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={reset} className="h-8 gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" asChild className="h-8">
              <Link to="/auth?mode=signup">Start free trial</Link>
            </Button>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setBannerOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Icon rail — desktop only */}
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-[#0f1a2b] py-3 text-white/80 md:flex">
          {railItems.map((it) => {
            const Icon = it.icon;
            const on = rail === it.key;
            const badge = badges[it.key];
            return (
              <button
                key={it.key}
                onClick={() => {
                  setRail(it.key);
                  if (it.key === "chats") setShowMobileList(true);
                }}
                className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-lg transition ${
                  on ? "bg-primary text-primary-foreground" : "hover:bg-white/10"
                }`}
                title={it.label}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-0.5 text-[9px] font-medium">{it.label.slice(0, 6)}</span>
                {badge ? (
                  <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{badge}</span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {/* Middle: conversation list (only for chats view) */}
        {rail === "chats" && (
          <section
            className={`w-full shrink-0 border-r border-border bg-card md:w-80 lg:w-96 ${
              !showMobileList && active ? "hidden md:block" : "block"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Chats</h2>
                <p className="text-xs text-muted-foreground">{contacts.length} conversations</p>
              </div>
              <Button size="sm" variant="ghost" onClick={simulateIncoming} title="Simulate incoming">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100dvh - 140px)" }}>
              {contacts
                .slice()
                .sort((a, b) => (b.messages[b.messages.length - 1]?.ts ?? 0) - (a.messages[a.messages.length - 1]?.ts ?? 0))
                .map((c) => {
                  const last = c.messages[c.messages.length - 1];
                  return (
                    <button
                      key={c.id}
                      onClick={() => openChat(c.id)}
                      className={`flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-muted ${
                        active?.id === c.id ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">{last ? relTime(last.ts) : ""}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {c.interested && <Star className="h-3 w-3 fill-yellow-400 text-yellow-500" />}
                          {c.needsHuman && <Flag className="h-3 w-3 text-red-500" />}
                          <p className="truncate text-xs text-muted-foreground">{last?.text ?? ""}</p>
                        </div>
                      </div>
                      {c.unread > 0 && <Badge className="ml-auto shrink-0 bg-primary text-primary-foreground">{c.unread}</Badge>}
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {/* Right pane */}
        <section className="flex min-w-0 flex-1 flex-col">
          {rail === "chats" ? (
            active ? (
              <ChatPane
                contact={active}
                onBack={() => setShowMobileList(true)}
                onSend={(t) => sendReply(active.id, t)}
                onToggleAi={() => toggleAi(active.id)}
                onToggleInterested={() => toggleInterested(active.id)}
                onToggleHuman={() => toggleHuman(active.id)}
              />
            ) : (
              <EmptyState label="Pick a conversation" />
            )
          ) : (
            <RightPane rail={rail} vertical={vertical} contacts={contacts} orders={orders} appts={appts} onBumpOrder={bumpOrder} />
          )}
        </section>
      </div>

      {/* Mobile bottom bar */}
      <nav className="flex items-center justify-around border-t border-border bg-card px-1 py-1 md:hidden">
        {railItems.slice(0, 5).map((it) => {
          const Icon = it.icon;
          const on = rail === it.key;
          return (
            <button
              key={it.key}
              onClick={() => {
                setRail(it.key);
                setShowMobileList(true);
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium ${
                on ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </button>
          );
        })}
      </nav>

      {/* Floating simulate button */}
      <button
        onClick={simulateIncoming}
        className="fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg md:bottom-6"
        title="Simulate incoming message"
      >
        <Plus className="h-4 w-4" /> Simulate message
      </button>
    </div>
  );
}

// ============================================================================
// Chat pane
// ============================================================================
function ChatPane({
  contact,
  onBack,
  onSend,
  onToggleAi,
  onToggleInterested,
  onToggleHuman,
}: {
  contact: Contact;
  onBack: () => void;
  onSend: (text: string) => void;
  onToggleAi: () => void;
  onToggleInterested: () => void;
  onToggleHuman: () => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [contact.messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-primary px-3 py-2 text-primary-foreground">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-white/20 text-primary-foreground">
            {contact.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{contact.name}</div>
          <div className="truncate text-[11px] opacity-80">{contact.phone}</div>
        </div>
        <button onClick={onToggleAi} title="AI replies" className="rounded p-1.5 hover:bg-white/10">
          {contact.aiEnabled ? <Bot className="h-5 w-5" /> : <BotOff className="h-5 w-5 opacity-60" />}
        </button>
        <button onClick={onToggleInterested} title="Mark interested" className="rounded p-1.5 hover:bg-white/10">
          <Star className={`h-5 w-5 ${contact.interested ? "fill-yellow-300 text-yellow-300" : ""}`} />
        </button>
        <button onClick={onToggleHuman} title="Needs human" className="rounded p-1.5 hover:bg-white/10">
          <Flag className={`h-5 w-5 ${contact.needsHuman ? "fill-red-400 text-red-400" : ""}`} />
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          background: "#efeae2",
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          {contact.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-[13px] leading-snug shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                m.from === "customer" ? "self-start bg-white text-[#111b21]" : m.from === "ai" ? "self-end bg-[#d9fdd3] text-[#111b21]" : "self-end bg-[#c8ecff] text-[#111b21]"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-[#667781]">
                <span>{new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                {m.from !== "customer" && <CheckCheck className="h-3 w-3 text-sky-500" />}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-card p-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button
          size="icon"
          disabled={!text.trim()}
          onClick={() => {
            if (!text.trim()) return;
            onSend(text.trim());
            setText("");
          }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard panes
// ============================================================================
function RightPane({
  rail,
  vertical,
  contacts,
  orders,
  appts,
  onBumpOrder,
}: {
  rail: string;
  vertical: Vertical;
  contacts: Contact[];
  orders: OrderItem[];
  appts: Appt[];
  onBumpOrder: (id: string) => void;
}) {
  if (rail === "home") return <Overview vertical={vertical} contacts={contacts} orders={orders} appts={appts} />;
  if (rail === "orders")
    return (
      <PaneWrap title={vertical === "restaurant" ? "Bills" : "Orders"} subtitle="Click a card to bump its status">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.length === 0 && <EmptyState label="No orders yet" />}
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => onBumpOrder(o.id)}
              className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="text-sm font-semibold">{o.customer}</div>
                <StatusPill s={o.status} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{o.item}</div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{relTime(o.createdAt)}</span>
                <span className="font-bold">${o.total.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      </PaneWrap>
    );
  if (rail === "interested")
    return (
      <PaneWrap title="Interested customers" subtitle="Marked as hot leads">
        <ContactCards items={contacts.filter((c) => c.interested)} emptyLabel="No interested contacts yet — star one!" />
      </PaneWrap>
    );
  if (rail === "flagged" || rail === "attention")
    return (
      <PaneWrap title="Flagged for human" subtitle="AI escalated these">
        <ContactCards items={contacts.filter((c) => c.needsHuman)} emptyLabel="Nothing flagged." />
      </PaneWrap>
    );
  if (rail === "crm")
    return (
      <PaneWrap title="CRM" subtitle={`${contacts.length} contacts`}>
        <ContactCards items={contacts} />
      </PaneWrap>
    );
  if (rail === "appts" || rail === "res" || rail === "viewings" || rail === "regs")
    return (
      <PaneWrap title="Appointments" subtitle="Upcoming bookings">
        <div className="grid gap-3 sm:grid-cols-2">
          {appts.length === 0 && <EmptyState label="No appointments" />}
          {appts.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.service}</div>
                </div>
                <Badge variant="secondary">{a.status}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <span>{a.when}</span>
              </div>
            </div>
          ))}
        </div>
      </PaneWrap>
    );
  if (rail === "campaigns")
    return (
      <PaneWrap title="Campaigns" subtitle="Broadcast to opt-in contacts">
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Campaign broadcasting is available on the real dashboard.
          <div className="mt-3">
            <Button asChild size="sm">
              <Link to="/auth?mode=signup">Start free trial</Link>
            </Button>
          </div>
        </div>
      </PaneWrap>
    );
  if (rail === "menu") return <MenuPane />;
  if (rail === "tables") return <TablesPane />;
  if (rail === "listings") return <ListingsPane />;
  if (rail === "leads") return <LeadsPane contacts={contacts} />;
  if (rail === "agents") return <AgentsPane />;
  if (rail === "services") return <ServicesPane />;
  if (rail === "doctors") return <DoctorsPane />;
  if (rail === "staff") return <StaffPane />;
  if (rail === "labs") return <LabsPane />;
  if (rail === "classes") return <ClassesPane />;
  if (rail === "ai")
    return (
      <PaneWrap title="AI settings" subtitle="Tune the assistant to your business">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { t: "Knowledge base", d: "12 entries · last updated 2h ago" },
            { t: "Auto-reply", d: "Enabled globally · 8 chats muted" },
            { t: "Escalation rules", d: "Flag when confidence < 60%" },
            { t: "Language", d: "English + Arabic (auto-detected)" },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">{x.t}</div>
              <div className="mt-1 text-xs text-muted-foreground">{x.d}</div>
            </div>
          ))}
        </div>
      </PaneWrap>
    );
  return <PaneWrap title={rail} subtitle="Explore this section on the real dashboard"><EmptyState label={`${rail} — available on the real app`} /></PaneWrap>;
}

// -- Vertical-specific dashboard sub-panes --------------------------------
function MenuPane() {
  const items = [
    { cat: "Pizza", name: "Margherita", price: 12, stock: "in stock" },
    { cat: "Pizza", name: "Diavola", price: 14, stock: "in stock" },
    { cat: "Salad", name: "Caesar", price: 10, stock: "in stock" },
    { cat: "Drinks", name: "Coke 33cl", price: 3, stock: "in stock" },
    { cat: "Dessert", name: "Tiramisu", price: 7, stock: "low" },
  ];
  return (
    <PaneWrap title="Menu" subtitle="What the AI can quote and take orders for">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{i.cat}</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="text-sm font-semibold">{i.name}</div>
              <div className="text-sm font-bold">${i.price}</div>
            </div>
            <Badge variant={i.stock === "low" ? "destructive" : "secondary"} className="mt-2 text-[10px]">{i.stock}</Badge>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function TablesPane() {
  const tables = Array.from({ length: 8 }, (_, i) => ({
    n: i + 1,
    seats: [2, 4, 4, 2, 6, 4, 2, 8][i],
    status: [true, false, true, true, false, false, true, false][i] ? "occupied" : "free",
  }));
  return (
    <PaneWrap title="Tables" subtitle="Live floor status">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <div
            key={t.n}
            className={`rounded-xl border p-4 text-center ${t.status === "occupied" ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}
          >
            <div className="text-2xl font-bold">T{t.n}</div>
            <div className="text-xs text-muted-foreground">{t.seats} seats</div>
            <div className={`mt-2 text-[10px] font-semibold uppercase ${t.status === "occupied" ? "text-red-600" : "text-emerald-700"}`}>
              {t.status}
            </div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function ListingsPane() {
  const list = [
    { name: "2BR Achrafieh · Sursock", price: "$1,200/mo", size: "95sqm", status: "available" },
    { name: "Studio Hamra · furnished", price: "$550/mo", size: "42sqm", status: "available" },
    { name: "3BR Badaro · balcony", price: "$1,600/mo", size: "140sqm", status: "under offer" },
    { name: "Duplex Mansourieh", price: "$2,400/mo", size: "220sqm", status: "available" },
  ];
  return (
    <PaneWrap title="Listings" subtitle="Properties the AI can quote">
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((l) => (
          <div key={l.name} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="text-sm font-semibold">{l.name}</div>
              <Badge variant={l.status === "available" ? "secondary" : "destructive"}>{l.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{l.size}</span>
              <span className="text-sm font-bold text-foreground">{l.price}</span>
            </div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function LeadsPane({ contacts }: { contacts: Contact[] }) {
  return (
    <PaneWrap title="Leads" subtitle="New enquiries captured by the AI">
      <ContactCards items={contacts} />
    </PaneWrap>
  );
}

function AgentsPane() {
  const agents = [
    { name: "Karim H.", role: "Senior · Achrafieh", listings: 12 },
    { name: "Lea M.", role: "Hamra · Ras Beirut", listings: 9 },
    { name: "Rami S.", role: "Metn · Baabda", listings: 7 },
  ];
  return (
    <PaneWrap title="Agents" subtitle="Who the AI can route viewings to">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <div key={a.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{a.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{a.role}</div>
            <div className="mt-3 text-xs"><b>{a.listings}</b> active listings</div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function ServicesPane() {
  const svc = [
    { name: "Deep Tissue Massage", dur: "60min", price: 55 },
    { name: "Swedish Massage", dur: "60min", price: 50 },
    { name: "Hydrating Facial", dur: "45min", price: 45 },
    { name: "Classic Facial", dur: "30min", price: 35 },
    { name: "Body Scrub", dur: "45min", price: 40 },
  ];
  return (
    <PaneWrap title="Services" subtitle="Menu the AI can book from">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {svc.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{s.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.dur}</div>
            <div className="mt-2 text-sm font-bold">${s.price}</div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function DoctorsPane() {
  const docs = [
    { name: "Dr. Karam", spec: "General practitioner", next: "Today 10:30am" },
    { name: "Dr. Antoun", spec: "Cardiology", next: "Today 3:00pm" },
    { name: "Dr. Nassar", spec: "Pediatrics", next: "Tomorrow 9:00am" },
  ];
  return (
    <PaneWrap title="Doctors" subtitle="Who the AI books appointments with">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <div key={d.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{d.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{d.spec}</div>
            <div className="mt-3 text-xs">Next slot: <b>{d.next}</b></div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function StaffPane() {
  const staff = [
    { name: "Nour A.", role: "Lead Therapist", next: "Fri 2:00pm" },
    { name: "Rami K.", role: "Massage Therapist", next: "Today 5:00pm" },
    { name: "Layla H.", role: "Esthetician · Facials", next: "Sat 11:00am" },
  ];
  return (
    <PaneWrap title="Staff" subtitle="Who the AI books sessions with">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{s.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.role}</div>
            <div className="mt-3 text-xs">Next slot: <b>{s.next}</b></div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function LabsPane() {
  const labs = [
    { patient: "Omar F.", test: "CBC + CRP", status: "pending", eta: "24h" },
    { patient: "Nour A.", test: "Vitamin D", status: "ready", eta: "—" },
    { patient: "Layla S.", test: "Thyroid panel", status: "in progress", eta: "12h" },
  ];
  return (
    <PaneWrap title="Labs" subtitle="Results the AI can share with patients">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labs.map((l) => (
          <div key={l.patient + l.test} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{l.patient}</div>
            <div className="mt-1 text-xs text-muted-foreground">{l.test}</div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <Badge variant={l.status === "ready" ? "secondary" : "outline"}>{l.status}</Badge>
              <span className="text-muted-foreground">ETA {l.eta}</span>
            </div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}

function ClassesPane() {
  const cls = [
    { name: "Coding for kids", when: "Sat 10am–12pm", seats: "6 / 12", term: "8 weeks" },
    { name: "Physics tutoring", when: "Thu 5pm", seats: "3 / 6", term: "ongoing" },
    { name: "Arabic literature", when: "Sun 11am", seats: "8 / 10", term: "6 weeks" },
  ];
  return (
    <PaneWrap title="Classes" subtitle="Live enrollment status">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cls.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{c.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.when} · {c.term}</div>
            <div className="mt-3 text-xs">Enrolled: <b>{c.seats}</b></div>
          </div>
        ))}
      </div>
    </PaneWrap>
  );
}


function Overview({ vertical, contacts, orders, appts }: { vertical: Vertical; contacts: Contact[]; orders: OrderItem[]; appts: Appt[] }) {
  const meta = VERTICALS.find((v) => v.id === vertical)!;
  const stats = [
    { label: "Active chats", value: contacts.length, icon: MessageSquare },
    { label: "Unread", value: contacts.reduce((n, c) => n + c.unread, 0), icon: Bot },
    { label: vertical === "restaurant" ? "Bills today" : "Orders today", value: orders.length, icon: Package },
    { label: "Appointments", value: appts.length, icon: CalendarDays },
  ];
  return (
    <PaneWrap title={`${meta.emoji} ${meta.label} overview`} subtitle={meta.tagline}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {contacts.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <span className="truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{relTime(c.messages[c.messages.length - 1]?.ts ?? now())}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <h3 className="text-sm font-semibold text-primary">Try it out</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>• Click <b>Chats</b> and open a conversation.</li>
            <li>• Send a reply — the AI will follow up.</li>
            <li>• Tap <b>+ Simulate message</b> to trigger an incoming ping.</li>
            <li>• Switch business type at the top right.</li>
          </ul>
          <Button asChild className="mt-4">
            <Link to="/auth">Get this for your business</Link>
          </Button>
        </div>
      </div>
    </PaneWrap>
  );
}

function ContactCards({ items, emptyLabel = "Nothing here" }: { items: Contact[]; emptyLabel?: string }) {
  if (items.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.phone}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.interested && <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Interested</Badge>}
            {c.needsHuman && <Badge className="bg-red-500/20 text-red-700 dark:text-red-300">Needs human</Badge>}
            {c.aiEnabled ? <Badge variant="secondary">AI on</Badge> : <Badge variant="outline">AI off</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ s }: { s: OrderItem["status"] }) {
  const map = {
    pending: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    confirmed: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    shipped: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${map[s]}`}>{s}</span>;
}

function PaneWrap({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border bg-card px-5 py-4">
        <h1 className="text-lg font-semibold capitalize">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function relTime(ts: number) {
  const s = Math.floor((now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
