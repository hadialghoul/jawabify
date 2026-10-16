import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { FileText, Megaphone, Plus, RefreshCw, Send, Trash2 } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { invokeErrorMessage } from '../../lib/functionError';
import { importCampaignBuffer, normalizePhone, parsePastedNumbers, splitKnownContacts } from '../../lib/jawabifyOctUpdates';
import { useAuth } from '../../hooks/useAuth';
import { actingHeaders } from '../../lib/actingTenant';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Input } from '../ui';
import { KeyboardSheet } from '../KeyboardSheet';
import { colors, radius } from '../../theme';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config';
import type { Contact, Order } from '../../types';
import { contactsWithoutOrders } from '../../lib/contactsWithoutOrders';

interface Campaign {
  id: string;
  name: string;
  template_name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
];

export function CampaignsPanel({
  contacts = [],
  orders = [],
  tenantId: tenantOverride,
  launchAudience,
  launchKey,
}: {
  contacts?: Contact[];
  orders?: Order[];
  tenantId?: string;
  /** When set (e.g. from No order yet → Campaign), open create with that audience. */
  launchAudience?: 'interested' | 'no_order' | null;
  launchKey?: number;
}) {
  const { tenantId: authTenantId, session } = useAuth();
  const tenantId = tenantOverride ?? authTenantId;
  const toast = useToast();
  const requestHeaders = () => (tenantOverride ? { 'x-acting-tenant': tenantOverride } : actingHeaders());
  const waContacts = useMemo(() => contacts.filter((c) => c.platform === 'whatsapp' || !c.platform), [contacts]);
  const noOrderIds = useMemo(
    () => new Set(contactsWithoutOrders(contacts, orders).map((c) => c.id)),
    [contacts, orders],
  );
  const [tab, setTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [audience, setAudience] = useState<'all' | 'interested' | 'flagged' | 'no_order'>('all');
  const [sending, setSending] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('MARKETING');
  const [tplLanguage, setTplLanguage] = useState('en_US');
  const [tplBody, setTplBody] = useState('');
  const [tplHeader, setTplHeader] = useState('');
  const [tplFooter, setTplFooter] = useState('');
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [numberText, setNumberText] = useState('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [importNote, setImportNote] = useState('');

  const loadCampaigns = useCallback(async () => {
    if (!tenantId) {
      setCampaigns([]);
      return;
    }
    const { data } = await supabase.from('campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
    setCampaigns((data as Campaign[]) || []);
  }, [tenantId]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('whatsapp-templates', { headers: requestHeaders(), method: 'GET' });
      const list: Template[] = res.data?.data || [];
      setTemplates(list.filter((t) => !String(t.status || '').toUpperCase().includes('DELETED')));
    } catch {
      setTemplates([]);
    }
  }, [tenantOverride]);

  useEffect(() => {
    setLoadingCampaigns(true);
    loadCampaigns().finally(() => setLoadingCampaigns(false));
  }, [loadCampaigns]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!launchAudience || !launchKey) return;
    setAudience(launchAudience);
    setShowCreate(true);
  }, [launchAudience, launchKey]);

  const approved = templates.filter((t) => String(t.status).toUpperCase() === 'APPROVED');
  const selectedTemplate = approved.find((t) => t.name === templateName);
  const recipients = waContacts.filter((c) => {
    if (c.optedOut) return false;
    if (audience === 'interested') return !!c.isInterested;
    if (audience === 'flagged') return !!c.needsHuman;
    if (audience === 'no_order') return noOrderIds.has(c.id);
    return true;
  });

  const addPastedNumbers = () => {
    const parsed = parsePastedNumbers(numberText);
    if (parsed.phones.length === 0) {
      toast.error(parsed.skipped ? 'No valid numbers found' : 'Paste one or more phone numbers');
      return;
    }
    setExtraPhones((prev) => {
      const names = [...extraNames];
      const next = [...prev];
      for (const phone of parsed.phones) {
        if (next.includes(phone)) continue;
        next.push(phone);
        names.push('');
      }
      setExtraNames(names.slice(0, next.length));
      return next;
    });
    setNumberText('');
    if (parsed.skipped) toast.success(`Added ${parsed.phones.length} · skipped ${parsed.skipped} invalid/duplicate`);
  };

  const importNumbers = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.oasis.opendocument.spreadsheet',
      ],
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    try {
      const base64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const binary = globalThis.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const imported = importCampaignBuffer(bytes.buffer);
      setExtraPhones((prev) => {
        const names = [...extraNames];
        const next = [...prev];
        imported.phones.forEach((phone, index) => {
          if (next.includes(phone)) return;
          next.push(phone);
          names.push(imported.names[index] || '');
        });
        setExtraNames(names.slice(0, next.length));
        return next;
      });
      setImportNote(imported.summary);
      toast.success(imported.summary);
    } catch (e: any) {
      toast.error(e?.message || 'Could not import the file');
    }
  };

  const removeExtra = (phone: string) => {
    const index = extraPhones.indexOf(phone);
    setExtraPhones((prev) => prev.filter((item) => item !== phone));
    if (index >= 0) setExtraNames((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const createCampaign = async () => {
    const known = splitKnownContacts(
      extraPhones,
      extraNames,
      waContacts.map((contact) => ({ id: contact.id, phone: contact.phoneNumber })),
    );
    const contactIds = [...new Set([...recipients.map((contact) => contact.id), ...known.contactIds])];
    if (!name.trim() || !templateName || (contactIds.length === 0 && known.manualPhones.length === 0)) {
      toast.error('Name, template, and at least one contact required');
      return;
    }
    setSending(true);
    try {
      const templateBody = selectedTemplate?.components?.find((c: any) => String(c.type).toUpperCase() === 'BODY')?.text || '';
      const selectedContacts = waContacts.filter((contact) => contactIds.includes(contact.id));
      const res = await supabase.functions.invoke('send-campaign', {
        headers: requestHeaders(),
        body: {
          name: name.trim(),
          templateName,
          templateLanguage: selectedTemplate?.language || 'en_US',
          templateBody,
          variables: [],
          variableFallbacks: [],
          contactIds,
          contactPhones: selectedContacts.map((contact) => contact.phoneNumber),
          manualPhones: known.manualPhones,
          manualNames: known.manualNames,
          scheduledAt: null,
          sendRatePerMinute: 60,
          concurrency: 5,
          excludeOptedOut: true,
          appendOptOut: true,
          optOutVariableIndex: null,
        },
      });
      if (res.error || res.data?.error) throw new Error(await invokeErrorMessage(res.error, res.data));
      toast.success(`Campaign started: sending to ${contactIds.length + known.manualPhones.length} contacts`);
      setShowCreate(false);
      setName('');
      setTemplateName('');
      setExtraPhones([]);
      setExtraNames([]);
      setImportNote('');
      await loadCampaigns();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send');
    }
    setSending(false);
  };

  const createTemplate = async () => {
    const templateSlug = tplName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!templateSlug || !tplBody.trim()) {
      toast.error('Name and body text are required');
      return;
    }
    setCreatingTpl(true);
    try {
      const res = await supabase.functions.invoke('whatsapp-templates', {
        headers: requestHeaders(),
        body: {
          name: templateSlug,
          category: tplCategory,
          language: tplLanguage,
          components: [
            ...(tplHeader.trim() ? [{ type: 'HEADER', format: 'TEXT', text: tplHeader.trim().replace(/[\r\n\t]+/g, ' ') }] : []),
            { type: 'BODY', text: tplBody.trim() },
            ...(tplFooter.trim() ? [{ type: 'FOOTER', text: tplFooter.trim().replace(/[\r\n\t]+/g, ' ') }] : []),
          ],
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) {
        const err = res.data.error;
        throw new Error(err.error_user_msg || err.message || (typeof err === 'string' ? err : 'Failed to create template'));
      }
      toast.success('Template submitted for review');
      setShowTemplate(false);
      setTplName('');
      setTplBody('');
      setTplHeader('');
      setTplFooter('');
      await loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create template');
    }
    setCreatingTpl(false);
  };

  const deleteTemplate = async (template: Template) => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const qs = new URLSearchParams({ name: template.name, id: template.id });
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-templates?${qs.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, ...requestHeaders() },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) throw new Error(data?.error?.message || 'Failed to delete');
      toast.success('Template deleted');
      loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete template');
    }
  };

  const deleteCampaign = (campaign: Campaign) => {
    Alert.alert('Delete campaign', `Delete campaign "${campaign.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);
          if (error) toast.error(error.message);
          else {
            toast.success('Campaign deleted');
            loadCampaigns();
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>WhatsApp Campaigns</Text>
          <Text style={styles.sub}>Send approved templates to opted-in contacts.</Text>
        </View>
        <Pressable onPress={() => { loadCampaigns(); loadTemplates(); }} style={styles.icon}>
          <RefreshCw size={16} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.switchRow}>
        <Button title="Campaigns" variant={tab === 'campaigns' ? 'primary' : 'outline'} icon={<Send size={14} color={tab === 'campaigns' ? '#fff' : colors.foreground} />} onPress={() => setTab('campaigns')} />
        <Button title="Templates" variant={tab === 'templates' ? 'primary' : 'outline'} icon={<FileText size={14} color={tab === 'templates' ? '#fff' : colors.foreground} />} onPress={() => setTab('templates')} />
      </View>

      {tab === 'campaigns' ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.switchRow}>
            <Text style={styles.sub}>{approved.length} approved template{approved.length === 1 ? '' : 's'} available</Text>
            <Button
              title="New campaign"
              icon={<Plus size={14} color="#fff" />}
              onPress={() => {
                if (approved.length === 0) {
                  toast.error('Create and get a template approved first');
                  setTab('templates');
                  return;
                }
                setShowCreate(true);
              }}
            />
          </View>
          {loadingCampaigns ? <ActivityIndicator color={colors.primary} /> : null}
          {!loadingCampaigns && campaigns.length === 0 ? (
            <View style={styles.empty}>
              <Megaphone size={36} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <Text style={styles.sub}>Create a campaign with an approved WhatsApp template.</Text>
            </View>
          ) : (
            campaigns.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.name, { flex: 1 }]}>{c.name}</Text>
                  <Pressable onPress={() => deleteCampaign(c)} hitSlop={8}>
                    <Trash2 size={16} color={colors.destructive} />
                  </Pressable>
                </View>
                <Text style={styles.sub}>{c.template_name}</Text>
                <View style={styles.row}>
                  <Badge label={c.status} tone={c.status === 'completed' ? 'success' : 'primary'} />
                  <Text style={styles.meta}>
                    {c.sent_count}/{c.total_recipients} sent · {c.failed_count} failed
                  </Text>
                </View>
                <Text style={styles.meta}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <Button title="New template" icon={<Plus size={14} color="#fff" />} onPress={() => setShowTemplate(true)} />
          {templates.length === 0 ? (
            <View style={styles.empty}>
              <FileText size={36} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No templates yet</Text>
              <Text style={styles.sub}>Submit a template for Meta review, then use it in campaigns.</Text>
            </View>
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.name, { flex: 1 }]}>{t.name}</Text>
                  <Pressable onPress={() => deleteTemplate(t)} hitSlop={8}>
                    <Trash2 size={16} color={colors.destructive} />
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <Badge label={t.status} tone={String(t.status).toUpperCase() === 'APPROVED' ? 'success' : 'amber'} />
                  <Badge label={t.category} tone="muted" />
                  <Badge label={t.language} tone="muted" />
                </View>
                {t.components?.find((c) => String(c.type).toUpperCase() === 'BODY')?.text ? (
                  <Text style={styles.meta}>{t.components.find((c) => String(c.type).toUpperCase() === 'BODY').text}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <KeyboardSheet visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={styles.h1}>New campaign</Text>
        <Input placeholder="Campaign name" value={name} onChangeText={setName} />
        <Text style={styles.sub}>Template</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {approved.map((t) => (
            <Button key={t.id} title={t.name} variant={templateName === t.name ? 'primary' : 'outline'} onPress={() => setTemplateName(t.name)} />
          ))}
        </ScrollView>
        {approved.length === 0 ? <Text style={styles.sub}>No approved templates. Create one in the Templates tab first.</Text> : null}
        <Text style={styles.sub}>Audience</Text>
        <View style={styles.row}>
          <Button title={`All (${waContacts.length})`} variant={audience === 'all' ? 'primary' : 'outline'} onPress={() => setAudience('all')} />
          <Button title={`Interested (${waContacts.filter((c) => c.isInterested).length})`} variant={audience === 'interested' ? 'primary' : 'outline'} onPress={() => setAudience('interested')} />
          <Button title={`No order (${noOrderIds.size})`} variant={audience === 'no_order' ? 'primary' : 'outline'} onPress={() => setAudience('no_order')} />
          <Button title={`Flagged (${waContacts.filter((c) => c.needsHuman).length})`} variant={audience === 'flagged' ? 'primary' : 'outline'} onPress={() => setAudience('flagged')} />
        </View>
        <Text style={styles.meta}>{recipients.length} recipients selected</Text>
        <Text style={styles.sub}>Add numbers</Text>
        <Input
          placeholder="Paste numbers, separated by commas or new lines"
          value={numberText}
          onChangeText={setNumberText}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Button title="Add numbers" variant="outline" onPress={addPastedNumbers} />
        <Button title="Import Excel" variant="outline" onPress={importNumbers} />
        {importNote ? <Text style={styles.meta}>{importNote}</Text> : null}
        <View style={styles.row}>
          {extraPhones.map((phone) => {
            const known = waContacts.find((contact) => normalizePhone(contact.phoneNumber) === phone);
            const label = known?.name || phone;
            return (
              <Pressable key={phone} onPress={() => removeExtra(phone)} style={styles.chip}>
                <Text style={[styles.meta, /[\u0600-\u06FF]/.test(label) && { writingDirection: 'rtl', textAlign: 'right' }]}>{label} ×</Text>
              </Pressable>
            );
          })}
        </View>
        <Button title={sending ? 'Sending…' : 'Send campaign'} loading={sending} onPress={createCampaign} />
      </KeyboardSheet>

      <KeyboardSheet visible={showTemplate} onClose={() => setShowTemplate(false)}>
        <Text style={styles.h1}>New template</Text>
        <Input placeholder="template_name" autoCapitalize="none" value={tplName} onChangeText={setTplName} />
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Button key={c} title={c} variant={tplCategory === c ? 'primary' : 'outline'} onPress={() => setTplCategory(c)} />
          ))}
        </View>
        <View style={styles.row}>
          {LANGUAGES.map((l) => (
            <Button key={l.value} title={l.label} variant={tplLanguage === l.value ? 'primary' : 'outline'} onPress={() => setTplLanguage(l.value)} />
          ))}
        </View>
        <Input placeholder="Header (optional)" value={tplHeader} onChangeText={setTplHeader} />
        <Input placeholder="Body text. Use {{1}} for variables." value={tplBody} onChangeText={setTplBody} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <Input placeholder="Footer (optional)" value={tplFooter} onChangeText={setTplFooter} />
        <Button title={creatingTpl ? 'Submitting…' : 'Submit for review'} loading={creatingTpl} onPress={createTemplate} />
      </KeyboardSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  pad: { padding: 16, paddingBottom: 48, gap: 10 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontWeight: '700', color: colors.foreground, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 4 },
});
