import { useState, lazy, Suspense, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ListOrdered,
  CalendarDays,
  BookOpen,
  LayoutGrid,
  Users,
  Megaphone,
  AlertCircle,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import type { Contact } from "@/types/chat";
import type { Order } from "@/types/order";
import { useOrders } from "@/hooks/useOrders";
import { RestaurantNewOrderDialog } from "@/components/restaurant/RestaurantNewOrderDialog";
import { InterestedPanel, AiIssuesPanel } from "@/components/dashboard/SharedPanels";

const OverviewDashboard = lazy(() => import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })));
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
const CampaignsTab = lazy(() => import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })));
const OrdersList = lazy(() => import("@/components/orders/OrdersList").then((m) => ({ default: m.OrdersList })));
const ReservationsCalendar = lazy(() => import("./ReservationsCalendar").then((m) => ({ default: m.ReservationsCalendar })));
const MenuManager = lazy(() => import("./MenuManager").then((m) => ({ default: m.MenuManager })));
const TablesManager = lazy(() => import("./TablesManager").then((m) => ({ default: m.TablesManager })));


const Fallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

export type RestaurantTab =
  | "overview"
  | "orders"
  | "reservations"
  | "menu"
  | "tables"
  | "crm"
  | "flagged"
  | "campaigns"
  | "interested"
  | "ai_issues";


interface Props {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  tab?: RestaurantTab;
  onTabChange?: (t: RestaurantTab) => void;
  hideTabBar?: boolean;
  onToggleInterested?: (contactId: string, value: boolean) => void;
  onToggleNeedsHuman?: (contactId: string, value: boolean) => void;
  selectedContactId?: string | null;
}

export function RestaurantDashboard({
  contacts,
  onSelectContact,
  tab: tabProp,
  onTabChange,
  onToggleInterested,
  onToggleNeedsHuman,
  selectedContactId,
  hideTabBar,
}: Props) {
  const [internalTab, setInternalTab] = useState<RestaurantTab>("overview");
  const tab = tabProp ?? internalTab;
  const setTab = (t: RestaurantTab) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const { orders, createOrder, updateOrderStatus, deleteOrder } = useOrders();
  const [showNewOrder, setShowNewOrder] = useState(false);

  const flaggedContacts = useMemo(
    () =>
      contacts
        .filter((c) => c.needsHuman)
        .sort((a, b) => (b.humanRequestedAt?.getTime() || 0) - (a.humanRequestedAt?.getTime() || 0)),
    [contacts],
  );

  return (
    <div className="flex flex-col h-full">
      {!hideTabBar && (
      <div className="border-b p-2 sm:p-3 bg-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as RestaurantTab)}>
          <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
            <TabsList className="h-9 w-max inline-flex px-2 sm:px-0">
              <TabsTrigger value="overview" data-tour="rest-overview" className="flex items-center gap-1.5 whitespace-nowrap">
                <BarChart3 className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="orders" data-tour="rest-orders" className="flex items-center gap-1.5 whitespace-nowrap">
                <ListOrdered className="h-4 w-4" /> Orders
              </TabsTrigger>
              <TabsTrigger value="reservations" data-tour="rest-reservations" className="flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="h-4 w-4" /> Reservations
              </TabsTrigger>
              <TabsTrigger value="menu" data-tour="rest-menu" className="flex items-center gap-1.5 whitespace-nowrap">
                <BookOpen className="h-4 w-4" /> Menu
              </TabsTrigger>
              <TabsTrigger value="tables" data-tour="rest-tables" className="flex items-center gap-1.5 whitespace-nowrap">
                <LayoutGrid className="h-4 w-4" /> Tables
              </TabsTrigger>
              <TabsTrigger value="crm" data-tour="rest-crm" className="flex items-center gap-1.5 whitespace-nowrap">
              <TabsTrigger value="interested" data-tour="rest-interested" className="flex items-center gap-1.5 whitespace-nowrap">Interested</TabsTrigger>
                <Users className="h-4 w-4" /> CRM
              </TabsTrigger>
              <TabsTrigger value="flagged" data-tour="rest-flagged" className="flex items-center gap-1.5 whitespace-nowrap">
                <AlertCircle className="h-4 w-4" /> Flagged
                {flaggedContacts.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {flaggedContacts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="campaigns" data-tour="rest-campaigns" className="flex items-center gap-1.5 whitespace-nowrap">
                <Megaphone className="h-4 w-4" /> Campaigns
              </TabsTrigger>
              <TabsTrigger value="ai_issues" data-tour="rest-ai-issues" className="flex items-center gap-1.5 whitespace-nowrap">AI Issues</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Fallback />}>
          {tab === "overview" && (
            <OverviewDashboard
              onSelectByPhone={(phone) => {
                const c = contacts.find((x) => x.phoneNumber === phone);
                if (c) onSelectContact(c);
              }}
            />
          )}

          {tab === "orders" && (
            <OrdersPanel
              orders={orders}
              onUpdateStatus={updateOrderStatus}
              onDeleteOrder={deleteOrder}
              onNew={() => setShowNewOrder(true)}
            />
          )}

          {tab === "reservations" && <ReservationsCalendar />}

          {tab === "menu" && (
            <div className="h-full overflow-y-auto p-4">
              <div className="w-full"><MenuManager /></div>
            </div>
          )}

          {tab === "tables" && (
            <div className="h-full overflow-y-auto p-4">
              <div className="w-full">
                <h3 className="font-semibold text-lg mb-1">Tables</h3>
                <p className="text-sm text-muted-foreground mb-4">Add, rename or remove tables. Deleting a table won't delete past reservations.</p>
                <TablesManager />
              </div>
            </div>
          )}

          {tab === "crm" && <CrmTab contacts={contacts} orders={orders} onSelectContact={onSelectContact} />}


          {tab === "flagged" && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" /> Flagged for human
                </h3>
                <p className="text-sm text-muted-foreground">Customers the AI escalated because they asked for a human.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl">
                  {flaggedContacts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserRound className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No flagged conversations.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {flaggedContacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors">
                          <button type="button" onClick={() => onSelectContact(c)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.phoneNumber}
                                {c.humanRequestedAt && ` · ${c.humanRequestedAt.toLocaleString()}`}
                              </p>
                            </div>
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => onToggleNeedsHuman?.(c.id, false)} title="Mark as resolved">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "campaigns" && <CampaignsTab contacts={contacts} />}

          {tab === "interested" && (
            <InterestedPanel
              contacts={contacts}
              orders={orders}
              selectedContactId={selectedContactId ?? null}
              onSelectContact={onSelectContact}
              onToggleInterested={onToggleInterested}
            />
          )}

          {tab === "ai_issues" && <AiIssuesPanel contacts={contacts} onSelectContact={onSelectContact} />}
        </Suspense>
      </div>

      <RestaurantNewOrderDialog
        open={showNewOrder}
        onOpenChange={setShowNewOrder}
        onCreateOrder={async (od) => { await createOrder(od); }}
      />

    </div>
  );
}

function OrdersPanel({
  orders,
  onUpdateStatus,
  onDeleteOrder,
  onNew,
}: {
  orders: Order[];
  onUpdateStatus: (id: string, status: Order["status"]) => void;
  onDeleteOrder: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">Orders</h3>
          <p className="text-sm text-muted-foreground">Delivery, pickup and dine-in orders.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={onNew}>
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">New Order</span>
            <span className="sm:hidden ml-1.5">New</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<Fallback />}>
            <OrdersList orders={orders} onUpdateStatus={onUpdateStatus} onDeleteOrder={onDeleteOrder} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
