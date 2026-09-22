import {
  MessageCircle,
  Users,
  ShoppingBag,
  Bot,
  LayoutDashboard,
  Sparkles,
  Megaphone,
  Heart,
  Bell,
} from "lucide-react";

const floatA = { animation: "floatA 6s ease-in-out infinite" } as React.CSSProperties;
const floatB = { animation: "floatB 7s ease-in-out infinite" } as React.CSSProperties;
const floatC = { animation: "floatC 8s ease-in-out infinite" } as React.CSSProperties;
const floatD = { animation: "floatD 5.5s ease-in-out infinite" } as React.CSSProperties;

export function SignUpShowcase() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[hsl(240_50%_6%)] via-[hsl(240_45%_10%)] to-[hsl(245_60%_4%)]">
      {/* Mesh glow */}
      <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-[120px]" />
      <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-indigo-300/15 blur-[100px]" />

      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(hsl(238 80% 75%) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center p-6">
        {/* Brand */}
        <div className="mb-2 flex items-center gap-2">
          <div className="text-3xl font-bold tracking-tight text-white">Jawabify</div>
          <Sparkles className="h-5 w-5 text-indigo-300" />
        </div>

        {/* Stage */}
        <div className="relative flex w-full max-w-[560px] flex-1 items-center justify-center">
          {/* Main dashboard panel */}
          <div className="relative w-full max-w-[440px] rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_30px_80px_-20px_rgba(8,80,120,0.35)] backdrop-blur-xl">
            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-foreground">Dashboard Overview</div>
              <div className="ml-auto flex gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              </div>
            </div>

            {/* KPIs */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { label: "Chats", value: "1,234" },
                { label: "Orders", value: "428" },
                { label: "CRM", value: "892" },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-indigo-100 bg-white p-2 text-center shadow-sm"
                >
                  <div className="text-[10px] text-muted-foreground">{k.label}</div>
                  <div className="text-sm font-bold text-indigo-700">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="mb-4 rounded-xl border border-indigo-100 bg-white p-3">
              <div className="flex h-16 items-end justify-between gap-1.5">
                {[40, 55, 35, 70, 50, 80, 60, 90, 65, 85, 70, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-indigo-300"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Service grid (2 cols) */}
            <div className="grid grid-cols-2 gap-2.5">
              <ServiceTile
                icon={<MessageCircle className="h-4 w-4 text-indigo-600" />}
                label="WhatsApp"
                tint="bg-indigo-50"
              />
              <ServiceTile
                icon={<Users className="h-4 w-4 text-sky-600" />}
                label="CRM"
                tint="bg-sky-50"
              />
              <ServiceTile
                icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
                label="Orders"
                tint="bg-orange-50"
              />
              <ServiceTile
                icon={<Megaphone className="h-4 w-4 text-pink-600" />}
                label="Campaigns"
                tint="bg-pink-50"
              />
            </div>

            {/* AI Assistant row */}
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 p-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">AI Assistant</div>
                <div className="text-[10px] text-muted-foreground">Automate customer support</div>
              </div>
            </div>

            {/* ─── Floating overlays ─── */}

            {/* WhatsApp pill — top right */}
            <div
              className="absolute -top-5 right-6 z-30 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white px-3 py-2 shadow-xl"
              style={floatA}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500">
                <MessageCircle className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground">WhatsApp</span>
            </div>

            {/* Orders floating — mid right */}
            <div
              className="absolute -right-6 top-[44%] z-30 flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-2 shadow-xl"
              style={floatB}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                <ShoppingBag className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] text-muted-foreground">Orders</div>
                <div className="text-xs font-bold text-orange-600">+12%</div>
              </div>
            </div>

            {/* CRM floating — bottom left */}
            <div
              className="absolute -bottom-5 -left-4 z-30 flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 shadow-xl"
              style={floatC}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100">
                <Users className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <span className="text-xs font-semibold text-foreground">CRM</span>
            </div>

            {/* Notifications — bottom right */}
            <div
              className="absolute -bottom-4 right-8 z-30 flex items-center gap-2 rounded-2xl border border-amber-100 bg-white px-3 py-2 shadow-xl"
              style={floatD}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                <Bell className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-foreground">Notifications</span>
            </div>

            {/* Interested leads — mid left */}
            <div
              className="absolute -left-6 top-[30%] z-30 flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-3 py-2 shadow-xl"
              style={floatA}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
                <Heart className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] text-muted-foreground">Leads</div>
                <div className="text-xs font-bold text-rose-600">27</div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 max-w-xs text-center text-sm text-indigo-200/80">
          Chats, orders, CRM, campaigns — your entire WhatsApp business on one screen.
        </p>
      </div>

      <style>{`
        @keyframes floatA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes floatB { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes floatC { 0%,100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
        @keyframes floatD { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
      `}</style>
    </div>
  );
}

function ServiceTile({
  icon,
  label,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-border/40 ${tint} p-2.5`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
        {icon}
      </div>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}
