import { useState, lazy, Suspense, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, Home, CalendarDays, Users, UserRound, Megaphone,
  AlertCircle, Plus, Trash2, X, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import { useListings, type Listing } from "@/hooks/useListings";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useViewings, type Viewing } from "@/hooks/useViewings";
import { useRealEstateSettings } from "@/hooks/useRealEstateSettings";
const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
import { addDays, addWeeks, format, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay, isToday } from "date-fns";

const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type RealEstateTab = "overview" | "listings" | "viewings" | "leads" | "agents" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues";

interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: RealEstateTab;
  onTabChange?: (t: RealEstateTab) => void;
  hideTabBar?: boolean;
  onToggleNeedsHuman?: (id: string, v: boolean) => void;
  onToggleInterested?: (id: string, v: boolean) => void;
  selectedContactId?: string | null;
}

export function RealEstateDashboard({ contacts, onSelectContact, tab: tabProp, onTabChange, onToggleNeedsHuman, onToggleInterested, selectedContactId,
  hideTabBar,}: Props) {
  const [internalTab, setInternalTab] = useState<RealEstateTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: RealEstateTab) => { setInternalTab(t); onTabChange?.(t); };

  const flagged = useMemo(() => contacts.filter((c) => c.needsHuman), [contacts]);

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
      <div className="border-b p-2 sm:p-3 bg-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as RealEstateTab)}>
          <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 w-max inline-flex px-2 sm:px-0">
              <TabsTrigger value="overview" data-tour="re-overview" className="flex items-center gap-1.5 whitespace-nowrap"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="listings" data-tour="re-listings" className="flex items-center gap-1.5 whitespace-nowrap"><Home className="h-4 w-4" /> Listings</TabsTrigger>
              <TabsTrigger value="viewings" data-tour="re-viewings" className="flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="h-4 w-4" /> Viewings</TabsTrigger>
              <TabsTrigger value="leads" data-tour="re-leads" className="flex items-center gap-1.5 whitespace-nowrap"><Users className="h-4 w-4" /> Leads</TabsTrigger>
              <TabsTrigger value="agents" data-tour="re-agents" className="flex items-center gap-1.5 whitespace-nowrap"><UserRound className="h-4 w-4" /> Agents</TabsTrigger>
              <TabsTrigger value="crm" data-tour="re-crm" className="flex items-center gap-1.5 whitespace-nowrap"><Users className="h-4 w-4" /> CRM</TabsTrigger>
              <TabsTrigger value="interested" data-tour="re-interested" className="gap-1.5 whitespace-nowrap flex items-center">Interested</TabsTrigger>
              <TabsTrigger value="flagged" data-tour="re-flagged" className="flex items-center gap-1.5 whitespace-nowrap">
                <AlertCircle className="h-4 w-4" /> Flagged
                {flagged.length > 0 && <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{flagged.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="campaigns" data-tour="re-campaigns" className="flex items-center gap-1.5 whitespace-nowrap"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
              <TabsTrigger value="ai_issues" data-tour="re-ai-issues" className="gap-1.5 whitespace-nowrap flex items-center">AI Issues</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && <OverviewDashboard onSelectByPhone={(p) => { const c = contacts.find((x) => x.phoneNumber === p); if (c) onSelectContact(c); }} />}
          {tab === "listings" && <ListingsPanel />}
          {tab === "viewings" && <ViewingsPanel />}
          {tab === "leads" && <LeadsPanel onSelectContact={onSelectContact} contacts={contacts} />}
          {tab === "agents" && <AgentsPanel />}
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

// ============== LISTINGS ==============
function ListingsPanel() {
  const { listings, create, update, remove, loading } = useListings();
  const { agents } = useAgents();
  const [editing, setEditing] = useState<Partial<Listing> | null>(null);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Listings</h3>
            <p className="text-sm text-muted-foreground">Properties the AI offers to customers.</p>
          </div>
          <Button onClick={() => setEditing({ kind: "rent", property_type: "apartment", currency: "USD", status: "active" })}>
            <Plus className="h-4 w-4 mr-1.5" /> New Listing
          </Button>
        </div>

        {loading ? <Fallback /> : listings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No listings yet. Add one or sync a Google Sheet from Settings.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {listings.map((l) => (
              <Card key={l.id} className="overflow-hidden cursor-pointer hover:shadow-md" onClick={() => setEditing(l)}>
                {Array.isArray(l.images) && l.images[0] && (
                  <img src={(l.images[0] as any).url || l.images[0]} alt={l.title} className="w-full h-32 object-cover" />
                )}
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate flex-1">{l.title}</p>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${l.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{l.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {l.kind === "rent" ? "Rent" : "Sale"} · {l.property_type}
                    {l.bedrooms ? ` · ${l.bedrooms}BR` : ""}{l.area_name ? ` · ${l.area_name}` : ""}
                  </p>
                  {l.price && <p className="text-sm font-medium mt-1">{l.currency} {Number(l.price).toLocaleString()}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {editing && (
          <ListingDialog
            listing={editing}
            agents={agents}
            onClose={() => setEditing(null)}
            onSave={async (data) => {
              if (editing.id) await update(editing.id, data);
              else await create(data);
              setEditing(null);
            }}
            onDelete={editing.id ? async () => { if (confirm("Delete this listing?")) { await remove(editing.id!); setEditing(null); } } : undefined}
          />
        )}
      </div>
    </div>
  );
}

function ListingDialog({ listing, agents, onClose, onSave, onDelete }: {
  listing: Partial<Listing>; agents: Agent[]; onClose: () => void;
  onSave: (l: Partial<Listing>) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Partial<Listing>>(listing);
  const upd = (k: keyof Listing, v: any) => setF({ ...f, [k]: v });
  const firstImg = Array.isArray(f.images) && f.images[0] ? ((f.images[0] as any).url || f.images[0]) : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Edit listing" : "New listing"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={f.title || ""} onChange={(e) => upd("title", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Kind</Label>
              <Select value={f.kind || "rent"} onValueChange={(v) => upd("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="rent">Rent</SelectItem><SelectItem value="buy">Buy</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Property type</Label>
              <Select value={f.property_type || "apartment"} onValueChange={(v) => upd("property_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">Apartment</SelectItem><SelectItem value="villa">Villa</SelectItem>
                  <SelectItem value="office">Office</SelectItem><SelectItem value="land">Land</SelectItem><SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Price</Label><Input type="number" value={f.price ?? ""} onChange={(e) => upd("price", e.target.value ? parseFloat(e.target.value) : null)} /></div>
            <div><Label>Currency</Label><Input value={f.currency || "USD"} onChange={(e) => upd("currency", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Beds</Label><Input type="number" value={f.bedrooms ?? ""} onChange={(e) => upd("bedrooms", e.target.value ? parseInt(e.target.value) : null)} /></div>
            <div><Label>Baths</Label><Input type="number" value={f.bathrooms ?? ""} onChange={(e) => upd("bathrooms", e.target.value ? parseInt(e.target.value) : null)} /></div>
            <div><Label>Area m²</Label><Input type="number" value={f.area_sqm ?? ""} onChange={(e) => upd("area_sqm", e.target.value ? parseFloat(e.target.value) : null)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Area name</Label><Input value={f.area_name || ""} onChange={(e) => upd("area_name", e.target.value)} /></div>
            <div><Label>Region</Label><Input value={f.region || ""} onChange={(e) => upd("region", e.target.value)} /></div>
          </div>
          <div><Label>Image URL</Label>
            <Input value={firstImg} onChange={(e) => upd("images", e.target.value ? [{ url: e.target.value }] : [])} placeholder="https://..." />
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description || ""} onChange={(e) => upd("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Status</Label>
              <Select value={f.status || "active"} onValueChange={(v) => upd("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem><SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem><SelectItem value="rented">Rented</SelectItem><SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Agent</Label>
              <Select value={f.agent_id || "_none"} onValueChange={(v) => upd("agent_id", v === "_none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {onDelete && <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(f)} disabled={!f.title}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== VIEWINGS CALENDAR ==============
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const STATUS_COLORS: Record<Viewing["status"], string> = {
  booked: "bg-blue-500/90 border-l-blue-700 text-white",
  completed: "bg-muted border-l-border text-muted-foreground",
  cancelled: "bg-red-200 border-l-red-500 text-red-900 line-through",
  no_show: "bg-orange-200 border-l-orange-500 text-orange-900",
};

function ViewingsPanel() {
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState(new Date());
  const range = useMemo(() => view === "day"
    ? { start: startOfDay(cursor), end: endOfDay(cursor) }
    : { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) }, [view, cursor]);
  const { viewings, update, remove } = useViewings(range.start, range.end);
  const [selected, setSelected] = useState<Viewing | null>(null);
  const shift = (n: number) => setCursor(view === "day" ? addDays(cursor, n) : addWeeks(cursor, n));
  const days = view === "day" ? [cursor] : Array.from({ length: 7 }).map((_, i) => addDays(range.start, i));

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-card px-3 py-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-1 text-xl">{view === "day" ? format(cursor, "EEEE, MMMM d") : `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`}</div>
        </div>
        <div className="inline-flex rounded-md border overflow-hidden">
          <button className={`px-3 py-1.5 text-sm ${view === "day" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} onClick={() => setView("day")}>Day</button>
          <button className={`px-3 py-1.5 text-sm ${view === "week" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} onClick={() => setView("week")}>Week</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex min-w-max">
          <div className="w-14 shrink-0 border-r bg-background sticky left-0 z-20">
            <div className="h-12 border-b bg-card" />
            {HOURS.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground bg-background px-1">{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-1">
            {days.map((d) => {
              const dayVs = viewings.filter((v) => isSameDay(new Date(v.scheduled_at), d));
              return (
                <div key={d.toISOString()} className={`flex-1 min-w-[140px] border-r ${days.length === 1 ? "min-w-[500px]" : ""}`}>
                  <div className="h-12 border-b bg-card sticky top-0 z-10 flex flex-col items-center justify-center">
                    <span className="text-[11px] uppercase text-muted-foreground">{format(d, "EEE")}</span>
                    <span className={`text-lg leading-none ${isToday(d) ? "bg-primary text-primary-foreground rounded-full h-7 w-7 inline-flex items-center justify-center" : ""}`}>{format(d, "d")}</span>
                  </div>
                  <div className="relative">
                    {HOURS.map((h) => (<div key={h} className="border-b relative" style={{ height: HOUR_HEIGHT }}><div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-border/40" /></div>))}
                    {dayVs.map((v) => {
                      const s = new Date(v.scheduled_at);
                      const top = (s.getHours() + s.getMinutes() / 60) * HOUR_HEIGHT;
                      const height = Math.max(28, (v.duration_min / 60) * HOUR_HEIGHT - 2);
                      return (
                        <button key={v.id} onClick={() => setSelected(v)}
                          className={`absolute left-1 right-1 rounded-md border-l-4 text-left px-1.5 py-1 text-xs shadow-sm ${STATUS_COLORS[v.status]}`}
                          style={{ top, height }}>
                          <div className="font-semibold truncate flex items-center gap-1">
                            {v.guest_name}{v.source === "ai" && <Sparkles className="h-3 w-3 shrink-0" />}
                          </div>
                          <div className="text-[10px] opacity-90">{format(s, "HH:mm")}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{selected.guest_name}</DialogTitle></DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {selected.guest_phone || "—"}</p>
              <p><span className="text-muted-foreground">When:</span> {format(new Date(selected.scheduled_at), "EEE MMM d, HH:mm")}</p>
              <p><span className="text-muted-foreground">Duration:</span> {selected.duration_min} min</p>
              {selected.notes && <p className="italic text-muted-foreground">{selected.notes}</p>}
              <p className="pt-2"><span className="text-muted-foreground">Status:</span> {selected.status}</p>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {selected.status === "booked" && <Button size="sm" onClick={async () => { await update(selected.id, { status: "completed" }); setSelected(null); }}>Mark completed</Button>}
              <Button size="sm" variant="outline" onClick={async () => { await update(selected.id, { status: "cancelled" }); setSelected(null); }}>Cancel</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await remove(selected.id); setSelected(null); } }}><Trash2 className="h-4 w-4" /></Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============== LEADS ==============
const LEAD_STATUS_META: Record<Lead["status"], { label: string; hint: string; tint: string; dot: string }> = {
  new:            { label: "New enquiry",     hint: "Just reached out",            tint: "bg-sky-50 border-sky-200",         dot: "bg-sky-400" },
  qualified:      { label: "Qualified",       hint: "Budget & area known",         tint: "bg-amber-50 border-amber-200",     dot: "bg-amber-400" },
  viewing_booked: { label: "Viewing booked",  hint: "Awaiting the visit",          tint: "bg-violet-50 border-violet-200",   dot: "bg-violet-500" },
  closed_won:     { label: "Closed — won",    hint: "Deal signed",                 tint: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  closed_lost:    { label: "Closed — lost",   hint: "Walked away or unqualified",  tint: "bg-rose-50 border-rose-200",       dot: "bg-rose-400" },
};

function LeadsPanel({ contacts, onSelectContact }: { contacts: Contact[]; onSelectContact: (c: Contact) => void }) {
  const { leads, update, remove } = useLeads();
  const { agents } = useAgents();
  const columns: Lead["status"][] = ["new", "qualified", "viewing_booked", "closed_won", "closed_lost"];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">Leads</h3>
        <p className="text-sm text-muted-foreground">Pipeline of buyers and renters the AI is qualifying — drag through stages from first enquiry to closed deal.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {columns.map((col) => {
          const items = leads.filter((l) => l.status === col);
          const meta = LEAD_STATUS_META[col];
          return (
            <div key={col} className={`rounded-md p-2 min-h-[200px] border ${meta.tint}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <h4 className="text-xs font-semibold">{meta.label}</h4>
                <span className="text-[10px] text-muted-foreground ml-auto">{items.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">{meta.hint}</p>
              <div className="space-y-2">
                {items.map((l) => {
                  const c = contacts.find((x) => x.id === l.contact_id);
                  const agent = agents.find((a) => a.id === l.assigned_agent_id);
                  return (
                    <Card key={l.id} className="cursor-pointer hover:shadow-md bg-background" onClick={() => c && onSelectContact(c)}>
                      <CardContent className="p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{c?.name || c?.phoneNumber || "Unknown"}</p>
                          {l.needs_human && <span className="text-[9px] bg-destructive text-destructive-foreground px-1 rounded">⚠ Human</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {l.intent || "?"} · {l.property_type || "?"}
                          {l.budget_max ? ` · ≤${l.budget_max}` : ""}
                        </p>
                        {(l.preferred_areas || []).length > 0 && <p className="text-[11px] text-muted-foreground truncate">📍 {l.preferred_areas.join(", ")}</p>}
                        {agent && <p className="text-[11px] text-emerald-700">→ {agent.name}</p>}
                        <div className="flex items-center gap-1 pt-1">
                          <Select value={l.status} onValueChange={(v) => update(l.id, { status: v as any })}>
                            <SelectTrigger className="h-6 text-[11px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                            <SelectContent>{columns.map((s) => <SelectItem key={s} value={s} className="text-xs">{LEAD_STATUS_META[s].label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (confirm("Delete lead?")) remove(l.id); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============== AGENTS ==============
function AgentsPanel() {
  const { agents, create, update, remove } = useAgents();
  const [editing, setEditing] = useState<Partial<Agent> | null>(null);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Agents</h3>
            <p className="text-sm text-muted-foreground">Used for lead routing by area and property type.</p>
          </div>
          <Button onClick={() => setEditing({ active: true, areas: [], property_types: [] })}><Plus className="h-4 w-4 mr-1.5" /> Add Agent</Button>
        </div>
        <div className="space-y-2">
          {agents.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(a)}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{a.name} {!a.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">{a.phone || "no phone"} · {(a.areas || []).join(", ") || "no areas"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {agents.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No agents yet.</p>}
        </div>

        {editing && (
          <AgentDialog
            agent={editing}
            onClose={() => setEditing(null)}
            onSave={async (data) => {
              if (editing.id) await update(editing.id, data);
              else await create(data);
              setEditing(null);
            }}
            onDelete={editing.id ? async () => { if (confirm("Delete agent?")) { await remove(editing.id!); setEditing(null); } } : undefined}
          />
        )}
      </div>
    </div>
  );
}

function AgentDialog({ agent, onClose, onSave, onDelete }: {
  agent: Partial<Agent>; onClose: () => void; onSave: (a: Partial<Agent>) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Partial<Agent>>(agent);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{f.id ? "Edit agent" : "New agent"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+961..." /></div>
          <div><Label>Email</Label><Input value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Areas (comma-separated)</Label><Input value={(f.areas || []).join(", ")} onChange={(e) => setF({ ...f, areas: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
          <div><Label>Property types (comma-separated)</Label><Input value={(f.property_types || []).join(", ")} onChange={(e) => setF({ ...f, property_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="apartment, villa, office" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={f.active ?? true} onChange={(e) => setF({ ...f, active: e.target.checked })} /> <Label>Active</Label></div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {onDelete && <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(f)} disabled={!f.name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== FLAGGED ==============
function FlaggedPanel({ flagged, onSelectContact, onResolve }: { flagged: Contact[]; onSelectContact: (c: Contact) => void; onResolve: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Flagged for human</h3>
          <p className="text-sm text-muted-foreground">Conversations the AI handed over — angry customer, VIP / luxury request, off-topic question, or anyone asking for a human agent. Reply yourself, then dismiss.</p>
        </div>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No flagged conversations.</p>
        ) : flagged.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 mb-2">
            <button onClick={() => onSelectContact(c)} className="flex-1 text-left">
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.phoneNumber}</p>
            </button>
            <Button variant="ghost" size="sm" onClick={() => onResolve(c.id)}><X className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== SETTINGS ==============
function SettingsPanel() {
  const { settings, save, loading } = useRealEstateSettings();
  const [areas, setAreas] = useState("");
  const [calendly, setCalendly] = useState("");
  const [sheet, setSheet] = useState("");
  const [webhook, setWebhook] = useState("");
  const [human, setHuman] = useState("");
  const [dur, setDur] = useState("30");
  const [rem, setRem] = useState("2");
  const [fol, setFol] = useState("24");
  const [curr, setCurr] = useState("USD");

  useMemo(() => {
    if (!settings) return;
    setAreas((settings.areas_covered || []).join(", "));
    setCalendly(settings.calendly_url || "");
    setSheet(settings.google_sheet_url || "");
    setWebhook(settings.crm_webhook_url || "");
    setHuman(settings.human_transfer_phone || "");
    setDur(String(settings.viewing_duration_min ?? 30));
    setRem(String(settings.reminder_hours_before ?? 2));
    setFol(String(settings.followup_hours_after ?? 24));
    setCurr(settings.currency || "USD");
  }, [settings]);

  if (loading || !settings) return <Fallback />;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full space-y-4">
        <Card>
          <CardHeader><CardTitle>Coverage</CardTitle><CardDescription>Areas the AI qualifies leads for. Outside → polite decline or handoff.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Areas covered (comma-separated)</Label><Input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Achrafieh, Hamra, Verdun" /></div>
            <div><Label>Currency</Label><Input value={curr} onChange={(e) => setCurr(e.target.value)} className="max-w-[120px]" /></div>
            <Button onClick={() => save({ areas_covered: areas.split(",").map((s) => s.trim()).filter(Boolean), currency: curr })}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Viewings</CardTitle><CardDescription>Default duration and reminder/follow-up timing.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 max-w-md">
              <div><Label>Duration (min)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
              <div><Label>Reminder (h before)</Label><Input type="number" value={rem} onChange={(e) => setRem(e.target.value)} /></div>
              <div><Label>Follow-up (h after)</Label><Input type="number" value={fol} onChange={(e) => setFol(e.target.value)} /></div>
            </div>
            <Button onClick={() => save({ viewing_duration_min: parseInt(dur) || 30, reminder_hours_before: parseInt(rem) || 2, followup_hours_after: parseInt(fol) || 24 })}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Integrations</CardTitle><CardDescription>Optional external links.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Google Sheet URL (listings sync)</Label><Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></div>
            <div><Label>Calendly URL (alternative booking)</Label><Input value={calendly} onChange={(e) => setCalendly(e.target.value)} placeholder="https://calendly.com/..." /></div>
            <div><Label>CRM webhook URL</Label><Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://..." /></div>
            <Button onClick={() => save({ google_sheet_url: sheet || null, calendly_url: calendly || null, crm_webhook_url: webhook || null })}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Human handoff</CardTitle><CardDescription>Where to forward complaints, VIPs, off-topic requests.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Human transfer phone</Label><Input value={human} onChange={(e) => setHuman(e.target.value)} placeholder="+961..." /></div>
            <Button onClick={() => save({ human_transfer_phone: human || null })}>Save</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
