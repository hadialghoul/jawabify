import { useState, lazy, Suspense, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, BookOpen, Users, GraduationCap, Megaphone, AlertCircle,
  Plus, Trash2, CalendarDays, CreditCard,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import {
  useEduCourses, useEduLeads, useEduEnrollments,
  type EduCourse, type EduLead, type EduEnrollment,
} from "@/hooks/useEducation";
import { format } from "date-fns";

const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type EducationTab =
  | "overview" | "courses" | "leads" | "enrollments" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues";

interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: EducationTab;
  onTabChange?: (t: EducationTab) => void;
  hideTabBar?: boolean;
  onToggleNeedsHuman?: (id: string, v: boolean) => void;
  onToggleInterested?: (id: string, v: boolean) => void;
  selectedContactId?: string | null;
}

export function EducationDashboard({ contacts, onSelectContact, tab: tabProp, onTabChange, onToggleNeedsHuman, onToggleInterested, selectedContactId,
  hideTabBar,}: Props) {
  const [internalTab, setInternalTab] = useState<EducationTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: EducationTab) => { setInternalTab(t); onTabChange?.(t); };

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
      <div className="border-b p-2 sm:p-3 bg-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EducationTab)}>
          <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 w-max sm:w-auto inline-flex sm:flex px-2 sm:px-0">
              <TabsTrigger value="overview" className="gap-1.5 whitespace-nowrap" data-tour="edu-overview"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="courses" className="gap-1.5 whitespace-nowrap" data-tour="edu-courses"><BookOpen className="h-3.5 w-3.5" />Courses</TabsTrigger>
              <TabsTrigger value="leads" className="gap-1.5 whitespace-nowrap" data-tour="edu-leads"><Users className="h-3.5 w-3.5" />Leads</TabsTrigger>
              <TabsTrigger value="enrollments" className="gap-1.5 whitespace-nowrap" data-tour="edu-enrollments"><GraduationCap className="h-3.5 w-3.5" />Enrollments</TabsTrigger>
              <TabsTrigger value="crm" className="gap-1.5 whitespace-nowrap" data-tour="edu-crm"><Users className="h-3.5 w-3.5" />CRM</TabsTrigger>
              <TabsTrigger value="interested" data-tour="edu-interested" className="gap-1.5 whitespace-nowrap flex items-center">Interested</TabsTrigger>
              <TabsTrigger value="flagged" className="gap-1.5 whitespace-nowrap" data-tour="edu-flagged"><AlertCircle className="h-3.5 w-3.5" />Flagged</TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-1.5 whitespace-nowrap" data-tour="edu-campaigns"><Megaphone className="h-3.5 w-3.5" />Campaigns</TabsTrigger>
              <TabsTrigger value="ai_issues" data-tour="edu-ai-issues" className="gap-1.5 whitespace-nowrap flex items-center">AI Issues</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && <OverviewDashboard onSelectByPhone={(p) => { const c = contacts.find((x) => x.phoneNumber === p); if (c) onSelectContact(c); }} />}
          {tab === "courses" && <CoursesPanel />}
          {tab === "leads" && <LeadsPanel />}
          {tab === "enrollments" && <EnrollmentsPanel />}
          {tab === "crm" && <CrmTab contacts={contacts} orders={[]} onSelectContact={onSelectContact} />}
          {tab === "flagged" && <FlaggedPanel contacts={contacts} onSelectContact={onSelectContact} onToggleNeedsHuman={onToggleNeedsHuman} />}
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

// =============== Courses ===============
function CoursesPanel() {
  const { items, create, update, remove } = useEduCourses();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<EduCourse> | null>(null);

  const blank: Partial<EduCourse> = {
    name: "", subject: "", level: "", age_group: "", description: "",
    price: 0, currency: "USD", schedule: "", capacity: 20,
    payment_options: ["full"], trial_available: false, active: true, payment_link_url: "",
  };

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Course catalog</h3>
          <p className="text-xs text-muted-foreground">Name, age, price, schedule, capacity, payment options.</p>
        </div>
        <Button size="sm" onClick={() => { setEdit({ ...blank }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add course</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Card key={c.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.name}</span>
                    {!c.active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[c.subject, c.level, c.age_group].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{c.currency} {Number(c.price).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">cap. {c.capacity}</div>
                </div>
              </div>
              {c.schedule && <div className="text-xs flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{c.schedule}</div>}
              <div className="flex flex-wrap gap-1">
                {(c.payment_options || []).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] capitalize">{p}</Badge>
                ))}
                {c.trial_available && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">trial</Badge>}
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground col-span-full">
            No courses yet. Add your first course so the AI can answer enrollment questions.
          </CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>{edit?.id ? "Edit course" : "Add course"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label>Name</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div><Label>Subject</Label><Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
                <div><Label>Level</Label><Input value={edit.level ?? ""} onChange={(e) => setEdit({ ...edit, level: e.target.value })} /></div>
                <div><Label>Age group</Label><Input placeholder="e.g. 6-9" value={edit.age_group ?? ""} onChange={(e) => setEdit({ ...edit, age_group: e.target.value })} /></div>
                <div><Label>Schedule</Label><Input placeholder="Mon/Wed 5–6pm" value={edit.schedule ?? ""} onChange={(e) => setEdit({ ...edit, schedule: e.target.value })} /></div>
                <div><Label>Price</Label><Input type="number" value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></div>
                <div><Label>Currency</Label><Input value={edit.currency ?? "USD"} onChange={(e) => setEdit({ ...edit, currency: e.target.value })} /></div>
                <div><Label>Capacity</Label><Input type="number" value={edit.capacity ?? 20} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></div>
                <div><Label>Start date</Label><Input type="date" value={edit.start_date ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value || null })} /></div>
              </div>
              <div>
                <Label>Payment options</Label>
                <div className="flex gap-3 mt-1 text-sm">
                  {(["full", "installment", "trial"] as const).map((opt) => {
                    const sel = (edit.payment_options || []).includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox" checked={sel}
                          onChange={() => {
                            const cur = new Set(edit.payment_options || []);
                            sel ? cur.delete(opt) : cur.add(opt);
                            setEdit({ ...edit, payment_options: Array.from(cur) });
                          }}
                        />
                        <span className="capitalize">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="trial" checked={!!edit.trial_available} onChange={(e) => setEdit({ ...edit, trial_available: e.target.checked })} />
                <Label htmlFor="trial">Trial class available</Label>
              </div>
              <div><Label>Payment link (optional)</Label><Input value={edit.payment_link_url ?? ""} onChange={(e) => setEdit({ ...edit, payment_link_url: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!edit?.name) return;
              if (edit.id) await update(edit.id, edit);
              else await create(edit);
              setOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============== Leads ===============
const LEAD_STATUS: Record<EduLead["status"], { label: string; cls: string }> = {
  new: { label: "New enquiry", cls: "bg-slate-50 border-slate-200" },
  interested: { label: "Interested", cls: "bg-blue-50 border-blue-200" },
  trial_booked: { label: "Trial booked", cls: "bg-amber-50 border-amber-200" },
  enrolled: { label: "Enrolled", cls: "bg-emerald-50 border-emerald-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 border-emerald-300" },
  lost: { label: "Lost", cls: "bg-rose-50 border-rose-200" },
};

function LeadsPanel() {
  const { items, update, remove } = useEduLeads();
  const { items: courses } = useEduCourses();
  const cols = useMemo(() => {
    const by: Record<string, EduLead[]> = { new: [], interested: [], trial_booked: [], enrolled: [], completed: [], lost: [] };
    for (const l of items) by[l.status]?.push(l);
    return by;
  }, [items]);

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">Leads pipeline</h3>
        <p className="text-xs text-muted-foreground">Parents/students captured from WhatsApp — drag through stages as they convert.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(LEAD_STATUS) as EduLead["status"][]).map((k) => (
          <div key={k} className={`rounded-md border p-2 min-h-[120px] ${LEAD_STATUS[k].cls}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center justify-between">
              <span>{LEAD_STATUS[k].label}</span>
              <span className="text-muted-foreground">{cols[k]?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {cols[k]?.map((l) => {
                const course = courses.find((c) => c.id === l.course_id);
                return (
                  <Card key={l.id} className="bg-card">
                    <CardContent className="p-2 text-xs space-y-1">
                      <div className="font-medium">{l.student_name || l.parent_name || "Unnamed"}</div>
                      {l.student_age && <div className="text-[10px] text-muted-foreground">Age {l.student_age}</div>}
                      {course && <div className="text-[10px]">📘 {course.name}</div>}
                      {l.parent_phone && <div className="text-[10px] text-muted-foreground">{l.parent_phone}</div>}
                      {l.needs_human && <Badge variant="destructive" className="text-[9px]">needs human</Badge>}
                      <div className="flex justify-between items-center pt-1">
                        <Select value={l.status} onValueChange={(v) => update(l.id, { status: v as any })}>
                          <SelectTrigger className="h-6 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(LEAD_STATUS) as EduLead["status"][]).map((s) => (
                              <SelectItem key={s} value={s}>{LEAD_STATUS[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => remove(l.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============== Enrollments ===============
function EnrollmentsPanel() {
  const { items, update, remove } = useEduEnrollments();
  const { items: courses } = useEduCourses();

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div>
        <h3 className="text-base font-semibold">Enrollments</h3>
        <p className="text-xs text-muted-foreground">Confirmed students. Payment status and weekly progress reminders flow from here.</p>
      </div>
      <div className="grid gap-2">
        {items.map((e) => {
          const course = courses.find((c) => c.id === e.course_id);
          return (
            <Card key={e.id}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{e.student_name}{e.student_age ? ` · age ${e.student_age}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {course?.name || "(no course)"} · {e.parent_name ?? "—"} · {e.parent_phone ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize text-[10px]">{e.plan_type}</Badge>
                <div className="flex items-center gap-1 text-[10px]">
                  <CreditCard className="h-3 w-3" />
                  <span className="capitalize">{e.payment_status}</span>
                  {e.amount_paid > 0 && <span>· {course?.currency || "USD"} {Number(e.amount_paid).toFixed(2)}</span>}
                </div>
                <Select value={e.status} onValueChange={(v) => update(e.id, { status: v as any })}>
                  <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            No enrollments yet. They'll appear here automatically when the AI confirms a paid spot.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

// =============== Flagged ===============
function FlaggedPanel({ contacts, onSelectContact, onToggleNeedsHuman }: { contacts: Contact[]; onSelectContact: (c: Contact) => void; onToggleNeedsHuman?: (id: string, v: boolean) => void; }) {
  const flagged = contacts.filter((c) => c.needsHuman);
  return (
    <div className="p-3 sm:p-4 space-y-2">
      <h3 className="text-base font-semibold">Flagged for human</h3>
      <p className="text-xs text-muted-foreground">Conversations the AI handed over — an upset parent, a question it couldn't answer, or someone who specifically asked to speak to a human. Reply yourself, then tap Resolve to clear.</p>
      {flagged.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No flagged conversations.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {flagged.map((c) => (
            <Card key={c.id} className="hover:shadow-sm cursor-pointer" onClick={() => onSelectContact(c)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name || c.phoneNumber}</div>
                  <div className="text-xs text-muted-foreground">{c.phoneNumber}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggleNeedsHuman?.(c.id, false); }}>
                  Resolve
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
