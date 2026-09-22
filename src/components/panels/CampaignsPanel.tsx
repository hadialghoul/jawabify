import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FileText, Megaphone, Plus, RefreshCw, Send, Trash2 } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { actingHeaders } from '../../lib/actingTenant';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Input } from '../ui';
import { KeyboardSheet } from '../KeyboardSheet';
import { colors, radius } from '../../theme';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config';
import type { Contact } from '../../types';

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

export function CampaignsPanel({ contacts = [] }: { contacts?: Contact[] }) {
  const { tenantId, session } = useAuth();
  const toast = useToast();
  const waContacts = useMemo(() => contacts.filter((c) => c.platform === 'whatsapp' || !c.platform), [contacts]);
  const [tab, setTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [audience, setAudience] = useState<'all' | 'interested' | 'flagged'>('all');
  const [sending, setSending] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('MARKETING');
  const [tplLanguage, setTplLanguage] = useState('en_US');
  const [tplBody, setTplBody] = useState('');
  const [tplHeader, setTplHeader] = useState('');
  const [tplFooter, setTplFooter] = useState('');
  const [creatingTpl, setCreatingTpl] = useState(false);

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
      const res = await supabase.functions.invoke('whatsapp-templates', { headers: actingHeaders(), method: 'GET' });
      const list: Template[] = res.data?.data || [];
      setTemplates(list.filter((t) => !String(t.status || '').toUpperCase().includes('DELETED')));
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadCampaigns(), loadTemplates()]).finally(() => setLoading(false));
  }, [loadCampaigns, loadTemplates]);

  const approved = templates.filter((t) => String(t.status).toUpperCase() === 'APPROVED');
  const selectedTemplate = approved.find((t) => t.name === templateName);
  const recipients = waContacts.filter((c) => {
    if (c.optedOut) return false;
    if (audience === 'interested') return !!c.isInterested;
    if (audience === 'flagged') return !!c.needsHuman;
    return true;
  });

  const createCampaign = async () => {
    if (!name.trim() || !templateName || recipients.length === 0) {
      toast.error('Name, template, and at least one contact required');
      return;
    }
    setSending(true);
    try {
        const templateBody = selectedTemplate?.components?.find((c: any) => String(c.type).toUpperCase() === 'BODY')?.text || '';
      const res = await supabase.functions.invoke('send-campaign', {
        headers: actingHeaders(),
        body: {
          name: name.trim(),
          templateName,
          templateLanguage: selectedTemplate?.language || 'en_US',
          templateBody,
          variables: [],
          variableFallbacks: [],
          contactIds: recipients.map((c) => c.id),
          contactPhones: recipients.map((c) => c.phoneNumber),
          scheduledAt: null,
          sendRatePerMinute: 60,
          concurrency: 5,
          excludeOptedOut: true,
          appendOptOut: true,
          optOutVariableIndex: null,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Campaign started: sending to ${recipients.length} contacts`);
      setShowCreate(false);
      setName('');
      setTemplateName('');
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
        headers: actingHeaders(),
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
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, ...actingHeaders() },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) throw new Error(data?.error?.message || 'Failed to delete');
      toast.success('Template deleted');
      loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete template');
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

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
          {campaigns.length === 0 ? (
            <View style={styles.empty}>
              <Megaphone size={36} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <Text style={styles.sub}>Create a campaign with an approved WhatsApp template.</Text>
            </View>
          ) : (
            campaigns.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.name}>{c.name}</Text>
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
          <Button title={`Flagged (${waContacts.filter((c) => c.needsHuman).length})`} variant={audience === 'flagged' ? 'primary' : 'outline'} onPress={() => setAudience('flagged')} />
        </View>
        <Text style={styles.meta}>{recipients.length} recipients selected</Text>
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
});
