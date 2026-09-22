import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useMenuModifiers, type ModifierOption } from "@/hooks/useMenuModifiers";

export function ModifierEditor({ menuItemId }: { menuItemId: string }) {
  const { modifiers, addGroup, updateGroup, deleteGroup } = useMenuModifiers();
  const groups = modifiers.filter((m) => m.menu_item_id === menuItemId);
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Modifiers {groups.length > 0 && <span>({groups.length})</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-2 pl-4 border-l">
          {groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              onUpdate={(p) => updateGroup(g.id, p)}
              onDelete={() => deleteGroup(g.id)}
            />
          ))}

          <div className="flex gap-2">
            <Input
              className="h-8 text-sm"
              placeholder="Group name (e.g. Size, Extras)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!newGroupName.trim()) return;
                await addGroup(menuItemId, newGroupName.trim());
                setNewGroupName("");
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({ group, onUpdate, onDelete }: any) {
  const [options, setOptions] = useState<ModifierOption[]>(group.options || []);
  const [newOpt, setNewOpt] = useState({ name: "", price_delta: "" });

  const save = (opts: ModifierOption[]) => {
    setOptions(opts);
    onUpdate({ options: opts });
  };

  return (
    <div className="rounded-md border bg-card/50 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="h-7 text-sm flex-1"
          defaultValue={group.group_name}
          onBlur={(e) => e.target.value !== group.group_name && onUpdate({ group_name: e.target.value })}
        />
        <div className="flex items-center gap-1 text-xs">
          <Switch checked={group.required} onCheckedChange={(v) => onUpdate({ required: v })} />
          <span>Required</span>
        </div>
        <Input
          className="w-14 h-7 text-sm"
          type="number"
          min={1}
          defaultValue={group.max_select}
          title="Max selectable"
          onBlur={(e) => Number(e.target.value) !== group.max_select && onUpdate({ max_select: parseInt(e.target.value) || 1 })}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      <div className="space-y-1">
        {options.map((o, idx) => (
          <div key={idx} className="flex gap-1 items-center">
            <Input
              className="h-7 text-sm flex-1"
              value={o.name}
              onChange={(e) => save(options.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
            />
            <Input
              className="w-20 h-7 text-sm"
              type="number"
              step="0.01"
              value={o.price_delta}
              onChange={(e) => save(options.map((x, i) => i === idx ? { ...x, price_delta: parseFloat(e.target.value) || 0 } : x))}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => save(options.filter((_, i) => i !== idx))}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-1">
          <Input
            className="h-7 text-sm flex-1"
            placeholder="Option name"
            value={newOpt.name}
            onChange={(e) => setNewOpt({ ...newOpt, name: e.target.value })}
          />
          <Input
            className="w-20 h-7 text-sm"
            type="number"
            step="0.01"
            placeholder="+$"
            value={newOpt.price_delta}
            onChange={(e) => setNewOpt({ ...newOpt, price_delta: e.target.value })}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              if (!newOpt.name.trim()) return;
              save([...options, { name: newOpt.name.trim(), price_delta: parseFloat(newOpt.price_delta) || 0 }]);
              setNewOpt({ name: "", price_delta: "" });
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
