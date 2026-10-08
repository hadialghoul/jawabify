import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GraduationCap, Settings, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { Contact } from '../types';
import { useMessages } from '../hooks/useMessages';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { KeyboardSheet } from '../components/KeyboardSheet';
import { useSafeHeaderPad } from '../components/ScreenHeader';
import {
  useChannelFilter,
  useFlaggedContacts,
  useInstagramConnection,
  useTenantVertical,
} from '../hooks/useAppData';
import { ConversationList } from '../components/ConversationList';
import { InstagramPagePicker } from '../components/InstagramPagePicker';
import { useInstagramFacebookConnect } from '../hooks/useInstagramFacebookConnect';
import { ChatWindow } from '../components/ChatWindow';
import { BottomNav } from '../components/BottomNav';
import { OverviewPanel } from '../components/panels/OverviewPanel';
import { OrdersPanel } from '../components/panels/OrdersPanel';
import { CrmPanel, FlaggedPanel, InterestedPanel, NoOrderPanel } from '../components/panels/ListsPanel';
import { contactsWithoutOrders } from '../lib/contactsWithoutOrders';
import { AIIssuesPanel, VerticalRecordsPanel } from '../components/panels/MorePanels';
import { WellnessPanel } from '../components/panels/WellnessPanel';
import { RestaurantMenuPanel } from '../components/panels/RestaurantMenuPanel';
import { RestaurantTablesPanel } from '../components/panels/RestaurantTablesPanel';
import { ReservationsPanel } from '../components/panels/ReservationsPanel';
import { CampaignsPanel } from '../components/panels/CampaignsPanel';
import { GrowthUpgradePanel } from '../components/GrowthUpgradePanel';
import { EducationPanel } from '../components/panels/EducationPanel';
import { useSubscription } from '../hooks/useSubscription';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { WEB_ORIGIN, APP_ORIGIN } from '../config';

export function MainScreen({
  onOpenSettings,
  onOpenBilling,
  onOpenAccount,
}: {
  onOpenSettings: () => void;
  onOpenBilling?: () => void;
  onOpenAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const headerPad = useSafeHeaderPad();
  const toast = useToast();
  const { isActingAs, actingTenantName, stopActingAs } = useAuth();
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
    toggleInterested,
    toggleNeedsHuman,
    toggleAiEnabled,
    loadMoreContactPreviews,
    hasMoreContactPreviews,
    loadingMoreContacts,
    searchContacts,
    clearChatMessages,
    toggleBlocked,
    updateContact,
  } = useMessages();
  const { orders, createOrder, updateOrderStatus, deleteOrder } = useOrders();
  const { vertical } = useTenantVertical();
  const isService = vertical === 'service';
  const isRestaurant = vertical === 'restaurant';
  const { isGrowth } = useSubscription();
  // CRM + Campaigns stay behind Growth for service and restaurant, same as the website.
  const needsGrowthForCrm = (isService || isRestaurant) && !isGrowth;
  const { channel, setChannel } = useChannelFilter();

  // When vertical flips (e.g. Service → Restaurant), leave any stale service tab.
  useEffect(() => {
    const serviceOnly = new Set(['services', 'sessions', 'packages', 'staff', 'catalog']);
    if (isRestaurant && serviceOnly.has(subTab)) setSubTab('home');
  }, [isRestaurant, subTab]);
  const { connected: instagramConnected, refresh: refreshInstagram } = useInstagramConnection();
  const igConnect = useInstagramFacebookConnect(refreshInstagram);
  const { flagged, setLocalResolved, refetch: refetchFlagged } = useFlaggedContacts();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'dashboard'>('chats');
  const [subTab, setSubTab] = useState('home');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [campaignLaunch, setCampaignLaunch] = useState<{ audience: 'interested' | 'no_order'; key: number } | null>(
    null,
  );
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    productName: '',
    quantity: '1',
  });

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.id);
    setActiveTab('chats');
  };

  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);
  const interestedCount = useMemo(() => contacts.filter((c) => c.isInterested).length, [contacts]);
  const noOrderCount = useMemo(() => contactsWithoutOrders(contacts, orders).length, [contacts, orders]);
  const unresolvedFlagged = useMemo(() => flagged.filter((c) => c.needsHuman), [flagged]);
  const isEcommerce = vertical === 'ecommerce';
  const showNoOrder = vertical === 'ecommerce' || vertical === 'restaurant';
  const railActive = activeTab === 'chats' ? 'chats' : subTab;

  const handleRailSelect = (key: string) => {
    setSelectedContact(null);
    if (key === 'chats') {
      setActiveTab('chats');
      return;
    }
    setActiveTab('dashboard');
    setSubTab(key);
  };

  const showChat = activeTab === 'chats' && selectedContact;
  const showList = activeTab === 'chats' && !selectedContact;
  const showDashboard = activeTab === 'dashboard';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!showChat ? (
        <View style={[styles.topBar, { paddingTop: headerPad }]}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.brand}>Jawabify</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/tutorials`)} hitSlop={10} style={styles.iconBtn}>
              <GraduationCap size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={onOpenAccount} hitSlop={10} style={styles.iconBtn}>
              <UserRound size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={onOpenSettings} hitSlop={10} style={styles.iconBtn}>
              <Settings size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {isActingAs && !showChat ? (
        <View style={styles.acting}>
          <Text style={styles.actingText} numberOfLines={1}>
            Managing {actingTenantName || 'account'}
          </Text>
          <Pressable onPress={stopActingAs} hitSlop={10} style={styles.actingBtn}>
            <Text style={styles.actingBtnText}>Back to Super Admin</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {showList ? (
          <ConversationList
            contacts={contacts}
            selectedContactId={null}
            onSelectContact={handleSelectContact}
            onNewChat={() => setShowNewChat(true)}
            onLoadMore={loadMoreContactPreviews}
            hasMore={hasMoreContactPreviews}
            isLoadingMore={loadingMoreContacts}
            onSearchContacts={searchContacts}
            channel={channel}
            onChannelChange={setChannel}
            instagramConnected={instagramConnected}
            onConnectInstagram={() => igConnect.connect()}
            emptyLoading={loading}
          />
        ) : null}

        {showChat && selectedContact ? (
          <ChatWindow
            contact={contacts.find((c) => c.id === selectedContact.id) || selectedContact}
            messages={messages[selectedContact.id] || []}
            onSendMessage={(content, media) => sendMessage(selectedContact, content, media)}
            onBack={() => setSelectedContact(null)}
            onDeleteChat={async (id) => {
              await deleteChat(id);
              setSelectedContact(null);
            }}
            onLoadMoreMessages={() => loadMoreMessages(selectedContact.id)}
            hasMoreMessages={hasMoreMessages[selectedContact.id] || false}
            isLoadingMore={loadingMoreMessages[selectedContact.id] || false}
            onToggleInterested={toggleInterested}
            onToggleAiEnabled={async (id, enabled) => {
              const ok = await toggleAiEnabled(id, enabled);
              toast[ok ? 'success' : 'error'](ok ? (enabled ? 'AI replies are ON' : 'AI replies are OFF') : 'Could not update AI setting');
              return ok;
            }}
            onToggleNeedsHuman={async (id, needs) => {
              const ok = await toggleNeedsHuman(id, needs);
              if (ok) await refetchFlagged();
              return ok;
            }}
            onClearChat={clearChatMessages}
            onToggleBlocked={toggleBlocked}
            onCreateOrder={
              vertical === 'ecommerce' || vertical === 'restaurant'
                ? () => {
                    setOrderForm({
                      customerName: selectedContact.name,
                      customerPhone: selectedContact.phoneNumber,
                      customerAddress: selectedContact.address || '',
                      productName: '',
                      quantity: '1',
                    });
                    setShowNewOrder(true);
                  }
                : undefined
            }
          />
        ) : null}

        {showDashboard ? (
          <View style={{ flex: 1 }}>
            {subTab === 'home' ? (
              <OverviewPanel
                topItemsLabel={isService ? 'Top services' : 'Top products'}
                onSelectByPhone={(phone) => {
                  const c = contacts.find((x) => x.phoneNumber === phone);
                  if (c) handleSelectContact(c);
                }}
              />
            ) : null}
            {subTab === 'orders' ? (
              <OrdersPanel orders={orders} onUpdateStatus={updateOrderStatus} onDeleteOrder={deleteOrder} onCreateOrder={createOrder} />
            ) : null}
            {subTab === 'crm' ? (
              needsGrowthForCrm ? (
                <GrowthUpgradePanel feature="CRM" onUpgrade={onOpenBilling ?? onOpenSettings} />
              ) : (
                <CrmPanel
                  contacts={contacts}
                  orders={orders}
                  onSelectContact={handleSelectContact}
                  editable={isEcommerce || isRestaurant}
                  onSaveContact={async (contactId, edits) => {
                    const ok = await updateContact(contactId, {
                      name: edits.name,
                      phone_number: edits.phoneNumber,
                      email: edits.email,
                      address: edits.address,
                      notes: edits.notes,
                      tags: edits.tags,
                    });
                    if (ok) toast.success('Client updated');
                    else toast.error('Could not save client');
                    return ok;
                  }}
                />
              )
            ) : null}
            {subTab === 'no_order' && showNoOrder ? (
              <NoOrderPanel
                contacts={contacts}
                orders={orders}
                onSelectContact={handleSelectContact}
                onCampaign={() => {
                  setCampaignLaunch({ audience: 'no_order', key: Date.now() });
                  setSubTab('campaigns');
                }}
              />
            ) : null}
            {subTab === 'interested' ? (
              <InterestedPanel
                contacts={contacts}
                orders={orders}
                onSelectContact={handleSelectContact}
                onUnflag={(id) => toggleInterested(id, false)}
              />
            ) : null}
            {subTab === 'flagged' ? (
              <FlaggedPanel
                flagged={flagged}
                onOpen={(phone) => {
                  const c = contacts.find((x) => x.phoneNumber === phone);
                  if (c) handleSelectContact(c);
                }}
                onResolve={async (id) => {
                  setLocalResolved(id, false);
                  const ok = await toggleNeedsHuman(id, false);
                  if (!ok) setLocalResolved(id, true);
                  else toast.success('Marked as resolved');
                }}
                onUnresolve={async (id) => {
                  setLocalResolved(id, true);
                  const ok = await toggleNeedsHuman(id, true);
                  if (!ok) setLocalResolved(id, false);
                  else toast.success('Moved back to unresolved');
                }}
              />
            ) : null}
            {subTab === 'campaigns' ? (
              needsGrowthForCrm ? (
                <GrowthUpgradePanel feature="Campaigns" onUpgrade={onOpenBilling ?? onOpenSettings} />
              ) : (
                <CampaignsPanel
                  contacts={contacts}
                  orders={orders}
                  launchAudience={campaignLaunch?.audience ?? null}
                  launchKey={campaignLaunch?.key}
                />
              )
            ) : null}
            {subTab === 'ai_issues' ? (
              <AIIssuesPanel
                onSelectByPhone={(phone) => {
                  const c = contacts.find((x) => x.phoneNumber === phone);
                  if (c) handleSelectContact(c);
                }}
              />
            ) : null}
            {subTab === 'reservations' ? <ReservationsPanel /> : null}
            {subTab === 'menu' ? <RestaurantMenuPanel /> : null}
            {subTab === 'tables' ? <RestaurantTablesPanel /> : null}
            {subTab === 'listings' ? <VerticalRecordsPanel table="listings" title="Listings" fields={['title', 'price', 'area_name', 'status']} /> : null}
            {subTab === 'viewings' ? <VerticalRecordsPanel table="viewings" title="Viewings" fields={['starts_at', 'status']} /> : null}
            {subTab === 'leads' ? (
              vertical === 'education' ? (
                <EducationPanel mode="leads" />
              ) : vertical === 'healthcare' ? (
                <VerticalRecordsPanel table="healthcare_leads" title="Leads" fields={['reason', 'urgency_level', 'status']} />
              ) : (vertical === 'wellness' || vertical === 'service') ? (
                <WellnessPanel mode="leads" variant={vertical === 'service' ? 'service' : 'wellness'} />
              ) : (
                <VerticalRecordsPanel table="leads" title="Leads" fields={['status', 'intent', 'notes']} />
              )
            ) : null}
            {subTab === 'agents' ? <VerticalRecordsPanel table="agents" title="Agents" fields={['name', 'phone', 'email']} /> : null}
            {subTab === 'staff' ? <WellnessPanel mode="staff" /> : null}
            {subTab === 'doctors' ? <VerticalRecordsPanel table="healthcare_doctors" title="Doctors" fields={['name', 'email']} /> : null}
            {subTab === 'catalog' || subTab === 'services' ? (
              <WellnessPanel
                mode={subTab === 'services' || isService ? 'services' : 'catalog'}
                variant={isService ? 'service' : 'wellness'}
              />
            ) : null}
            {subTab === 'packages' ? <WellnessPanel mode="packages" /> : null}
            {subTab === 'sessions' ? <WellnessPanel mode="sessions" variant={isService ? 'service' : 'wellness'} /> : null}
            {subTab === 'appointments' ? <VerticalRecordsPanel table="healthcare_appointments" title="Calendar" fields={['patient_name', 'scheduled_at', 'status']} /> : null}
            {subTab === 'courses' ? <EducationPanel mode="courses" /> : null}
            {subTab === 'enrollments' ? <EducationPanel mode="enrollments" /> : null}
            {subTab === 'specialties' ? <VerticalRecordsPanel table="healthcare_specialties" title="Specialties" fields={['name']} /> : null}
            {subTab === 'labs' ? <VerticalRecordsPanel table="healthcare_lab_results" title="Labs" fields={['patient_name', 'status']} /> : null}
            {subTab === 'triage' ? <VerticalRecordsPanel table="healthcare_leads" title="Triage" fields={['reason', 'urgency_level', 'status']} /> : null}
            {![
              'home', 'orders', 'crm', 'no_order', 'interested', 'flagged', 'campaigns', 'ai_issues',
              'reservations', 'menu', 'tables', 'listings', 'viewings', 'leads', 'agents',
              'staff', 'doctors', 'catalog', 'services', 'packages', 'sessions', 'appointments',
              'courses', 'enrollments', 'specialties', 'labs', 'triage',
            ].includes(subTab) ? (
              <OverviewPanel
                onSelectByPhone={(phone) => {
                  const c = contacts.find((x) => x.phoneNumber === phone);
                  if (c) handleSelectContact(c);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {!showChat ? (
        <BottomNav
          vertical={vertical}
          active={railActive}
          onSelect={handleRailSelect}
          onOpenSettings={onOpenSettings}
          onOpenAccount={onOpenAccount}
          badges={{
            orders: pendingOrdersCount,
            chats: contacts.reduce((n, c) => n + ((c.unreadCount ?? 0) > 0 ? 1 : 0), 0),
            interested: interestedCount,
            no_order: showNoOrder ? noOrderCount : 0,
            flagged: unresolvedFlagged.length,
            ai_issues: unresolvedFlagged.length,
          }}
        />
      ) : null}
      {!showChat ? <View style={{ height: 56 + insets.bottom }} /> : null}

      <KeyboardSheet visible={showNewOrder} onClose={() => setShowNewOrder(false)}>
        <Text style={styles.modalTitle}>New order</Text>
        <Input placeholder="Customer name" value={orderForm.customerName} onChangeText={(v) => setOrderForm({ ...orderForm, customerName: v })} />
        <Input placeholder="Phone" value={orderForm.customerPhone} onChangeText={(v) => setOrderForm({ ...orderForm, customerPhone: v })} keyboardType="phone-pad" />
        <Input placeholder="Address" value={orderForm.customerAddress} onChangeText={(v) => setOrderForm({ ...orderForm, customerAddress: v })} />
        <Input placeholder="Product" value={orderForm.productName} onChangeText={(v) => setOrderForm({ ...orderForm, productName: v })} />
        <Input placeholder="Quantity" keyboardType="number-pad" value={orderForm.quantity} onChangeText={(v) => setOrderForm({ ...orderForm, quantity: v })} />
        <Button
          title="Create order"
          onPress={async () => {
            await createOrder({ ...orderForm, quantity: Number(orderForm.quantity) || 1 });
            setShowNewOrder(false);
            toast.success('Order created');
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setShowNewOrder(false)} />
      </KeyboardSheet>
      <KeyboardSheet visible={showNewChat} onClose={() => setShowNewChat(false)}>
        <Text style={styles.modalTitle}>New chat</Text>
        <Input placeholder="Name" value={newName} onChangeText={setNewName} />
        <Input placeholder="Phone number" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
        <Button
          title="Create"
          onPress={async () => {
            const contact = await createContact(newName, newPhone);
            if (contact) {
              setSelectedContact(contact);
              setShowNewChat(false);
              setNewName('');
              setNewPhone('');
            } else toast.error('Could not create chat');
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setShowNewChat(false)} />
      </KeyboardSheet>
      <InstagramPagePicker
        visible={igConnect.pickerVisible}
        pages={igConnect.pages ?? []}
        onSelect={igConnect.selectPage}
        onCancel={igConnect.clearPicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topBar: {
    backgroundColor: colors.header,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(79,70,229,0.3)', alignItems: 'center', justifyContent: 'center' },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  brand: { color: '#fff', fontSize: 16, fontWeight: '800' },
  topActions: { flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  acting: {
    backgroundColor: colors.amberSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actingText: { flex: 1, color: colors.amber, fontWeight: '700', fontSize: 12 },
  actingBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  actingBtnText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
});
