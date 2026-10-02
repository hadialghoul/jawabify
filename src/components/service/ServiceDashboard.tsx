import { useState, lazy, Suspense, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, Briefcase, CalendarDays, Users, Megaphone, AlertCircle, UserPlus,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import {
  ServicesPanel, SessionsPanel, LeadsPanel, FlaggedPanel,
} from "@/components/wellness/WellnessDashboard";

const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type ServiceTab =
  | "overview" | "services" | "sessions" | "leads"
  | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues";

// Booking pipeline wording for a service business (calls, meetings, appointments).
const SERVICE_STATUS_META = {
  new:       { label: "New enquiry",     hint: "Just reached out",            tint: "bg-sky-50 border-sky-200",        dot: "bg-sky-400" },
  qualified: { label: "Interested",      hint: "Knows the service & price",   tint: "bg-amber-50 border-amber-200",    dot: "bg-amber-400" },
  booked:    { label: "Booked",          hint: "Call / meeting scheduled",    tint: "bg-violet-50 border-violet-200",  dot: "bg-violet-500" },
  completed: { label: "Done",            hint: "Delivered — follow up?",      tint: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  no_show:   { label: "No-show / lost",  hint: "Did not show up",             tint: "bg-rose-50 border-rose-200",      dot: "bg-rose-400" },
} as const;

interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: ServiceTab;
  onTabChange?: (t: ServiceTab) => void;
  hideTabBar?: boolean;
  onToggleNeedsHuman?: (id: string, v: boolean) => void;
  onToggleInterested?: (id: string, v: boolean) => void;
  selectedContactId?: string | null;
}

export function ServiceDashboard({
  contacts, onSelectContact, tab: tabProp, onTabChange,
  onToggleNeedsHuman, onToggleInterested, selectedContactId, hideTabBar,
}: Props) {
  const [internalTab, setInternalTab] = useState<ServiceTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: ServiceTab) => { setInternalTab(t); onTabChange?.(t); };

  const flagged = useMemo(() => contacts.filter((c) => c.needsHuman), [contacts]);

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
        <div className="border-b p-2 sm:p-3 bg-card">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ServiceTab)}>
            <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
              <TabsList className="h-9 w-max inline-flex px-2 sm:px-0">
                <TabsTrigger value="overview" data-tour="sv-overview" className="flex items-center gap-1.5 whitespace-nowrap"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
                <TabsTrigger value="services" data-tour="sv-services" className="flex items-center gap-1.5 whitespace-nowrap"><Briefcase className="h-4 w-4" /> Services</TabsTrigger>
                <TabsTrigger value="sessions" data-tour="sv-sessions" className="flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="h-4 w-4" /> Bookings</TabsTrigger>
                <TabsTrigger value="leads" data-tour="sv-leads" className="flex items-center gap-1.5 whitespace-nowrap"><UserPlus className="h-4 w-4" /> Enquiries</TabsTrigger>
                <TabsTrigger value="crm" data-tour="sv-crm" className="flex items-center gap-1.5 whitespace-nowrap"><Users className="h-4 w-4" /> CRM</TabsTrigger>
                <TabsTrigger value="interested" data-tour="sv-interested" className="gap-1.5 whitespace-nowrap flex items-center">Interested</TabsTrigger>
                <TabsTrigger value="flagged" data-tour="sv-flagged" className="flex items-center gap-1.5 whitespace-nowrap">
                  <AlertCircle className="h-4 w-4" /> Flagged
                  {flagged.length > 0 && <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{flagged.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="campaigns" data-tour="sv-campaigns" className="flex items-center gap-1.5 whitespace-nowrap"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
                <TabsTrigger value="ai_issues" data-tour="sv-ai-issues" className="gap-1.5 whitespace-nowrap flex items-center">AI Issues</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && <OverviewDashboard topItemsLabel="Top services" onSelectByPhone={(p) => { const c = contacts.find((x) => x.phoneNumber === p); if (c) onSelectContact(c); }} />}
          {tab === "services" && <ServicesPanel hint="What you offer, how long it takes and what it costs — the AI quotes and books from this list." />}
          {tab === "sessions" && <SessionsPanel />}
          {tab === "leads" && (
            <LeadsPanel
              contacts={contacts}
              onSelectContact={onSelectContact}
              title="Enquiries"
              hint="Everyone the AI is talking to — from first enquiry to a booked call, meeting or appointment."
              statusMeta={SERVICE_STATUS_META as any}
              showStaff={false}
            />
          )}
          {tab === "crm" && <CrmTab contacts={contacts} orders={[]} onSelectContact={onSelectContact} />}
          {tab === "flagged" && <FlaggedPanel flagged={flagged} onSelectContact={onSelectContact} onResolve={(id) => onToggleNeedsHuman?.(id, false)} />}
          {tab === "campaigns" && <CampaignsTab contacts={contacts} />}
          {tab === "interested" && (
            <InterestedPanel
              contacts={contacts}
              selectedContactId={selectedContactId ?? null}
              onSelectContact={onSelectContact}
              onToggleInterested={onToggleInterested}
            />
          )}
          {tab === "ai_issues" && <AiIssuesPanel contacts={contacts} onSelectContact={onSelectContact} />}
        </Suspense>
      </div>
    </div>
  );
}
