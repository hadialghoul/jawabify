import { MessageCircle, Users, ShoppingBag, Bot, Truck, Heart, BarChart3, Sparkles } from "lucide-react";

export function SignInShowcase() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[hsl(240_50%_6%)] via-[hsl(240_45%_10%)] to-[hsl(245_60%_4%)]">
      {/* Mesh glow */}
      <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-[120px]" />
      <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-indigo-300/15 blur-[100px]" />

      {/* grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(hsl(238 80% 75%) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center p-10">
        {/* logo */}
        <div className="mb-6 flex items-center gap-2">
          <div className="text-3xl font-bold tracking-tight text-white">Jawabify</div>
          <Sparkles className="h-5 w-5 text-indigo-300" />
        </div>

        {/* main card */}
        <div className="relative w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto -mt-10 mb-4 w-fit rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            Welcome Back to Work
          </div>

          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
            </div>
          </div>

          {/* feature tiles */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { icon: MessageCircle, label: "WhatsApp", bg: "bg-indigo-50", fg: "text-indigo-600" },
              { icon: Users, label: "Team", bg: "bg-sky-50", fg: "text-sky-600" },
              { icon: ShoppingBag, label: "Orders", bg: "bg-amber-50", fg: "text-amber-600" },
            ].map((t) => (
              <div key={t.label} className={`flex flex-col items-center gap-1.5 rounded-xl ${t.bg} py-3`}>
                <t.icon className={`h-5 w-5 ${t.fg}`} />
                <span className="text-[11px] font-medium text-foreground/80">{t.label}</span>
              </div>
            ))}
          </div>

          {/* dotted icon row */}
          <div className="mb-5 flex items-center justify-between px-2">
            {[
              { icon: Users, c: "bg-indigo-100 text-indigo-600" },
              { icon: MessageCircle, c: "bg-indigo-100 text-indigo-600" },
              { icon: Bot, c: "bg-slate-100 text-slate-600" },
              { icon: Truck, c: "bg-orange-100 text-orange-600" },
              { icon: Heart, c: "bg-pink-100 text-pink-500" },
            ].map((t, i) => (
              <div key={i} className="flex flex-1 items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.c}`}>
                  <t.icon className="h-4 w-4" />
                </div>
                {i < 4 && <div className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />}
              </div>
            ))}
          </div>

          {/* chart */}
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
              Business Growth
            </div>
            <div className="flex h-16 items-end gap-1">
              {[40, 55, 35, 70, 50, 80, 65, 90, 75, 60, 85, 95, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-indigo-500/80"
                  style={{
                    height: `${h}%`,
                    animation: `grow 1.4s ease-out ${i * 0.06}s both`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* floating chat bubble */}
          <div className="absolute -right-4 top-20 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500">
              <MessageCircle className="h-3 w-3 text-white" />
            </div>
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
            </div>
          </div>
        </div>

        <p className="mt-8 max-w-xs text-center text-sm text-white/60">
          Your AI-powered WhatsApp assistant, always on.
        </p>
      </div>

      <style>{`
        @keyframes grow { from { height: 0; opacity: 0; } }
      `}</style>
    </div>
  );
}
