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
  BarChart3, Stethoscope, CalendarDays, Users, UserRound, Megaphone, AlertCircle,
  Plus, Trash2, X, ChevronLeft, ChevronRight, FlaskConical, Activity, ShieldAlert,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import {
  useHCSpecialties, useHCDoctors, useHCLeads, useHCAppointments, useHCLabResults,
  type HCSpecialty, type HCDoctor, type HCLead, type HCAppointment, type HCLabResult,
} from "@/hooks/useHealthcare";
import { addDays, addWeeks, format, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay, isToday } from "date-fns";

const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type HealthcareTab =
  | "overview" | "team" | "specialties" | "doctors" | "appointments" | "leads"
  | "labs" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues";

interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: HealthcareTab;
  onTabChange?: (t: HealthcareTab) => void;
  hideTabBar?: boolean;
  onToggleNeedsHuman?: (id: string, v: boolean) => void;
  onToggleInterested?: (id: string, v: boolean) => void;
  selectedContactId?: string | null;
}

export function HealthcareDashboard({ contacts, onSelectContact, tab: tabProp, onTabChange, onToggleNeedsHuman, onToggleInterested, selectedContactId,
  hideTabBar,}: Props) {
  const [internalTab, setInternalTab] = useState<HealthcareTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: HealthcareTab) => { setInternalTab(t); onTabChange?.(t); };
  const flagged = useMemo(() => contacts.filter((c) => c.needsHuman), [contacts]);

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
      <div className="border-b p-2 sm:p-3 bg-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as HealthcareTab)}>
          <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 w-max inline-flex px-2 sm:px-0">
              <TabsTrigger value="overview" data-tour="hc-overview" className="flex items-center gap-1.5 whitespace-nowrap"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
              <TabsTrigger value="team" data-tour="hc-team" className="flex items-center gap-1.5 whitespace-nowrap"><Stethoscope className="h-4 w-4" /> Team</TabsTrigger>
              <TabsTrigger value="appointments" data-tour="hc-appointments" className="flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="h-4 w-4" /> Calendar</TabsTrigger>
              <TabsTrigger value="leads" data-tour="hc-leads" className="flex items-center gap-1.5 whitespace-nowrap"><Activity className="h-4 w-4" /> Leads</TabsTrigger>
              <TabsTrigger value="labs" data-tour="hc-labs" className="flex items-center gap-1.5 whitespace-nowrap"><FlaskConical className="h-4 w-4" /> Labs</TabsTrigger>
              <TabsTrigger value="crm" data-tour="hc-crm" className="flex items-center gap-1.5 whitespace-nowrap"><Users className="h-4 w-4" /> CRM</TabsTrigger>
              <TabsTrigger value="interested" data-tour="hc-interested" className="gap-1.5 whitespace-nowrap flex items-center">Interested</TabsTrigger>
              <TabsTrigger value="flagged" data-tour="hc-flagged" className="flex items-center gap-1.5 whitespace-nowrap">
                <ShieldAlert className="h-4 w-4" /> Attention
                {flagged.length > 0 && <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{flagged.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="campaigns" data-tour="hc-campaigns" className="flex items-center gap-1.5 whitespace-nowrap"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
              <TabsTrigger value="ai_issues" data-tour="hc-ai-issues" className="gap-1.5 whitespace-nowrap flex items-center">AI Issues</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && <OverviewDashboard onSelectByPhone={(p) => { const c = contacts.find((x) => x.phoneNumber === p); if (c) onSelectContact(c); }} />}
          {(tab === "team" || tab === "specialties" || tab === "doctors") && (
            <TeamPanel initial={tab === "doctors" ? "doctors" : "specialties"} />
          )}
          {tab === "appointments" && <AppointmentsPanel />}
          {tab === "leads" && <LeadsPanel onSelectContact={onSelectContact} contacts={contacts} />}
          {tab === "labs" && <LabsPanel />}
          {tab === "crm" && <CrmTab contacts={contacts} orders={[]} onSelectContact={onSelectContact} />}
          {tab === "flagged" && <AttentionPanel flagged={flagged} contacts={contacts} onSelectContact={onSelectContact} onResolve={(id) => onToggleNeedsHuman?.(id, false)} />}
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

// ============== TEAM (Specialties + Doctors cascade) ==============
function TeamPanel({ initial = "specialties" }: { initial?: "specialties" | "doctors" }) {
  const [sub, setSub] = useState<"specialties" | "doctors">(initial);
  useEffect(() => { setSub(initial); }, [initial]);
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card px-3 py-2">
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            data-tour="team-specialties"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "specialties" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("specialties")}
          ><Stethoscope className="h-4 w-4" /> Specialties</button>
          <button
            data-tour="team-doctors"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "doctors" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("doctors")}
          ><UserRound className="h-4 w-4" /> Doctors</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {sub === "specialties" ? <SpecialtiesPanel /> : <DoctorsPanel />}
      </div>
    </div>
  );
}

// ============== SPECIALTIES ==============
function SpecialtiesPanel() {
  const { items, create, update, remove, loading } = useHCSpecialties();
  const [editing, setEditing] = useState<Partial<HCSpecialty> | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Specialties / departments</h3>
            <p className="text-sm text-muted-foreground">Cardiology, pediatrics, etc. — each has its own triage and urgency keywords.</p>
          </div>
          <Button onClick={() => setEditing({ active: true, triage_questions: [], urgency_keywords: [] })}><Plus className="h-4 w-4 mr-1.5" /> New</Button>
        </div>
        {loading ? <Fallback /> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No specialties yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((s) => (
              <Card key={s.id} className="cursor-pointer hover:shadow-md" onClick={() => setEditing(s)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{s.name}</p>
                    {!s.active && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">off</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.description || "—"}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(s.urgency_keywords || []).slice(0, 6).map((k, i) => (
                      <span key={i} className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">⚠ {k}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {editing && (
          <SpecialtyDialog
            value={editing}
            onClose={() => setEditing(null)}
            onSave={async (d) => { if (editing.id) await update(editing.id, d); else await create(d); setEditing(null); }}
            onDelete={editing.id ? async () => { if (confirm("Delete?")) { await remove(editing.id!); setEditing(null); } } : undefined}
          />
        )}
      </div>
    </div>
  );
}

function SpecialtyDialog({ value, onClose, onSave, onDelete }: {
  value: Partial<HCSpecialty>; onClose: () => void;
  onSave: (s: Partial<HCSpecialty>) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Partial<HCSpecialty>>(value);
  const tq = Array.isArray(f.triage_questions) ? (f.triage_questions as any[]).join("\n") : "";
  const uk = (f.urgency_keywords || []).join(", ");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Edit specialty" : "New specialty"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Cardiology, Pediatrics..." /></div>
          <div><Label>Description</Label><Textarea rows={2} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div>
            <Label>Triage questions (one per line)</Label>
            <Textarea rows={3} value={tq}
              onChange={(e) => setF({ ...f, triage_questions: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              placeholder={"Where is the pain?\nHow long has it been?\nAny fever?"} />
            <p className="text-[10px] text-muted-foreground mt-1">AI asks up to 2–3 to assess urgency. Does NOT diagnose.</p>
          </div>
          <div>
            <Label>Urgency keywords (comma-separated)</Label>
            <Input value={uk}
              onChange={(e) => setF({ ...f, urgency_keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              placeholder="chest pain, bleeding, faint, can't breathe" />
            <p className="text-[10px] text-muted-foreground mt-1">If detected in patient message → immediate doctor handoff.</p>
          </div>
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

// ============== DOCTORS ==============
function DoctorsPanel() {
  const { items, create, update, remove } = useHCDoctors();
  const { items: specs } = useHCSpecialties();
  const [editing, setEditing] = useState<Partial<HCDoctor> | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Doctors</h3>
            <p className="text-sm text-muted-foreground">Per-doctor slots & availability used by the AI for booking.</p>
          </div>
          <Button onClick={() => setEditing({ active: true })}><Plus className="h-4 w-4 mr-1.5" /> Add Doctor</Button>
        </div>
        <div className="space-y-2">
          {items.map((d) => {
            const sp = specs.find((x) => x.id === d.specialty_id);
            return (
              <Card key={d.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(d)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Dr. {d.name} {!d.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                    {sp && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{sp.name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.phone || "no phone"} · {d.email || "no email"}</p>
                </CardContent>
              </Card>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No doctors yet.</p>}
        </div>
        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing.id ? "Edit doctor" : "New doctor"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div>
                  <Label>Specialty</Label>
                  <Select value={editing.specialty_id || "none"} onValueChange={(v) => setEditing({ ...editing, specialty_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {specs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Phone</Label><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+961..." /></div>
                <div><Label>Email</Label><Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Bio</Label><Textarea rows={2} value={editing.bio || ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
                <div>
                  <Label>Availability (JSON, weekly schedule)</Label>
                  <Textarea rows={3} value={JSON.stringify(editing.availability || {}, null, 2)}
                    onChange={(e) => { try { setEditing({ ...editing, availability: JSON.parse(e.target.value) }); } catch { /* ignore */ } }}
                    placeholder='{"mon":["09:00-12:00","14:00-17:00"]}' />
                </div>
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

// ============== APPOINTMENTS (calendar) ==============
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const APPT_COLORS: Record<HCAppointment["status"], string> = {
  booked: "bg-rose-500/90 border-l-rose-700 text-white",
  completed: "bg-muted border-l-border text-muted-foreground",
  cancelled: "bg-red-200 border-l-red-500 text-red-900 line-through",
  no_show: "bg-orange-200 border-l-orange-500 text-orange-900",
};
const URGENCY_BADGE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  emergency: "bg-rose-600 text-white",
};

function AppointmentsPanel() {
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState(new Date());
  const range = useMemo(() => view === "day"
    ? { start: startOfDay(cursor), end: endOfDay(cursor) }
    : { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) }, [view, cursor]);
  const { appts, update, remove } = useHCAppointments(range.start, range.end);
  const [selected, setSelected] = useState<HCAppointment | null>(null);
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
              const dayVs = appts.filter((v) => isSameDay(new Date(v.scheduled_at), d));
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
                          className={`absolute left-1 right-1 rounded-md border-l-4 text-left px-1.5 py-1 text-xs shadow-sm ${APPT_COLORS[v.status]}`}
                          style={{ top, height }}>
                          <div className="font-semibold truncate">{v.patient_name}</div>
                          <div className="text-[10px] opacity-90">{format(s, "HH:mm")}{v.urgency_level && v.urgency_level !== "low" && ` · ${v.urgency_level}`}</div>
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
            <DialogHeader><DialogTitle>{selected.patient_name}</DialogTitle></DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {selected.patient_phone || "—"}</p>
              <p><span className="text-muted-foreground">When:</span> {format(new Date(selected.scheduled_at), "EEE MMM d, HH:mm")}</p>
              <p><span className="text-muted-foreground">Duration:</span> {selected.duration_min} min</p>
              {selected.reason && <p><span className="text-muted-foreground">Reason:</span> {selected.reason}</p>}
              {selected.triage_notes && <p className="italic text-muted-foreground">Triage: {selected.triage_notes}</p>}
              {selected.urgency_level && <p><span className="text-muted-foreground">Urgency:</span> <span className={`px-1.5 py-0.5 rounded text-[10px] ${URGENCY_BADGE[selected.urgency_level] || ""}`}>{selected.urgency_level}</span></p>}
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
const LEAD_META: Record<HCLead["status"], { label: string; hint: string; tint: string; dot: string }> = {
  new:       { label: "New enquiry",   hint: "Just messaged",          tint: "bg-sky-50 border-sky-200",        dot: "bg-sky-400" },
  triaged:   { label: "Triaged",       hint: "Screened, awaiting book", tint: "bg-amber-50 border-amber-200",   dot: "bg-amber-400" },
  booked:    { label: "Booked",        hint: "Appointment scheduled",   tint: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  urgent:    { label: "URGENT",        hint: "Routed to doctor",        tint: "bg-rose-50 border-rose-300",     dot: "bg-rose-500" },
  completed: { label: "Completed",     hint: "Visit done",              tint: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled",     hint: "Closed",                  tint: "bg-muted border-border",          dot: "bg-muted-foreground" },
};

function LeadsPanel({ contacts, onSelectContact }: { contacts: Contact[]; onSelectContact: (c: Contact) => void }) {
  const { items: leads, update, remove } = useHCLeads();
  const { items: doctors } = useHCDoctors();
  const { items: specs } = useHCSpecialties();
  const columns: HCLead["status"][] = ["new", "triaged", "booked", "urgent", "completed", "cancelled"];
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-lg">Leads</h3>
        <p className="text-sm text-muted-foreground">Pipeline of every patient enquiry the AI is handling — drag from New through Triaged, Booked and Completed.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {columns.map((col) => {
          const items = leads.filter((l) => l.status === col);
          const meta = LEAD_META[col];
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
                  const doc = doctors.find((d) => d.id === l.assigned_doctor_id);
                  const sp = specs.find((s) => s.id === l.specialty_id);
                  return (
                    <Card key={l.id} className="cursor-pointer hover:shadow-md bg-background" onClick={() => c && onSelectContact(c)}>
                      <CardContent className="p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{c?.name || c?.phoneNumber || "Patient"}</p>
                          {l.needs_human && <span className="text-[9px] bg-destructive text-destructive-foreground px-1 rounded">⚠ Human</span>}
                        </div>
                        <p className="text-[11px]"><span className="text-muted-foreground">Intent:</span> {l.intent}</p>
                        {sp && <p className="text-[11px]"><span className="text-muted-foreground">Specialty:</span> {sp.name}</p>}
                        {doc && <p className="text-[11px] text-rose-700">🩺 Dr. {doc.name}</p>}
                        {l.urgency_level && l.urgency_level !== "low" && (
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${URGENCY_BADGE[l.urgency_level] || ""}`}>{l.urgency_level}</span>
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          <Select value={l.status} onValueChange={(v) => update(l.id, { status: v as any })}>
                            <SelectTrigger className="h-6 text-[11px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                            <SelectContent>{columns.map((s) => <SelectItem key={s} value={s} className="text-xs">{LEAD_META[s].label}</SelectItem>)}</SelectContent>
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

// ============== TRIAGE ==============
function TriagePanel({ contacts, onSelectContact }: { contacts: Contact[]; onSelectContact: (c: Contact) => void }) {
  const { items: leads, update } = useHCLeads();
  const urgent = leads.filter((l) => l.urgency_level === "emergency" || l.urgency_level === "high" || l.status === "urgent");
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <h3 className="font-semibold text-lg mb-1 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Urgent triage queue</h3>
        <p className="text-sm text-muted-foreground mb-4">Patients flagged for fast doctor/nurse handoff. AI never diagnoses — these need a human now.</p>
        {urgent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No urgent cases. 🌿</p>
        ) : urgent.map((l) => {
          const c = contacts.find((x) => x.id === l.contact_id);
          return (
            <Card key={l.id} className="mb-2 border-l-4 border-l-rose-500">
              <CardContent className="p-3 flex items-center gap-3">
                <button onClick={() => c && onSelectContact(c)} className="flex-1 text-left">
                  <p className="font-medium text-sm">{c?.name || c?.phoneNumber || "Patient"}</p>
                  <p className="text-xs text-muted-foreground">{l.reason || l.notes || "—"}</p>
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${URGENCY_BADGE[l.urgency_level || "low"] || ""}`}>
                    {l.urgency_level}
                  </span>
                </button>
                <Button size="sm" variant="outline" onClick={() => update(l.id, { status: "triaged", urgency_level: "low" })}>Mark handled</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============== LABS ==============
function LabsPanel() {
  const { items, create, update, remove } = useHCLabResults();
  const [editing, setEditing] = useState<Partial<HCLabResult> | null>(null);
  const STATUS_LABEL: Record<HCLabResult["status"], string> = { pending: "Pending", ready: "Ready", delivered: "Delivered" };
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Lab results</h3>
            <p className="text-sm text-muted-foreground">Manually log a result or wait for the lab webhook. AI notifies the patient when ready.</p>
          </div>
          <Button onClick={() => setEditing({ status: "pending" })}><Plus className="h-4 w-4 mr-1.5" /> New result</Button>
        </div>
        <div className="space-y-2">
          {items.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(r)}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{r.patient_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{r.notes || "no notes"}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded ${r.status === "ready" ? "bg-amber-100 text-amber-800" : r.status === "delivered" ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No lab results yet.</p>}
        </div>
        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing.id ? "Edit lab result" : "New lab result"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Patient name</Label><Input value={editing.patient_name || ""} onChange={(e) => setEditing({ ...editing, patient_name: e.target.value })} /></div>
                <div><Label>Result URL (PDF / link)</Label><Input value={editing.result_url || ""} onChange={(e) => setEditing({ ...editing, result_url: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status || "pending"} onValueChange={(v) => setEditing({ ...editing, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ready">Ready (notify patient)</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {editing.id && <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete?")) { await remove(editing.id!); setEditing(null); } }}><Trash2 className="h-4 w-4" /></Button>}
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={async () => { if (editing.id) await update(editing.id, editing); else await create(editing); setEditing(null); }}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ============== ATTENTION (urgent triage + flagged for human, cascaded) ==============
function AttentionPanel({ flagged, contacts, onSelectContact, onResolve }: {
  flagged: Contact[]; contacts: Contact[]; onSelectContact: (c: Contact) => void; onResolve: (id: string) => void;
}) {
  const { items: leads, update } = useHCLeads();
  const urgent = leads.filter((l) => l.urgency_level === "emergency" || l.urgency_level === "high" || l.status === "urgent");
  const [sub, setSub] = useState<"urgent" | "flagged">("urgent");
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card px-3 py-2">
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            data-tour="attention-urgent"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "urgent" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("urgent")}
          ><ShieldAlert className="h-4 w-4" /> Urgent triage
            {urgent.length > 0 && <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] text-white">{urgent.length}</span>}
          </button>
          <button
            data-tour="attention-flagged"
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${sub === "flagged" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            onClick={() => setSub("flagged")}
          ><AlertCircle className="h-4 w-4" /> AI flagged
            {flagged.length > 0 && <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{flagged.length}</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sub === "urgent" ? (
          <section>
            <div className="mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Urgent triage queue</h3>
              <p className="text-sm text-muted-foreground">Patients flagged for fast doctor/nurse handoff. The AI never diagnoses — these need a human now.</p>
            </div>
            {urgent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No urgent cases. 🌿</p>
            ) : urgent.map((l) => {
              const c = contacts.find((x) => x.id === l.contact_id);
              return (
                <Card key={l.id} className="mb-2 border-l-4 border-l-rose-500">
                  <CardContent className="p-3 flex items-center gap-3">
                    <button onClick={() => c && onSelectContact(c)} className="flex-1 text-left">
                      <p className="font-medium text-sm">{c?.name || c?.phoneNumber || "Patient"}</p>
                      <p className="text-xs text-muted-foreground">{l.reason || l.notes || "—"}</p>
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${URGENCY_BADGE[l.urgency_level || "low"] || ""}`}>
                        {l.urgency_level}
                      </span>
                    </button>
                    <Button size="sm" variant="outline" onClick={() => update(l.id, { status: "triaged", urgency_level: "low" })}>Mark handled</Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <section>
            <div className="mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Flagged for human</h3>
              <p className="text-sm text-muted-foreground">Conversations the AI escalated — upset patient, complaint, sensitive request, or anything it couldn't confidently answer. Reply yourself, then dismiss.</p>
            </div>
            {flagged.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No flagged conversations.</p>
            ) : flagged.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 mb-2">
                <button onClick={() => onSelectContact(c)} className="flex-1 text-left">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phoneNumber}</p>
                </button>
                <Button variant="ghost" size="sm" onClick={() => onResolve(c.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
