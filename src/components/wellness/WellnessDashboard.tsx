import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, Sparkles, CalendarDays, Users, UserRound, Megaphone,
  AlertCircle, Plus, Trash2, X, ChevronLeft, ChevronRight, Package as PkgIcon, HeartPulse,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import {
  useWellnessServices, useWellnessStaff, useWellnessPackages,
  useWellnessLeads, useWellnessSessions,
  type WellnessService, type WellnessStaff, type WellnessPackage, type WellnessLead, type WellnessSession,
} from "@/hooks/useWellness";
import { addDays, addWeeks, format, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay, isToday } from "date-fns";

const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type WellnessTab = "overview" | "catalog" | "services" | "sessions" | "leads" | "packages" | "staff" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues";

interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: WellnessTab;
  onTabChange?: (t: WellnessTab) => void;
  hideTabBar?: boolean;
  onToggleNeedsHuman?: (id: string, v: boolean) => void;
  onToggleInterested?: (id: string, v: boolean) => void;
  selectedContactId?: string | null;
}

export function WellnessDashboard({ contacts, onSelectContact, tab: tabProp, onTabChange, onToggleNeedsHuman, onToggleInterested, selectedContactId,
  hideTabBar,}: Props) {
  const [internalTab, setInternalTab] = useState<WellnessTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: WellnessTab) => { setInternalTab(t); onTabChange?.(t); };

  const flagged = useMemo(() => contacts.filter((c) => c.needsHuman), [contacts]);

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
      <div className="border-b p-2 sm:p-3 bg-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as WellnessTab)}>
          <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 w-max inline-flex px-2 sm:px-0">
              <TabsTrigger value="overview" data-tour="we-overview" className="flex items-center gap-1.5 whitespace-nowrap"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="catalog" data-tour="we-catalog" className="flex items-center gap-1.5 whitespace-nowrap"><Sparkles className="h-4 w-4" /> Catalog</TabsTrigger>
              <TabsTrigger value="sessions" data-tour="we-sessions" className="flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="h-4 w-4" /> Calendar</TabsTrigger>
              <TabsTrigger value="leads" data-tour="we-leads" className="flex items-center gap-1.5 whitespace-nowrap"><HeartPulse className="h-4 w-4" /> Leads</TabsTrigger>
              <TabsTrigger value="staff" data-tour="we-staff" className="flex items-center gap-1.5 whitespace-nowrap"><UserRound className="h-4 w-4" /> Staff</TabsTrigger>
              <TabsTrigger value="crm" data-tour="we-crm" className="flex items-center gap-1.5 whitespace-nowrap"><Users className="h-4 w-4" /> CRM</TabsTrigger>
              <TabsTrigger value="interested" data-tour="we-interested" className="gap-1.5 whitespace-nowrap flex items-center">Interested</TabsTrigger>
              <TabsTrigger value="flagged" data-tour="we-flagged" className="flex items-center gap-1.5 whitespace-nowrap">
                <AlertCircle className="h-4 w-4" /> Flagged
                {flagged.length > 0 && <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{flagged.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="campaigns" data-tour="we-campaigns" className="flex items-center gap-1.5 whitespace-nowrap"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
              <TabsTrigger value="ai_issues" data-tour="we-ai-issues" className="gap-1.5 whitespace-nowrap flex items-center">AI Issues</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && <OverviewDashboard onSelectByPhone={(p) => { const c = contacts.find((x) => x.phoneNumber === p); if (c) onSelectContact(c); }} />}
          {tab === "catalog" && <CatalogPanel />}
          {tab === "services" && <CatalogPanel initial="services" />}
          {tab === "sessions" && <SessionsPanel />}
          {tab === "leads" && <LeadsPanel onSelectContact={onSelectContact} contacts={contacts} />}
          {tab === "packages" && <CatalogPanel initial="packages" />}
          {tab === "staff" && <StaffPanel />}
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

// ============== CATALOG (Services + Packages) ==============
function CatalogPanel({ initial = "services" }: { initial?: "services" | "packages" }) {
  const [sub, setSub] = useState<"services" | "packages">(initial);
  useEffect(() => { setSub(initial); }, [initial]);
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card px-3 py-2">
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            data-tour="catalog-services"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "services" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("services")}
          ><Sparkles className="h-4 w-4" /> Services</button>
          <button
            data-tour="catalog-packages"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "packages" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("packages")}
          ><PkgIcon className="h-4 w-4" /> Packages</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {sub === "services" ? <ServicesPanel /> : <PackagesPanel />}
      </div>
    </div>
  );
}

// ============== SERVICES ==============
function ServicesPanel() {
  const { items, create, update, remove, loading } = useWellnessServices();
  const [editing, setEditing] = useState<Partial<WellnessService> | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Services</h3>
            <p className="text-sm text-muted-foreground">Massages, classes, treatments — what the AI offers and books.</p>
          </div>
          <Button onClick={() => setEditing({ duration_min: 60, currency: "USD", active: true })}><Plus className="h-4 w-4 mr-1.5" /> New Service</Button>
        </div>
        {loading ? <Fallback /> : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No services yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s) => (
              <Card key={s.id} className="overflow-hidden cursor-pointer hover:shadow-md" onClick={() => setEditing(s)}>
                {s.image_url && <img src={s.image_url} alt={s.name} className="w-full h-32 object-cover" />}
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate flex-1">{s.name}</p>
                    {!s.active && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">off</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.category || "—"} · {s.duration_min}min</p>
                  {s.price != null && <p className="text-sm font-medium mt-1">{s.currency} {Number(s.price).toLocaleString()}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {editing && (
          <ServiceDialog
            service={editing}
            onClose={() => setEditing(null)}
            onSave={async (d) => { if (editing.id) await update(editing.id, d); else await create(d); setEditing(null); }}
            onDelete={editing.id ? async () => { if (confirm("Delete?")) { await remove(editing.id!); setEditing(null); } } : undefined}
          />
        )}
      </div>
    </div>
  );
}

function ServiceDialog({ service, onClose, onSave, onDelete }: {
  service: Partial<WellnessService>; onClose: () => void;
  onSave: (s: Partial<WellnessService>) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Partial<WellnessService>>(service);
  const u = (k: keyof WellnessService, v: any) => setF({ ...f, [k]: v });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name || ""} onChange={(e) => u("name", e.target.value)} /></div>
          <div><Label>Category</Label><Input value={f.category || ""} onChange={(e) => u("category", e.target.value)} placeholder="Massage, Yoga, Facial..." /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Duration (min)</Label><Input type="number" value={f.duration_min ?? 60} onChange={(e) => u("duration_min", parseInt(e.target.value) || 60)} /></div>
            <div><Label>Price</Label><Input type="number" value={f.price ?? ""} onChange={(e) => u("price", e.target.value ? parseFloat(e.target.value) : null)} /></div>
            <div><Label>Currency</Label><Input value={f.currency || "USD"} onChange={(e) => u("currency", e.target.value)} /></div>
          </div>
          <div><Label>Image URL</Label><Input value={f.image_url || ""} onChange={(e) => u("image_url", e.target.value || null)} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description || ""} onChange={(e) => u("description", e.target.value)} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={f.active ?? true} onChange={(e) => u("active", e.target.checked)} /> <Label>Active</Label></div>
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

// ============== CALENDAR / SESSIONS ==============
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const STATUS_COLORS: Record<WellnessSession["status"], string> = {
  booked: "bg-purple-500/90 border-l-purple-700 text-white",
  completed: "bg-muted border-l-border text-muted-foreground",
  cancelled: "bg-red-200 border-l-red-500 text-red-900 line-through",
  no_show: "bg-orange-200 border-l-orange-500 text-orange-900",
};

function SessionsPanel() {
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState(new Date());
  const range = useMemo(() => view === "day"
    ? { start: startOfDay(cursor), end: endOfDay(cursor) }
    : { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) }, [view, cursor]);
  const { sessions, update, remove } = useWellnessSessions(range.start, range.end);
  const [selected, setSelected] = useState<WellnessSession | null>(null);
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
              const dayVs = sessions.filter((v) => isSameDay(new Date(v.scheduled_at), d));
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
const STATUS_META: Record<WellnessLead["status"], { label: string; hint: string; tint: string; dot: string }> = {
  new:       { label: "New enquiry",  hint: "Just reached out",          tint: "bg-sky-50 border-sky-200",       dot: "bg-sky-400" },
  qualified: { label: "Interested",   hint: "Service & needs known",     tint: "bg-amber-50 border-amber-200",   dot: "bg-amber-400" },
  booked:    { label: "Session booked",hint: "Awaiting visit",           tint: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  completed: { label: "Completed",    hint: "Session done — rebook?",    tint: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  no_show:   { label: "No-show / lost",hint: "Did not attend",           tint: "bg-rose-50 border-rose-200",     dot: "bg-rose-400" },
};

function LeadsPanel({ contacts, onSelectContact }: { contacts: Contact[]; onSelectContact: (c: Contact) => void }) {
  const { items: leads, update, remove } = useWellnessLeads();
  const { items: staff } = useWellnessStaff();
  const { items: services } = useWellnessServices();
  const columns: WellnessLead["status"][] = ["new", "qualified", "booked", "completed", "no_show"];
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">Leads</h3>
        <p className="text-sm text-muted-foreground">Pipeline of guests the AI is talking to — drag through stages from first enquiry to completed session.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">

        {columns.map((col) => {
          const items = leads.filter((l) => l.status === col);
          const meta = STATUS_META[col];
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
                  const member = staff.find((a) => a.id === l.assigned_staff_id);
                  const svc = services.find((s) => s.id === l.service_id);
                  return (
                    <Card key={l.id} className="cursor-pointer hover:shadow-md bg-background" onClick={() => c && onSelectContact(c)}>
                      <CardContent className="p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{c?.name || c?.phoneNumber || "Guest"}</p>
                          {l.needs_human && <span className="text-[9px] bg-destructive text-destructive-foreground px-1 rounded">⚠ Human</span>}
                        </div>
                        {svc ? (
                          <p className="text-[11px]"><span className="text-muted-foreground">Service:</span> {svc.name}</p>
                        ) : l.interest ? (
                          <p className="text-[11px]"><span className="text-muted-foreground">Wants:</span> {l.interest}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">No service yet</p>
                        )}
                        {member && <p className="text-[11px] text-purple-700">🧖 {member.name}</p>}
                        <div className="flex items-center gap-1 pt-1">
                          <Select value={l.status} onValueChange={(v) => update(l.id, { status: v as any })}>
                            <SelectTrigger className="h-6 text-[11px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                            <SelectContent>{columns.map((s) => <SelectItem key={s} value={s} className="text-xs">{STATUS_META[s].label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) remove(l.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// ============== PACKAGES ==============
function PackagesPanel() {
  const { items, create, update, remove } = useWellnessPackages();
  const { items: services } = useWellnessServices();
  const [editing, setEditing] = useState<Partial<WellnessPackage> | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Packages</h3>
            <p className="text-sm text-muted-foreground">Multi-session bundles the AI upsells after bookings.</p>
          </div>
          <Button onClick={() => setEditing({ sessions_count: 5, currency: "USD", active: true, service_ids: [] })}><Plus className="h-4 w-4 mr-1.5" /> Add Package</Button>
        </div>
        <div className="space-y-2">
          {items.map((p) => {
            const ids = p.service_ids?.length ? p.service_ids : (p.service_id ? [p.service_id] : []);
            const svcNames = ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean) as string[];
            return (
              <Card key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing({ ...p, service_ids: ids })}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.name} {!p.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                    <p className="text-xs text-muted-foreground">{p.sessions_count} sessions · {p.price != null ? `${p.currency} ${p.price}` : "no price"}</p>
                    {svcNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {svcNames.map((n) => <span key={n} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{n}</span>)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No packages yet.</p>}
        </div>
        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing.id ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div>
                  <Label>Services included</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Pick one or more. Leave empty for "any service".</p>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto p-2 border rounded-md">
                    {services.length === 0 && <span className="text-xs text-muted-foreground">Add services first.</span>}
                    {services.map((s) => {
                      const selected = (editing.service_ids || []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const cur = editing.service_ids || [];
                            const next = selected ? cur.filter((x) => x !== s.id) : [...cur, s.id];
                            setEditing({ ...editing, service_ids: next });
                          }}
                          className={`text-xs px-2 py-1 rounded border transition ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                        >
                          {selected && "✓ "}{s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Sessions</Label><Input type="number" value={editing.sessions_count ?? 5} onChange={(e) => setEditing({ ...editing, sessions_count: parseInt(e.target.value) || 5 })} /></div>
                  <div><Label>Price</Label><Input type="number" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                  <div><Label>Currency</Label><Input value={editing.currency || "USD"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></div>
                </div>
                <div><Label>Description</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> <Label>Active</Label></div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {editing.id && <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete?")) { await remove(editing.id!); setEditing(null); } }}><Trash2 className="h-4 w-4" /></Button>}
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={async () => {
                  const payload: any = { ...editing, service_ids: editing.service_ids || [] };
                  // keep legacy single service_id in sync with first selection for back-compat
                  payload.service_id = payload.service_ids[0] ?? null;
                  if (editing.id) await update(editing.id, payload); else await create(payload);
                  setEditing(null);
                }} disabled={!editing.name}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ============== STAFF ==============
function StaffPanel() {
  const { items, create, update, remove } = useWellnessStaff();
  const [editing, setEditing] = useState<Partial<WellnessStaff> | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Staff</h3>
            <p className="text-sm text-muted-foreground">Therapists / instructors. AI offers them to customers and routes leads.</p>
          </div>
          <Button onClick={() => setEditing({ active: true, specialties: [] })}><Plus className="h-4 w-4 mr-1.5" /> Add Staff</Button>
        </div>
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(a)}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{a.name} {!a.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">{a.phone || "no phone"} · {(a.specialties || []).join(", ") || "no specialties"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No staff yet.</p>}
        </div>
        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing.id ? "Edit staff" : "New staff"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+961..." /></div>
                <div><Label>Email</Label><Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Specialties (comma-separated)</Label><Input value={(editing.specialties || []).join(", ")} onChange={(e) => setEditing({ ...editing, specialties: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="massage, yoga, facial" /></div>
                <div><Label>Bio</Label><Textarea rows={2} value={editing.bio || ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> <Label>Active</Label></div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {editing.id && <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete?")) { await remove(editing.id!); setEditing(null); } }}><Trash2 className="h-4 w-4" /></Button>}
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={async () => { if (editing.id) await update(editing.id, editing); else await create(editing); setEditing(null); }} disabled={!editing.name}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ============== FLAGGED ==============
function FlaggedPanel({ flagged, onSelectContact, onResolve }: { flagged: Contact[]; onSelectContact: (c: Contact) => void; onResolve: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
      <div className="mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Flagged for human</h3>
        <p className="text-sm text-muted-foreground">Conversations the AI escalated — angry guest, complaint, refund, or anything it couldn't handle. Reply yourself, then dismiss.</p>
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
