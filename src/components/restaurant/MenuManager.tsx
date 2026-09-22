import { useState } from "react";
import { useMenu, type MenuItem } from "@/hooks/useMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ModifierEditor } from "./ModifierEditor";
import { MenuFileImportCard } from "./MenuFileImportCard";
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

const CURRENCIES = ["USD", "LBP", "EUR", "GBP", "AED"];

export function MenuManager() {
  const { categories, items, loading, refetch, addCategory, deleteCategory, addItem, updateItem, deleteItem } = useMenu();
  const [newCat, setNewCat] = useState("");
  const [newItem, setNewItem] = useState({ category_id: "", name: "", price: "", currency: "USD", description: "" });
  const [query, setQuery] = useState("");
  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);

  const q = query.trim().toLowerCase();
  const visibleItems = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q))
    : items;
  const catToDeleteCount = catToDelete ? items.filter((i) => i.category_id === catToDelete.id).length : 0;

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading menu...</p>;

  return (
    <div className="space-y-6">
      {/* Import from PDF / image */}
      <MenuFileImportCard onImported={refetch} />

      {/* Add category */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="font-semibold mb-2">Categories</h4>
        <div className="flex gap-2 mb-3">
          <Input value={newCat} placeholder="e.g. Appetizers, Pizzas, Drinks" onChange={(e) => setNewCat(e.target.value)} />
          <Button
            onClick={async () => {
              if (!newCat.trim()) return;
              try {
                await addCategory(newCat.trim());
                setNewCat("");
                toast.success("Category added");
              } catch (e: any) {
                toast.error(e?.message || "Could not add category");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
              {c.name}
              <button
                onClick={() => setCatToDelete({ id: c.id, name: c.name })}
                className="text-muted-foreground hover:text-destructive"
                title="Delete category"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      </div>

      {/* Add item */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="font-semibold mb-2">Add menu item</h4>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-3">
            <Select value={newItem.category_id} onValueChange={(v) => setNewItem({ ...newItem, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input className="sm:col-span-4" placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          <Input className="sm:col-span-2" type="number" step="0.01" placeholder="Price" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
          <div className="sm:col-span-1">
            <Select value={newItem.currency} onValueChange={(v) => setNewItem({ ...newItem, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="sm:col-span-2"
            onClick={async () => {
              if (!newItem.name.trim() || !newItem.price) return toast.error("Name and price required");
              try {
                await addItem({
                  category_id: newItem.category_id || null,
                  name: newItem.name.trim(),
                  price: parseFloat(newItem.price),
                  currency: newItem.currency,
                  description: newItem.description || undefined,
                });
                setNewItem({ category_id: newItem.category_id, name: "", price: "", currency: newItem.currency, description: "" });
                toast.success("Item added");
              } catch (e: any) {
                toast.error(e?.message || "Could not add item");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add item
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search menu items..."
          className="pl-9 pr-9 text-base"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Items list grouped */}
      <div className="space-y-4">
        {categories.map((c) => {
          const catItems = visibleItems.filter((i) => i.category_id === c.id);
          if (catItems.length === 0) return null;
          return (
            <div key={c.id}>
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">{c.name}</h4>
              <div className="space-y-2">
                {catItems.map((i) => <Row key={i.id} item={i} onUpdate={updateItem} onDelete={deleteItem} />)}
              </div>
            </div>
          );
        })}
        {(() => {
          const uncat = visibleItems.filter((i) => !i.category_id);
          if (uncat.length === 0) return null;
          return (
            <div>
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">Uncategorized</h4>
              <div className="space-y-2">
                {uncat.map((i) => <Row key={i.id} item={i} onUpdate={updateItem} onDelete={deleteItem} />)}
              </div>
            </div>
          );
        })()}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No menu items yet.</p>}
        {items.length > 0 && visibleItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No items match "{query}".</p>
        )}
      </div>

      <AlertDialog open={!!catToDelete} onOpenChange={(o) => !o && setCatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{catToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {catToDeleteCount > 0
                ? `This will also permanently delete the ${catToDeleteCount} item${catToDeleteCount === 1 ? "" : "s"} in this category.`
                : "This category is empty and will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!catToDelete) return;
                try {
                  await deleteCategory(catToDelete.id);
                  toast.success(catToDeleteCount > 0 ? `Category and ${catToDeleteCount} item(s) removed` : "Category removed");
                } catch (e: any) {
                  toast.error(e?.message || "Could not delete category");
                } finally {
                  setCatToDelete(null);
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

function Row({ item, onUpdate, onDelete }: { item: MenuItem; onUpdate: (id: string, patch: Partial<MenuItem>) => any; onDelete: (id: string) => any }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="flex-1 min-w-[140px] h-9" defaultValue={item.name} onBlur={(e) => e.target.value !== item.name && onUpdate(item.id, { name: e.target.value })} />
        <Input className="w-24 h-9" type="number" step="0.01" defaultValue={item.price} onBlur={(e) => Number(e.target.value) !== item.price && onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })} />
        <span className="text-xs text-muted-foreground">{item.currency}</span>
        <div className="flex items-center gap-1.5">
          <Switch checked={item.is_available} onCheckedChange={(v) => onUpdate(item.id, { is_available: v })} />
          <span className="text-xs">{item.is_available ? "Available" : "Hidden"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <ModifierEditor menuItemId={item.id} />
    </div>
  );
}
