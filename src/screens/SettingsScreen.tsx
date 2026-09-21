import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { actingHeaders } from '../lib/actingTenant';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { WEB_ORIGIN } from '../config';

const KNOWLEDGE_ENTRY_TITLE = 'main_knowledge';
type AiLanguage = 'all' | 'english' | 'arabizi' | 'arabic' | 'french';
const AI_LANGUAGE_OPTIONS: { value: AiLanguage; label: string }[] = [
  { value: 'all', label: 'All languages (mirror customer)' },
  { value: 'english', label: 'English only' },
  { value: 'arabizi', label: 'Arabizi only' },
  { value: 'arabic', label: 'Arabic only' },
  { value: 'french', label: 'French only' },
];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { user, tenantId, signOut } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
  const [aiLanguage, setAiLanguage] = useState<AiLanguage>('all');
  const [waConnected, setWaConnected] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: knowledge }, { data: ai }, { data: lang }, { data: creds }] = await Promise.all([
        supabase.from('ai_knowledge').select('id,content').eq('title', KNOWLEDGE_ENTRY_TITLE).eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'ai_replies_enabled').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'ai_reply_language').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('tenant_credentials').select('id').eq('tenant_id', tenantId).eq('provider', 'whatsapp_cloud').eq('is_active', true).maybeSingle(),
      ]);
      if (knowledge) {
        setContent(knowledge.content || '');
        setEntryId(knowledge.id);
      }
      if (ai) setAiRepliesEnabled(ai.value === true || ai.value === 'true');
      if (lang?.value) setAiLanguage(String(lang.value) as AiLanguage);
      setWaConnected(!!creds);
      setLoading(false);
    })();
  }, [tenantId]);

  const upsertSetting = async (key: string, value: any) => {
    if (!tenantId) return;
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).eq('tenant_id', tenantId).maybeSingle();
    if (existing) await supabase.from('app_settings').update({ value }).eq('id', existing.id);
    else await supabase.from('app_settings').insert({ key, value, tenant_id: tenantId } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h2}>AI training</Text>
        <Text style={styles.sub}>This is what your assistant knows about your business.</Text>
        <Input
          value={content}
          onChangeText={setContent}
          placeholder="Products, prices, policies, FAQs…"
          multiline
          style={{ minHeight: 160, textAlignVertical: 'top' }}
        />
        <Button
          title={saving ? 'Saving...' : 'Save knowledge'}
          loading={saving || loading}
          onPress={async () => {
            if (!tenantId) return;
            setSaving(true);
            try {
              if (entryId) {
                const { error } = await supabase.from('ai_knowledge').update({ content, is_active: true }).eq('id', entryId);
                if (error) throw error;
                supabase.functions.invoke('embed-knowledge', { headers: actingHeaders(), body: { id: entryId } }).catch(() => {});
              } else {
                const { data, error } = await supabase
                  .from('ai_knowledge')
                  .insert({ title: KNOWLEDGE_ENTRY_TITLE, content, is_active: true, tenant_id: tenantId } as any)
                  .select()
                  .single();
                if (error) throw error;
                setEntryId(data.id);
                supabase.functions.invoke('embed-knowledge', { headers: actingHeaders(), body: { id: data.id } }).catch(() => {});
              }
              toast.success('Knowledge saved');
            } catch (e: any) {
              toast.error(e?.message || 'Failed to save knowledge');
            } finally {
              setSaving(false);
            }
          }}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>AI auto-replies</Text>
            <Text style={styles.sub}>Turn the assistant on or off for new chats.</Text>
          </View>
          <Switch
            value={aiRepliesEnabled}
            onValueChange={async (v) => {
              setAiRepliesEnabled(v);
              await upsertSetting('ai_replies_enabled', v);
              if (tenantId) await supabase.from('tenants').update({ ai_replies_enabled: v }).eq('id', tenantId);
              toast.success(v ? 'AI replies are ON' : 'AI replies are OFF');
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <Text style={styles.h2}>Reply language</Text>
        {AI_LANGUAGE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={async () => {
              setAiLanguage(opt.value);
              await upsertSetting('ai_reply_language', opt.value);
              toast.success('AI reply language updated');
            }}
            style={[styles.lang, aiLanguage === opt.value && styles.langOn]}
          >
            <Text style={[styles.langText, aiLanguage === opt.value && { color: colors.primary }]}>{opt.label}</Text>
          </Pressable>
        ))}

        <Text style={styles.h2}>Connections</Text>
        <Text style={styles.sub}>WhatsApp: {waConnected ? 'Connected' : 'Not connected'}</Text>
        <Button title="Manage WhatsApp / Shopify" variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/settings`)} />
        <Button title="Integrations" variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/integrations`)} />
        <Button
          title="Sign out"
          variant="destructive"
          onPress={() =>
            Alert.alert('Sign out', 'Sign out of Jawabify?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        />
        <Text style={styles.meta}>{user?.email}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.header, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, gap: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  pad: { padding: 16, gap: 10, paddingBottom: 48 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 8 },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  lang: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.card },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  langText: { fontWeight: '600', color: colors.foreground },
  meta: { textAlign: 'center', color: colors.mutedForeground, marginTop: 8 },
});
