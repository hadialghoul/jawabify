import {
  BarChart3, ListOrdered, CalendarDays, BookOpen, LayoutGrid, Users, Megaphone, AlertCircle,
  Home as HomeIcon, UserRound, Activity, FlaskConical, Stethoscope, Sparkles, GraduationCap,
  Package, MessageSquare, TrendingUp, CheckCircle2, Clock, Plus, Search, RefreshCw, CalendarIcon,
  Briefcase,
} from "lucide-react";
import { BrowserFrame } from "./Mockups";

/* ---------------- Shared chrome (mirrors the real app tab bar) ---------------- */

type TabDef = { id: string; label: string; icon: any; badge?: number };

function AppTabs({ tabs, active }: { tabs: TabDef[]; active: string }) {
  return (
    <div className="border-b border-border p-2 bg-card">
      <div className="overflow-x-auto scrollbar-thin">
        <div className="inline-flex h-9 items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
          {tabs.map((t) => {
            const on = t.id === active;
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium transition ${
                  on ? "bg-background text-foreground shadow-sm" : ""
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
                {t.badge ? (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground">
                    {t.badge}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AppShell({
  url, tabs, active, children,
}: { url: string; tabs: TabDef[]; active: string; children: React.ReactNode }) {
  return (
    <BrowserFrame url={url}>
      <div className="flex flex-col bg-background text-foreground text-[13px]">
        <AppTabs tabs={tabs} active={active} />
        <div className="p-4">{children}</div>
      </div>
    </BrowserFrame>
  );
}

/* ---------------- Reusable overview building blocks ---------------- */

function Kpi({
  icon: Icon, label, value, delta, tone = "primary",
}: { icon: any; label: string; value: string; delta?: string; tone?: "primary" | "emerald" | "amber" | "sky" | "violet" }) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${tones[tone]} grid place-items-center`}>
          <Icon className="h-4 w-4" />
        </div>
        {delta && (
          <span className="text-[10px] font-semibold text-emerald-600 inline-flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" /> {delta}
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function AreaChartMock({ tone = "primary" }: { tone?: "primary" | "emerald" | "sky" | "violet" }) {
  const stops: Record<string, [string, string]> = {
    primary: ["hsl(var(--primary))", "hsl(var(--primary)/0.05)"],
    emerald: ["#10b981", "rgba(16,185,129,0.05)"],
    sky: ["#0ea5e9", "rgba(14,165,233,0.05)"],
    violet: ["#8b5cf6", "rgba(139,92,246,0.05)"],
  };
  const [c1, c2] = stops[tone];
  const id = `g-${tone}`;
  return (
    <svg viewBox="0 0 320 110" className="w-full h-28">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="0.5">
        <line x1="0" y1="30" x2="320" y2="30" /><line x1="0" y1="60" x2="320" y2="60" /><line x1="0" y1="90" x2="320" y2="90" />
      </g>
      <path
        d="M0,80 L30,70 L60,72 L90,55 L120,60 L150,40 L180,45 L210,30 L240,38 L270,22 L300,28 L320,18 L320,110 L0,110 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M0,80 L30,70 L60,72 L90,55 L120,60 L150,40 L180,45 L210,30 L240,38 L270,22 L300,28 L320,18"
        fill="none" stroke={c1} strokeWidth="1.75"
      />
    </svg>
  );
}

function BarsMock() {
  const bars = [45, 62, 38, 74, 55, 80, 48, 70, 58, 82, 66, 74];
  return (
    <svg viewBox="0 0 320 110" className="w-full h-28">
      <g stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="0.5">
        <line x1="0" y1="30" x2="320" y2="30" /><line x1="0" y1="60" x2="320" y2="60" /><line x1="0" y1="90" x2="320" y2="90" />
      </g>
      {bars.map((h, i) => (
        <rect key={i} x={10 + i * 25} y={100 - h} width="14" height={h} rx="2" fill="hsl(var(--primary))" opacity={i % 2 ? 0.9 : 0.65} />
      ))}
    </svg>
  );
}

function DonutMock() {
  const segs = [
    { c: "#10b981", n: 58, label: "Completed" },
    { c: "#0ea5e9", n: 22, label: "Processing" },
    { c: "#f59e0b", n: 14, label: "Pending" },
    { c: "#ef4444", n: 6, label: "Cancelled" },
  ];
  const R = 34, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-28 w-28">
        <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        {segs.map((s, i) => {
          const len = (s.n / 100) * C;
          const el = (
            <circle
              key={i} cx="50" cy="50" r={R} fill="none" stroke={s.c} strokeWidth="12"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="48" textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="700">248</text>
        <text x="50" y="60" textAnchor="middle" className="fill-muted-foreground" fontSize="6">orders</text>
      </svg>
      <div className="flex-1 grid gap-1.5">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.c }} /> {s.label}
            </span>
            <span className="font-medium tabular-nums">{s.n}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-xs font-semibold">{title}</div>
        {action && <div className="text-[10px] text-foreground/80">{action}</div>}
      </div>

      <div className="p-3">{children}</div>
    </div>
  );
}

function DateBar({ label = "Last 30 days" }: { label?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="font-display text-lg font-bold">Overview</div>
        <div className="text-[11px] text-muted-foreground">Snapshot of your WhatsApp activity</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px]">
          <CalendarIcon className="h-3 w-3" /> {label}
        </div>
        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- E-commerce (matches Orders + Overview chrome) ---------------- */

const ECOM_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ListOrdered },
  { id: "products", label: "Products", icon: Package },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle, badge: 2 },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function EcommerceDashboard() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={ECOM_TABS} active="overview">
      <DateBar />
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={Users} label="Contacts" value="1,284" delta="+12%" tone="primary" />
        <Kpi icon={MessageSquare} label="Messages" value="8,412" delta="+18%" tone="sky" />
        <Kpi icon={Package} label="Orders" value="248" delta="+9%" tone="emerald" />
        <Kpi icon={Sparkles} label="AI resolved" value="86%" delta="+4%" tone="violet" />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="col-span-2">
          <Panel title="Revenue" action="Last 30 days">
            <AreaChartMock tone="primary" />
          </Panel>
        </div>
        <Panel title="Order status">
          <DonutMock />
        </Panel>
      </div>
      <div className="mt-3">
        <Panel title="Recent orders" action="View all">
          <div className="divide-y divide-border">
            {[
              { id: "#2278", name: "Elissa K.", item: "Dreamy Star Projector", total: "$32.99", status: "Processing", tone: "sky" },
              { id: "#2277", name: "Karim H.", item: "Solar Book Light × 2", total: "$45.98", status: "Completed", tone: "emerald" },
              { id: "#2276", name: "Nour A.", item: "Minecraft Lantern", total: "$24.99", status: "Pending", tone: "amber" },
              { id: "#2275", name: "Rami D.", item: "Flat Book Light", total: "$18.99", status: "Completed", tone: "emerald" },
            ].map((o) => (
              <div key={o.id} className="flex items-center justify-between py-2 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{o.id}</span>
                  <span className="font-medium">{o.name}</span>
                  <span className="text-muted-foreground">· {o.item}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{o.total}</span>
                  <StatusPill status={o.status} tone={o.tone as any} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function StatusPill({ status, tone }: { status: string; tone: "emerald" | "sky" | "amber" | "rose" }) {
  const map = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[tone]}`}>{status}</span>;
}

/* ---------------- Restaurants ---------------- */

const REST_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ListOrdered },
  { id: "reservations", label: "Reservations", icon: CalendarDays },
  { id: "menu", label: "Menu", icon: BookOpen },
  { id: "tables", label: "Tables", icon: LayoutGrid },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle, badge: 1 },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function RestaurantDashboardPreview() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={REST_TABS} active="orders">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg font-bold">Orders</div>
          <div className="text-[11px] text-muted-foreground">Delivery, pickup and dine-in orders.</div>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> New Order
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { l: "Pending", v: 6, tone: "amber" },
          { l: "In kitchen", v: 4, tone: "sky" },
          { l: "Ready", v: 2, tone: "emerald" },
        ].map((k) => (
          <div key={k.l} className={`rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between`}>
            <span className="text-[11px] text-muted-foreground">{k.l}</span>
            <span className="font-display text-lg font-bold">{k.v}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        {[
          { id: "#R-142", name: "Table 6", item: "Manakish za'atar × 3, Ayran × 2", eta: "5 min", status: "In kitchen", tone: "sky" },
          { id: "#R-141", name: "Delivery · Sami", item: "Mixed grill, Fattoush, Baklava", eta: "12 min", status: "Pending", tone: "amber" },
          { id: "#R-140", name: "Pickup · Layla", item: "Shawarma wrap × 2, Fries", eta: "Ready", status: "Ready", tone: "emerald" },
          { id: "#R-139", name: "Table 2", item: "Hummus, Kibbeh, Tabbouleh", eta: "—", status: "Completed", tone: "emerald" },
        ].map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{o.id}</span>
                <span className="text-xs font-semibold">{o.name}</span>
              </div>
              <StatusPill status={o.status} tone={o.tone as any} />
            </div>
            <div className="text-[12px] text-muted-foreground">{o.item}</div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ETA {o.eta}</span>
              <span className="text-primary font-semibold">Print ticket →</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/* ---------------- Real Estate ---------------- */

const RE_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "listings", label: "Listings", icon: HomeIcon },
  { id: "viewings", label: "Viewings", icon: CalendarDays },
  { id: "leads", label: "Leads", icon: Users },
  { id: "agents", label: "Agents", icon: UserRound },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function RealEstateDashboardPreview() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={RE_TABS} active="leads">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg font-bold">Leads</div>
          <div className="text-[11px] text-muted-foreground">Qualified by AI · sorted by score</div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px]">
          <Search className="h-3 w-3" /> Search leads
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Kpi icon={Users} label="New" value="42" tone="primary" />
        <Kpi icon={CheckCircle2} label="Qualified" value="18" tone="emerald" />
        <Kpi icon={CalendarDays} label="Viewings" value="9" tone="sky" />
        <Kpi icon={TrendingUp} label="Won" value="3" tone="violet" />
      </div>
      <Panel title="Hot leads">
        <div className="divide-y divide-border">
          {[
            { name: "Rana Farah", area: "Ashrafieh · 2BR", budget: "$450k", score: 92 },
            { name: "Omar Nasr", area: "Downtown · 3BR", budget: "$780k", score: 88 },
            { name: "Yara S.", area: "Hamra · 1BR", budget: "$210k", score: 74 },
            { name: "Elie Boutros", area: "Verdun · 3BR", budget: "$620k", score: 71 },
          ].map((l) => (
            <div key={l.name} className="flex items-center justify-between py-2 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-semibold">
                  {l.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{l.area} · {l.budget}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${l.score}%` }} />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-emerald-600">{l.score}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}

/* ---------------- Healthcare ---------------- */

const HC_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "team", label: "Team", icon: Stethoscope },
  { id: "appointments", label: "Calendar", icon: CalendarDays },
  { id: "leads", label: "Leads", icon: Activity },
  { id: "labs", label: "Labs", icon: FlaskConical },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle, badge: 3 },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function HealthcareDashboardPreview() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
  const booked: Record<string, string[]> = {
    Mon: ["09:00", "11:00", "14:00"],
    Tue: ["10:00", "15:00"],
    Wed: ["09:00", "10:00", "12:00", "16:00"],
    Thu: ["11:00", "14:00"],
    Fri: ["09:00", "10:00", "15:00", "16:00"],
    Sat: ["11:00"],
  };
  return (
    <AppShell url="app.jawabify.com/app" tabs={HC_TABS} active="appointments">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg font-bold">Appointments</div>
          <div className="text-[11px] text-foreground/80">This week · Dr. Rania · Dr. Karim</div>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Book
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(6,1fr)] text-[10px] font-medium text-foreground/80 bg-muted/50">
          <div className="p-2"></div>
          {days.map((d) => <div key={d} className="p-2 text-center border-l border-border">{d}</div>)}
        </div>
        {slots.map((s) => (
          <div key={s} className="grid grid-cols-[60px_repeat(6,1fr)] border-t border-border">
            <div className="p-2 text-[10px] text-foreground/80">{s}</div>

            {days.map((d) => {
              const on = booked[d]?.includes(s);
              return (
                <div key={d} className="p-1 border-l border-border h-9">
                  {on && (
                    <div className="h-full rounded-md bg-primary/15 border border-primary/30 text-[9px] font-medium text-primary px-1.5 py-0.5 truncate">
                      Consult
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Kpi icon={CalendarDays} label="Booked this wk" value="42" tone="primary" />
        <Kpi icon={CheckCircle2} label="Confirmed" value="38" tone="emerald" />
        <Kpi icon={AlertCircle} label="No-shows" value="1" tone="amber" />
      </div>
    </AppShell>
  );
}

/* ---------------- Wellness ---------------- */

const WE_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "catalog", label: "Catalog", icon: Sparkles },
  { id: "sessions", label: "Calendar", icon: CalendarDays },
  { id: "leads", label: "Leads", icon: Activity },
  { id: "staff", label: "Staff", icon: UserRound },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function WellnessDashboardPreview() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={WE_TABS} active="overview">
      <DateBar />
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={Users} label="Members" value="342" delta="+8%" tone="primary" />
        <Kpi icon={CalendarDays} label="Sessions" value="128" delta="+14%" tone="sky" />
        <Kpi icon={Sparkles} label="Upsells" value="+22%" tone="violet" />
        <Kpi icon={CheckCircle2} label="Retention" value="94%" tone="emerald" />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="col-span-2">
          <Panel title="Bookings" action="Last 30 days"><AreaChartMock tone="violet" /></Panel>
        </div>
        <Panel title="Top packages">
          <div className="space-y-2">
            {[
              { n: "10-Session Yoga", p: 68 },
              { n: "Deep-tissue Massage", p: 52 },
              { n: "Reformer Pilates", p: 41 },
              { n: "Meditation Bundle", p: 28 },
            ].map((r) => (
              <div key={r.n}>
                <div className="flex justify-between text-[11px]">
                  <span>{r.n}</span><span className="tabular-nums text-muted-foreground">{r.p}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${r.p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-3">
        <Panel title="Today's classes">
          <div className="divide-y divide-border">
            {[
              { t: "07:00", n: "Sunrise Yoga", instr: "Lea", full: "12/15" },
              { t: "10:30", n: "Reformer Pilates", instr: "Nadine", full: "8/8", waitlist: 3 },
              { t: "18:00", n: "Restorative Flow", instr: "Sami", full: "10/15" },
              { t: "19:30", n: "Sound Bath", instr: "Tala", full: "20/20", waitlist: 5 },
            ].map((c) => (
              <div key={c.t} className="flex items-center justify-between py-2 text-[12px]">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">{c.t}</span>
                  <span className="font-medium">{c.n}</span>
                  <span className="text-muted-foreground">· {c.instr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-[11px]">{c.full}</span>
                  {c.waitlist && <span className="rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-[10px] font-medium">+{c.waitlist} waitlist</span>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

/* ---------------- Education ---------------- */

const EDU_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "leads", label: "Leads", icon: Users },
  { id: "enrollments", label: "Enrollments", icon: GraduationCap },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function EducationDashboardPreview() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={EDU_TABS} active="enrollments">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg font-bold">Enrollments</div>
          <div className="text-[11px] text-muted-foreground">Fall intake · registrations in progress</div>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Add student
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Kpi icon={Users} label="Applications" value="184" delta="+22%" tone="primary" />
        <Kpi icon={CheckCircle2} label="Enrolled" value="96" tone="emerald" />
        <Kpi icon={Clock} label="Awaiting docs" value="24" tone="amber" />
        <Kpi icon={MessageSquare} label="Parent chats" value="312" tone="sky" />
      </div>
      <Panel title="Recent applications">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] bg-muted/50 text-[10px] font-medium text-foreground/80 px-3 py-1.5">
            <div>Student</div><div>Course</div><div>Language</div><div>Status</div>
          </div>
          {[
            { s: "Layla Haddad", c: "IGCSE Math · Grade 9", l: "AR/EN", st: "Enrolled", tone: "emerald" },
            { s: "Karim Nassar", c: "SAT Prep", l: "EN", st: "Docs pending", tone: "amber" },
            { s: "Yasmine Ahmad", c: "French A2", l: "FR/AR", st: "Interview", tone: "sky" },
            { s: "Rami Chahine", c: "Coding for Kids", l: "EN", st: "Enrolled", tone: "emerald" },
            { s: "Nour Saliba", c: "IB English HL", l: "EN", st: "Docs pending", tone: "amber" },
          ].map((r) => (
            <div key={r.s} className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] items-center px-3 py-2 border-t border-border text-[12px]">
              <div className="font-medium">{r.s}</div>
              <div className="text-foreground/80">{r.c}</div>
              <div className="text-foreground/80">{r.l}</div>
              <div><StatusPill status={r.st} tone={r.tone as any} /></div>
            </div>
          ))}
        </div>
      </Panel>

    </AppShell>
  );
}

/* ---------------- Services (default) ---------------- */

const SVC_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "inbox", label: "Inbox", icon: MessageSquare },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "clients", label: "Clients", icon: Users },
  { id: "quotes", label: "Quotes", icon: Briefcase },
  { id: "crm", label: "CRM", icon: Users },
  { id: "flagged", label: "Flagged", icon: AlertCircle },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
];

export function ServicesDashboardPreview() {
  return (
    <AppShell url="app.jawabify.com/app" tabs={SVC_TABS} active="overview">
      <DateBar />
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={MessageSquare} label="Conversations" value="1,204" delta="+16%" tone="primary" />
        <Kpi icon={CalendarDays} label="Bookings" value="82" delta="+11%" tone="sky" />
        <Kpi icon={Briefcase} label="Quotes sent" value="46" tone="violet" />
        <Kpi icon={CheckCircle2} label="Closed" value="19" delta="+7%" tone="emerald" />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="col-span-2">
          <Panel title="Activity" action="Last 30 days"><BarsMock /></Panel>
        </div>
        <Panel title="Channels">
          <DonutMock />
        </Panel>
      </div>
      <div className="mt-3">
        <Panel title="Open threads">
          <div className="divide-y divide-border">
            {[
              { n: "Hala K.", m: "Can you send a quote for the villa cleaning?", t: "2m", tag: "Quote" },
              { n: "Michel A.", m: "Booking confirmed for Thursday 3pm.", t: "18m", tag: "Booking" },
              { n: "Sara T.", m: "Do you offer weekly maintenance?", t: "1h", tag: "Lead" },
              { n: "Fadi J.", m: "Invoice paid — thanks!", t: "3h", tag: "Payment" },
            ].map((r) => (
              <div key={r.n} className="flex items-center justify-between py-2 text-[12px]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-semibold">
                    {r.n.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{r.n}</div>
                    <div className="text-[11px] text-foreground/80 truncate">{r.m}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted text-foreground/80 px-2 py-0.5 text-[10px] font-medium">{r.tag}</span>
                  <span className="text-[11px] text-foreground/80">{r.t}</span>
                </div>
              </div>

            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

/* ---------------- Router ---------------- */

export function RealisticDashboard({ index }: { index: number }) {
  switch (index) {
    case 0: return <EcommerceDashboard />;
    case 1: return <RestaurantDashboardPreview />;
    case 2: return <RealEstateDashboardPreview />;
    case 3: return <HealthcareDashboardPreview />;
    case 4: return <WellnessDashboardPreview />;
    case 5: return <EducationDashboardPreview />;
    default: return <ServicesDashboardPreview />;
  }
}
