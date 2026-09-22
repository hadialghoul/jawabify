import { useMemo, useState, lazy, Suspense } from 'react';
import { Contact } from '@/types/chat';
import { Order } from '@/types/order';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, UserRound, Mail, MapPin, Phone, Package, MessageSquare, Download, Upload } from 'lucide-react';

const ImportContactsDialog = lazy(() =>
  import('./ImportContactsDialog').then((m) => ({ default: m.ImportContactsDialog })),
);

// Pasted numbers often carry invisible bidi/zero-width marks or Arabic-Indic digits.
const sanitizeQuery = (v: string) =>
  v
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();

const digitsOnly = (v: string) => sanitizeQuery(v).replace(/\D/g, '');

const normalizePhoneQuery = (v: string) => {
  let d = digitsOnly(v);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
};


interface CrmTabProps {
  contacts: Contact[];
  orders: Order[];
  onSelectContact: (c: Contact) => void;
}


export function CrmTab({ contacts, orders, onSelectContact }: CrmTabProps) {
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const ordersByContact = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of orders) {
      if (!o.contactId) continue;
      const arr = m.get(o.contactId) || [];
      arr.push(o);
      m.set(o.contactId, arr);
    }
    return m;
  }, [orders]);

  const rows = useMemo(() => {
    const q = sanitizeQuery(query).toLowerCase();
    return contacts
      .map((c) => {
        const co = ordersByContact.get(c.id) || [];
        const totalSpent = co.reduce(
          (sum, o) => sum + (o.deliveryFee || 0) + (o.quantity || 0) * 0,
          0
        );
        return {
          contact: c,
          orderCount: co.length,
          totalSpent,
          lastOrderAt: co.reduce<Date | null>(
            (acc, o) => (!acc || o.createdAt > acc ? o.createdAt : acc),
            null
          ),
        };
      })
      .filter((r) => {
        if (!q) return true;
        const c = r.contact;
        const phoneQuery = normalizePhoneQuery(query);
        return (
          c.name?.toLowerCase().includes(q) ||
          (!!phoneQuery && digitsOnly(c.phoneNumber || '').includes(phoneQuery)) ||
          c.email?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      })

      // Most recent order first; clients without orders fall back to their latest activity
      // so newly imported clients are visible instead of being buried at the bottom.
      .sort((a, b) => {
        const av = a.lastOrderAt?.getTime() || a.contact.lastMessageTime?.getTime() || 0;
        const bv = b.lastOrderAt?.getTime() || b.contact.lastMessageTime?.getTime() || 0;
        return bv - av;
      });
  }, [contacts, ordersByContact, query]);

  const exportCsv = () => {
    const header = ['Name', 'Phone', 'Email', 'Address', 'Tags', 'Notes', 'Orders', 'Last order'];
    const lines = rows.map((r) => {
      const c = r.contact;
      const cells = [
        c.name || '',
        c.phoneNumber || '',
        c.email || '',
        c.address || '',
        (c.tags || []).join('; '),
        (c.notes || '').replace(/\s+/g, ' '),
        String(r.orderCount),
        r.lastOrderAt ? r.lastOrderAt.toISOString() : '',
      ];
      return cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">CRM</h3>
            <p className="text-sm text-muted-foreground">
              All clients with profile, tags, notes and order history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rows.length} clients</Badge>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email, tag, note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl">
          {rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserRound className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No clients match this search.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ contact: c, orderCount, lastOrderAt }) => (
                <div
                  key={c.id}
                  className="rounded-lg border bg-card p-3 shadow-sm hover:bg-accent/30 transition-colors flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name || c.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSelectContact(c)}
                      title="Open chat"
                      className="h-7 w-7 shrink-0"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>

                  {(c.email || c.address) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {c.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{c.address}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {c.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">"{c.notes}"</p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {orderCount} order{orderCount === 1 ? '' : 's'}
                    </span>
                    {lastOrderAt && <span>last {lastOrderAt.toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {importOpen && (
        <Suspense fallback={null}>
          <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />
        </Suspense>
      )}
    </div>
  );
}
