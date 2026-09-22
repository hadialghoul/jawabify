import { ReactNode } from "react";
import {
  Bot, Check, CheckCheck, Send, Paperclip, Smile, Search, Filter, Plus, MoreHorizontal,
  Calendar, Clock, MapPin, Phone, Star, TrendingUp, TrendingDown, ShoppingCart, Package,
  Truck, CheckCircle2, XCircle, MessageSquare, Users, DollarSign, ArrowUpRight, ArrowDownRight,
  Bell, Mic, Image as ImageIcon, User, Mail, Tag, Sparkles, Zap, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------- Browser frame wrapper -------------------------- */
export function BrowserFrame({
  children, className, url = "app.jawabify.com", tone = "light",
}: { children: ReactNode; className?: string; url?: string; tone?: "light" | "dark" }) {
  return (
    <div className={cn(
      "rounded-2xl border shadow-[0_30px_80px_-30px_hsl(243_75%_20%/0.4)] overflow-hidden",
      tone === "light" ? "bg-white border-border" : "bg-[hsl(240_45%_6%)] border-white/10",
      className,
    )}>
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b",
        tone === "light" ? "border-border bg-secondary/40" : "border-white/10 bg-white/5",
      )}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className={cn(
          "flex-1 mx-4 h-6 rounded-md flex items-center justify-center text-[11px]",
          tone === "light" ? "bg-white border border-border text-muted-foreground" : "bg-white/5 border border-white/10 text-white/70",
        )}>
          {url}
        </div>
      </div>
      <div className="relative overflow-x-auto">{children}</div>
    </div>
  );
}

/* -------------------------- WhatsApp Chat Mockup -------------------------- */
export function WhatsAppChat({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl overflow-hidden border border-border bg-white shadow-xl",
      className,
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white">
        <div className="h-9 w-9 rounded-full bg-white/20 grid place-items-center font-semibold">S</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">Sara Khoury</div>
          <div className="text-[11px] text-white/85 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> online · typing…
          </div>
        </div>
        <Phone className="h-4 w-4 text-white/80" />
      </div>
      {/* Messages */}
      <div className="chat-background px-4 py-4 space-y-2.5" style={{ minHeight: compact ? 260 : 340 }}>
        <Bubble side="in">Hi! Is the leather crossbody bag still available in tan? 🛍️</Bubble>
        <Bubble side="in" time="2:14 PM">And do you deliver to Beirut today?</Bubble>
        <Bubble side="out" time="2:14 PM">
          Yes — tan is in stock. Orders before 4pm ship same-day to Beirut. $3 flat delivery.
        </Bubble>
        {!compact && (
          <>
            <Bubble side="in">شو الحجم المتوفر؟</Bubble>
            <Bubble side="out">
              متوفر Small و Medium. صور المقاسات ⬇️
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="aspect-square rounded-lg bg-gradient-to-br from-amber-100 to-amber-300" />
                <div className="aspect-square rounded-lg bg-gradient-to-br from-orange-100 to-amber-400" />
              </div>
            </Bubble>
            <Bubble side="in">Medium please — Sara Khoury, 03-123456, Achrafieh</Bubble>
            <Bubble side="out">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Order #1042 confirmed
              </div>
              <div className="text-[11px] text-foreground/80">Tan Crossbody · M · $89 + $3 delivery = <b>$92</b></div>
            </Bubble>
          </>
        )}
        <div className="flex items-center gap-1 text-[10px] text-foreground/70 pl-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI replying · 0.8s
        </div>
      </div>
      {/* Composer */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-white">
        <Smile className="h-4 w-4 text-muted-foreground" />
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 h-8 rounded-full bg-secondary text-[11px] text-muted-foreground px-3 flex items-center">Message</div>
        <Mic className="h-4 w-4 text-muted-foreground" />
        <div className="h-8 w-8 rounded-full bg-[#075E54] grid place-items-center"><Send className="h-3.5 w-3.5 text-white" /></div>
      </div>
    </div>
  );
}

function Bubble({ side, children, time = "2:15 PM" }: { side: "in" | "out"; children: ReactNode; time?: string }) {
  const out = side === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-sm",
        out ? "bg-[#DCF8C6] text-slate-900 rounded-tr-sm" : "bg-white text-slate-900 rounded-tl-sm",
      )}>
        {children}
        <div className={cn("flex items-center gap-1 mt-0.5 text-[9.5px] text-slate-700", out && "justify-end")}>
          {time}
          {out && <CheckCheck className="h-3 w-3 text-sky-500" />}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Inbox Mockup -------------------------- */
const inboxContacts = [
  { name: "Sara Khoury", last: "Medium please — Sara Khoury, 03-1…", time: "2:15", unread: 0, active: true, tag: "Order" },
  { name: "Ahmed Hassan", last: "Do you have this in blue?", time: "2:11", unread: 2, tag: "Sales" },
  { name: "Layla Nasser", last: "شكرا! رح استنى الوصول", time: "1:58", unread: 0, tag: "Delivered" },
  { name: "Marc Boutros", last: "Table for 4 tomorrow at 8pm?", time: "1:42", unread: 1, tag: "Booking" },
  { name: "Nour El-Din", last: "Voice message · 0:24", time: "12:30", unread: 0, tag: "Voice" },
  { name: "Rania Malouf", last: "Refund processed ✅", time: "11:12", unread: 0, tag: "Support" },
];

export function InboxMockup({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-[280px_1fr] bg-white", className)}>
      <aside className="border-r border-border">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Search conversations</span>
          </div>
          <div className="mt-2 flex gap-1.5 text-[10px]">
            {["All", "Unread", "AI", "Human"].map((t, i) => (
              <span key={t} className={cn(
                "px-2 py-0.5 rounded-full",
                i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}>{t}</span>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {inboxContacts.map((c) => (
            <div key={c.name} className={cn(
              "flex gap-2.5 px-3 py-2.5 cursor-pointer",
              c.active ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-secondary/40",
            )}>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/80 to-indigo-500 grid place-items-center text-white text-[11px] font-semibold shrink-0">
                {c.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-foreground truncate">{c.name}</div>
                  <div className="text-[10px] text-foreground/80">{c.time}</div>
                </div>
                <div className="text-[11px] text-foreground/80 truncate">{c.last}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-foreground/80">{c.tag}</span>
                  {c.unread > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{c.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-indigo-500 grid place-items-center text-white text-xs font-semibold">SK</div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Sara Khoury</div>
            <div className="text-[11px] text-foreground/80 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online · +961 3 123 456
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Bot className="h-3 w-3" /> AI on
          </div>
        </div>
        <div className="flex-1 chat-background p-4 space-y-2">
          <Bubble side="in">Hi! Is the tan crossbody bag still available?</Bubble>
          <Bubble side="out">Yes — tan in stock. Ship same-day to Beirut. $3 delivery.</Bubble>
          <Bubble side="in">Medium please. Sara Khoury, 03-123456</Bubble>
          <Bubble side="out">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-0.5"><CheckCircle2 className="h-3.5 w-3.5" /> Order #1042 confirmed</div>
            <div className="text-[11px] text-slate-600">Tan Crossbody · M · $92</div>
          </Bubble>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Analytics dashboard -------------------------- */
export function AnalyticsMockup({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-foreground/80">Overview</div>
          <div className="font-display text-lg font-bold">Today's performance</div>
        </div>
        <div className="flex gap-1.5 text-[10px]">
          {["24h", "7d", "30d", "90d"].map((r, i) => (
            <span key={r} className={cn(
              "px-2 py-1 rounded-full",
              i === 1 ? "bg-foreground text-background" : "bg-secondary text-foreground/80",
            )}>{r}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatTile icon={MessageSquare} label="Messages" value="12,847" delta="+18%" up />
        <StatTile icon={Bot} label="AI resolved" value="94.2%" delta="+2.1%" up />
        <StatTile icon={ShoppingCart} label="Orders" value="284" delta="+31%" up />
        <StatTile icon={DollarSign} label="Revenue" value="$18,420" delta="-4%" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-foreground">Message volume · by hour</div>
            <div className="text-[10px] text-foreground/80">Peak 7–9 PM</div>
          </div>

          <AreaChart />
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs font-semibold text-foreground mb-2">Orders</div>
          <DonutChart />
          <div className="mt-2 space-y-1 text-[11px]">
            <Legend color="hsl(158 64% 52%)" label="Completed" value="212" />
            <Legend color="hsl(243 75% 59%)" label="Processing" value="48" />
            <Legend color="hsl(0 84% 60%)" label="Cancelled" value="24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">Reply rate</div>
            <div className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> 99.4%</div>
          </div>
          <BarChart />
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs font-semibold mb-2">Top products</div>
          <div className="space-y-2">
            {[
              { name: "Tan Crossbody Bag", pct: 82, sales: 118 },
              { name: "Wireless Earbuds Pro", pct: 64, sales: 92 },
              { name: "Solar Camping Lantern", pct: 51, sales: 74 },
              { name: "Minimalist Wallet", pct: 38, sales: 55 },
            ].map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.sales}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-primary to-indigo-500" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, delta, up = false }: any) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center"><Icon className="h-3.5 w-3.5 text-primary" /></div>
        <div className={cn("text-[10px] flex items-center gap-0.5", up ? "text-emerald-600" : "text-red-500")}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {delta}
        </div>
      </div>
      <div className="mt-2 font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] text-foreground/80">{label}</div>
    </div>
  );
}


function AreaChart() {
  const pts = [10, 18, 14, 22, 30, 28, 40, 55, 48, 62, 78, 92, 88, 70, 58, 44, 30, 22];
  const max = Math.max(...pts);
  const w = 100, h = 60;
  const step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <defs>
        <linearGradient id="a1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(243 75% 59%)" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(243 75% 59%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#a1)" />
      <path d={d} fill="none" stroke="hsl(243 75% 59%)" strokeWidth="1.5" />
    </svg>
  );
}

function DonutChart() {
  const total = 284;
  const done = 212, proc = 48, canc = 24;
  const r = 28, c = 2 * Math.PI * r;
  const s1 = (done / total) * c;
  const s2 = (proc / total) * c;
  const s3 = (canc / total) * c;
  return (
    <svg viewBox="0 0 80 80" className="w-full h-28">
      <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(240 20% 94%)" strokeWidth="10" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(158 64% 52%)" strokeWidth="10" strokeDasharray={`${s1} ${c}`} transform="rotate(-90 40 40)" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(243 75% 59%)" strokeWidth="10" strokeDasharray={`${s2} ${c}`} strokeDashoffset={-s1} transform="rotate(-90 40 40)" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(0 84% 60%)" strokeWidth="10" strokeDasharray={`${s3} ${c}`} strokeDashoffset={-(s1 + s2)} transform="rotate(-90 40 40)" />
      <text x="40" y="40" textAnchor="middle" dy="4" className="fill-foreground" style={{ font: "bold 10px Urbanist" }}>284</text>
    </svg>
  );
}

function Legend({ color, label, value }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function BarChart() {
  const vals = [42, 55, 48, 70, 65, 82, 92];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {vals.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t bg-gradient-to-t from-primary to-indigo-400" style={{ height: `${v}%` }} />
          <div className="text-[9px] text-foreground/80">{days[i]}</div>
        </div>
      ))}

    </div>
  );
}

/* -------------------------- CRM Contact Card -------------------------- */
export function CrmCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white p-5", className)}>
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 grid place-items-center text-white font-bold text-lg">AH</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold">Ahmed Hassan</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Returning</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground">VIP</span>
          </div>
          <div className="text-xs text-foreground/80 mt-0.5">+961 3 987 654 · Beirut · Customer since Jan 2024</div>
        </div>
        <button className="text-[11px] px-3 py-1.5 rounded-full bg-foreground text-background font-semibold">Message</button>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        <MiniStat label="Orders" value="6" />
        <MiniStat label="Lifetime value" value="$487" />
        <MiniStat label="Avg order" value="$81" />
        <MiniStat label="Response" value="4 min" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-foreground/80 mb-2">Recent activity</div>
          <div className="space-y-2">
            <Timeline icon={ShoppingCart} title="Purchased Wireless Earbuds Pro" time="2 days ago" tone="emerald" />
            <Timeline icon={Mail} title="Opened campaign: Winter Sale" time="4 days ago" tone="indigo" />
            <Timeline icon={MessageSquare} title="Asked about warranty" time="1 week ago" />
            <Timeline icon={ShoppingCart} title="Purchased Tan Crossbody Bag" time="3 weeks ago" tone="emerald" />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-foreground/80 mb-2">AI notes</div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] text-foreground leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1 text-foreground font-semibold text-[10px]"><Sparkles className="h-3 w-3" /> Auto-generated</div>

            Prefers premium electronics. Sensitive to shipping delays — always confirms tracking. Interested in earbuds &amp; smart home. Best contact window: <b>7–9 PM</b>.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["electronics", "premium", "beirut", "email-opener", "loyal"].map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1"><Tag className="h-2.5 w-2.5" /> {t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] text-foreground/70 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Timeline({ icon: Icon, title, time, tone = "slate" }: any) {
  const map: any = {
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-primary/10 text-primary",
    slate: "bg-secondary text-muted-foreground",
  };
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", map[tone])}><Icon className="h-3.5 w-3.5" /></div>
      <div className="flex-1">
        <div className="text-[12px] font-medium">{title}</div>
        <div className="text-[10px] text-foreground/70">{time}</div>
      </div>
    </div>
  );
}

/* -------------------------- Orders Board -------------------------- */
const orderCols = [
  { title: "New", tone: "bg-slate-100 text-slate-700", items: [
    { id: "#1052", customer: "Layla N.", items: "2× Earbuds Pro", total: "$178", time: "3m" },
    { id: "#1051", customer: "Marc B.", items: "1× Solar Lantern", total: "$34", time: "8m" },
  ]},
  { title: "Preparing", tone: "bg-amber-50 text-amber-700", items: [
    { id: "#1050", customer: "Nour E.", items: "1× Crossbody Bag", total: "$92", time: "14m" },
    { id: "#1049", customer: "Rania M.", items: "3× Notebooks", total: "$45", time: "22m" },
    { id: "#1048", customer: "Sara K.", items: "1× Wallet + 1× Belt", total: "$110", time: "31m" },
  ]},
  { title: "Out for delivery", tone: "bg-primary/10 text-primary", items: [
    { id: "#1047", customer: "Karim A.", items: "1× Backpack", total: "$140", time: "1h" },
    { id: "#1046", customer: "Yara T.", items: "2× Perfume 50ml", total: "$180", time: "1h" },
  ]},
  { title: "Delivered", tone: "bg-emerald-50 text-emerald-700", items: [
    { id: "#1045", customer: "Omar F.", items: "1× Watch strap", total: "$28", time: "2h" },
  ]},
];

export function OrdersBoard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-lg font-bold">Orders</div>
          <div className="text-xs text-muted-foreground">284 today · $18,420 revenue</div>
        </div>
        <div className="flex gap-2">
          <button className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border flex items-center gap-1"><Filter className="h-3 w-3" /> Filter</button>
          <button className="text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground text-background flex items-center gap-1"><Plus className="h-3 w-3" /> New order</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {orderCols.map((col) => (
          <div key={col.title} className="rounded-xl bg-secondary/40 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", col.tone)}>{col.title}</span>
              <span className="text-[10px] text-foreground/80">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((o) => (
                <div key={o.id} className="rounded-lg bg-white border border-border p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-foreground/80">
                    <span>{o.id}</span><span>{o.time}</span>
                  </div>
                  <div className="text-[12px] font-semibold mt-0.5">{o.customer}</div>
                  <div className="text-[10.5px] text-foreground/80">{o.items}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary">{o.total}</span>

                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-indigo-500 grid place-items-center text-white text-[8px] font-bold">
                      {o.customer.split(" ")[0][0]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Calendar (Appointments) -------------------------- */
export function CalendarMockup({ className }: { className?: string }) {
  const hours = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"];
  const days = ["Mon 15", "Tue 16", "Wed 17", "Thu 18", "Fri 19"];
  const appts = [
    { day: 0, hour: 1, dur: 1, title: "Rania — Consultation", tone: "bg-primary/15 text-primary border-primary/30" },
    { day: 1, hour: 0, dur: 2, title: "Ahmed — Follow-up", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { day: 2, hour: 3, dur: 1, title: "Layla — First visit", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    { day: 3, hour: 2, dur: 2, title: "Marc — Deep tissue", tone: "bg-primary/15 text-primary border-primary/30" },
    { day: 4, hour: 4, dur: 1, title: "Sara — Reschedule", tone: "bg-rose-50 text-rose-700 border-rose-200" },
    { day: 1, hour: 5, dur: 1, title: "Nour — Consultation", tone: "bg-primary/15 text-primary border-primary/30" },
  ];
  return (
    <div className={cn("bg-white p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-lg font-bold">This week</div>
          <div className="text-xs text-muted-foreground">14 appointments · 92% confirmed via WhatsApp</div>
        </div>
        <div className="flex gap-1.5">
          <button className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border">Today</button>
          <button className="text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground text-background">Week</button>
        </div>
      </div>
      <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-1">
        <div />
        {days.map(d => <div key={d} className="text-[10px] text-center text-foreground/80 font-semibold py-1">{d}</div>)}
        {hours.map((h, hi) => (
          <div key={h} className="contents">
            <div className="text-[10px] text-foreground/80 text-right pr-2 pt-1">{h}</div>

            {days.map((_, di) => (
              <div key={`${h}-${di}`} className="relative h-10 border-t border-border">
                {appts.filter(a => a.day === di && a.hour === hi).map((a, i) => (
                  <div key={i} className={cn("absolute inset-x-0.5 rounded-md border px-1.5 py-1 text-[9.5px] font-medium", a.tone)}
                    style={{ height: `${a.dur * 40 - 4}px`, top: "2px" }}>
                    <div className="truncate">{a.title}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Campaign Builder -------------------------- */
export function CampaignBuilder({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-foreground/80">Campaign builder</div>
          <div className="font-display text-lg font-bold">Winter Sale · Round 2</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ready to send</span>
      </div>
      <div className="grid grid-cols-[1fr_260px] gap-4">
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground/80 mb-2">Audience</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Purchased in last 90 days" />
              <Chip label="Beirut + Metn" />
              <Chip label="Exclude opted-out" tone="rose" />
              <Chip label="Speaks Arabic or English" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-foreground/80">Estimated reach</span>
              <span className="font-display font-bold text-lg">4,218 contacts</span>
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground/80 mb-2">Template</div>
            <div className="text-[12px] p-2.5 rounded-lg bg-secondary/60 leading-relaxed">
              Hi <span className="text-primary font-semibold">{"{{name}}"}</span> 👋 Our Winter Sale is live — up to <b>40% off</b>.
              Reply <b>SHOP</b> to browse or <b>STOP</b> to opt out. Delivery in 24h across Lebanon.
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground/80 mb-2">Schedule</div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-primary bg-primary/5 p-2">
                <div className="font-semibold">Now</div><div className="text-foreground/80">Start immediately</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="font-semibold">Peak time</div><div className="text-foreground/80">Tonight 7 PM</div>
              </div>

              <div className="rounded-lg border border-border p-2">
                <div className="font-semibold">Custom</div><div className="text-muted-foreground">Pick date</div>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[#075E54]/95 p-3 text-white">
          <div className="text-[10px] text-white/80 uppercase tracking-widest mb-2">Preview</div>
          <div className="rounded-2xl bg-[#DCF8C6] text-slate-900 px-3 py-2 text-[12px] leading-relaxed">
            Hi <b>Sara</b> 👋 Our Winter Sale is live — up to <b>40% off</b>.
            Reply <b>SHOP</b> to browse or <b>STOP</b> to opt out. Delivery in 24h.
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/85 space-y-1">
            <Row label="Sending rate" value="60/min" />
            <Row label="Est. duration" value="~70 min" />
            <Row label="Meta cost" value="$32.40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, tone = "primary" }: { label: string; tone?: "primary" | "rose" }) {
  return (
    <span className={cn(
      "text-[10.5px] px-2 py-1 rounded-full border",
      tone === "primary" ? "bg-primary/10 text-primary border-primary/20" : "bg-rose-50 text-rose-700 border-rose-200",
    )}>{label}</span>
  );
}

function Row({ label, value }: any) {
  return <div className="flex items-center justify-between"><span>{label}</span><span className="font-semibold text-white">{value}</span></div>;
}

/* -------------------------- Notification stack (floating) -------------------------- */
export function NotificationStack({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Notif icon={ShoppingCart} title="New order #1052" body="Layla — 2× Earbuds Pro · $178" tone="emerald" />
      <Notif icon={Bot} title="AI resolved 3 chats" body="No human handoff needed" tone="indigo" />
      <Notif icon={Calendar} title="Appointment booked" body="Marc — Fri 10 AM · Deep tissue" tone="amber" />
    </div>
  );
}

function Notif({ icon: Icon, title, body, tone }: any) {
  const map: any = {
    emerald: "bg-emerald-500",
    indigo: "bg-primary",
    amber: "bg-amber-500",
  };
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white border border-border p-3 shadow-lg backdrop-blur">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center text-white shrink-0", map[tone])}><Icon className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-foreground/80 truncate">{body}</div>
      </div>
      <div className="text-[10px] text-foreground/80">now</div>
    </div>
  );
}


/* -------------------------- Logo cloud -------------------------- */
import ackrabLogo from "@/assets/brands/ackrab.jpg.asset.json";
import mensparksLogo from "@/assets/brands/mensparks.jpg.asset.json";
import tropicalLogo from "@/assets/brands/tropical.jpg.asset.json";
import seaqersLogo from "@/assets/brands/seaqers.jpg.asset.json";
import ibtisamatiLogo from "@/assets/brands/ibtisamati.jpg.asset.json";
import herbalhavenLogo from "@/assets/brands/herbalhaven.jpg.asset.json";
import bubblybitesLogo from "@/assets/brands/bubblybites.jpg.asset.json";

export function LogoCloud() {
  const brands = [
    { name: "Ackrab", logo: ackrabLogo.url },
    { name: "MenSparks", logo: mensparksLogo.url },
    { name: "Tropical", logo: tropicalLogo.url },
    { name: "Sea Qers", logo: seaqersLogo.url },
    { name: "Ibtisamati", logo: ibtisamatiLogo.url },
    { name: "Herbal Haven", logo: herbalhavenLogo.url },
    { name: "Bubbly Bites", logo: bubblybitesLogo.url },
  ];
  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="flex w-max items-center gap-12 py-3 animate-[marquee_30s_linear_infinite] group-hover:[animation-play-state:paused]">
        {[...brands, ...brands].map((b, i) => (
          <div key={`${b.name}-${i}`} className="flex w-28 shrink-0 flex-col items-center gap-2.5">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border shadow-sm">
              <img src={b.logo} alt={`${b.name} brand logo`} loading="lazy" className="h-full w-full object-cover" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Feature callout -------------------------- */
export function FeatureRow({
  eyebrow, title, body, bullets, cta, visual, reverse = false,
}: {
  eyebrow: string; title: ReactNode; body: string;
  bullets: { label: string; value: string }[]; cta?: ReactNode;
  visual: ReactNode; reverse?: boolean;
}) {
  return (
    <div className={cn("grid gap-10 lg:grid-cols-2 items-center", reverse && "lg:[&>*:first-child]:order-2")}>
      <div className={cn("relative", !reverse && "lg:pr-6")}>
        {visual}
      </div>
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {eyebrow}
        </div>
        <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">{body}</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {bullets.map(b => (
            <div key={b.label} className="rounded-xl border border-border p-3">
              <div className="font-display text-xl font-bold text-foreground">{b.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-foreground/70 mt-0.5">{b.label}</div>
            </div>
          ))}
        </div>
        {cta && <div className="mt-6">{cta}</div>}
      </div>
    </div>
  );
}
