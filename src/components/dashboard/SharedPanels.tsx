import { lazy, Suspense } from "react";
import type { Contact } from "@/types/chat";
import type { Order } from "@/types/order";

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
}: InterestedPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
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
