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
} from "lucide-react";

import { Instagram, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelFilter } from "@/types/chat";

export type RailKey = string;

interface RailItem {
  key: string;
  label: string;
  icon: typeof MessageSquare;
}

interface IconRailProps {
  active: RailKey;
  onSelect: (key: RailKey) => void;
  badges?: Record<string, number>;
  vertical?: string;
  channel?: ChannelFilter;
  onChannelChange?: (channel: ChannelFilter) => void;
  instagramConnected?: boolean;
}

const COMMON_HEAD: RailItem[] = [
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "home", label: "Overview", icon: LayoutDashboard },
];

const COMMON_TAIL: RailItem[] = [
  { key: "crm", label: "CRM", icon: Users },
  { key: "interested", label: "Interested", icon: Star },
  { key: "flagged", label: "Flagged", icon: Flag },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "ai_issues", label: "AI Issues", icon: Bot },
];

const WELLNESS_ITEMS: RailItem[] = [
  ...COMMON_HEAD,
  { key: "catalog", label: "Catalog", icon: Sparkles },
  { key: "sessions", label: "Calendar", icon: CalendarDays },
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "staff", label: "Staff", icon: UserRound },
  ...COMMON_TAIL,
];

const ITEMS_BY_VERTICAL: Record<string, RailItem[]> = {
  ecommerce: [
    ...COMMON_HEAD,
    { key: "orders", label: "Orders", icon: Package },
    ...COMMON_TAIL,
  ],
  restaurant: [
    ...COMMON_HEAD,
    { key: "orders", label: "Orders", icon: Package },
    { key: "reservations", label: "Reservations", icon: CalendarDays },
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
  wellness: WELLNESS_ITEMS,
  service: WELLNESS_ITEMS,
  healthcare: [
    ...COMMON_HEAD,
    { key: "team", label: "Team", icon: Stethoscope },
    { key: "appointments", label: "Calendar", icon: CalendarDays },
    { key: "leads", label: "Leads", icon: HeartPulse },
    { key: "labs", label: "Labs", icon: FlaskConical },
    { key: "crm", label: "CRM", icon: Users },
    { key: "interested", label: "Interested", icon: Star },
    { key: "flagged", label: "Attention", icon: ShieldAlert },
    { key: "campaigns", label: "Campaigns", icon: Megaphone },
    { key: "ai_issues", label: "AI Issues", icon: Bot },
  ],
  education: [
    ...COMMON_HEAD,
    { key: "courses", label: "Courses", icon: BookOpen },
    { key: "leads", label: "Leads", icon: UserPlus },
    { key: "enrollments", label: "Enrollments", icon: GraduationCap },
    ...COMMON_TAIL,
  ],
};


export function IconRail({
  active,
  onSelect,
  badges = {},
  vertical = "ecommerce",
  channel = "all",
  onChannelChange,
  instagramConnected = false,
}: IconRailProps) {
  const navigate = useNavigate();
  const items = ITEMS_BY_VERTICAL[vertical] ?? ITEMS_BY_VERTICAL.ecommerce;

  return (
    <aside
      className="hidden md:flex w-14 shrink-0 flex-col items-center justify-between border-r py-3 transition-all duration-200"
      style={{
        background: "hsl(222 47% 11%)",
        borderColor: "hsl(220 26% 18%)",
      }}
    >
      {/* Logo + nav */}
      <div className="flex flex-col items-center gap-1 overflow-y-auto overflow-x-hidden scrollbar-none [&::-webkit-scrollbar]:hidden">
        <div
          className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/40 shrink-0"
          title="Jawabify"
        >
          <div className="h-3.5 w-3.5 rounded-full bg-primary" />
          <div className="absolute h-6 w-6 rounded-full border-2 border-primary/40 animate-ripple" />
        </div>

        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          const badge = badges[key];
          const danger = key === "flagged" || key === "ai_issues" || key === "triage";
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={label}
              aria-label={label}
              data-tour={`rail-${key}`}
              className={cn(
                "group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              {!!badge && badge > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ring-2 ring-[hsl(222_47%_11%)]",
                    danger
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>




      {/* Footer actions */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          onClick={() => navigate("/tutorials")}
          title="Tutorials"
          aria-label="Open tutorials"
          data-tour="tutorials-btn"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
        >
          <GraduationCap className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/settings")}
          title="Settings"
          aria-label="Open settings"
          data-tour="settings-btn"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/account")}
          title="Profile"
          aria-label="Open account profile"
          data-tour="account-btn"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
        >
          <UserRound className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
