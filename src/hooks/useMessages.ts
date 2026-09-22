import { setMobileBadge } from '@/lib/mobileBridge';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Contact, Message } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';
import { actingHeaders } from '@/lib/actingTenant';
import { toast } from 'sonner';
import { mediaPlaceholder } from '@/lib/chatMedia';
import { enqueueSend, mediaStoragePath, uniqueToken, withRetry } from '@/lib/sendQueue';




const MESSAGES_PAGE_SIZE = 50;
const CONTACT_BATCH_SIZE = 100;
const INITIAL_PREVIEW_COUNT = 150;
const PREVIEW_PAGE_SIZE = 50;
const CONTACT_FETCH_LIMIT = 1500;
// Only the columns the inbox actually renders — `select('*')` pulled large
// notes/tags payloads for thousands of rows and dominated first paint.
const CONTACT_COLUMNS =
  'id,name,handle,phone_number,updated_at,is_interested,interest_reason,interested_at,needs_human,human_requested_at,email,address,notes,tags,ai_enabled,opted_out,opted_out_at,platform,external_id,assigned_member_id,assigned_at,blocked,blocked_at';


export function useMessages() {
  const { tenantId, memberId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<Record<string, boolean>>({});
  const [previewedCount, setPreviewedCount] = useState(0);
  const [loadingMoreContacts, setLoadingMoreContacts] = useState(false);


  const [readContactIds, setReadContactIds] = useState<Set<string>>(new Set());

  // Mark a contact as read locally
  const markAsRead = useCallback((contactId: string) => {
    setReadContactIds((prev) => new Set(prev).add(contactId));
  }, []);

  // Fetch message previews + unread counts for a specific subset of contact IDs
  // and merge into the given contacts array.
  const enrichContactsWithPreviews = useCallback(
    async (allContacts: any[], idsToPreview: string[]): Promise<Contact[]> => {
      const idSet = new Set(idsToPreview);
      const lastMessageMap: Record<string, { content: string; time: string }> = {};
      const unreadCountMap: Record<string, number> = {};

      if (idsToPreview.length > 0) {
        const batches: string[][] = [];
        for (let i = 0; i < idsToPreview.length; i += CONTACT_BATCH_SIZE) {
          batches.push(idsToPreview.slice(i, i + CONTACT_BATCH_SIZE));
        }

        const previewResults = await Promise.all(
          batches.map((batch) =>
            supabase.rpc('get_contact_previews', { p_contact_ids: batch })
          )
        );

        for (const r of previewResults) {
          if (r.error) { console.error(r.error); continue; }
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
        lastMessageTime: idSet.has(c.id) && lastMessageMap[c.id]?.time
          ? new Date(lastMessageMap[c.id].time)
          : c.updated_at
            ? new Date(c.updated_at)
            : undefined,
        unreadCount: idSet.has(c.id) ? (unreadCountMap[c.id] || 0) : 0,
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
    },
    []
  );

  // Initial contacts fetch: load contact rows and previews for the top N.
  // Contacts and unread ids are fetched in parallel so first paint waits on one
  // round-trip instead of two.
  const fetchContacts = useCallback(async () => {
    const [contactsRes, unreadRes] = await Promise.all([
      supabase
        .from('contacts')
        .select(CONTACT_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(CONTACT_FETCH_LIMIT),
      (supabase.rpc as any)('get_unread_contact_ids', {
        p_tenant_id: tenantId,
        p_limit: 2000,
      }).then((r: any) => r, () => ({ data: [] })),
    ]);

    const { data, error } = contactsRes as any;

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }

    if (!data || data.length === 0) {
      setContacts([]);
      setPreviewedCount(0);
      return;
    }

    // Always preview conversations that have unread incoming messages, even when they
    // sit far below the initial page (e.g. replies to a large broadcast).
    const unreadIds = (((unreadRes as any)?.data || []) as any[]).map((r) => r.contact_id);

    const allIds = new Set(data.map((c: any) => c.id));
    const initialIds = Array.from(
      new Set([
        ...data.slice(0, INITIAL_PREVIEW_COUNT).map((c: any) => c.id),
        ...unreadIds.filter((id) => allIds.has(id)),
      ])
    );

    const formatted = await enrichContactsWithPreviews(data, initialIds);
    setContacts(formatted);
    setPreviewedCount(Math.min(INITIAL_PREVIEW_COUNT, data.length));

  }, [tenantId, enrichContactsWithPreviews]);


  // Server-side contact search so numbers outside the loaded page are findable.
  const searchContacts = useCallback(
    async (query: string): Promise<Contact[]> => {
      const raw = query.trim();
      if (!raw || !tenantId) return [];
      const digits = raw.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '');
      const filters: string[] = [
        `name.ilike.%${raw.replace(/[%,]/g, '')}%`,
        `handle.ilike.%${raw.replace(/[%,@]/g, '')}%`,
      ];
      if (digits.length >= 3) filters.push(`phone_number.ilike.%${digits}%`);

      const { data, error } = await supabase
        .from('contacts')
        .select(CONTACT_COLUMNS)
        .eq('tenant_id', tenantId)
        .or(filters.join(','))
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error searching contacts:', error);
        return [];
      }
      if (!data || data.length === 0) return [];
      return enrichContactsWithPreviews(data, data.map((c) => c.id));
    },
    [tenantId, enrichContactsWithPreviews]
  );


  // Load previews for the next batch of older contacts
  const loadMoreContactPreviews = useCallback(async () => {
    if (loadingMoreContacts) return;
    if (previewedCount >= contacts.length) return;
    setLoadingMoreContacts(true);
    try {
      const nextSlice = contacts.slice(previewedCount, previewedCount + PREVIEW_PAGE_SIZE);
      const ids = nextSlice.map((c) => c.id);
      if (ids.length === 0) return;

      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += CONTACT_BATCH_SIZE) {
        batches.push(ids.slice(i, i + CONTACT_BATCH_SIZE));
      }
      const previewResults = await Promise.all(
        batches.map((b) => supabase.rpc('get_contact_previews', { p_contact_ids: b }))
      );

      const lastMessageMap: Record<string, { content: string; time: string }> = {};
      const unreadCountMap: Record<string, number> = {};
      for (const r of previewResults) {
        if (r.error) { console.error(r.error); continue; }
        for (const row of (r.data || []) as any[]) {
          lastMessageMap[row.contact_id] = { content: row.last_content, time: row.last_created_at };
          if (row.unread_count > 0) unreadCountMap[row.contact_id] = row.unread_count;
        }
      }

      setContacts((prev) => prev.map((c) => {
        if (!ids.includes(c.id)) return c;
        const lm = lastMessageMap[c.id];
        return {
          ...c,
          lastMessage: lm?.content ?? c.lastMessage,
          lastMessageTime: lm?.time ? new Date(lm.time) : c.lastMessageTime,
          unreadCount: unreadCountMap[c.id] || 0,
        };
      }));
      setPreviewedCount((n) => n + ids.length);
    } finally {
      setLoadingMoreContacts(false);
    }
  }, [contacts, previewedCount, loadingMoreContacts]);



  // Fetch messages for a contact with pagination (newest first, then reverse for display)
  const fetchMessages = useCallback(async (contactId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Reverse to show oldest first in the UI
    const formattedMessages: Message[] = data.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      timestamp: new Date(m.created_at),
      status: m.status as Message['status'],
      direction: m.direction as Message['direction'],
      mediaUrl: (m as any).media_url || undefined,
      mediaType: (m as any).media_type || undefined,
      platform: ((m as any).platform as Message['platform']) || 'whatsapp',
    }));

    setMessages((prev) => ({ ...prev, [contactId]: formattedMessages }));
    setHasMoreMessages((prev) => ({ ...prev, [contactId]: data.length === MESSAGES_PAGE_SIZE }));

    // Mark incoming delivered messages as read in the database
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('contact_id', contactId)
      .eq('direction', 'incoming')
      .eq('status', 'delivered');

    // Clear unread count when chat is opened
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // Load more (older) messages for a contact
  const loadMoreMessages = useCallback(async (contactId: string) => {
    const currentMessages = messages[contactId] || [];
    if (currentMessages.length === 0) return;

    // Get the oldest message we have
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

      if (error) {
        console.error('Error loading more messages:', error);
        return;
      }

      // Reverse to show oldest first
      const olderMessages: Message[] = data.reverse().map((m) => ({
        id: m.id,
        content: m.content,
        timestamp: new Date(m.created_at),
        status: m.status as Message['status'],
        direction: m.direction as Message['direction'],
        mediaUrl: (m as any).media_url || undefined,
        mediaType: (m as any).media_type || undefined,
        platform: ((m as any).platform as Message['platform']) || 'whatsapp',
      }));

      setMessages((prev) => ({
        ...prev,
        [contactId]: [...olderMessages, ...prev[contactId]],
      }));
      setHasMoreMessages((prev) => ({ ...prev, [contactId]: data.length === MESSAGES_PAGE_SIZE }));
    } finally {
      setLoadingMoreMessages((prev) => ({ ...prev, [contactId]: false }));
    }
  }, [messages]);

  // Send a message (with optional media: image, voice note or file).
  // Sends for the same contact are queued so rapid image → text → file bursts
  // all go out, in order, instead of racing each other.
  const sendMessage = useCallback(async (contact: Contact, content: string, mediaFile?: File) => {
    const placeholder = mediaFile ? mediaPlaceholder(mediaFile.type, mediaFile.name) : '';
    const tempId = `temp-${uniqueToken()}`;

    // Optimistically add the message immediately so the UI reflects the order
    // the user sent things in, even while earlier items are still uploading.
    const tempMessage: Message = {
      id: tempId,
      content: content || placeholder,
      timestamp: new Date(),
      status: 'sending',
      direction: 'outgoing',
      mediaUrl: mediaFile && mediaFile.type.startsWith('image/') ? URL.createObjectURL(mediaFile) : undefined,
      mediaType: mediaFile?.type || undefined,
    };

    setMessages((prev) => ({
      ...prev,
      [contact.id]: [...(prev[contact.id] || []), tempMessage],
    }));

    const markFailed = () =>
      setMessages((prev) => ({
        ...prev,
        [contact.id]: (prev[contact.id] || []).map((m) =>
          m.id === tempId ? { ...m, status: 'failed' as const } : m
        ),
      }));

    return enqueueSend(`chat:${contact.id}`, async () => {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      try {
        if (mediaFile) {
          const filePath = mediaStoragePath(contact.id, mediaFile.name);
          const { data: uploadData, error: uploadError } = await withRetry(async () => {
            const res = await supabase.storage
              .from('chat-media')
              .upload(filePath, mediaFile, {
                contentType: mediaFile.type || 'application/octet-stream',
                upsert: true,
              });
            if (res.error) throw res.error;
            return res;
          });

          if (uploadError || !uploadData) throw uploadError || new Error('Upload failed');

          mediaUrl = supabase.storage.from('chat-media').getPublicUrl(uploadData.path).data.publicUrl;
          mediaType = mediaFile.type || 'application/octet-stream';
        }

        const platform = contact.platform || 'whatsapp';
        const data = await withRetry(async () => {
          const res =
            platform === 'instagram'
              ? await supabase.functions.invoke('send-instagram', {
                  headers: actingHeaders(),
                  body: { contactId: contact.id, message: content, mediaUrl, mediaType },
                })
              : await supabase.functions.invoke('send-whatsapp', {
                  headers: actingHeaders(),
                  body: {
                    to: contact.phoneNumber,
                    message: content,
                    mediaUrl,
                    mediaType,
                    fileName: mediaFile?.name,
                  },
                });
          if (res.error) throw res.error;
          if ((res.data as any)?.error) throw new Error((res.data as any).error);
          return res.data;
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
              : m
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
        console.error('Failed to send message:', error);
        markFailed();
        const description = error instanceof Error ? error.message : undefined;
        if ((contact.platform || 'whatsapp') === 'instagram') {
          toast.error("Couldn't send this Instagram DM", {
            description:
              'Instagram only allows replies within 24 hours of the customer’s last message.',
          });
        } else {
          toast.error(
            mediaFile ? `Couldn't send ${mediaFile.name}` : "Couldn't send that message",
            { description },
          );
        }
      }
    });
  }, []);


  // Create a new contact (manual contacts are always WhatsApp)
  const createContact = useCallback(async (name: string, phoneNumber: string) => {
    const { data, error } = await supabase
      .from('contacts')
      .insert({ name, phone_number: phoneNumber, tenant_id: tenantId, platform: 'whatsapp' } as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return null;
    }

    const newContact: Contact = {
      id: data.id,
      name: data.name || data.phone_number,
      phoneNumber: data.phone_number,
      platform: 'whatsapp',
    };

    setContacts((prev) => [newContact, ...prev]);
    setMessages((prev) => ({ ...prev, [data.id]: [] }));
    setHasMoreMessages((prev) => ({ ...prev, [data.id]: false }));

    return newContact;
  }, []);

  // Delete one or more messages from a conversation
  const deleteMessages = useCallback(async (contactId: string, messageIds: string[]) => {
    if (messageIds.length === 0) return true;
    const { error } = await supabase.from('messages').delete().in('id', messageIds);
    if (error) {
      console.error('Error deleting messages:', error);
      toast.error("Couldn't delete the selected messages");
      return false;
    }
    const removed = new Set(messageIds);
    setMessages((prev) => ({
      ...prev,
      [contactId]: (prev[contactId] || []).filter((m) => !removed.has(m.id)),
    }));
    toast.success(messageIds.length > 1 ? `${messageIds.length} messages deleted` : 'Message deleted');
    return true;
  }, []);

  // Delete every message in a conversation but keep the contact
  const clearChatMessages = useCallback(async (contactId: string) => {
    const { error } = await supabase.from('messages').delete().eq('contact_id', contactId);
    if (error) {
      console.error('Error clearing chat:', error);
      toast.error("Couldn't clear this chat");
      return false;
    }
    setMessages((prev) => ({ ...prev, [contactId]: [] }));
    setHasMoreMessages((prev) => ({ ...prev, [contactId]: false }));
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c)),
    );
    toast.success('Chat cleared');
    return true;
  }, []);

  // Block / unblock a contact: the bot stops replying and we stop tracking them
  const toggleBlocked = useCallback(async (contactId: string, blocked: boolean) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, blocked, blockedAt: blocked ? new Date() : undefined } : c,
      ),
    );
    const { error } = await supabase
      .from('contacts')
      .update({
        blocked,
        blocked_at: blocked ? new Date().toISOString() : null,
        ...(blocked ? { ai_enabled: false } : {}),
      } as any)
      .eq('id', contactId);
    if (error) {
      console.error('Error toggling blocked:', error);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, blocked: !blocked } : c)));
      toast.error(error.message || "Couldn't update this contact");
      return false;
    }
    toast.success(blocked ? 'Contact blocked' : 'Contact unblocked');
    return true;
  }, []);

  // Delete a contact and its messages
  const deleteChat = useCallback(async (contactId: string) => {
    // Delete messages first (due to foreign key constraint)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('contact_id', contactId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      return false;
    }

    // Delete the contact
    const { error: contactError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (contactError) {
      console.error('Error deleting contact:', contactError);
      return false;
    }

    // Update local state
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages[contactId];
      return newMessages;
    });
    setHasMoreMessages((prev) => {
      const newState = { ...prev };
      delete newState[contactId];
      return newState;
    });

    return true;
  }, []);

  // Update contact CRM fields (name, email, address, notes, tags)
  const updateContact = useCallback(async (
    contactId: string,
    updates: { name?: string; email?: string | null; address?: string | null; notes?: string | null; tags?: string[] } | string
  ) => {
    // Backwards compatible: allow passing just a name string
    const payload: any = typeof updates === 'string' ? { name: updates } : { ...updates };

    const { error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', contactId);

    if (error) {
      console.error('Error updating contact:', error);
      return false;
    }

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
          : c
      )
    );

    return true;
  }, []);

  // Toggle the "interested" flag manually
  const toggleInterested = useCallback(async (contactId: string, isInterested: boolean, reason?: string) => {
    const payload: any = {
      is_interested: isInterested,
      interest_reason: isInterested ? (reason || 'Manually flagged') : null,
      interested_at: isInterested ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('contacts').update(payload).eq('id', contactId);
    if (error) {
      console.error('Error toggling interested:', error);
      return false;
    }
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              isInterested,
              interestReason: isInterested ? (reason || 'Manually flagged') : undefined,
              interestedAt: isInterested ? new Date() : undefined,
            }
          : c
      )
    );
    return true;
  }, []);

  // Toggle the "needs human" flag manually (retries once on transient failures)
  const toggleNeedsHuman = useCallback(async (contactId: string, needsHuman: boolean) => {
    // Keep human_requested_at when resolving so the "Resolved" history survives reloads.
    const payload: any = needsHuman
      ? { needs_human: true, human_requested_at: new Date().toISOString() }
      : { needs_human: false };

    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', contactId)
          .select('id');
        if (!error && data && data.length > 0) {
          lastError = null;
          break;
        }
        lastError = error || new Error('Contact not found or not permitted');
      } catch (e) {
        lastError = e;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }

    if (lastError) {
      console.error('Error toggling needs_human:', lastError);
      toast.error(lastError?.message ? `Update failed: ${lastError.message}` : 'Update failed');
      return false;
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, needsHuman, humanRequestedAt: needsHuman ? new Date() : c.humanRequestedAt }
          : c
      )
    );
    return true;
  }, []);


  // Toggle per-chat AI auto-replies (optimistic + guard against rapid clicks)
  const toggleAiEnabled = useCallback(async (contactId: string, aiEnabled: boolean) => {
    // Optimistically update local state so the icon flips immediately.
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, aiEnabled } : c))
    );
    const { error } = await supabase
      .from('contacts')
      .update({ ai_enabled: aiEnabled } as any)
      .eq('id', contactId);
    if (error) {
      console.error('Error toggling ai_enabled:', error);
      // Roll back on failure so the UI matches the DB again.
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, aiEnabled: !aiEnabled } : c))
      );
      return false;
    }
    return true;
  }, []);

  // Assign / reassign / unassign a conversation to a team member.
  // Employees may only claim an unassigned chat or release their own; the
  // database enforces that rule, so a rejected change rolls back here.
  const assignContact = useCallback(
    async (contactId: string, newMemberId: string | null) => {
      const previous = contacts.find((c) => c.id === contactId)?.assignedMemberId ?? null;
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, assignedMemberId: newMemberId, assignedAt: newMemberId ? new Date() : undefined }
            : c,
        ),
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
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, assignedMemberId: previous } : c)),
        );
        toast.error(error.message || 'Could not change the assignment');
        return false;
      }
      toast.success(newMemberId ? 'Chat assigned' : 'Chat unassigned');
      return true;
    },
    [contacts, memberId],
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

  // Keep fetchContacts in a ref so the realtime effect doesn't tear down/recreate
  // the channel every time the callback identity changes.
  const fetchContactsRef = useRef(fetchContacts);
  useEffect(() => { fetchContactsRef.current = fetchContacts; }, [fetchContacts]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channelId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    const channel = supabase
      .channel(`messages-changes-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          console.log('New message received:', payload);
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
            if (contactMessages.some((m) => m.id === newMsg.id)) {
              return prev;
            }
            return {
              ...prev,
              [newMsg.contact_id]: [...contactMessages, message],
            };
          });

          // Update contact with last message info and unread count
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
        }
      )
      .subscribe((status) => {
        console.log('[realtime] messages channel:', status);
      });

    // Subscribe to new contacts (created by webhooks)
    const contactsChannel = supabase
      .channel(`contacts-changes-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
        },
        (payload) => {
          console.log('New contact received:', payload);
          const newContact = payload.new as any;
          setContacts((prev) => {
            if (prev.some((c) => c.id === newContact.id)) {
              return prev;
            }
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
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
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
                : c
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('[realtime] contacts channel:', status);
      });

    // Resync on tab visibility / network reconnect so we don't miss inserts
    // that happened while the socket was dropped or the tab was hidden.
    const resync = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      console.log('[realtime] resync triggered');
      fetchContactsRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    const onOnline = () => resync();
    const onImported = () => fetchContactsRef.current();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('jawabify:contacts-imported', onImported);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(contactsChannel);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('jawabify:contacts-imported', onImported);
    };
  }, []);


  // Keep the native app icon badge in sync with total unread messages.
  const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  useEffect(() => {
    setMobileBadge(totalUnread);
  }, [totalUnread]);

  const hasMoreContactPreviews = previewedCount < contacts.length;

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
    hasMoreContactPreviews,
    loadingMoreContacts,
    searchContacts,
    assignContact,
    deleteMessages,
    clearChatMessages,
    toggleBlocked,

  };
}

