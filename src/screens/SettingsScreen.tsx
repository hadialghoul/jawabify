import { useEffect, useState } from 'react';
import { Alert, Image as RNImage, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import {
  Bot,
  CheckCircle2,
  ImagePlus,
  Link as LinkIcon,
  LogOut,
  MessageSquare,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react-native';
import { InstagramIcon } from '../components/ChannelIcons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { actingHeaders } from '../lib/actingTenant';
import { useInstagramConnection } from '../hooks/useAppData';
import { Button, Card, Input } from '../components/ui';
import { colors, radius } from '../theme';
import { WEB_ORIGIN } from '../config';
import { ScreenHeader } from '../components/ScreenHeader';
import { KeyboardForm } from '../components/KeyboardSheet';
import { BillingCard } from '../components/settings/BillingCard';
import { TeamSection } from '../components/settings/TeamSection';

const KNOWLEDGE_ENTRY_TITLE = 'main_knowledge';
const LEARNED_KNOWLEDGE_TITLE = 'learned_from_conversations';
type AiLanguage = 'all' | 'english' | 'arabizi' | 'arabic' | 'french';
const AI_LANGUAGE_OPTIONS: { value: AiLanguage; label: string; hint: string }[] = [
  { value: 'all', label: 'All languages (mirror customer)', hint: 'AI replies in whatever language the customer writes in.' },
  { value: 'english', label: 'English only', hint: 'AI always replies in English.' },
  { value: 'arabizi', label: 'Arabizi only', hint: 'AI always replies in Lebanese Arabizi (Latin letters).' },
  { value: 'arabic', label: 'Arabic only', hint: 'AI always replies in Arabic script.' },
  { value: 'french', label: 'French only', hint: 'AI always replies in French.' },
];

interface KnowledgeImage {
  id: string;
  image_url: string;
  description: string;
  label: string;
  is_active: boolean;
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { user, tenantId, isTenantAdmin, signOut } = useAuth();
  const toast = useToast();
  const instagram = useInstagramConnection();
  const [content, setContent] = useState('');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
  const [aiLanguage, setAiLanguage] = useState<AiLanguage>('all');
  const [aiUpsellEnabled, setAiUpsellEnabled] = useState(false);
  const [learnEnabled, setLearnEnabled] = useState(false);
  const [learnedContent, setLearnedContent] = useState('');
  const [learnedEntryId, setLearnedEntryId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifyImporting, setShopifyImporting] = useState(false);
  const [showTokenConnect, setShowTokenConnect] = useState(false);
  const [knowledgeImages, setKnowledgeImages] = useState<KnowledgeImage[]>([]);
  const [newImageLabel, setNewImageLabel] = useState('');
  const [newImageDesc, setNewImageDesc] = useState('');
  const [pendingUris, setPendingUris] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const upsertSetting = async (key: string, value: any) => {
    if (!tenantId) return;
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).eq('tenant_id', tenantId).maybeSingle();
    if (existing) await supabase.from('app_settings').update({ value }).eq('id', existing.id);
    else await supabase.from('app_settings').insert({ key, value, tenant_id: tenantId } as any);
  };

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      const [
        { data: knowledge },
        { data: ai },
        { data: lang },
        { data: upsell },
        { data: learn },
        { data: learned },
        { data: wa },
        { data: shop },
        { data: images },
      ] = await Promise.all([
        supabase.from('ai_knowledge').select('id,content').eq('title', KNOWLEDGE_ENTRY_TITLE).eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'ai_replies_enabled').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'ai_reply_language').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'ai_upsell_enabled').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'learn_from_conversations').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('ai_knowledge').select('id,content,is_active').eq('title', LEARNED_KNOWLEDGE_TITLE).eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('tenant_credentials').select('phone_number, phone_number_id, waba_id, is_active').eq('tenant_id', tenantId).eq('provider', 'whatsapp_cloud').maybeSingle(),
        supabase.from('tenant_credentials').select('shop_domain, is_active').eq('tenant_id', tenantId).eq('provider', 'shopify').maybeSingle(),
        supabase.from('knowledge_images').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      ]);
      if (knowledge) {
        setContent(knowledge.content || '');
        setEntryId(knowledge.id);
      }
      if (ai) setAiRepliesEnabled(ai.value === true || ai.value === 'true');
      if (lang?.value) setAiLanguage(String(lang.value) as AiLanguage);
      if (upsell) setAiUpsellEnabled(upsell.value === true || upsell.value === 'true');
      if (learn) setLearnEnabled(learn.value === true || learn.value === 'true');
      if (learned) {
        setLearnedContent(learned.content || '');
        setLearnedEntryId(learned.id);
        if (learned.is_active) setLearnEnabled(true);
      }
      if (wa && wa.is_active !== false && (wa.phone_number_id || wa.waba_id)) {
        setWaConnected(true);
        setWaPhone(wa.phone_number || wa.phone_number_id || 'WhatsApp connected');
      }
      if (shop && shop.is_active !== false) {
        setShopifyConnected(true);
        setShopDomain(shop.shop_domain || '');
      }
      if (images) setKnowledgeImages(images as KnowledgeImage[]);
      setLoading(false);
    })();
  }, [tenantId]);

  const saveKnowledge = async () => {
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
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Settings" onBack={onBack} />
      <KeyboardForm contentStyle={styles.pad}>
          <BillingCard />

          {isTenantAdmin ? <TeamSection /> : <Text style={styles.sub}>Only owners and admins can manage the team.</Text>}

          <Card>
            <View style={styles.head}>
              <Bot size={16} color={colors.primary} />
              <Text style={styles.h2}>AI Auto-Replies</Text>
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Global AI auto-replies</Text>
                <Text style={styles.sub}>Master switch. When off, the AI will not reply to any conversation.</Text>
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
            <Text style={styles.label}>Reply language</Text>
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
                <Text style={styles.sub}>{opt.hint}</Text>
              </Pressable>
            ))}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>AI upselling & recommendations</Text>
                <Text style={styles.sub}>Suggest one relevant add-on. Never pushy — one suggestion max.</Text>
              </View>
              <Switch
                value={aiUpsellEnabled}
                onValueChange={async (v) => {
                  setAiUpsellEnabled(v);
                  await upsertSetting('ai_upsell_enabled', v);
                  toast.success(v ? 'Upselling is ON' : 'Upselling is OFF');
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </Card>

          <Card>
            <View style={styles.head}>
              <MessageSquare size={16} color={colors.primary} />
              <Text style={styles.h2}>WhatsApp Business</Text>
            </View>
            <View style={styles.switchRow}>
              <CheckCircle2 size={22} color={waConnected ? colors.success : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{waConnected ? 'Connected' : 'Reconnect required'}</Text>
                <Text style={styles.sub}>{waConnected ? waPhone : 'Connect once to refresh Meta account access.'}</Text>
              </View>
            </View>
            <Button title="Connect / reconnect WhatsApp" onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/onboarding`)} />
            {waConnected && isTenantAdmin ? (
              <Button
                title="Disconnect from Meta"
                variant="destructive"
                onPress={() =>
                  Alert.alert('Disconnect from Meta?', 'Incoming WhatsApp messages will stop until you reconnect.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Disconnect',
                      style: 'destructive',
                      onPress: async () => {
                        if (!tenantId) return;
                        const { error } = await supabase.from('tenant_credentials').update({ is_active: false }).eq('tenant_id', tenantId).eq('provider', 'whatsapp_cloud');
                        if (error) toast.error('Failed to disconnect from Meta');
                        else {
                          setWaConnected(false);
                          setWaPhone('');
                          toast.success('Disconnected from Meta');
                        }
                      },
                    },
                  ])
                }
              />
            ) : null}
          </Card>

          <Card>
            <View style={styles.head}>
              <Store size={16} color={colors.primary} />
              <Text style={styles.h2}>Shopify Store</Text>
            </View>
            {shopifyConnected ? (
              <>
                <View style={styles.switchRow}>
                  <CheckCircle2 size={22} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Connected</Text>
                    <Text style={styles.sub}>{shopDomain || 'Shopify store linked'}</Text>
                  </View>
                </View>
                <Button
                  title={shopifyImporting ? 'Importing…' : 'Import products into knowledge'}
                  loading={shopifyImporting}
                  onPress={async () => {
                    setShopifyImporting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('shopify-import-knowledge', {
                        headers: actingHeaders(),
                        body: {},
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success(data?.total ? `Import started — ${data.total} products found.` : 'Import started.');
                    } catch (e: any) {
                      toast.error(e?.message || 'Import failed');
                    } finally {
                      setShopifyImporting(false);
                    }
                  }}
                />
                <Button
                  title="Disconnect Shopify"
                  variant="outline"
                  onPress={async () => {
                    if (!tenantId) return;
                    const { error } = await supabase.from('tenant_credentials').delete().eq('tenant_id', tenantId).eq('provider', 'shopify');
                    if (error) toast.error('Failed to disconnect Shopify store');
                    else {
                      setShopifyConnected(false);
                      setShopDomain('');
                      toast.success('Shopify store disconnected');
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Input placeholder="your-store.myshopify.com" autoCapitalize="none" value={shopDomain} onChangeText={setShopDomain} />
                <Button
                  title={shopifyConnecting ? 'Connecting…' : 'Connect with Shopify'}
                  loading={shopifyConnecting}
                  onPress={async () => {
                    if (!shopDomain.trim() || !tenantId) {
                      toast.error('Please enter your Shopify store domain.');
                      return;
                    }
                    setShopifyConnecting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('shopify-oauth', {
                        headers: actingHeaders(),
                        body: { shop: shopDomain.trim(), tenant_id: tenantId },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      if (data?.install_url) await WebBrowser.openBrowserAsync(data.install_url);
                      else toast.error('Failed to start Shopify connection');
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to connect Shopify.');
                    } finally {
                      setShopifyConnecting(false);
                    }
                  }}
                />
                <Button title={showTokenConnect ? 'Hide access token' : 'Connect with Admin API token'} variant="ghost" onPress={() => setShowTokenConnect((v) => !v)} />
                {showTokenConnect ? (
                  <>
                    <Input placeholder="shpat_…" autoCapitalize="none" value={shopifyToken} onChangeText={setShopifyToken} />
                    <Button
                      title="Connect with token"
                      variant="outline"
                      onPress={async () => {
                        if (!shopDomain.trim() || !shopifyToken.trim()) {
                          toast.error('Enter both the store domain and the Admin API access token.');
                          return;
                        }
                        setShopifyConnecting(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('shopify-connect-token', {
                            headers: actingHeaders(),
                            body: { shop: shopDomain.trim(), access_token: shopifyToken.trim() },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          setShopifyConnected(true);
                          setShopifyToken('');
                          toast.success(`Connected to ${data?.shop_name || data?.shop_domain}`);
                        } catch (e: any) {
                          toast.error(e?.message || 'Failed to connect with that token.');
                        } finally {
                          setShopifyConnecting(false);
                        }
                      }}
                    />
                  </>
                ) : null}
              </>
            )}
          </Card>

          <Card>
            <View style={styles.head}>
              <InstagramIcon size={16} />
              <Text style={styles.h2}>Instagram Direct</Text>
            </View>
            <Text style={styles.sub}>Answer Instagram DMs in the same inbox, alongside WhatsApp Business.</Text>
            <View style={styles.switchRow}>
              <CheckCircle2 size={22} color={instagram.connected ? colors.success : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{instagram.connected ? 'Connected' : 'Not connected'}</Text>
                <Text style={styles.sub}>
                  {instagram.connected
                    ? instagram.username
                      ? `@${instagram.username}`
                      : 'Instagram professional account linked'
                    : 'Requires an Instagram professional account linked to your Facebook Page.'}
                </Text>
              </View>
            </View>
            <Button
              title={instagram.connected ? 'Manage Instagram' : 'Connect Instagram'}
              onPress={async () => {
                if (instagram.connected) {
                  await WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/integrations`);
                  instagram.refresh();
                  return;
                }
                try {
                  const { data, error } = await supabase.functions.invoke('instagram-connect', {
                    body: { action: 'start', redirectTo: `${WEB_ORIGIN}/integrations` },
                  });
                  if (error) throw error;
                  const url = data?.url || data?.authUrl;
                  if (url) await WebBrowser.openBrowserAsync(url);
                  else await WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/integrations`);
                  instagram.refresh();
                } catch (e: any) {
                  toast.error(e?.message || 'Could not start Instagram connect');
                }
              }}
            />
            {instagram.connected && isTenantAdmin ? (
              <Button
                title="Disconnect from Meta"
                variant="destructive"
                onPress={() =>
                  Alert.alert('Disconnect Instagram?', 'Incoming Instagram DMs will stop until you reconnect.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Disconnect',
                      style: 'destructive',
                      onPress: async () => {
                        if (!tenantId) return;
                        const { error } = await supabase.from('tenant_credentials').update({ is_active: false }).eq('tenant_id', tenantId).eq('provider', 'instagram');
                        if (error) toast.error('Failed to disconnect Instagram');
                        else {
                          await instagram.refresh();
                          toast.success('Instagram disconnected from Meta');
                        }
                      },
                    },
                  ])
                }
              />
            ) : null}
          </Card>

          <Card>
            <View style={styles.head}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={styles.h2}>AI training</Text>
            </View>
            <Text style={styles.sub}>This is what your assistant knows about your business.</Text>
            <Input value={urlInput} onChangeText={setUrlInput} placeholder="https://your-website.com" autoCapitalize="none" />
            <Button
              title={fetchingUrl ? 'Fetching…' : 'Add content from URL'}
              variant="outline"
              loading={fetchingUrl}
              icon={<LinkIcon size={14} color={colors.foreground} />}
              onPress={async () => {
                if (!urlInput.trim()) {
                  toast.error('Please enter a URL');
                  return;
                }
                setFetchingUrl(true);
                try {
                  const { data, error } = await supabase.functions.invoke('fetch-url-content', { body: { url: urlInput.trim() } });
                  if (error) throw error;
                  if (data.success) {
                    const separator = content.trim() ? '\n\n---\n\n' : '';
                    setContent(`${content}${separator}## Content from ${data.url}\n\n${data.content}`);
                    setUrlInput('');
                    toast.success('Content fetched and added');
                  } else toast.error(data.error || 'Failed to fetch URL');
                } catch {
                  toast.error('Failed to fetch content from URL');
                }
                setFetchingUrl(false);
              }}
            />
            <Input value={content} onChangeText={setContent} placeholder="Products, prices, policies, FAQs…" multiline style={{ minHeight: 180, textAlignVertical: 'top' }} />
            <Button title={saving ? 'Saving…' : 'Save knowledge'} loading={saving || loading} onPress={saveKnowledge} />
          </Card>

          <Card>
            <View style={styles.head}>
              <ImagePlus size={16} color={colors.primary} />
              <Text style={styles.h2}>Knowledge images</Text>
            </View>
            <Text style={styles.sub}>Add product or catalog photos the AI can send when customers ask.</Text>
            <Input placeholder="Item name" value={newImageLabel} onChangeText={setNewImageLabel} />
            <Input placeholder="Description (when to send this image)" value={newImageDesc} onChangeText={setNewImageDesc} />
            <Button
              title="Pick images"
              variant="outline"
              icon={<ImagePlus size={14} color={colors.foreground} />}
              onPress={async () => {
                const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
                if (res.canceled) return;
                setPendingUris((prev) => [...prev, ...res.assets.map((a) => a.uri)]);
              }}
            />
            {pendingUris.length > 0 ? (
              <View style={styles.imageRow}>
                {pendingUris.map((uri) => (
                  <RNImage key={uri} source={{ uri }} style={styles.thumb} />
                ))}
              </View>
            ) : null}
            <Button
              title={uploadingImage ? 'Uploading…' : `Add pictures (${pendingUris.length})`}
              loading={uploadingImage}
              disabled={!newImageLabel.trim() || !newImageDesc.trim() || pendingUris.length === 0}
              onPress={async () => {
                if (!tenantId) return;
                setUploadingImage(true);
                try {
                  for (const uri of pendingUris) {
                    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
                    const filePath = `knowledge/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const fileRes = await fetch(uri);
                    const blob = await fileRes.blob();
                    const { data: uploadData, error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, blob, {
                      contentType: blob.type || 'image/jpeg',
                      upsert: true,
                    });
                    if (uploadError) throw uploadError;
                    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(uploadData.path);
                    const { data: imgData, error: insertError } = await supabase
                      .from('knowledge_images')
                      .insert({
                        image_url: urlData.publicUrl,
                        description: newImageDesc.trim(),
                        label: newImageLabel.trim(),
                        is_active: true,
                        tenant_id: tenantId,
                      } as any)
                      .select()
                      .single();
                    if (insertError) throw insertError;
                    setKnowledgeImages((prev) => [imgData as KnowledgeImage, ...prev]);
                  }
                  toast.success(`${pendingUris.length} image(s) added for "${newImageLabel.trim()}"`);
                  setNewImageLabel('');
                  setNewImageDesc('');
                  setPendingUris([]);
                } catch {
                  toast.error('Failed to upload images');
                }
                setUploadingImage(false);
              }}
            />
          </Card>
          {knowledgeImages.map((img) => (
            <Card key={img.id}>
              <View style={styles.switchRow}>
                <RNImage source={{ uri: img.image_url }} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{img.label}</Text>
                  <Text style={styles.sub}>{img.description}</Text>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert('Remove image?', img.label, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          const { error } = await supabase.from('knowledge_images').delete().eq('id', img.id);
                          if (error) toast.error('Failed to delete image');
                          else {
                            setKnowledgeImages((prev) => prev.filter((i) => i.id !== img.id));
                            toast.success('Image removed');
                          }
                        },
                      },
                    ])
                  }
                  hitSlop={8}
                >
                  <Trash2 size={16} color={colors.destructive} />
                </Pressable>
              </View>
            </Card>
          ))}
          {knowledgeImages.length === 0 ? <Text style={styles.sub}>No knowledge images yet.</Text> : null}

          <Card>
            <View style={styles.head}>
              <Bot size={16} color={colors.primary} />
              <Text style={styles.h2}>Learn from conversations</Text>
            </View>
            <Text style={styles.sub}>Analyze past chats and add what customers actually ask into AI knowledge.</Text>
            <View style={styles.switchRow}>
              <Text style={[styles.label, { flex: 1 }]}>Use learned insights</Text>
              <Switch
                value={learnEnabled}
                onValueChange={async (v) => {
                  setLearnEnabled(v);
                  await upsertSetting('learn_from_conversations', v);
                  if (learnedEntryId) await supabase.from('ai_knowledge').update({ is_active: v }).eq('id', learnedEntryId);
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>
            <Button
              title={analyzing ? 'Analyzing…' : 'Analyze conversations'}
              loading={analyzing}
              onPress={async () => {
                setAnalyzing(true);
                try {
                  const { data, error } = await supabase.functions.invoke('analyze-conversations', { headers: actingHeaders() });
                  if (error) throw error;
                  if (data.success) {
                    setLearnedContent(data.insights);
                    if (learnedEntryId) {
                      await supabase.from('ai_knowledge').update({ content: data.insights, is_active: learnEnabled }).eq('id', learnedEntryId);
                    } else if (tenantId) {
                      const { data: newEntry } = await supabase
                        .from('ai_knowledge')
                        .insert({ title: LEARNED_KNOWLEDGE_TITLE, content: data.insights, is_active: learnEnabled, tenant_id: tenantId } as any)
                        .select()
                        .single();
                      if (newEntry) setLearnedEntryId(newEntry.id);
                    }
                    toast.success(`Analyzed ${data.messageCount} messages from ${data.conversationCount} conversations`);
                  } else toast.error(data.error || 'Failed to analyze conversations');
                } catch {
                  toast.error('Failed to analyze conversations');
                }
                setAnalyzing(false);
              }}
            />
            <Input value={learnedContent} onChangeText={setLearnedContent} placeholder="Learned insights appear here…" multiline style={{ minHeight: 160, textAlignVertical: 'top' }} />
            <Button
              title="Save learned insights"
              variant="outline"
              onPress={async () => {
                if (!tenantId) return;
                if (learnedEntryId) await supabase.from('ai_knowledge').update({ content: learnedContent, is_active: learnEnabled }).eq('id', learnedEntryId);
                else {
                  const { data } = await supabase
                    .from('ai_knowledge')
                    .insert({ title: LEARNED_KNOWLEDGE_TITLE, content: learnedContent, is_active: learnEnabled, tenant_id: tenantId } as any)
                    .select()
                    .single();
                  if (data) setLearnedEntryId(data.id);
                }
                toast.success('Learned insights saved');
              }}
            />
          </Card>
          <Button title="Sign out" variant="destructive" icon={<LogOut size={14} color="#fff" />} onPress={() => Alert.alert('Sign out', 'Sign out of Jawabify?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])} />
          <Text style={styles.meta}>{user?.email}</Text>
      </KeyboardForm>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  tab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  pad: { padding: 16, gap: 12, paddingBottom: 48 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  label: { fontWeight: '700', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lang: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.card },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  langText: { fontWeight: '600', color: colors.foreground },
  meta: { textAlign: 'center', color: colors.mutedForeground },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.muted },
});
