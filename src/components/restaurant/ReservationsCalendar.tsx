import { useMemo, useRef, useState, useEffect } from "react";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";
import { useReservations, type Reservation } from "@/hooks/useReservations";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  addDays, addWeeks, format, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay, isToday,
} from "date-fns";
import { NewReservationDialog } from "./NewReservationDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const HOUR_HEIGHT = 56; // px per hour (GCal feel)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const STATUS_COLORS: Record<Reservation["status"], string> = {
  confirmed: "bg-emerald-500/90 border-l-emerald-700 text-white",
  seated: "bg-blue-500/90 border-l-blue-700 text-white",
  completed: "bg-muted border-l-border text-muted-foreground",
  cancelled: "bg-red-200 border-l-red-500 text-red-900 line-through",
  no_show: "bg-orange-200 border-l-orange-500 text-orange-900",
};

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function topPx(d: Date) {
  return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
}

export function ReservationsCalendar() {
  const [view, setView] = useState<"day" | "week">("week");
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaults, setDefaults] = useState<{ date?: Date; time?: string }>({});
  const [selected, setSelected] = useState<Reservation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { tables } = useRestaurantTables();

  const range = useMemo(() => {
    if (view === "day") return { start: startOfDay(cursor), end: endOfDay(cursor) };
    return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
  }, [view, cursor]);

  const { reservations, create, update, remove } = useReservations(range.start, range.end);

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
  }, [view]);

  const shift = (n: number) => setCursor(view === "day" ? addDays(cursor, n) : addWeeks(cursor, n));

  const openCreateAt = (date: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = Math.max(0, Math.round((y / HOUR_HEIGHT) * 60 / 15) * 15);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    setDefaults({ date, time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="border-b bg-card px-3 py-2 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <div className="flex">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="ml-1 text-xl font-normal">
            {view === "day"
              ? format(cursor, "EEEE, MMMM d")
              : `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${view === "day" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("day")}
            >Day</button>
            <button
              className={`px-3 py-1.5 text-sm ${view === "week" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("week")}
            >Week</button>
          </div>
          <Button size="sm" onClick={() => { setDefaults({ date: cursor }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Create
          </Button>
        </div>
      </div>

      {/* Calendar body */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {view === "day"
          ? <TimelineGrid days={[cursor]} reservations={reservations} tables={tables} onSlotClick={openCreateAt} onEventClick={setSelected} />
          : <TimelineGrid days={Array.from({ length: 7 }).map((_, i) => addDays(range.start, i))} reservations={reservations} tables={tables} onSlotClick={openCreateAt} onEventClick={setSelected} />}
      </div>

      <NewReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tables={tables}
        defaultDate={defaults.date ?? cursor}
        defaultTime={defaults.time}
        defaultTableId={null}
        onCreate={async (data) => {
          await create({
            ...data,
            tenant_id: "" as any,
            contact_id: null,
            status: "confirmed",
            source: "manual",
          } as any);
        }}
      />

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selected.guest_name}
                {selected.source === "ai" && (
                  <span className="inline-flex items-center gap-1 text-xs rounded-full bg-purple-100 text-purple-700 px-2 py-0.5">
                    <Sparkles className="h-3 w-3" /> AI
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {selected.guest_phone || "—"}</p>
              <p><span className="text-muted-foreground">Party:</span> {selected.party_size}</p>
              <p><span className="text-muted-foreground">When:</span> {format(new Date(selected.starts_at), "EEE MMM d, HH:mm")} – {format(new Date(selected.ends_at), "HH:mm")}</p>
              <p><span className="text-muted-foreground">Table:</span> {tables.find((t) => t.id === selected.table_id)?.label ?? "—"}</p>
              {selected.notes && <p className="text-muted-foreground italic">{selected.notes}</p>}
              <p className="pt-2"><span className="text-muted-foreground">Status:</span> {selected.status}</p>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {selected.status === "confirmed" && (
                <Button size="sm" onClick={async () => { await update(selected.id, { status: "seated" }); setSelected(null); }}>Mark seated</Button>
              )}
              {selected.status === "seated" && (
                <Button size="sm" onClick={async () => { await update(selected.id, { status: "completed" }); setSelected(null); }}>Mark completed</Button>
              )}
              <Button size="sm" variant="outline" onClick={async () => { await update(selected.id, { status: "cancelled" }); setSelected(null); }}>Cancel</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete this reservation?")) { await remove(selected.id); setSelected(null); } }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TimelineGrid({
  days, reservations, tables, onSlotClick, onEventClick,
}: {
  days: Date[];
  reservations: Reservation[];
  tables: ReturnType<typeof useRestaurantTables>["tables"];
  onSlotClick: (date: Date, e: React.MouseEvent<HTMLDivElement>) => void;
  onEventClick: (r: Reservation) => void;
}) {
  return (
    <div className="flex min-w-max">
      {/* Hour gutter */}
      <div className="w-14 shrink-0 border-r bg-background sticky left-0 z-20">
        <div className="h-12 border-b bg-card" />
        {HOURS.map((h) => (
          <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
            <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground bg-background px-1">
              {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
            </span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1">
        {days.map((d) => {
          const dayRes = reservations.filter((r) => isSameDay(new Date(r.starts_at), d));
          return (
            <div key={d.toISOString()} className={`flex-1 min-w-[140px] border-r ${days.length === 1 ? "min-w-[500px]" : ""}`}>
              {/* Day header */}
              <div className="h-12 border-b bg-card sticky top-0 z-10 flex flex-col items-center justify-center">
                <span className="text-[11px] uppercase text-muted-foreground tracking-wide">{format(d, "EEE")}</span>
                <span className={`text-lg leading-none ${isToday(d) ? "bg-primary text-primary-foreground rounded-full h-7 w-7 inline-flex items-center justify-center" : ""}`}>
                  {format(d, "d")}
                </span>
              </div>

              {/* Hour grid + events */}
              <div className="relative">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    onClick={(e) => {
                      const newDate = new Date(d);
                      newDate.setHours(h, 0, 0, 0);
                      onSlotClick(newDate, e);
                    }}
                    className="border-b hover:bg-primary/5 cursor-pointer relative"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {/* half-hour divider */}
                    <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-border/40" />
                  </div>
                ))}

                {/* Now line */}
                {isToday(d) && <NowLine />}

                {/* Reservation blocks */}
                {dayRes.map((r) => {
                  const starts = new Date(r.starts_at);
                  const ends = new Date(r.ends_at);
                  const top = topPx(starts);
                  const height = Math.max(24, topPx(ends) - top - 2);
                  const tableLabel = tables.find((t) => t.id === r.table_id)?.label;
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(r); }}
                      className={`absolute left-1 right-1 rounded-md border-l-4 text-left px-1.5 py-1 text-xs shadow-sm hover:shadow-md transition-shadow ${STATUS_COLORS[r.status]}`}
                      style={{ top, height }}
                    >
                      <div className="font-semibold truncate flex items-center gap-1">
                        {r.guest_name}
                        {r.source === "ai" && <Sparkles className="h-3 w-3 shrink-0" />}
                      </div>
                      <div className="text-[10px] opacity-90 truncate">
                        {hhmm(starts)} · {r.party_size}p{tableLabel ? ` · ${tableLabel}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NowLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute left-0 right-0 z-[5] pointer-events-none" style={{ top: topPx(now) }}>
      <div className="h-0.5 bg-red-500" />
      <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
    </div>
  );
}
