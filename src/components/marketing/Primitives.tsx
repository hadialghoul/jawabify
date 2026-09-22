import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("relative py-14 sm:py-28", className)}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-primary uppercase tracking-widest">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow, title, description, center = false, as: Tag = "h2",
}: { eyebrow?: string; title: ReactNode; description?: ReactNode; center?: boolean; as?: "h1" | "h2" }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      {eyebrow && <div className="mb-4"><Eyebrow>{eyebrow}</Eyebrow></div>}
      <Tag className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
        {title}
      </Tag>
      {description && (
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export function BentoCard({
  className, children, tone = "light",
}: { className?: string; children: ReactNode; tone?: "light" | "dark" | "primary" }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all duration-300",
      tone === "light" && "bg-white border-border card-elevated hover:-translate-y-0.5",
      tone === "dark" && "bg-[hsl(240_45%_6%)] border-white/10 text-white",
      tone === "primary" && "bg-gradient-to-br from-primary to-indigo-600 border-transparent text-white",
      className,
    )}>
      {children}
    </div>
  );
}
