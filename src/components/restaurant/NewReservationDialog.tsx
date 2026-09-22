import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { parseTimeInput } from "@/lib/parseTime";
import type { RTable } from "@/hooks/useRestaurantTables";
import { toast } from "sonner";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tables: RTable[];
  defaultDate: Date;
  defaultTime?: string; // "HH:mm"
  defaultTableId?: string | null;
  defaultGuestName?: string;
  defaultGuestPhone?: string;
  onCreate: (data: {
    table_id: string | null;
    guest_name: string;
    guest_phone: string;
    party_size: number;
    starts_at: string;
    ends_at: string;
    notes: string;
  }) => Promise<void>;
}

function toLocalIso(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function NewReservationDialog({
  open, onOpenChange, tables, defaultDate, defaultTime, defaultTableId, defaultGuestName, defaultGuestPhone, onCreate,
}: Props) {
  const [tableId, setTableId] = useState<string>(defaultTableId ?? "");
  const [date, setDate] = useState<Date>(defaultDate);
  const [timeRaw, setTimeRaw] = useState(defaultTime ?? "7:00 pm");
  const [duration, setDuration] = useState(90);
  const [name, setName] = useState(defaultGuestName ?? "");
  const [phone, setPhone] = useState(defaultGuestPhone ?? "");
  const [party, setParty] = useState(2);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTableId(defaultTableId ?? "");
      setDate(defaultDate);
      setTimeRaw(defaultTime ?? "7:00 pm");
      setName(defaultGuestName ?? "");
      setPhone(defaultGuestPhone ?? "");
      setParty(2);
      setDuration(90);
      setNotes("");
    }
  }, [open, defaultDate, defaultTableId, defaultTime, defaultGuestName, defaultGuestPhone]);

  const parsedTime = parseTimeInput(timeRaw);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New reservation</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Guest name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Party size</Label>
              <Input type="number" min={1} value={party} onChange={(e) => setParty(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                value={timeRaw}
                onChange={(e) => setTimeRaw(e.target.value)}
                placeholder="7 30 or 7:30 pm"
                className={!parsedTime ? "border-destructive" : ""}
              />
              {parsedTime && <p className="text-[10px] text-muted-foreground mt-0.5">→ {parsedTime}</p>}
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={30} step={15} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 90)} />
            </div>
          </div>

          <div>
            <Label>Table</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger><SelectValue placeholder="Auto-assign or pick a table" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Auto-assign (first fitting)</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label} · {t.seats} seats</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, occasion, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!name.trim()) return toast.error("Guest name required");
              if (!parsedTime) return toast.error("Time format not recognized — try '7 30' or '7:30 pm'");
              setSaving(true);
              try {
                const starts = toLocalIso(date, parsedTime);
                const ends = new Date(starts.getTime() + duration * 60_000);
                let resolvedTable: string | null = null;
                if (tableId && tableId !== "__auto__") {
                  resolvedTable = tableId;
                } else {
                  const fit = tables.filter((t) => t.seats >= party).sort((a, b) => a.seats - b.seats)[0];
                  resolvedTable = fit?.id ?? tables[0]?.id ?? null;
                }

                await onCreate({
                  table_id: resolvedTable,
                  guest_name: name.trim(),
                  guest_phone: phone.trim(),
                  party_size: party,
                  starts_at: starts.toISOString(),
                  ends_at: ends.toISOString(),
                  notes,
                });
                toast.success("Reservation added");
                onOpenChange(false);
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              } finally { setSaving(false); }
            }}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
