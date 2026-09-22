import { useState, useEffect, useMemo, lazy, Suspense, useCallback, useRef } from "react";
import { Contact } from "@/types/chat";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMessages } from "@/hooks/useMessages";
import { useOrders } from "@/hooks/useOrders";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Package,
  Plus,
  Settings,
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Megaphone,
  UserRound,
  X,
  AlertCircle,
  Users,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  Check,
  CheckCheck,
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductTour, type TourStep } from "@/components/tour/ProductTour";
import { useAuth } from "@/hooks/useAuth";
import { useFlaggedContacts } from "@/hooks/useFlaggedContacts";
import { useTenantVertical } from "@/hooks/useTenantVertical";
import { IconRail } from "@/components/IconRail";
import { useChannelFilter, useInstagramConnection } from "@/hooks/useChannels";
import { BottomNav } from "@/components/BottomNav";
import { actingHeaders } from '@/lib/actingTenant';
import { KeepAlive } from "@/components/KeepAlive";


const OrdersList = lazy(() => import("@/components/orders/OrdersList").then((m) => ({ default: m.OrdersList })));
const InterestedDashboard = lazy(() =>
  import("@/components/chat/InterestedDashboard").then((m) => ({ default: m.InterestedDashboard })),
);
const OverviewDashboard = lazy(() =>
  import("@/components/analytics/OverviewDashboard").then((m) => ({ default: m.OverviewDashboard })),
);
const CampaignsTab = lazy(() =>
  import("@/components/campaigns/CampaignsTab").then((m) => ({ default: m.CampaignsTab })),
);
const CrmTab = lazy(() => import("@/components/crm/CrmTab").then((m) => ({ default: m.CrmTab })));
const AIIssuesTab = lazy(() => import("@/components/dashboard/AIIssuesTab").then((m) => ({ default: m.AIIssuesTab })));
const RestaurantDashboard = lazy(() => import("@/components/restaurant/RestaurantDashboard").then((m) => ({ default: m.RestaurantDashboard })));
const RealEstateDashboard = lazy(() => import("@/components/real_estate/RealEstateDashboard").then((m) => ({ default: m.RealEstateDashboard })));
const WellnessDashboard = lazy(() => import("@/components/wellness/WellnessDashboard").then((m) => ({ default: m.WellnessDashboard })));
const HealthcareDashboard = lazy(() => import("@/components/healthcare/HealthcareDashboard").then((m) => ({ default: m.HealthcareDashboard })));
const EducationDashboard = lazy(() => import("@/components/education/EducationDashboard").then((m) => ({ default: m.EducationDashboard })));
const VerticalComingSoon = lazy(() => import("@/components/VerticalComingSoon").then((m) => ({ default: m.VerticalComingSoon })));

const PanelFallback = () => <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

const Index = () => {
  const {
    contacts,
    messages,
    loading,
    hasMoreMessages,
    loadingMoreMessages,
    sendMessage,
    createContact,
    fetchMessages,
    loadMoreMessages,
    deleteChat,
    updateContact,
    toggleInterested,
    toggleNeedsHuman,
    toggleAiEnabled,
    loadMoreContactPreviews,
    hasMoreContactPreviews,
    loadingMoreContacts,
    searchContacts,
    assignContact,
    deleteMessages,
    clearChatMessages,
    toggleBlocked,
  } = useMessages();
  const { orders, loading: ordersLoading, createOrder, updateOrderStatus, deleteOrder } = useOrders();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "dashboard">("chats");
  const [dashboardSubTab, setDashboardSubTab] = useState<
    "overview" | "orders" | "crm" | "interested" | "campaigns" | "flagged" | "ai_issues"
  >("overview");
  const [restaurantTab, setRestaurantTab] = useState<
    "overview" | "orders" | "reservations" | "menu" | "tables" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues"
  >("overview");
  const [realEstateTab, setRealEstateTab] = useState<
    "overview" | "listings" | "viewings" | "leads" | "agents" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues"
  >("overview");
  const [wellnessTab, setWellnessTab] = useState<
    "overview" | "catalog" | "services" | "sessions" | "leads" | "packages" | "staff" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues"
  >("overview");
  const [healthcareTab, setHealthcareTab] = useState<
    "overview" | "team" | "specialties" | "doctors" | "appointments" | "leads" | "labs" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues"
  >("overview");
  const [educationTab, setEducationTab] = useState<
    "overview" | "courses" | "leads" | "enrollments" | "crm" | "flagged" | "campaigns" | "interested" | "ai_issues"
  >("overview");
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vertical: rawVertical } = useTenantVertical();
  // Service businesses reuse the wellness screens (services, bookings calendar, staff, leads)
  const vertical = rawVertical === "service" ? "wellness" : rawVertical;
  const { channel, setChannel } = useChannelFilter();
  const { connected: instagramConnected } = useInstagramConnection();
  const { flagged: flaggedContacts, setLocalResolved: setLocalFlaggedResolved, refetch: refetchFlagged } = useFlaggedContacts();
  const [hideChatPanel, setHideChatPanel] = useState(false);


  // Onboarding tour state
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);

  // Auto-start tour for new users (or replay via ?tour=1)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const flagged = sessionStorage.getItem('jawabify_force_tour') === '1';
    const force = params.get("tour") === "1" || flagged;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tour_completed_at, tour_step, onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      if (force) {
        sessionStorage.removeItem('jawabify_force_tour');
        setTourInitialStep(0);
        setActiveTab("chats");
        setSelectedContact(null);
        // Wait for layout to settle before opening
        setTimeout(() => setTourOpen(true), 300);
        // Clean URL
        params.delete("tour");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
        return;
      }
      if (!data.tour_completed_at && data.onboarding_completed) {
        setTourInitialStep(Math.max(0, data.tour_step ?? 0));
        // Give layout a moment to settle
        setTimeout(() => setTourOpen(true), 600);
      }
    })();
  }, [user]);

  // Warm up the lazy dashboard chunks while the browser is idle so switching
  // tabs doesn't wait on a network round-trip for the code itself.
  useEffect(() => {
    const warm = () => {
      void import("@/components/analytics/OverviewDashboard");
      void import("@/components/orders/OrdersList");
      void import("@/components/crm/CrmTab");
      void import("@/components/campaigns/CampaignsTab");
      void import("@/components/chat/InterestedDashboard");
      void import("@/components/dashboard/AIIssuesTab");
    };
    const idle = (window as any).requestIdleCallback;
    const id = idle ? idle(warm, { timeout: 3000 }) : window.setTimeout(warm, 1500);
    return () => {
      const cancel = (window as any).cancelIdleCallback;
      if (idle && cancel) cancel(id);
      else window.clearTimeout(id as number);
    };
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


  // Refs so tour beforeShow callbacks always read latest values (useMemo closure stays fresh)
  const contactsRef = useRef<Contact[]>([]);
  contactsRef.current = contacts;
  const waitForEl = async (sel: string, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.querySelector(sel)) return true;
      await sleep(60);
    }
    return false;
  };

  const tourSteps: TourStep[] = useMemo(() => {
    const welcome: TourStep = {
      id: "welcome",
      title: "Welcome to Jawabify 👋",
      body: "Let's take a quick tour to show you how to handle chats, orders, customers and campaigns from one place.",
      action: "Use Next / Back to navigate, or Skip anytime.",
    };
    const chatSteps: TourStep[] = [
      {
        id: "tab-chats",
        target: '[data-tour="rail-chats"]',
        title: "Chats",
        body: "Every WhatsApp conversation lands here in real time — replied to automatically by your AI assistant.",
        action: "Click any chat to view, reply, or take over from the AI.",
        placement: "right",
        beforeShow: async () => { setActiveTab("chats"); await sleep(150); },
      },
      {
        id: "conversation-list",
        target: '[data-tour="conversation-list"]',
        title: "Your conversations",
        body: "Browse all customers and quickly find chats. Unread and flagged customers are highlighted.",
        action: "Tap the new-chat icon in the search bar to start a new chat.",
        placement: "right",
        beforeShow: async () => { setActiveTab("chats"); setSelectedContact(null); await sleep(150); },
      },
      {
        id: "tab-dashboard",
        target: '[data-tour="rail-home"]',
        title: "Dashboard",
        body: "The left sidebar is your navigation: Overview, Orders, CRM, Interested, Flagged, Campaigns and AI Issues — one click each.",
        action: "Open Overview now to see today's stats.",
        placement: "right",
      },
    ];

    const accountSteps: TourStep[] = [
      {
        id: "ai-replies",
        target: '[data-tour="ai-toggle"]',
        title: "Turning AI replies on or off",
        body: "Look at the top-right of the chat header — the bot icon (highlighted now). Tap it to toggle AI auto-replies on/off for this customer.",
        action: "Use this when a customer needs human attention or when the AI is struggling.",
        beforeShow: async () => {
          setActiveTab("dashboard");
          setDashboardSubTab("overview");
          await sleep(50);
          setActiveTab("chats");
          const list = contactsRef.current;
          if (list.length > 0) setSelectedContact(list[0]);
          await sleep(200);
          await waitForEl('[data-tour="ai-toggle"]', 2500);
        },
      },
      {
        id: "contact-us",
        target: '[data-tour="contact-us"]',
        title: "Need help? Contact us",
        body: "Tap this headphones button (bottom-right when no chat is open) to book a free onboarding call or email our support team.",
        placement: "left",
        beforeShow: async () => {
          setActiveTab("chats");
          setSelectedContact(null);
          await sleep(200);
          await waitForEl('[data-tour="contact-us"]', 2000);
        },
      },

      {
        id: "account-btn",
        target: '[data-tour="account-btn"]',
        title: "Your account",
        body: "Manage your profile, business info, password and replay this tour from Account Settings.",
        placement: "right",
        beforeShow: async () => { setActiveTab("chats"); await sleep(150); },
      },
      {
        id: "settings-btn",
        target: '[data-tour="settings-btn"]',
        title: "Settings & AI training",
        body: "Open Settings to connect Shopify, manage WhatsApp templates, and — most importantly — train your AI assistant.",
        action: "Tap the gear icon to open Settings when the tour ends.",
        placement: "right",
      },

      {
        id: "tutorials-btn",
        target: '[data-tour="tutorials-btn"]',
        title: "Need a refresher? Tutorials",
        body: "This graduation-cap icon opens the Tutorials page — short video walkthroughs of every feature. If anything is unclear later, head here anytime.",
        action: "You can also replay this guided tour from Account Settings.",
        placement: "right",
      },
      {
        id: "finish",
        title: "You're all set 🎉",
        body: "That's the full tour! Replay it anytime from Account Settings, or open the Tutorials icon for video guides. Don't forget to visit Settings to train your AI with your business knowledge.",
      },
    ];

    const railKeyFor = (sub: string) => `rail-${sub === "overview" ? "home" : sub}`;

    if (vertical === "restaurant") {
      const restStep = (sub: typeof restaurantTab, title: string, body: string, action?: string): TourStep => {
        const target = `[data-tour="${railKeyFor(sub)}"]`;
        return {
          id: `rest-${sub}`,
          target,
          title,
          body,
          action,
          placement: "right",
          beforeShow: async () => {
            setActiveTab("dashboard");
            setRestaurantTab(sub);
            await sleep(220);
            await waitForEl(target, 2000);
          },
        };
      };
      return [
        welcome,
        ...chatSteps,
        restStep("overview", "Overview", "Today at a glance — reservations, orders, covers and AI performance."),
        restStep("orders", "Orders", "Delivery, pickup and dine-in orders in one place. Update status and notify the customer with one tap.", "Use 'New Order' to add manually."),
        restStep("reservations", "Reservations", "Google-Calendar style view of every booking. Click any empty slot to add a reservation yourself."),
        restStep("menu", "Menu", "Categories, items, prices and modifiers — exactly what the AI offers when taking orders.", "Hidden items won't be offered to customers."),
        restStep("tables", "Tables", "Add, rename or remove tables. Used by reservations to know what's free."),
        restStep("crm", "CRM", "Your full customer database — search, tag and segment everyone who's ever messaged you."),
        restStep("flagged", "Flagged for human", "Conversations the AI handed over because the customer was upset, asked something it couldn't answer, or specifically requested a human. Reply yourself, then mark resolved."),
        restStep("campaigns", "Campaigns", "Send bulk WhatsApp template messages — specials, events, holiday hours — to any segment."),
        ...accountSteps,
      ];
    }

    if (vertical === "real_estate") {
      const reStep = (sub: typeof realEstateTab, title: string, body: string, action?: string): TourStep => {
        const target = `[data-tour="${railKeyFor(sub)}"]`;
        return {
          id: `re-${sub}`,
          target,
          title,
          body,
          action,
          placement: "right",
          beforeShow: async () => {
            setActiveTab("dashboard");
            setRealEstateTab(sub);
            await sleep(220);
            await waitForEl(target, 2000);
          },
        };
      };
      return [
        welcome,
        ...chatSteps,
        reStep("overview", "Overview", "Today's leads, scheduled viewings and AI activity at a glance."),
        reStep("listings", "Listings", "Properties the AI offers to customers — for sale or for rent.", "Add manually or sync a Google Sheet from Settings."),
        reStep("viewings", "Viewings", "Calendar of property viewings booked by the AI or by you. Click any slot to inspect or cancel."),
        reStep("leads", "Leads", "Pipeline of every enquiry — drag through New → Qualified → Viewing booked → Closed Won/Lost."),
        reStep("agents", "Agents", "Your team — used to auto-route leads by area and property type."),
        reStep("crm", "CRM", "Your full customer database — search, tag and segment everyone who ever messaged you."),
        reStep("flagged", "Flagged for human", "Conversations the AI handed over because the customer was upset, asked something it couldn't answer, or specifically requested a human. Reply yourself, then mark resolved."),
        reStep("campaigns", "Campaigns", "Send bulk WhatsApp template messages — new listings, price drops, open houses — to any segment."),
        ...accountSteps,
      ];
    }


    if (vertical === "wellness") {
      const weStep = (sub: typeof wellnessTab, title: string, body: string, action?: string): TourStep => {
        const isCatalogSub = sub === "services" || sub === "packages";
        const target = isCatalogSub
          ? `[data-tour="catalog-${sub}"]`
          : `[data-tour="${railKeyFor(sub)}"]`;
        return {
          id: `we-${sub}`,
          target,
          title, body, action,
          placement: isCatalogSub ? "bottom" : "right",
          beforeShow: async () => {
            setActiveTab("dashboard");
            setWellnessTab(sub);
            await sleep(220);
            if (isCatalogSub) await waitForEl(target, 2000);
          },
        };
      };

      return [
        welcome,
        ...chatSteps,
        weStep("overview", "Overview", "Today's bookings, leads and AI activity."),
        weStep("services", "Services", "Massages, classes, treatments — what the AI offers and at what price.", "Click here to manage services."),
        weStep("packages", "Packages", "Multi-session bundles the AI upsells after each booking.", "Click here to manage packages."),
        weStep("sessions", "Calendar", "All booked sessions — week/day view."),
        weStep("leads", "Leads", "Pipeline: New → Qualified → Booked → Closed Won/Lost."),

        weStep("staff", "Staff", "Therapists / instructors with specialties used for routing."),
        weStep("crm", "CRM", "Your full customer database."),
        weStep("flagged", "Flagged", "Conversations the AI escalated for a human."),
        weStep("campaigns", "Campaigns", "Bulk WhatsApp template messages."),

        ...accountSteps,
      ];
    }

    if (vertical === "healthcare") {
      const hcStep = (sub: typeof healthcareTab, title: string, body: string, action?: string): TourStep => {
        const isTeamSub = sub === "specialties" || sub === "doctors";
        const target = isTeamSub
          ? `[data-tour="team-${sub}"]`
          : `[data-tour="${railKeyFor(sub)}"]`;
        return {
          id: `hc-${sub}`,
          target,
          title, body, action,
          placement: isTeamSub ? "bottom" : "right",
          beforeShow: async () => {
            setActiveTab("dashboard");
            setHealthcareTab(sub);
            await sleep(220);
            await waitForEl(target, 2000);
          },
        };
      };
      return [
        welcome,
        ...chatSteps,
        hcStep("overview", "Overview", "Today at a glance — appointments, urgent cases and AI activity."),
        hcStep("specialties", "Specialties", "Cardiology, pediatrics, dermatology — each with its own triage rules and urgency keywords.", "Add or edit specialties here."),
        hcStep("doctors", "Doctors", "Names, availability and per-doctor booking slots — used by the AI when offering appointments."),
        hcStep("appointments", "Calendar", "Every booked appointment in a week / day view. Click any slot to inspect or reschedule."),
        hcStep("leads", "Leads", "Pipeline of every patient enquiry — drag through New → Triaged → Booked → Completed."),
        hcStep("labs", "Lab results", "Log results manually or via webhook. The AI notifies patients automatically when ready."),
        hcStep("crm", "CRM", "Your full patient database — search, tag and segment everyone who ever messaged you."),
        hcStep("flagged", "Attention", "Two stacked queues: urgent triage (patients flagged for an immediate doctor/nurse handoff) and flagged-for-human (anything the AI escalated — upset patient, complaint, sensitive request). Reply yourself, then mark resolved."),
        hcStep("campaigns", "Campaigns", "Send bulk WhatsApp template messages — check-up reminders, vaccination drives, clinic updates — to any segment."),
        ...accountSteps,
      ];
    }


    if (vertical === "education") {
      const eduStep = (sub: typeof educationTab, title: string, body: string, action?: string): TourStep => {
        const target = `[data-tour="${railKeyFor(sub)}"]`;
        return {
          id: `edu-${sub}`,
          target,
          title, body, action,
          placement: "right",
          beforeShow: async () => {
            setActiveTab("dashboard");
            setEducationTab(sub);
            await sleep(220);
            await waitForEl(target, 2000);
          },
        };
      };
      return [
        welcome,
        ...chatSteps,
        eduStep("overview", "Overview", "Today's enquiries, trial bookings and new enrollments."),
        eduStep("courses", "Courses", "Your catalog — name, age group, price, schedule, capacity.", "Add or edit courses here."),
        eduStep("leads", "Leads", "Pipeline of parents and students captured from WhatsApp — drag through stages from first enquiry to enrolled."),
        eduStep("enrollments", "Enrollments", "Confirmed students, payment status and progress reminders."),
        eduStep("crm", "CRM", "Your full parent / student database — search, tag and segment."),
        eduStep("flagged", "Flagged for human", "Conversations the AI handed over because the parent was upset, asked something it couldn't answer, or specifically requested a human. Reply yourself, then mark resolved."),
        eduStep("campaigns", "Campaigns", "Bulk WhatsApp messages (registration, reminders, holidays)."),
        ...accountSteps,
      ];
    }

    // E-commerce / default
    const ecomStep = (sub: typeof dashboardSubTab, title: string, body: string, action?: string): TourStep => {
      const target = `[data-tour="${railKeyFor(sub)}"]`;
      return {
        id: `sub-${sub}`,
        target,
        title,
        body,
        action,
        placement: "right",
        beforeShow: async () => {
          setActiveTab("dashboard");
          setDashboardSubTab(sub);
          await sleep(220);
          await waitForEl(target, 2000);
        },
      };
    };
    return [
      welcome,
      ...chatSteps,
      ecomStep("overview", "Overview", "Today at a glance — conversations handled, response times, orders placed and revenue."),
      ecomStep("orders", "Orders", "Every order from WhatsApp or Shopify in one place. Update status, add tracking and notify the customer with one tap.", "Use 'New Order' to add manually or 'Sync Shopify' to pull live."),
      ecomStep("crm", "CRM", "Your full customer database — search, filter, tag and segment everyone who ever messaged you."),
      ecomStep("interested", "Interested leads", "Customers the AI flagged as buying-intent but who haven't ordered yet — a warm list ready for a nudge."),
      ecomStep("flagged", "Flagged for human", "Conversations the AI handed over because the customer was upset, asked something it couldn't answer, or specifically requested a human. Reply yourself, then mark resolved."),
      ecomStep("campaigns", "Campaigns", "Send bulk WhatsApp template messages — promotions, restocks, holiday offers — to any segment."),
      ecomStep("ai_issues", "AI Issues", "Replies the AI got wrong or wasn't sure about. Review them, fix the answer in your Knowledge Base and the AI learns instantly."),
      ...accountSteps,
    ];

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical]);

  const handleTourClose = useCallback((completed: boolean) => {
    setTourOpen(false);
    if (completed) toast.success("Tour complete — happy chatting!");
  }, []);


  const handleSelectContact = (contact: Contact) => {
    // Toggle: clicking the already-open chat closes it
    if (selectedContact?.id === contact.id && activeTab === "chats") {
      setSelectedContact(null);
      return;
    }
    setSelectedContact(contact);
    fetchMessages(contact.id);
    if (activeTab !== "chats") setActiveTab("chats");
  };

  const handleSendMessage = async (content: string, mediaFile?: File) => {
    if (!selectedContact) return;
    await sendMessage(selectedContact, content, mediaFile);
  };

  const handleCreateChat = async (name: string, phoneNumber: string) => {
    const contact = await createContact(name, phoneNumber);
    if (contact) {
      setSelectedContact(contact);
    }
  };

  const handleBack = () => {
    setSelectedContact(null);
  };

  const handleLoadMoreMessages = () => {
    if (selectedContact) {
      loadMoreMessages(selectedContact.id);
    }
  };

  const handleDeleteChat = async (contactId: string) => {
    await deleteChat(contactId);
    setSelectedContact(null);
  };

  const handleToggleAiEnabled = async (contactId: string, aiEnabled: boolean) => {
    const success = await toggleAiEnabled(contactId, aiEnabled);
    if (success) {
      toast.success(
        aiEnabled
          ? "AI replies are ON for this chat"
          : "AI replies are OFF for this chat — the bot will stop answering until you turn it back on"
      );
    } else {
      toast.error("Could not update AI setting. Please try again.");
    }
    return success;
  };

  const handleCreateOrder = async (orderData: {
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    productName: string;
    quantity: number;
  }) => {
    await createOrder({
      ...orderData,
      contactId: selectedContact?.id,
    });
  };

  // Load messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact?.id, fetchMessages]);

  // On mobile: show sidebar only when no chat is open AND tab is chats; show chat/dashboard otherwise.
  // On desktop: sidebar is visible except when the user explicitly hides it while on the Dashboard.
  const showSidebar = isMobile
    ? !selectedContact && activeTab === "chats"
    : !(activeTab === "dashboard" && hideChatPanel);
  const showMainArea = !isMobile || activeTab === "dashboard" || (activeTab === "chats" && selectedContact);
  const showMobileBottomNav = isMobile && !(activeTab === "chats" && selectedContact);


  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);
  const interestedCount = useMemo(() => contacts.filter((c) => c.isInterested).length, [contacts]);
  // Flagged queue comes straight from the database (see useFlaggedContacts) so it
  // never depends on which contacts happen to be loaded in the paginated list.
  const unresolvedFlagged = useMemo(
    () => flaggedContacts.filter((c) => c.needsHuman),
    [flaggedContacts],
  );
  const resolvedFlagged = useMemo(
    () => flaggedContacts.filter((c) => !c.needsHuman),
    [flaggedContacts],
  );
  const openFlaggedContact = (phone: string) => {
    const c = contacts.find((x) => x.phoneNumber === phone);
    if (c) handleSelectContact(c);
  };
  const handleResolveFlagged = async (contactId: string) => {
    setLocalFlaggedResolved(contactId, false);
    const ok = await toggleNeedsHuman(contactId, false);
    if (ok === false) {
      setLocalFlaggedResolved(contactId, true);
      toast.error("Could not mark as resolved. Please try again.");
      return;
    }
    toast.success("Marked as resolved");
  };
  const handleFlagFromChat = async (contactId: string, needsHuman: boolean) => {
    const ok = await toggleNeedsHuman(contactId, needsHuman);
    if (ok === false) {
      toast.error("Could not update the flag. Please try again.");
      return false;
    }
    await refetchFlagged();
    toast.success(needsHuman ? "Added to Flagged" : "Removed from Flagged");
    return true;
  };
  const handleUnresolveFlagged = async (contactId: string) => {
    setLocalFlaggedResolved(contactId, true);
    const ok = await toggleNeedsHuman(contactId, true);
    if (ok === false) {
      setLocalFlaggedResolved(contactId, false);
      toast.error("Could not move back to unresolved. Please try again.");
      return;
    }
    toast.success("Moved back to unresolved");
  };
  const dashboardBadgeCount = pendingOrdersCount + interestedCount;

  const ordersByContact = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.contactId) set.add(o.contactId);
    return set;
  }, [orders]);

  if (loading) {
    return (
      <div className="flex h-screen h-[100dvh] w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Map per-vertical rail key <-> internal tab state
  const subTabForVertical = (): string => {
    if (activeTab === "chats") return "chats";
    if (vertical === "restaurant") return restaurantTab === "overview" ? "home" : restaurantTab;
    if (vertical === "real_estate") return realEstateTab === "overview" ? "home" : realEstateTab;
    if (vertical === "wellness") return wellnessTab === "overview" ? "home" : wellnessTab;
    if (vertical === "healthcare") {
      if (healthcareTab === "overview") return "home";
      if (healthcareTab === "specialties" || healthcareTab === "doctors") return "team";
      return healthcareTab;
    }
    if (vertical === "education") return educationTab === "overview" ? "home" : educationTab;
    return dashboardSubTab === "overview" ? "home" : dashboardSubTab;
  };
  const railActive = subTabForVertical();

  const handleRailSelect = (key: string) => {
    if (isMobile) setSelectedContact(null);
    if (key === "chats") {
      // Toggle: if already on chats, close the open chat (or hide panel on desktop)
      if (activeTab === "chats") {
        if (selectedContact) setSelectedContact(null);
        else if (!isMobile) setHideChatPanel((v) => !v);
      }
      setActiveTab("chats");
      return;
    }
    setActiveTab("dashboard");
    const sub = key === "home" ? "overview" : key;
    if (vertical === "restaurant") setRestaurantTab(sub as any);
    else if (vertical === "real_estate") setRealEstateTab(sub as any);
    else if (vertical === "wellness") setWellnessTab(sub as any);
    else if (vertical === "healthcare") setHealthcareTab(sub === "team" ? "specialties" : sub as any);
    else if (vertical === "education") setEducationTab(sub as any);
    else setDashboardSubTab(sub as any);
  };

  return (
    <>
      <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background safe-top">
        {/* Left icon rail (desktop) */}
        <IconRail
          vertical={vertical}
          active={railActive}
          onSelect={handleRailSelect}
          channel={channel}

          badges={{
            orders: pendingOrdersCount,
            chats: contacts.reduce((n, c) => n + ((c.unreadCount ?? 0) > 0 ? 1 : 0), 0),
            interested: interestedCount,
            flagged: unresolvedFlagged.length,
            ai_issues: unresolvedFlagged.length,

          }}
        />


        {/* App body */}
        <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="border-b bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 px-3 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary/30">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">Jawabify</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("/tutorials")} className="text-white/90 hover:bg-white/10 h-9 w-9">
                <GraduationCap className="h-5 w-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => navigate("/account")} className="text-white/90 hover:bg-white/10 h-9 w-9">
                <UserRound className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="text-white/90 hover:bg-white/10 h-9 w-9">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
        {/* Conversation list panel */}
        {showSidebar && (
          <div className={`${isMobile ? "w-full relative" : "w-80 lg:w-96"} shrink-0 border-r flex flex-col bg-card`}>
            {/* Mobile bottom nav replaces the old top tab toggle */}



            {/* Sidebar always shows the conversation list */}
            <div className="flex-1 overflow-hidden" data-tour="conversation-list">
              <ConversationList
                contacts={contacts}
                selectedContactId={selectedContact?.id || null}
                onSelectContact={handleSelectContact}
                onNewChat={() => setShowNewChatDialog(true)}
                hideHeader
                onLoadMore={loadMoreContactPreviews}
                hasMore={hasMoreContactPreviews}
                isLoadingMore={loadingMoreContacts}
                onSearchContacts={searchContacts}
                channel={channel}
                onChannelChange={setChannel}
                instagramConnected={instagramConnected}
              />
            </div>


          </div>
        )}


        {/* Main area */}
        {showMainArea && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "chats" &&
              (selectedContact ? (
                <ChatWindow
                  contact={contacts.find((c) => c.id === selectedContact.id) || selectedContact}
                  messages={messages[selectedContact.id] || []}
                  onSendMessage={handleSendMessage}
                  onBack={handleBack}
                  onDeleteChat={handleDeleteChat}
                  onUpdateContact={updateContact}
                  onCreateOrder={() => setShowNewOrderDialog(true)}
                  onLoadMoreMessages={handleLoadMoreMessages}
                  hasMoreMessages={hasMoreMessages[selectedContact.id] || false}
                  isLoadingMore={loadingMoreMessages[selectedContact.id] || false}
                  isMobile={isMobile}
                  hasOrders={ordersByContact.has(selectedContact.id)}
                  onToggleInterested={toggleInterested}
                  onToggleAiEnabled={handleToggleAiEnabled}
                  onAssign={assignContact}
                  onToggleNeedsHuman={handleFlagFromChat}
                  onDeleteMessages={deleteMessages}
                  onClearChat={clearChatMessages}
                  onToggleBlocked={toggleBlocked}
                />
              ) : (
                <EmptyChat />
              ))}

            <KeepAlive active={activeTab === "dashboard"}>
              <div className="flex flex-col h-full">
                {/* Desktop: slim toolbar holding the chat-list toggle so it never overlaps vertical headers */}
                {!isMobile && (
                  <div className="h-10 shrink-0 border-b bg-card flex items-center px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHideChatPanel((v) => !v)}
                      className="h-8 w-8"
                      title={hideChatPanel ? "Show chat list" : "Hide chat list"}
                    >
                      {hideChatPanel ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col">





                {vertical === 'restaurant' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <RestaurantDashboard
                      contacts={contacts}
                      onSelectContact={handleSelectContact}
                      tab={restaurantTab}
                      onTabChange={setRestaurantTab}
                      onToggleInterested={toggleInterested}
                      onToggleNeedsHuman={toggleNeedsHuman}
                      selectedContactId={selectedContact?.id ?? null}
                      hideTabBar={!isMobile}
                    />
                  </Suspense>
                ) : vertical === 'real_estate' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <RealEstateDashboard
                      contacts={contacts}
                      onSelectContact={handleSelectContact}
                      onToggleNeedsHuman={toggleNeedsHuman}
                      onToggleInterested={toggleInterested}
                      selectedContactId={selectedContact?.id ?? null}
                      tab={realEstateTab}
                      onTabChange={setRealEstateTab}
                      hideTabBar={!isMobile}
                    />
                  </Suspense>
                ) : vertical === 'wellness' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <WellnessDashboard
                      contacts={contacts}
                      onSelectContact={handleSelectContact}
                      onToggleNeedsHuman={toggleNeedsHuman}
                      onToggleInterested={toggleInterested}
                      selectedContactId={selectedContact?.id ?? null}
                      tab={wellnessTab}
                      onTabChange={setWellnessTab}
                      hideTabBar={!isMobile}
                    />
                  </Suspense>
                ) : vertical === 'healthcare' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <HealthcareDashboard
                      contacts={contacts}
                      onSelectContact={handleSelectContact}
                      onToggleNeedsHuman={toggleNeedsHuman}
                      onToggleInterested={toggleInterested}
                      selectedContactId={selectedContact?.id ?? null}
                      tab={healthcareTab}
                      onTabChange={setHealthcareTab}
                      hideTabBar={!isMobile}
                    />
                  </Suspense>
                ) : vertical === 'education' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <EducationDashboard
                      contacts={contacts}
                      onSelectContact={handleSelectContact}
                      onToggleNeedsHuman={toggleNeedsHuman}
                      onToggleInterested={toggleInterested}
                      selectedContactId={selectedContact?.id ?? null}
                      tab={educationTab}
                      onTabChange={setEducationTab}
                      hideTabBar={!isMobile}
                    />
                  </Suspense>
                ) : vertical !== 'ecommerce' ? (
                  <Suspense fallback={<PanelFallback />}>
                    <VerticalComingSoon vertical={vertical} />
                  </Suspense>
                ) : (<>
                {/* Sub-tabs (mobile only — desktop uses left rail) */}
                {isMobile && (
                <div className="border-b px-3 py-3 sm:px-5 sm:py-4 bg-card">
                  <Tabs value={dashboardSubTab} onValueChange={(v) => setDashboardSubTab(v as any)}>
                    <div className="-mx-2 sm:mx-0 overflow-x-auto scrollbar-thin">
                      <TabsList className="h-10 w-max sm:w-auto inline-flex sm:flex gap-1 rounded-full bg-muted/50 p-1">
                        {[
                          { v: "overview", icon: BarChart3, label: "Overview", tour: "sub-overview" },
                          { v: "orders", icon: Package, label: "Orders", tour: "sub-orders", badge: pendingOrdersCount },
                          { v: "crm", icon: Users, label: "CRM", tour: "sub-crm" },
                          { v: "interested", icon: Sparkles, label: "Interested", tour: "sub-interested", badge: interestedCount },
                          { v: "flagged", icon: AlertCircle, label: "Flagged", tour: "sub-flagged", badge: unresolvedFlagged.length, danger: true },
                          { v: "campaigns", icon: Megaphone, label: "Campaigns", tour: "sub-campaigns" },
                          { v: "ai_issues", icon: AlertCircle, label: "AI Issues", tour: "ai-issues" },
                        ].map((t) => {
                          const Icon = t.icon;
                          return (
                            <TabsTrigger
                              key={t.v}
                              value={t.v}
                              data-tour={t.tour}
                              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 h-8 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 transition-all duration-200"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {t.label}
                              {!!t.badge && t.badge > 0 && (
                                <span className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${t.danger ? "bg-destructive text-destructive-foreground" : "bg-primary/20 text-primary data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"}`}>
                                  {t.badge}
                                </span>
                              )}
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </div>
                  </Tabs>
                </div>
                )}




                {/* Sub-tab content fills the large area */}
                <div className="flex-1 overflow-hidden">
                  <Suspense fallback={<PanelFallback />}>
                    <KeepAlive active={dashboardSubTab === "overview"}>
                      <OverviewDashboard
                        onSelectByPhone={(phone) => {
                          const c = contacts.find((x) => x.phoneNumber === phone);
                          if (c) handleSelectContact(c);
                        }}
                      />
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "orders"}>
                      <div className="h-full flex flex-col">
                        <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-lg">Orders</h3>
                            <p className="text-sm text-muted-foreground">Manage all customer orders.</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              onClick={async () => {
                                const tid = toast.loading("Syncing from Shopify…");
                                try {
                                  const { data, error } = await supabase.functions.invoke("shopify-api", { headers: actingHeaders(),
                                    body: { action: "sync_orders", params: { since_days: 30, limit: 250 } },
                                  });
                                  if (error) throw error;
                                  toast.success(`Synced: +${data?.inserted ?? 0} new, ${data?.updated ?? 0} updated`, {
                                    id: tid,
                                  });
                                  supabase.functions
                                    .invoke("shopify-api", { headers: actingHeaders(), body: { action: "register_webhooks" } })
                                    .catch(() => {});
                                } catch (e: any) {
                                  toast.error(e?.message || "Shopify sync failed", { id: tid });
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4 sm:mr-2" />{" "}
                              <span className="hidden sm:inline">Sync Shopify</span>
                              <span className="sm:hidden ml-1.5">Sync</span>
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none"
                              onClick={() => setShowNewOrderDialog(true)}
                            >
                              <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">New Order</span>
                              <span className="sm:hidden ml-1.5">New</span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                          <div className="mx-auto max-w-5xl">
                            <OrdersList
                              orders={orders}
                              onUpdateStatus={updateOrderStatus}
                              onDeleteOrder={deleteOrder}
                            />
                          </div>
                        </div>
                      </div>
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "crm"}>
                      <CrmTab contacts={contacts} orders={orders} onSelectContact={handleSelectContact} />
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "interested"}>
                      <div className="h-full flex flex-col">
                        <div className="p-4 border-b">
                          <h3 className="font-semibold text-lg">Interested customers</h3>
                          <p className="text-sm text-muted-foreground">
                            Engagement & conversion analytics for flagged leads.
                          </p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <InterestedDashboard
                            contacts={contacts}
                            orders={orders}
                            selectedContactId={selectedContact?.id || null}
                            onSelectContact={handleSelectContact}
                            onUnflag={(id) => toggleInterested(id, false)}
                          />
                        </div>
                      </div>
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "campaigns"}>
                      <CampaignsTab contacts={contacts} />
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "ai_issues"}>
                      <AIIssuesTab
                        onSelectContact={(phone) => {
                          const c = contacts.find((x) => x.phoneNumber === phone);
                          if (c) handleSelectContact(c);
                        }}
                      />
                    </KeepAlive>

                    <KeepAlive active={dashboardSubTab === "flagged"}>
                      <div className="h-full flex flex-col">
                        <div className="p-4 border-b">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Flagged for human
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Customers the AI escalated because they asked to speak with a human.
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                          <div className="mx-auto max-w-3xl space-y-6">
                            {/* Unresolved section */}
                            <div>
                              <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Unresolved ({unresolvedFlagged.length})
                              </h4>
                              {unresolvedFlagged.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed bg-muted/30">
                                  <UserRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No unresolved flagged conversations.</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {unresolvedFlagged.map((c) => (
                                    <div
                                      key={c.id}
                                      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openFlaggedContact(c.phoneNumber)}
                                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                                      >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 bg-destructive/10 text-destructive">
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
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResolveFlagged(c.id)}
                                        title="Mark as resolved"
                                        className="shrink-0 gap-1.5"
                                      >
                                        <Check className="h-4 w-4" />
                                        Resolve
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Resolved section */}
                            <div>
                              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                                <CheckCheck className="h-4 w-4" />
                                Resolved ({resolvedFlagged.length})
                              </h4>
                              {resolvedFlagged.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed bg-muted/30">
                                  <CheckCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No resolved conversations yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {resolvedFlagged.map((c) => (
                                    <div
                                      key={c.id}
                                      className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 transition-colors opacity-80 hover:opacity-100"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openFlaggedContact(c.phoneNumber)}
                                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                                      >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0 bg-primary/10 text-primary">
                                          <CheckCheck className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-sm truncate line-through">{c.name}</p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {c.phoneNumber}
                                            {c.humanRequestedAt && ` · ${c.humanRequestedAt.toLocaleString()}`}
                                          </p>
                                        </div>
                                      </button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleUnresolveFlagged(c.id)}
                                        title="Move back to unresolved"
                                        className="shrink-0 gap-1.5"
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                        Unresolve
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </KeepAlive>
                  </Suspense>
                </div>
                </>)}
                </div>
              </div>
            </KeepAlive>

          </div>
        )}
        </div>
        {showMobileBottomNav && <div className="h-14 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-hidden />}
        </div>
      </div>

      {showMobileBottomNav && (
        <BottomNav
          vertical={vertical}
          active={railActive}
          onSelect={handleRailSelect}
          badges={{
            orders: pendingOrdersCount,
            chats: contacts.reduce((n, c) => n + ((c.unreadCount ?? 0) > 0 ? 1 : 0), 0),
            interested: interestedCount,
            flagged: unresolvedFlagged.length,
            ai_issues: unresolvedFlagged.length,
          }}
        />
      )}



      <NewChatDialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog} onCreateChat={handleCreateChat} />

      <NewOrderDialog
        open={showNewOrderDialog}
        onOpenChange={setShowNewOrderDialog}
        onCreateOrder={handleCreateOrder}
        initialData={
          selectedContact
            ? {
                customerName: selectedContact.name,
                customerPhone: selectedContact.phoneNumber,
              }
            : undefined
        }
      />


      <ProductTour
        steps={tourSteps}
        open={tourOpen}
        initialStep={tourInitialStep}
        userId={user?.id ?? null}
        onClose={handleTourClose}
      />
    </>
  );
};

export default Index;
