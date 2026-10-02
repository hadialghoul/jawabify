import { lazy, Suspense, useMemo } from "react";
import { MessageCircleQuestion, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/types/chat";
import type { Order } from "@/types/order";

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const phoneMatches = (a?: string | null, b?: string | null) => {
  const da = digits(a);
  const db = digits(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
};

/** Contacts who messaged but never placed an order. */
export function contactsWithoutOrders(contacts: Contact[], orders: Order[]): Contact[] {
  return contacts
    .filter(
      (c) =>
        !orders.some(
          (o) =>
            (o.contactId && o.contactId === c.id) ||
            phoneMatches(o.customerPhone, c.phoneNumber),
        ),
    )
    .sort((a, b) => {
      const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return tb - ta;
    });
}

const InterestedDashboard = lazy(() =>
  import("@/components/chat/InterestedDashboard").then((m) => ({ default: m.InterestedDashboard })),
);
const AIIssuesTab = lazy(() =>
  import("@/components/dashboard/AIIssuesTab").then((m) => ({ default: m.AIIssuesTab })),
);

const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

interface InterestedPanelProps {
  contacts: Contact[];
  orders?: Order[];
  selectedContactId?: string | null;
  onSelectContact: (c: Contact) => void;
  onToggleInterested?: (contactId: string, value: boolean) => void;
  title?: string;
  subtitle?: string;
}

export function InterestedPanel({
  contacts,
  orders = [],
  selectedContactId = null,
  onSelectContact,
  onToggleInterested,
  title = "Interested customers",
  subtitle = "People the AI marked as ready to buy or book — a warm list to follow up on.",
  onCampaign,
}: InterestedPanelProps & { onCampaign?: () => void }) {
  const list = contacts.filter((c) => c.isInterested);
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onCampaign && list.length > 0 && (
          <Button size="sm" onClick={onCampaign} className="shrink-0">
            <Megaphone className="h-4 w-4 mr-1" /> Campaign ({list.length})
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          <InterestedDashboard
            contacts={contacts}
            orders={orders}
            selectedContactId={selectedContactId}
            onSelectContact={onSelectContact}
            onUnflag={(id) => onToggleInterested?.(id, false)}
          />
        </Suspense>
      </div>
    </div>
  );
}

interface NoOrderPanelProps {
  contacts: Contact[];
  orders: Order[];
  selectedContactId?: string | null;
  onSelectContact: (c: Contact) => void;
  title?: string;
  subtitle?: string;
  onCampaign?: () => void;
}

export function NoOrderPanel({
  contacts,
  orders,
  selectedContactId = null,
  onSelectContact,
  title = "Asked, no order yet",
  subtitle = "People who messaged you but haven't ordered — follow up while they're still warm.",
  onCampaign,
}: NoOrderPanelProps) {
  const list = useMemo(() => contactsWithoutOrders(contacts, orders), [contacts, orders]);
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onCampaign && list.length > 0 && (
          <Button size="sm" onClick={onCampaign} className="shrink-0">
            <Megaphone className="h-4 w-4 mr-1" /> Campaign ({list.length})
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
            <MessageCircleQuestion className="h-8 w-8" />
            <p className="text-sm">Everyone who messaged you has ordered. Nice.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelectContact(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors ${
                    selectedContactId === c.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name || c.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.lastMessage || c.phoneNumber}
                      </p>
                    </div>
                    {c.lastMessageTime && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(c.lastMessageTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AiIssuesPanel({
  contacts,
  onSelectContact,
}: {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
}) {
  return (
    <Suspense fallback={<Fallback />}>
      <AIIssuesTab
        onSelectContact={(phone) => {
          const c = contacts.find((x) => x.phoneNumber === phone);
          if (c) onSelectContact(c);
        }}
      />
    </Suspense>
  );
}
