import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GraduationCap, Settings, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { Contact } from '../types';
import { useMessages } from '../hooks/useMessages';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  useChannelFilter,
  useFlaggedContacts,
  useInstagramConnection,
  useTenantVertical,
} from '../hooks/useAppData';
import { ConversationList } from '../components/ConversationList';
import { ChatWindow } from '../components/ChatWindow';
import { BottomNav } from '../components/BottomNav';
import { OverviewPanel } from '../components/panels/OverviewPanel';
import { OrdersPanel } from '../components/panels/OrdersPanel';
import { CrmPanel, FlaggedPanel, InterestedPanel } from '../components/panels/ListsPanel';
import { AIIssuesPanel, CampaignsPanel, VerticalRecordsPanel } from '../components/panels/MorePanels';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { WEB_ORIGIN } from '../config';

export function MainScreen({
  onOpenSettings,
  onOpenAccount,
}: {
  onOpenSettings: () => void;
  onOpenAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
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
    deleteMessages,
    clearChatMessages,
    toggleBlocked,
  } = useMessages();
  const { orders, createOrder, updateOrderStatus, deleteOrder } = useOrders();
  const { vertical: rawVertical } = useTenantVertical();
  const vertical = rawVertical === 'service' ? 'wellness' : rawVertical;
  const { channel, setChannel } = useChannelFilter();
  const { connected: instagramConnected } = useInstagramConnection();
  const { flagged, setLocalResolved, refetch: refetchFlagged } = useFlaggedContacts();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'dashboard'>('chats');
  const [subTab, setSubTab] = useState('home');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.id);
    setActiveTab('chats');
  };

  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);
  const interestedCount = useMemo(() => contacts.filter((c) => c.isInterested).length, [contacts]);
  const unresolvedFlagged = useMemo(() => flagged.filter((c) => c.needsHuman), [flagged]);
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
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      {!showChat ? (
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.brand}>Jawabify</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/tutorials`)} style={styles.iconBtn}>
              <GraduationCap size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={onOpenAccount} style={styles.iconBtn}>
              <UserRound size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={onOpenSettings} style={styles.iconBtn}>
              <Settings size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {showList ? (
          <ConversationList
            contacts={contacts}
            selectedContactId={selectedContact?.id || null}
            onSelectContact={handleSelectContact}
            onNewChat={() => setShowNewChat(true)}
            onLoadMore={loadMoreContactPreviews}
            hasMore={hasMoreContactPreviews}
            isLoadingMore={loadingMoreContacts}
            onSearchContacts={searchContacts}
            channel={channel}
            onChannelChange={setChannel}
            instagramConnected={instagramConnected}
            onConnectInstagram={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/integrations`)}
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
          />
        ) : null}

        {showDashboard ? (
          <View style={{ flex: 1 }}>
            {subTab === 'home' ? <OverviewPanel /> : null}
            {subTab === 'orders' ? (
              <OrdersPanel orders={orders} onUpdateStatus={updateOrderStatus} onDeleteOrder={deleteOrder} onCreateOrder={createOrder} />
            ) : null}
            {subTab === 'crm' ? <CrmPanel contacts={contacts} orders={orders} onSelectContact={handleSelectContact} /> : null}
            {subTab === 'interested' ? (
              <InterestedPanel contacts={contacts} onSelectContact={handleSelectContact} onUnflag={(id) => toggleInterested(id, false)} />
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
            {subTab === 'campaigns' ? <CampaignsPanel /> : null}
            {subTab === 'ai_issues' ? (
              <AIIssuesPanel
                onSelectByPhone={(phone) => {
                  const c = contacts.find((x) => x.phoneNumber === phone);
                  if (c) handleSelectContact(c);
                }}
              />
            ) : null}
            {subTab === 'reservations' ? <VerticalRecordsPanel table="reservations" title="Reservations" fields={['guest_name', 'starts_at', 'party_size', 'status']} /> : null}
            {subTab === 'menu' ? <VerticalRecordsPanel table="menu_items" title="Menu" fields={['name', 'price', 'description']} /> : null}
            {subTab === 'tables' ? <VerticalRecordsPanel table="restaurant_tables" title="Tables" fields={['name', 'seats', 'status']} /> : null}
            {subTab === 'listings' ? <VerticalRecordsPanel table="listings" title="Listings" fields={['title', 'price', 'area_name', 'status']} /> : null}
            {subTab === 'viewings' ? <VerticalRecordsPanel table="viewings" title="Viewings" fields={['starts_at', 'status']} /> : null}
            {subTab === 'leads' ? <VerticalRecordsPanel table="leads" title="Leads" fields={['status', 'intent', 'notes']} /> : null}
            {subTab === 'agents' || subTab === 'staff' || subTab === 'doctors' ? (
              <VerticalRecordsPanel table="tenant_members" title="Team" fields={['display_name', 'email', 'role']} />
            ) : null}
            {subTab === 'catalog' || subTab === 'services' ? <VerticalRecordsPanel table="wellness_services" title="Catalog" fields={['name', 'price', 'duration_min']} /> : null}
            {subTab === 'sessions' ? <VerticalRecordsPanel table="wellness_sessions" title="Calendar" fields={['guest_name', 'scheduled_at', 'status']} /> : null}
            {subTab === 'appointments' ? <VerticalRecordsPanel table="healthcare_appointments" title="Calendar" fields={['patient_name', 'scheduled_at', 'status']} /> : null}
            {subTab === 'courses' ? <VerticalRecordsPanel table="education_courses" title="Courses" fields={['name', 'price', 'age_group']} /> : null}
            {subTab === 'enrollments' ? <VerticalRecordsPanel table="education_enrollments" title="Enrollments" fields={['student_name', 'status', 'created_at']} /> : null}
            {subTab === 'specialties' ? <VerticalRecordsPanel table="healthcare_specialties" title="Specialties" fields={['name']} /> : null}
            {subTab === 'labs' ? <VerticalRecordsPanel table="healthcare_lab_results" title="Labs" fields={['patient_name', 'status']} /> : null}
            {subTab === 'triage' ? <VerticalRecordsPanel table="healthcare_leads" title="Triage" fields={['reason', 'urgency_level', 'status']} /> : null}
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
            flagged: unresolvedFlagged.length,
            ai_issues: unresolvedFlagged.length,
          }}
        />
      ) : null}
      {!showChat ? <View style={{ height: 56 + insets.bottom }} /> : null}

      <Modal visible={showNewChat} transparent animationType="slide" onRequestClose={() => setShowNewChat(false)}>
        <View style={styles.modal}>
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topBar: {
    backgroundColor: colors.header,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(79,70,229,0.3)', alignItems: 'center', justifyContent: 'center' },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  brand: { color: '#fff', fontSize: 16, fontWeight: '800' },
  topActions: { flexDirection: 'row' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modal: { marginTop: 'auto', backgroundColor: colors.card, padding: 16, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
});
