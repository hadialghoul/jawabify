import { useEffect, useMemo, useRef, useState } from "react";
import { useRestaurantTables, type RTable } from "@/hooks/useRestaurantTables";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-2 text-base md:text-sm";

export function TablesManager() {
  const { tables, addTable, deleteTable, updateTable } = useRestaurantTables();
  const { settings } = useRestaurantSettings();
  const floorsCount = Math.max(1, settings?.floors_count ?? 1);
  const showFloor = floorsCount > 1;
  const showArea = !!settings?.has_indoor && !!settings?.has_outdoor;
  const floorOptions = Array.from({ length: floorsCount }, (_, i) => i + 1);

  const [newLabel, setNewLabel] = useState("");
  const [newSeats, setNewSeats] = useState(4);
  const [newFloor, setNewFloor] = useState("1");
  const [newArea, setNewArea] = useState("indoor");
  const [pendingDelete, setPendingDelete] = useState<RTable | null>(null);
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, { label?: string; seats?: number }>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  const queueSave = (id: string, patch: { label?: string; seats?: number }) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      try {
        await updateTable(id, { ...patch });
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch {
        toast.error("Couldn't save the table");
      }
    }, 600);
  };

  const saveNow = async (id: string, patch: Partial<RTable>) => {
    try {
      await updateTable(id, patch);
    } catch {
      toast.error("Couldn't save the table");
    }
  };

  const value = useMemo(
    () => (t: RTable) => ({
      label: drafts[t.id]?.label ?? t.label,
      seats: drafts[t.id]?.seats ?? t.seats,
    }),
    [drafts]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full sm:w-auto">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input value={newLabel} placeholder="T7 / Patio 1" onChange={(e) => setNewLabel(e.target.value)} />
        </div>
        <div className="w-full sm:w-24">
          <label className="text-xs text-muted-foreground">Seats</label>
          <Input type="number" min={1} max={50} value={newSeats} onChange={(e) => setNewSeats(parseInt(e.target.value) || 1)} />
        </div>
        {showFloor && (
          <div className="w-full sm:w-28">
            <label className="text-xs text-muted-foreground">Floor</label>
            <select className={selectCls} value={newFloor} onChange={(e) => setNewFloor(e.target.value)}>
              {floorOptions.map((f) => <option key={f} value={f}>Floor {f}</option>)}
            </select>
          </div>
        )}
        {showArea && (
          <div className="w-full sm:w-32">
            <label className="text-xs text-muted-foreground">Area</label>
            <select className={selectCls} value={newArea} onChange={(e) => setNewArea(e.target.value)}>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
        )}
        <Button
          onClick={async () => {
            if (!newLabel.trim()) return toast.error("Add a label");
            await addTable(newLabel.trim(), newSeats, {
              floor: showFloor ? parseInt(newFloor) : null,
              seating_area: showArea ? newArea : null,
            });
            setNewLabel("");
            setNewSeats(4);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add table
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tables.map((t) => {
          const v = value(t);
          return (
            <div key={t.id} className="rounded-lg border bg-card p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1">
                <Input
                  value={v.label}
                  onChange={(e) => queueSave(t.id, { label: e.target.value })}
                  className="font-semibold h-8"
                />
                <Button variant="ghost" size="icon" onClick={() => setPendingDelete(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Seats</span>
                <Input
                  type="number"
                  value={v.seats}
                  min={1}
                  max={50}
                  onChange={(e) => queueSave(t.id, { seats: parseInt(e.target.value) || 1 })}
                  className="h-8"
                />
              </div>
              {showFloor && (
                <select
                  className={selectCls}
                  value={t.floor ?? ""}
                  onChange={(e) => saveNow(t.id, { floor: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">Any floor</option>
                  {floorOptions.map((f) => <option key={f} value={f}>Floor {f}</option>)}
                </select>
              )}
              {showArea && (
                <select
                  className={selectCls}
                  value={t.seating_area ?? ""}
                  onChange={(e) => saveNow(t.id, { seating_area: e.target.value || null })}
                >
                  <option value="">Any area</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              )}
            </div>
          );
        })}
        {tables.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">
            No tables yet. Add your first one above.
          </p>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing reservations and bills stay, but they will no longer be linked to this table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                setSaving(true);
                try {
                  await deleteTable(pendingDelete.id);
                  toast.success("Table deleted");
                  setPendingDelete(null);
                } catch {
                  toast.error("Couldn't delete the table");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
