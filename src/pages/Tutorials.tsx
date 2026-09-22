import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGoBack } from "@/hooks/useGoBack";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  PlayCircle,
  Rocket,
  Utensils,
  Home as HomeIcon,
  Stethoscope,
  GraduationCap,
  Heart,
  ShoppingBag,
  Package,
  Users,
  Megaphone,
  BookOpen,
  Plug,
  Clock,
} from "lucide-react";

type Tutorial = {
  title: string;
  description: string;
  duration: string;
};

type Section = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind bg classes for icon chip
  tutorials: Tutorial[];
};

const sections: Section[] = [
  {
    id: "setup",
    title: "Setup basics",
    subtitle: "Get your account ready in minutes.",
    icon: Rocket,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    tutorials: [
      { title: "Connecting WhatsApp Business", description: "Link your Meta WhatsApp number to Jawabify.", duration: "3 min" },
      { title: "Inviting your team", description: "Add agents and assign roles.", duration: "2 min" },
      { title: "Turning AI auto-replies on/off", description: "Control when the AI replies for you.", duration: "2 min" },
      { title: "Customising your business profile", description: "Brand name, hours and contact info.", duration: "3 min" },
    ],
  },
  {
    id: "verticals",
    title: "Per-industry guides",
    subtitle: "Tailored walkthroughs for your business type.",
    icon: BookOpen,
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    tutorials: [
      { title: "Restaurants", description: "Menu, reservations, tables and orders.", duration: "5 min" },
      { title: "Real estate", description: "Listings, viewings and lead follow-ups.", duration: "5 min" },
      { title: "Healthcare", description: "Patient intake, appointments and reminders.", duration: "5 min" },
      { title: "Education", description: "Courses, enrolments and parent updates.", duration: "5 min" },
      { title: "Wellness", description: "Classes, bookings and packages.", duration: "5 min" },
    ],
  },
  {
    id: "orders-crm",
    title: "Orders & CRM",
    subtitle: "Run day-to-day operations from one screen.",
    icon: Package,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    tutorials: [
      { title: "Managing orders", description: "Track, update and complete orders.", duration: "4 min" },
      { title: "Organising contacts", description: "Tag, search and segment your CRM.", duration: "3 min" },
      { title: "Sending campaigns", description: "Broadcast templates to your audience.", duration: "4 min" },
      { title: "Flagged conversations", description: "Handle chats the AI escalates to a human.", duration: "3 min" },
    ],
  },
  {
    id: "integrations",
    title: "Shopify & integrations",
    subtitle: "Connect your stack and let the AI use it.",
    icon: Plug,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    tutorials: [
      { title: "Connecting Shopify", description: "OAuth, scopes and live product sync.", duration: "4 min" },
      { title: "Building your knowledge base", description: "Teach the AI about your products and policies.", duration: "5 min" },
      { title: "WhatsApp templates", description: "Create and approve message templates.", duration: "4 min" },
      { title: "Importing contacts", description: "Bulk-add customers from a CSV.", duration: "3 min" },
    ],
  },
];

function VideoTile({ tutorial }: { tutorial: Tutorial }) {
  return (
    <Card className="group overflow-hidden border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5">
      {/* Placeholder video thumbnail */}
      <div className="relative aspect-video w-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.12),transparent_55%)]" />
        <button
          type="button"
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-primary shadow-md ring-1 ring-border transition-transform group-hover:scale-110"
          aria-label={`Play ${tutorial.title}`}
        >
          <PlayCircle className="h-8 w-8" />
        </button>
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
          <Clock className="h-3 w-3" /> {tutorial.duration}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-tight">{tutorial.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{tutorial.description}</p>
      </div>
    </Card>
  );
}

export default function Tutorials() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const goBack = useGoBack(isSuperAdmin ? "/super-admin" : "/app");

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header — match the app's green top bar */}
      <div className="border-b bg-header px-3 py-3 sm:px-6 sm:py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="text-header-foreground hover:bg-primary/80 h-9 w-9"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20 text-header-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-header-foreground leading-tight">Tutorials</h1>
            <p className="text-[11px] text-header-foreground/70 leading-tight">Learn Jawabify in a few short videos</p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Rocket className="h-3.5 w-3.5" /> Getting started
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome to Jawabify — here's how everything works.
          </h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Short, focused videos that walk you through every service. Watch what you need, skip what you don't.
            New tutorials are added as we ship features.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id}>
              <div className="flex items-start gap-3 mb-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">{section.title}</h3>
                  <p className="text-sm text-muted-foreground">{section.subtitle}</p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.tutorials.map((t) => (
                  <VideoTile key={t.title} tutorial={t} />
                ))}
              </div>
            </section>
          );
        })}

        <div className="rounded-xl border bg-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-semibold text-lg">Need a hand?</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Can't find what you're looking for? Reach out and we'll point you to the right tutorial — or record a new one.
            </p>
          </div>
          <Button onClick={() => navigate("/settings")} className="shrink-0">
            Open settings
          </Button>
        </div>
      </div>
    </div>
  );
}
