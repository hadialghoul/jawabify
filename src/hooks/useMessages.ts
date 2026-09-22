import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { Contact, Message, MediaFile } from '../types';
import { useAuth } from './useAuth';
import { actingHeaders } from '../lib/actingTenant';
import { mediaPlaceholder } from '../lib/chatMedia';
import { enqueueSend, mediaStoragePath, uniqueToken, withRetry } from '../lib/sendQueue';
import { useToast } from './useToast';

const MESSAGES_PAGE_SIZE = 50;
const CONTACT_BATCH_SIZE = 100;
const INITIAL_PREVIEW_COUNT = 150;
const PREVIEW_PAGE_SIZE = 50;
const CONTACT_FETCH_LIMIT = 1500;
const CONTACT_COLUMNS =
  'id,name,handle,phone_number,updated_at,is_interested,interest_reason,interested_at,needs_human,human_requested_at,email,address,notes,tags,ai_enabled,opted_out,opted_out_at,platform,external_id,assigned_member_id,assigned_at,blocked,blocked_at';

export function useMessages() {
  const { tenantId, memberId } = useAuth();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<Record<string, boolean>>({});
  const [previewedCount, setPreviewedCount] = useState(0);
  const [loadingMoreContacts, setLoadingMoreContacts] = useState(false);

  const enrichContactsWithPreviews = useCallback(async (allContacts: any[], idsToPreview: string[]): Promise<Contact[]> => {
    const idSet = new Set(idsToPreview);
    const lastMessageMap: Record<string, { content: string; time: string }> = {};
    const unreadCountMap: Record<string, number> = {};

    if (idsToPreview.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < idsToPreview.length; i += CONTACT_BATCH_SIZE) {
        batches.push(idsToPreview.slice(i, i + CONTACT_BATCH_SIZE));
      }
      const previewResults = await Promise.all(
        batches.map((batch) => supabase.rpc('get_contact_previews', { p_contact_ids: batch })),
      );
      for (const r of previewResults) {
        if (r.error) continue;
        for (const row of (r.data || []) as any[]) {
          lastMessageMap[row.contact_id] = { content: row.last_content, time: row.last_created_at };
          if (row.unread_count > 0) unreadCountMap[row.contact_id] = row.unread_count;
        }
      }
    }

    return allContacts.map((c: any) => ({
      id: c.id,
      name: c.name || c.handle || c.phone_number,
      phoneNumber: c.phone_number,
      lastMessage: idSet.has(c.id) ? lastMessageMap[c.id]?.content : undefined,
      lastMessageTime:
        idSet.has(c.id) && lastMessageMap[c.id]?.time
          ? new Date(lastMessageMap[c.id].time)
          : c.updated_at
            ? new Date(c.updated_at)
            : undefined,
      unreadCount: idSet.has(c.id) ? unreadCountMap[c.id] || 0 : 0,
      isInterested: !!c.is_interested,
      interestReason: c.interest_reason || undefined,
      interestedAt: c.interested_at ? new Date(c.interested_at) : undefined,
      needsHuman: !!c.needs_human,
      humanRequestedAt: c.human_requested_at ? new Date(c.human_requested_at) : undefined,
      email: c.email || undefined,
      address: c.address || undefined,
      notes: c.notes || undefined,
      tags: Array.isArray(c.tags) ? c.tags : [],
      aiEnabled: c.ai_enabled !== false,
      optedOut: !!c.opted_out,
      optedOutAt: c.opted_out_at ? new Date(c.opted_out_at) : undefined,
      platform: (c.platform as Contact['platform']) || 'whatsapp',
      externalId: c.external_id || undefined,
      handle: c.handle || undefined,
      assignedMemberId: c.assigned_member_id ?? null,
      assignedAt: c.assigned_at ? new Date(c.assigned_at) : undefined,
      blocked: !!c.blocked,
      blockedAt: c.blocked_at ? new Date(c.blocked_at) : undefined,
    }));
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!tenantId) return;
    const [contactsRes, unreadRes] = await Promise.all([
      supabase.from('contacts').select(CONTACT_COLUMNS).eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(CONTACT_FETCH_LIMIT),
      (supabase.rpc as any)('get_unread_contact_ids', { p_tenant_id: tenantId, p_limit: 2000 }).then((r: any) => r, () => ({ data: [] })),
    ]);
    const { data, error } = contactsRes as any;
    if (error) {
      toast.error(error.message || 'Failed to load conversations');
      setContacts([]);
      setPreviewedCount(0);
      return;
    }
    if (!data || data.length === 0) {
      setContacts([]);
      setPreviewedCount(0);
      return;
    }
    const unreadIds = (((unreadRes as any)?.data || []) as any[]).map((r) => r.contact_id);
    const allIds = new Set(data.map((c: any) => c.id));
    const initialIds = Array.from(
      new Set([...data.slice(0, INITIAL_PREVIEW_COUNT).map((c: any) => c.id), ...unreadIds.filter((id: string) => allIds.has(id))]),
    );
    setContacts(await enrichContactsWithPreviews(data, initialIds));
    setPreviewedCount(Math.min(INITIAL_PREVIEW_COUNT, data.length));
  }, [tenantId, enrichContactsWithPreviews, toast]);

  const searchContacts = useCallback(
    async (query: string): Promise<Contact[]> => {
      const raw = query.trim();
      if (!raw || !tenantId) return [];
      const digits = raw.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '');
      const filters: string[] = [`name.ilike.%${raw.replace(/[%,]/g, '')}%`, `handle.ilike.%${raw.replace(/[%,@]/g, '')}%`];
      if (digits.length >= 3) filters.push(`phone_number.ilike.%${digits}%`);
      const { data, error } = await supabase
        .from('contacts')
        .select(CONTACT_COLUMNS)
        .eq('tenant_id', tenantId)
        .or(filters.join(','))
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error || !data?.length) return [];
      return enrichContactsWithPreviews(data, data.map((c) => c.id));
    },
    [tenantId, enrichContactsWithPreviews],
  );

  const loadMoreContactPreviews = useCallback(async () => {
    if (loadingMoreContacts || previewedCount >= contacts.length) return;
    setLoadingMoreContacts(true);
    try {
      const nextSlice = contacts.slice(previewedCount, previewedCount + PREVIEW_PAGE_SIZE);
      const ids = nextSlice.map((c) => c.id);
      if (!ids.length) return;
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += CONTACT_BATCH_SIZE) batches.push(ids.slice(i, i + CONTACT_BATCH_SIZE));
      const previewResults = await Promise.all(batches.map((b) => supabase.rpc('get_contact_previews', { p_contact_ids: b })));
      const lastMessageMap: Record<string, { content: string; time: string }> = {};
      const unreadCountMap: Record<string, number> = {};
      for (const r of previewResults) {
        if (r.error) continue;
        for (const row of (r.data || []) as any[]) {
          lastMessageMap[row.contact_id] = { content: row.last_content, time: row.last_created_at };
          if (row.unread_count > 0) unreadCountMap[row.contact_id] = row.unread_count;
        }
      }
      setContacts((prev) =>
        prev.map((c) => {
          if (!ids.includes(c.id)) return c;
          const lm = lastMessageMap[c.id];
          return {
            ...c,
            lastMessage: lm?.content ?? c.lastMessage,
            lastMessageTime: lm?.time ? new Date(lm.time) : c.lastMessageTime,
            unreadCount: unreadCountMap[c.id] || 0,
          };
        }),
      );
      setPreviewedCount((n) => n + ids.length);
    } finally {
      setLoadingMoreContacts(false);
    }
  }, [contacts, previewedCount, loadingMoreContacts]);

  const fetchMessages = useCallback(async (contactId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);
    if (error || !data) return;
    const formattedMessages: Message[] = data.reverse().map((m: any) => ({
      id: m.id,
      content: m.content,
      timestamp: new Date(m.created_at),
      status: m.status as Message['status'],
      direction: m.direction as Message['direction'],
      mediaUrl: m.media_url || undefined,
      mediaType: m.media_type || undefined,
      platform: (m.platform as Message['platform']) || 'whatsapp',
    }));
    setMessages((prev) => ({ ...prev, [contactId]: formattedMessages }));
    setHasMoreMessages((prev) => ({ ...prev, [contactId]: data.length === MESSAGES_PAGE_SIZE }));
    await supabase.from('messages').update({ status: 'read' }).eq('contact_id', contactId).eq('direction', 'incoming').eq('status', 'delivered');
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const loadMoreMessages = useCallback(
    async (contactId: string) => {
      const currentMessages = messages[contactId] || [];
      if (!currentMessages.length) return;
      const oldestMessage = currentMessages[0];
      setLoadingMoreMessages((prev) => ({ ...prev, [contactId]: true }));
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('contact_id', contactId)
          .lt('created_at', oldestMessage.timestamp.toISOString())
          .order('created_at', { ascending: false })
          .limit(MESSAGES_PAGE_SIZE);
        if (error || !data) return;
        const olderMessages: Message[] = data.reverse().map((m: any) => ({
          id: m.id,
          content: m.content,
          timestamp: new Date(m.created_at),
          status: m.status as Message['status'],
          direction: m.direction as Message['direction'],
          mediaUrl: m.media_url || undefined,
          mediaType: m.media_type || undefined,
          platform: (m.platform as Message['platform']) || 'whatsapp',
        }));
        setMessages((prev) => ({ ...prev, [contactId]: [...olderMessages, ...prev[contactId]] }));
        setHasMoreMessages((prev) => ({ ...prev, [contactId]: data.length === MESSAGES_PAGE_SIZE }));
      } finally {
        setLoadingMoreMessages((prev) => ({ ...prev, [contactId]: false }));
      }
    },
    [messages],
  );

  const sendMessage = useCallback(
    async (contact: Contact, content: string, mediaFile?: MediaFile) => {
      const placeholder = mediaFile ? mediaPlaceholder(mediaFile.type, mediaFile.name) : '';
      const tempId = `temp-${uniqueToken()}`;
      const tempMessage: Message = {
        id: tempId,
        content: content || placeholder,
        timestamp: new Date(),
        status: 'sending',
        direction: 'outgoing',
        mediaUrl: mediaFile && mediaFile.type.startsWith('image/') ? mediaFile.uri : undefined,
        mediaType: mediaFile?.type || undefined,
      };
      setMessages((prev) => ({ ...prev, [contact.id]: [...(prev[contact.id] || []), tempMessage] }));
      const markFailed = () =>
        setMessages((prev) => ({
          ...prev,
          [contact.id]: (prev[contact.id] || []).map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m)),
        }));

      return enqueueSend(`chat:${contact.id}`, async () => {
        let mediaUrl: string | undefined;
        let mediaType: string | undefined;
        try {
          if (mediaFile) {
            const filePath = mediaStoragePath(contact.id, mediaFile.name);
            const res = await withRetry(async () => {
              const fileRes = await fetch(mediaFile.uri);
              const blob = await fileRes.blob();
              const upload = await supabase.storage.from('chat-media').upload(filePath, blob, {
                contentType: mediaFile.type || 'application/octet-stream',
                upsert: true,
              });
              if (upload.error) throw upload.error;
              return upload;
            });
            mediaUrl = supabase.storage.from('chat-media').getPublicUrl(res.data.path).data.publicUrl;
            mediaType = mediaFile.type || 'application/octet-stream';
          }
          const platform = contact.platform || 'whatsapp';
          const data = await withRetry(async () => {
            const invokeRes =
              platform === 'instagram'
                ? await supabase.functions.invoke('send-instagram', {
                    headers: actingHeaders(),
                    body: { contactId: contact.id, message: content, mediaUrl, mediaType },
                  })
                : await supabase.functions.invoke('send-whatsapp', {
                    headers: actingHeaders(),
                    body: { to: contact.phoneNumber, message: content, mediaUrl, mediaType, fileName: mediaFile?.name },
                  });
            if (invokeRes.error) throw invokeRes.error;
            if ((invokeRes.data as any)?.error) throw new Error((invokeRes.data as any).error);
            return invokeRes.data;
          });
          const { data: dbMessage, error: dbError } = await supabase
            .from('messages')
            .insert({
              contact_id: contact.id,
              content: content || placeholder,
              direction: 'outgoing',
              status: 'sent',
              platform,
              twilio_sid: (data as any)?.messageSid || null,
              media_url: mediaUrl,
              media_type: mediaType,
              sent_by_member_id: memberId,
            } as any)
            .select()
            .single();
          if (dbError) throw dbError;
          setMessages((prev) => ({
            ...prev,
            [contact.id]: (prev[contact.id] || []).map((m) =>
              m.id === tempId
                ? {
                    id: dbMessage.id,
                    content: dbMessage.content,
                    timestamp: new Date(dbMessage.created_at),
                    status: 'delivered' as const,
                    direction: 'outgoing' as const,
                    mediaUrl: (dbMessage as any).media_url || undefined,
                    mediaType: (dbMessage as any).media_type || undefined,
                  }
                : m,
            ),
          }));
          setContacts((prev) => {
            const updated = prev.map((c) => (c.id === contact.id ? { ...c } : c));
            const contactIndex = updated.findIndex((c) => c.id === contact.id);
            if (contactIndex > 0) {
              const [movedContact] = updated.splice(contactIndex, 1);
              updated.unshift(movedContact);
            }
            return updated;
          });
        } catch (error) {
          markFailed();
          toast.error(mediaFile ? `Couldn't send ${mediaFile.name}` : "Couldn't send that message");
        }
      });
    },
    [memberId, toast],
  );

  const createContact = useCallback(
    async (name: string, phoneNumber: string) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({ name, phone_number: phoneNumber, tenant_id: tenantId, platform: 'whatsapp' } as any)
        .select()
        .single();
      if (error || !data) return null;
      const newContact: Contact = { id: data.id, name: data.name || data.phone_number, phoneNumber: data.phone_number, platform: 'whatsapp' };
      setContacts((prev) => [newContact, ...prev]);
      setMessages((prev) => ({ ...prev, [data.id]: [] }));
      return newContact;
    },
    [tenantId],
  );

  const deleteMessages = useCallback(async (contactId: string, messageIds: string[]) => {
    if (!messageIds.length) return true;
    const { error } = await supabase.from('messages').delete().in('id', messageIds);
    if (error) {
      toast.error("Couldn't delete the selected messages");
      return false;
    }
    const removed = new Set(messageIds);
    setMessages((prev) => ({ ...prev, [contactId]: (prev[contactId] || []).filter((m) => !removed.has(m.id)) }));
    toast.success(messageIds.length > 1 ? `${messageIds.length} messages deleted` : 'Message deleted');
    return true;
  }, [toast]);

  const clearChatMessages = useCallback(async (contactId: string) => {
    const { error } = await supabase.from('messages').delete().eq('contact_id', contactId);
    if (error) {
      toast.error("Couldn't clear this chat");
      return false;
    }
    setMessages((prev) => ({ ...prev, [contactId]: [] }));
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c)));
    toast.success('Chat cleared');
    return true;
  }, [toast]);

  const toggleBlocked = useCallback(async (contactId: string, blocked: boolean) => {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, blocked, blockedAt: blocked ? new Date() : undefined } : c)));
    const { error } = await supabase
      .from('contacts')
      .update({ blocked, blocked_at: blocked ? new Date().toISOString() : null, ...(blocked ? { ai_enabled: false } : {}) } as any)
      .eq('id', contactId);
    if (error) {
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, blocked: !blocked } : c)));
      toast.error("Couldn't update this contact");
      return false;
    }
    toast.success(blocked ? 'Contact blocked' : 'Contact unblocked');
    return true;
  }, [toast]);

  const deleteChat = useCallback(async (contactId: string) => {
    const { error: messagesError } = await supabase.from('messages').delete().eq('contact_id', contactId);
    if (messagesError) return false;
    const { error: contactError } = await supabase.from('contacts').delete().eq('id', contactId);
    if (contactError) return false;
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    return true;
  }, []);

  const updateContact = useCallback(async (contactId: string, updates: { name?: string; email?: string | null; address?: string | null; notes?: string | null; tags?: string[] } | string) => {
    const payload: any = typeof updates === 'string' ? { name: updates } : { ...updates };
    const { error } = await supabase.from('contacts').update(payload).eq('id', contactId);
    if (error) return false;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              ...(payload.name !== undefined ? { name: payload.name } : {}),
              ...(payload.email !== undefined ? { email: payload.email || undefined } : {}),
              ...(payload.address !== undefined ? { address: payload.address || undefined } : {}),
              ...(payload.notes !== undefined ? { notes: payload.notes || undefined } : {}),
              ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
            }
          : c,
      ),
    );
    return true;
  }, []);

  const toggleInterested = useCallback(async (contactId: string, isInterested: boolean, reason?: string) => {
    const payload: any = {
      is_interested: isInterested,
      interest_reason: isInterested ? reason || 'Manually flagged' : null,
      interested_at: isInterested ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('contacts').update(payload).eq('id', contactId);
    if (error) return false;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, isInterested, interestReason: isInterested ? reason || 'Manually flagged' : undefined, interestedAt: isInterested ? new Date() : undefined }
          : c,
      ),
    );
    return true;
  }, []);

  const toggleNeedsHuman = useCallback(async (contactId: string, needsHuman: boolean) => {
    const payload: any = needsHuman ? { needs_human: true, human_requested_at: new Date().toISOString() } : { needs_human: false };
    const { error } = await supabase.from('contacts').update(payload).eq('id', contactId).select('id');
    if (error) {
      toast.error('Update failed');
      return false;
    }
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, needsHuman, humanRequestedAt: needsHuman ? new Date() : c.humanRequestedAt } : c)),
    );
    return true;
  }, [toast]);

  const toggleAiEnabled = useCallback(async (contactId: string, aiEnabled: boolean) => {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, aiEnabled } : c)));
    const { error } = await supabase.from('contacts').update({ ai_enabled: aiEnabled } as any).eq('id', contactId);
    if (error) {
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, aiEnabled: !aiEnabled } : c)));
      return false;
    }
    return true;
  }, []);

  const assignContact = useCallback(
    async (contactId: string, newMemberId: string | null) => {
      const previous = contacts.find((c) => c.id === contactId)?.assignedMemberId ?? null;
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, assignedMemberId: newMemberId, assignedAt: newMemberId ? new Date() : undefined } : c)),
      );
      const { error } = await supabase
        .from('contacts')
        .update({
          assigned_member_id: newMemberId,
          assigned_at: newMemberId ? new Date().toISOString() : null,
          assigned_by_member_id: newMemberId ? memberId : null,
        } as any)
        .eq('id', contactId);
      if (error) {
        setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, assignedMemberId: previous } : c)));
        toast.error('Could not change the assignment');
        return false;
      }
      toast.success(newMemberId ? 'Chat assigned' : 'Chat unassigned');
      return true;
    },
    [contacts, memberId, toast],
  );

  useEffect(() => {
    if (!tenantId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchContacts().finally(() => setLoading(false));
  }, [fetchContacts, tenantId]);

  const fetchContactsRef = useRef(fetchContacts);
  useEffect(() => {
    fetchContactsRef.current = fetchContacts;
  }, [fetchContacts]);

  useEffect(() => {
    const channelId = `${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(`messages-changes-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as any;
        const message: Message = {
          id: newMsg.id,
          content: newMsg.content,
          timestamp: new Date(newMsg.created_at),
          status: newMsg.status as Message['status'],
          direction: newMsg.direction as Message['direction'],
          mediaUrl: newMsg.media_url || undefined,
          mediaType: newMsg.media_type || undefined,
          platform: (newMsg.platform as Message['platform']) || 'whatsapp',
        };
        setMessages((prev) => {
          const contactMessages = prev[newMsg.contact_id] || [];
          if (contactMessages.some((m) => m.id === newMsg.id)) return prev;
          return { ...prev, [newMsg.contact_id]: [...contactMessages, message] };
        });
        if (newMsg.direction === 'incoming') {
          setContacts((prev) => {
            const contactIndex = prev.findIndex((c) => c.id === newMsg.contact_id);
            if (contactIndex === -1) {
              fetchContactsRef.current();
              return prev;
            }
            const updated = [...prev];
            const contact = { ...updated[contactIndex] };
            contact.lastMessage = newMsg.content;
            contact.lastMessageTime = new Date(newMsg.created_at);
            contact.unreadCount = (contact.unreadCount || 0) + 1;
            updated.splice(contactIndex, 1);
            updated.unshift(contact);
            return updated;
          });
        } else {
          setContacts((prev) => {
            const contactIndex = prev.findIndex((c) => c.id === newMsg.contact_id);
            if (contactIndex === -1) return prev;
            const updated = [...prev];
            const contact = { ...updated[contactIndex] };
            contact.lastMessage = newMsg.content;
            contact.lastMessageTime = new Date(newMsg.created_at);
            updated[contactIndex] = contact;
            return updated;
          });
        }
      })
      .subscribe();

    const contactsChannel = supabase
      .channel(`contacts-changes-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, (payload) => {
        const newContact = payload.new as any;
        setContacts((prev) => {
          if (prev.some((c) => c.id === newContact.id)) return prev;
          return [
            {
              id: newContact.id,
              name: newContact.name || newContact.handle || newContact.phone_number,
              phoneNumber: newContact.phone_number,
              platform: (newContact.platform as Contact['platform']) || 'whatsapp',
              handle: newContact.handle || undefined,
              lastMessageTime: new Date(newContact.created_at || Date.now()),
              unreadCount: 1,
            },
            ...prev,
          ];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts' }, (payload) => {
        const updated = payload.new as any;
        setContacts((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? {
                  ...c,
                  name: updated.name || c.name,
                  isInterested: !!updated.is_interested,
                  interestReason: updated.interest_reason || undefined,
                  interestedAt: updated.interested_at ? new Date(updated.interested_at) : undefined,
                  needsHuman: !!updated.needs_human,
                  aiEnabled: updated.ai_enabled !== false,
                  humanRequestedAt: updated.human_requested_at ? new Date(updated.human_requested_at) : undefined,
                  assignedMemberId: updated.assigned_member_id ?? null,
                  assignedAt: updated.assigned_at ? new Date(updated.assigned_at) : undefined,
                  blocked: !!updated.blocked,
                  blockedAt: updated.blocked_at ? new Date(updated.blocked_at) : undefined,
                }
              : c,
          ),
        );
      })
      .subscribe();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchContactsRef.current();
    });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(contactsChannel);
      sub.remove();
    };
  }, []);

  return {
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
    hasMoreContactPreviews: previewedCount < contacts.length,
    loadingMoreContacts,
    searchContacts,
    assignContact,
    deleteMessages,
    clearChatMessages,
    toggleBlocked,
  };
}
