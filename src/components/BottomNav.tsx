import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Package,
  Users,
  Megaphone,
  Settings as SettingsIcon,
  LayoutDashboard,
  GraduationCap,
  UserRound,
  Star,
  Flag,
  Bot,
  CalendarDays,
  BookOpen,
  LayoutGrid,
  Home,
  UserPlus,
  Sparkles,
  HeartPulse,
  Stethoscope,
  ShieldAlert,
  FlaskConical,
  Briefcase,
  MoreHorizontal,
  Headphones,
  Phone,
  Mail,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  label: string;
  icon: typeof MessageSquare;
}

const COMMON_HEAD: NavItem[] = [
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "home", label: "Overview", icon: LayoutDashboard },
];

const COMMON_TAIL: NavItem[] = [
  { key: "crm", label: "CRM", icon: Users },
  { key: "interested", label: "Interested", icon: Star },
  { key: "flagged", label: "Flagged", icon: Flag },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "ai_issues", label: "AI Issues", icon: Bot },
];

const ITEMS_BY_VERTICAL: Record<string, NavItem[]> = {
  ecommerce: [
    ...COMMON_HEAD,
    { key: "orders", label: "Orders", icon: Package },
    { key: "crm", label: "CRM", icon: Users },
    { key: "interested", label: "Interested", icon: Star },
    { key: "flagged", label: "Flagged", icon: Flag },
    { key: "campaigns", label: "Campaigns", icon: Megaphone },
    { key: "ai_issues", label: "AI Issues", icon: Bot },
  ],
  restaurant: [
    ...COMMON_HEAD,
    { key: "orders", label: "Orders", icon: Package },
    { key: "reservations", label: "Bookings", icon: CalendarDays },
    { key: "menu", label: "Menu", icon: BookOpen },
    { key: "tables", label: "Tables", icon: LayoutGrid },
    ...COMMON_TAIL,
  ],
  real_estate: [
    ...COMMON_HEAD,
    { key: "listings", label: "Listings", icon: Home },
    { key: "viewings", label: "Viewings", icon: CalendarDays },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "agents", label: "Agents", icon: Briefcase },
    ...COMMON_TAIL,
  ],
  wellness: [
    ...COMMON_HEAD,
    { key: "catalog", label: "Catalog", icon: Sparkles },
    { key: "sessions", label: "Calendar", icon: CalendarDays },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "staff", label: "Staff", icon: UserRound },
    ...COMMON_TAIL,
  ],
  healthcare: [
    ...COMMON_HEAD,
    { key: "specialties", label: "Specialties", icon: Stethoscope },
    { key: "doctors", label: "Doctors", icon: UserRound },
    { key: "appointments", label: "Calendar", icon: CalendarDays },
    { key: "leads", label: "Leads", icon: HeartPulse },
    { key: "triage", label: "Triage", icon: ShieldAlert },
    { key: "labs", label: "Labs", icon: FlaskConical },
    ...COMMON_TAIL,
  ],
  education: [
    ...COMMON_HEAD,
    { key: "courses", label: "Courses", icon: BookOpen },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "enrollments", label: "Enrollments", icon: GraduationCap },
    ...COMMON_TAIL,
  ],
  service: [
    ...COMMON_HEAD,
    { key: "catalog", label: "Services", icon: Briefcase },
    { key: "sessions", label: "Bookings", icon: CalendarDays },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "staff", label: "Staff", icon: UserRound },
    ...COMMON_TAIL,
  ],
};

interface Props {
  active: string;
  onSelect: (key: string) => void;
  badges?: Record<string, number>;
  vertical?: string;
}

export function BottomNav({ active, onSelect, badges = {}, vertical = "ecommerce" }: Props) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const items = ITEMS_BY_VERTICAL[vertical] ?? ITEMS_BY_VERTICAL.ecommerce;

  // Primary slots in the bar (4 items + More). Keep chats + home always; pick 2 more from front.
  const PRIMARY_COUNT = 4;
  const primary = items.slice(0, PRIMARY_COUNT);
  const overflow = items.slice(PRIMARY_COUNT);

  // If active is in overflow, surface a hint via the "More" pill.
  const activeInOverflow = overflow.some((i) => i.key === active);

  const renderTab = (item: NavItem, isActive: boolean) => {
    const Icon = item.icon;
    const badge = badges[item.key];
    const danger = item.key === "flagged" || item.key === "ai_issues" || item.key === "triage";
    return (
      <button
        key={item.key}
        onClick={() => onSelect(item.key)}
        aria-label={item.label}
        data-tour={`bnav-${item.key}`}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <div className="relative">
          <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
          {!!badge && badge > 0 && (
            <span
              className={cn(
                "absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold ring-2 ring-card",
                danger ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">{item.label}</span>
        {isActive && (
          <span className="absolute -top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
        )}
      </button>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {primary.map((item) => renderTab(item, active === item.key))}

        {/* More menu */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open more navigation options"
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-colors",
                activeInOverflow ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">More</span>
              {activeInOverflow && (
                <span className="absolute -top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[80vh]"
          >
            <SheetTitle className="text-base mb-3">More</SheetTitle>
            <div className="grid grid-cols-4 gap-2">
              {overflow.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                const badge = badges[item.key];
                const danger = item.key === "flagged" || item.key === "ai_issues" || item.key === "triage";
                return (
                  <button
                    key={item.key}
                    aria-label={item.label}
                    onClick={() => {
                      onSelect(item.key);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 transition-all min-h-[72px]",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:bg-muted/60",
                    )}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {!!badge && badge > 0 && (
                        <span
                          className={cn(
                            "absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold",
                            danger
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground",
                          )}
                        >
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight text-center line-clamp-2">
                      {item.label}
                    </span>
                  </button>
                );
              })}

              <div className="col-span-4 my-2 h-px bg-border" />

              {[
                { key: "_tutorials", label: "Tutorials", icon: GraduationCap, onClick: () => navigate("/tutorials") },
                { key: "_settings", label: "Settings", icon: SettingsIcon, onClick: () => navigate("/settings") },
                { key: "_account", label: "Profile", icon: UserRound, onClick: () => navigate("/account") },
                {
                  key: "_support",
                  label: "Support",
                  icon: Headphones,
                  onClick: () => {
                    setMoreOpen(false);
                    setSupportOpen(true);
                  },
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    aria-label={item.label}
                    onClick={() => {
                      item.onClick();
                      setMoreOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/60 p-2.5 transition-all hover:bg-muted/60 min-h-[72px]"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Need a hand getting started?</DialogTitle>
            <DialogDescription>
              Book a free onboarding call with our team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href="tel:+971523506806"
              className="inline-flex items-center gap-2 rounded-lg bg-background border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Phone className="h-4 w-4 text-primary" />
              +971 52 350 6806
            </a>
            <a
              href="mailto:support@jawabify.com"
              className="inline-flex items-center gap-2 rounded-lg bg-background border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Mail className="h-4 w-4 text-primary" />
              support@jawabify.com
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
