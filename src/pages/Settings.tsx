import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Save, Link, Loader2, Bot, MessageSquare, Sparkles, ImagePlus, Trash2, Image, LogOut, UserRound, Store, ShoppingBag, CheckCircle2, Facebook, CreditCard, Mail, Phone, Instagram, FileUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input as SettingsInput } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGoBack } from '@/hooks/useGoBack';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { useBillingOrigin } from '@/hooks/useBillingOrigin';
import { RestaurantSettings } from '@/components/restaurant/RestaurantSettings';
import { RealEstateSettings } from '@/components/real_estate/RealEstateSettings';
import { WellnessSettings } from '@/components/wellness/WellnessSettings';
import { HealthcareSettings } from '@/components/healthcare/HealthcareSettings';
import { EducationSettings } from '@/components/education/EducationSettings';
import { useTenantVertical } from '@/hooks/useTenantVertical';
import { ProductTour, type TourStep } from '@/components/tour/ProductTour';
import { WhatsAppHealthCard } from '@/components/settings/WhatsAppHealthCard';
import { FileImportCard } from '@/components/settings/FileImportCard';
import { actingHeaders } from '@/lib/actingTenant';
import { useInstagramConnection } from '@/hooks/useChannels';
import { useInstagramConnect } from '@/hooks/useInstagramConnect';
import { TeamManager } from '@/components/settings/TeamManager';
import { TeamActivity } from '@/components/settings/TeamActivity';

const KNOWLEDGE_ENTRY_TITLE = 'main_knowledge';

type AiLanguage = 'all' | 'english' | 'arabizi' | 'arabic' | 'french';

const AI_LANGUAGE_OPTIONS: { value: AiLanguage; label: string; hint: string }[] = [
  { value: 'all', label: 'All languages (mirror customer)', hint: 'AI replies in whatever language the customer writes in.' },
  { value: 'english', label: 'English only', hint: 'AI always replies in English.' },
  { value: 'arabizi', label: 'Arabizi only', hint: 'AI always replies in Lebanese Arabizi (Latin letters).' },
  { value: 'arabic', label: 'Arabic only', hint: 'AI always replies in Arabic script.' },
  { value: 'french', label: 'French only', hint: 'AI always replies in French.' },
];
const LEARNED_KNOWLEDGE_TITLE = 'learned_from_conversations';
const META_APP_ID = '1392579008772004';
const META_CONFIG_ID = '1648388239943864';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

interface KnowledgeImage {
  id: string;
  image_url: string;
  description: string;
  label: string;
  is_active: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, tenantId, isSuperAdmin, isTenantAdmin, signOut } = useAuth();
  const { isShopifyBilled, loading: billingOriginLoading } = useBillingOrigin(user?.id);
  const goBack = useGoBack(isSuperAdmin ? '/super-admin' : '/app');
  const embeddedSignupDataRef = useRef<any>(null);

  // Handle Shopify OAuth callback redirect
  useEffect(() => {
    if (searchParams.get('shopify') === 'connected') {
      setShopifyConnected(true);
      toast.success('Shopify store connected successfully!');
    }
  }, [searchParams]);
  const [content, setContent] = useState('');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [extractingProducts, setExtractingProducts] = useState(false);
  const [aiRepliesEnabled, setAiRepliesEnabled] = useState(true);
  const [aiLanguage, setAiLanguage] = useState<AiLanguage>('all');
  const [aiUpsellEnabled, setAiUpsellEnabled] = useState(false);
  
  // Learn from conversations state
  const [learnEnabled, setLearnEnabled] = useState(false);
  const [learnedContent, setLearnedContent] = useState('');
  const [learnedEntryId, setLearnedEntryId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Knowledge images state
  const [knowledgeImages, setKnowledgeImages] = useState<KnowledgeImage[]>([]);
  const [newImageLabel, setNewImageLabel] = useState('');
  const [newImageDesc, setNewImageDesc] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Shopify state
  const [shopDomain, setShopDomain] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [showTokenConnect, setShowTokenConnect] = useState(false);
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyImporting, setShopifyImporting] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<any | null>(null);
  const [shopifyStopping, setShopifyStopping] = useState(false);

  const [shopifyClearing, setShopifyClearing] = useState(false);
  const [shopifyLastImportedAt, setShopifyLastImportedAt] = useState<string | null>(null);
  const [shopifyImportResult, setShopifyImportResult] = useState<{
    imported: { products: number; images: number; skipped_existing_images: number };
    failed: Array<{ product: string; product_id: string; reason: string }>;
    last_imported_at: string;
  } | null>(null);
  const [importedProducts, setImportedProducts] = useState<Array<{ id: string; title: string; shopify_product_id: string | null; updated_at: string }>>([]);
  const [showImportedList, setShowImportedList] = useState(false);
  const [websiteProducts, setWebsiteProducts] = useState<Array<{ id: string; title: string; price?: string; comparePrice?: string; image?: string; url?: string; updated_at: string }>>([]);
  const [showWebsiteList, setShowWebsiteList] = useState(true);
  const [clearingWebsiteProducts, setClearingWebsiteProducts] = useState(false);
  // Unified import source picker (website / shopify / file)
  const [importSource, setImportSource] = useState<'website' | 'shopify' | 'file'>('website');
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppConnecting, setWhatsAppConnecting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const instagram = useInstagramConnection();
  const { connecting: igConnecting, startConnect: startInstagramConnect } = useInstagramConnect(() => instagram.refresh());
  const [activeSettingsTab, setActiveSettingsTab] = useState('knowledge');

  // Settings tour state
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('tenant_credentials')
      .select('shop_domain')
      .eq('tenant_id', tenantId)
      .eq('provider', 'shopify')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setShopifyConnected(true);
          setShopDomain(data.shop_domain || '');
        }
      });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('tenant_credentials')
      .select('phone_number, phone_number_id, waba_id')
      .eq('tenant_id', tenantId)
      .eq('provider', 'whatsapp_cloud')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWhatsAppConnected(Boolean(data.phone_number_id || data.waba_id));
          setWhatsAppPhone(data.phone_number || data.phone_number_id || 'WhatsApp connected');
        }
      });
  }, [tenantId]);

  useEffect(() => {
    const handleEmbeddedSignupMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('facebook.net')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event?.startsWith('FINISH')) embeddedSignupDataRef.current = data.data || null;
        if (data.event === 'CANCEL' && data.data?.error_message) toast.error(data.data.error_message);
      } catch (_) {
        // Ignore non-JSON SDK messages.
      }
    };
    window.addEventListener('message', handleEmbeddedSignupMessage);

    const initFB = () => {
      if (!window.FB) return false;
      try { window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: true, version: 'v21.0' }); } catch (_) { /* already initialized */ }
      setSdkReady(true);
      return true;
    };
    let pollId: number | null = null;
    let stopId: number | null = null;
    if (!initFB()) {
      window.fbAsyncInit = initFB;
      const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.onload = initFB;
        document.body.appendChild(script);
      } else {
        existing.addEventListener('load', initFB);
        initFB();
      }
      pollId = window.setInterval(() => { if (initFB() && pollId) window.clearInterval(pollId); }, 300);
      stopId = window.setTimeout(() => { if (pollId) window.clearInterval(pollId); }, 10000);
    }
    return () => {
      window.removeEventListener('message', handleEmbeddedSignupMessage);
      if (pollId) window.clearInterval(pollId);
      if (stopId) window.clearTimeout(stopId);
    };
  }, []);

  const waitForEmbeddedSignupData = async () => {
    for (let i = 0; i < 10; i++) {
      if (embeddedSignupDataRef.current) return embeddedSignupDataRef.current;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return embeddedSignupDataRef.current;
  };

  const handleWhatsAppReconnect = () => {
    if (!tenantId) { toast.error('No tenant found'); return; }
    if (!sdkReady || !window.FB) { toast.error('Facebook SDK is still loading. Please try again.'); return; }
    setWhatsAppConnecting(true);
    embeddedSignupDataRef.current = null;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      setWhatsAppConnecting(false);
    };
    // Never let the button spin forever if Meta's popup is closed or its
    // callback never fires.
    const watchdog = window.setTimeout(() => {
      if (settled) return;
      toast.error('Meta did not finish the connection. Please try again.');
      finish();
    }, 180000);

    let loginStarted = false;
    const doLogin = () => {
      if (loginStarted) return;
      loginStarted = true;
      window.FB.login(
        (response: any) => {
          if (!response?.authResponse?.code) {
            toast.error('Facebook login was cancelled.');
            finish();
            return;
          }
          (async () => {
            try {
              const signupData = await waitForEmbeddedSignupData();
              const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
                headers: actingHeaders(),
                body: {
                  code: response.authResponse.code,
                  tenant_id: tenantId,
                  waba_id: signupData?.waba_id || signupData?.waba_ids?.[0],
                  phone_number_id: signupData?.phone_number_id,
                  business_id: signupData?.business_id,
                },
              });

              if (error) throw error;
              if (!data?.success) throw new Error(data?.error || 'Failed to complete WhatsApp connection');
              setWhatsAppConnected(true);
              setWhatsAppPhone(data.phone_number || data.phone_number_id || 'WhatsApp connected');
              if (data.warning) {
                toast.error(data.warning, { duration: 15000 });
              } else {
                toast.success(`WhatsApp reconnected${data.phone_number ? ` (${data.phone_number})` : ''}`);
              }

            } catch (err: any) {
              toast.error(err.message || 'Failed to reconnect WhatsApp');
            } finally {
              finish();
            }
          })();
        },
        {
          config_id: META_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          auth_type: 'reauthenticate',
          extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
        }
      );
    };

    // Force a clean FB session so Meta re-prompts for business portfolio selection
    // (otherwise the already-linked portfolio appears disabled in the picker).
    // FB.logout's callback sometimes never fires, so always fall through.
    try {
      const logoutFallback = window.setTimeout(doLogin, 1500);
      window.FB.getLoginStatus((statusResp: any) => {
        if (statusResp?.status === 'connected') {
          window.FB.logout(() => { window.clearTimeout(logoutFallback); doLogin(); });
        } else {
          window.clearTimeout(logoutFallback);
          doLogin();
        }
      }, true);
    } catch {
      doLogin();
    }
  };


  const handleShopifyConnect = async () => {
    if (!shopDomain.trim()) { toast.error('Please enter your Shopify store domain.'); return; }
    if (!tenantId) { toast.error('No account selected'); return; }
    setShopifyConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-oauth', {
        headers: actingHeaders(),
        body: { shop: shopDomain.trim(), tenant_id: tenantId }
      });
      if (error) {
        // Surface the function's real error body instead of "non-2xx status code".
        let detail = '';
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json();
            detail = body?.error || '';
          }
        } catch { /* ignore */ }
        throw new Error(detail || error.message);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.install_url) {
        window.location.href = data.install_url;
      } else {
        toast.error('Failed to start Shopify connection');
        setShopifyConnecting(false);
      }

    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Shopify. Please try again.');
      setShopifyConnecting(false);
    }
  };

  const handleShopifyTokenConnect = async () => {
    if (!shopDomain.trim() || !shopifyToken.trim()) {
      toast.error('Enter both the store domain and the Admin API access token.');
      return;
    }
    if (!tenantId) { toast.error('No account selected'); return; }
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
      fetchImportedProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect with that token.');
    } finally {
      setShopifyConnecting(false);
    }
  };




  const handleShopifyDisconnect = async () => {
    try {
      const { error } = await supabase
        .from('tenant_credentials')
        .delete()
        .eq('tenant_id', tenantId!)
        .eq('provider', 'shopify');
      if (error) throw error;
      setShopifyConnected(false);
      setShopDomain('');
      setShopifyImportResult(null);
      setShopifyLastImportedAt(null);
      toast.success('Shopify store disconnected');
    } catch {
      toast.error('Failed to disconnect Shopify store');
    }
  };

  const handleMetaDisconnect = async () => {
    if (!tenantId) return;
    if (!window.confirm('Disconnect from Meta? Incoming WhatsApp messages will stop until you reconnect.')) return;
    try {
      const { error } = await supabase
        .from('tenant_credentials')
        .update({ is_active: false })
        .eq('tenant_id', tenantId)
        .eq('provider', 'whatsapp_cloud');
      if (error) throw error;
      setWhatsAppConnected(false);
      setWhatsAppPhone('');
      toast.success('Disconnected from Meta');
    } catch {
      toast.error('Failed to disconnect from Meta');
    }
  };

  const handleInstagramDisconnect = async () => {
    if (!tenantId) return;
    if (!window.confirm('Disconnect Instagram from Meta? Incoming Instagram DMs will stop until you reconnect.')) return;
    try {
      const { error } = await supabase
        .from('tenant_credentials')
        .update({ is_active: false })
        .eq('tenant_id', tenantId)
        .eq('provider', 'instagram');
      if (error) throw error;
      await instagram.refresh();
      toast.success('Instagram disconnected from Meta');
    } catch {
      toast.error('Failed to disconnect Instagram');
    }
  };


  useEffect(() => {
    if (!tenantId) return;
    fetchKnowledge();
    fetchAiRepliesSetting();
    fetchLearnSetting();
    fetchLearnedKnowledge();
    fetchKnowledgeImages();
    fetchShopifyLastImported();
    fetchImportedProducts();
    fetchWebsiteProducts();

    // Realtime sync: keep AI replies toggle in sync across devices (mobile/web)
    const channel = supabase
      .channel(`app_settings_ai_${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (row?.key === 'ai_replies_enabled' && payload.new) {
            const v = payload.new.value;
            setAiRepliesEnabled(v === true || v === 'true');
          }
          if (row?.key === 'learn_from_conversations_enabled' && payload.new) {
            const v = payload.new.value;
            setLearnEnabled(v === true || v === 'true');
          }
          if (row?.key === 'ai_upsell_enabled' && payload.new) {
            const v = payload.new.value;
            setAiUpsellEnabled(v === true || v === 'true');
          }
        }
      )
      .subscribe();

    // Also refetch when tab regains focus
    const onFocus = () => {
      fetchAiRepliesSetting();
      fetchLearnSetting();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [tenantId]);


  // Auto-start settings tour when ?tour=1 is present
  useEffect(() => {
    if (searchParams.get('tour') === '1') {
      setTourInitialStep(0);
      setTimeout(() => setTourOpen(true), 300);
      // Clean URL
      const params = new URLSearchParams(searchParams);
      params.delete('tour');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [searchParams]);

  const fetchImportedProducts = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('ai_knowledge')
      .select('id, title, shopify_product_id, updated_at')
      .eq('tenant_id', tenantId)
      .eq('type', 'shopify_product')
      .order('title', { ascending: true });
    setImportedProducts((data as any) || []);
  };

  const fetchWebsiteProducts = async () => {
    if (!tenantId) return;
    // The backend caps a single response at 1000 rows, so page through everything.
    const rows: any[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 40000; from += PAGE) {
      const { data, error } = await supabase
        .from('ai_knowledge')
        .select('id, title, content, updated_at')
        .eq('tenant_id', tenantId)
        .eq('type', 'website_product')
        .order('title', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      rows.push(...((data as any[]) || []));
      if (!data || data.length < PAGE) break;
    }
    const grab = (c: string, label: string) => {
      const m = c.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
      return m ? m[1].trim() : undefined;
    };
    setWebsiteProducts(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        price: grab(r.content, 'Price'),
        comparePrice: grab(r.content, 'Original price'),
        image: grab(r.content, 'Image'),
        url: grab(r.content, 'Link'),
        updated_at: r.updated_at,
      })),
    );
  };


  const clearWebsiteProducts = async () => {
    if (!tenantId) return;
    if (!confirm('Remove all products imported from your website URL?')) return;
    setClearingWebsiteProducts(true);
    const { error } = await supabase
      .from('ai_knowledge')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('type', 'website_product');
    setClearingWebsiteProducts(false);
    if (error) {
      toast.error('Failed to remove products');
      return;
    }
    setWebsiteProducts([]);
    toast.success('Website products removed');
  };



  const fetchShopifyLastImported = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'shopify_last_imported_at')
      .eq('tenant_id', tenantId!)
      .maybeSingle();
    if (data?.value) {
      setShopifyLastImportedAt(typeof data.value === 'string' ? data.value : String(data.value).replace(/^"|"$/g, ''));
    } else {
      setShopifyLastImportedAt(null);
    }
  };

  const fetchKnowledgeImages = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('knowledge_images')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setKnowledgeImages(data as any as KnowledgeImage[]);
    }
  };


  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast.error('Please select image files');
      return;
    }
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (!newImageLabel.trim()) {
      toast.error('Please enter an item name');
      return;
    }
    if (!newImageDesc.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (pendingFiles.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    setUploadingImage(true);
    try {
      for (const file of pendingFiles) {
        const fileExt = file.name.split('.').pop();
        const filePath = `knowledge/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(uploadData.path);

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

        setKnowledgeImages(prev => [imgData as any as KnowledgeImage, ...prev]);
      }
      
      toast.success(`${pendingFiles.length} image(s) added for "${newImageLabel.trim()}"`);
      setNewImageLabel('');
      setNewImageDesc('');
      setPendingFiles([]);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    }
    setUploadingImage(false);
  };

  const deleteKnowledgeImage = async (id: string) => {
    const { error } = await supabase
      .from('knowledge_images')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete image');
      return;
    }

    setKnowledgeImages(prev => prev.filter(img => img.id !== id));
    toast.success('Image removed');
  };

  const fetchAiRepliesSetting = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_replies_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!error && data) {
      setAiRepliesEnabled(data.value === true || data.value === 'true');
    }

    const { data: langRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_reply_language')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (langRow?.value) {
      const v = typeof langRow.value === 'string' ? langRow.value.replace(/^"|"$/g, '') : String(langRow.value);
      setAiLanguage(v as AiLanguage);
    }

    const { data: upsellRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_upsell_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (upsellRow) {
      setAiUpsellEnabled(upsellRow.value === true || upsellRow.value === 'true');
    }
  };

  const toggleAiUpsell = async (enabled: boolean) => {
    if (!tenantId) { toast.error('No account selected'); return; }
    setAiUpsellEnabled(enabled);
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'ai_upsell_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value: enabled }).eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('app_settings')
        .insert({ key: 'ai_upsell_enabled', value: enabled, tenant_id: tenantId } as any));
    }

    if (error) {
      toast.error('Failed to update setting');
      setAiUpsellEnabled(!enabled);
    } else {
      // Keep the legacy restaurant-only switch in sync with the global one.
      await supabase.from('app_settings').upsert(
        { tenant_id: tenantId, key: 'restaurant_upsell_enabled', value: enabled } as any,
        { onConflict: 'tenant_id,key' },
      );
      toast.success(enabled ? 'AI upselling enabled' : 'AI upselling disabled');
    }
  };


  const saveAiLanguage = async (lang: AiLanguage) => {
    if (!tenantId) { toast.error('No account selected'); return; }
    const prev = aiLanguage;
    setAiLanguage(lang);
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'ai_reply_language')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value: lang }).eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('app_settings')
        .insert({ key: 'ai_reply_language', value: lang, tenant_id: tenantId } as any));
    }

    if (error) {
      toast.error('Failed to save reply language');
      setAiLanguage(prev);
      return;
    }
    toast.success('AI reply language updated');
  };

  const fetchLearnSetting = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'learn_from_conversations_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!error && data) {
      setLearnEnabled(data.value === true || data.value === 'true');
    }
  };

  const fetchLearnedKnowledge = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('ai_knowledge')
      .select('id,content')
      .eq('title', LEARNED_KNOWLEDGE_TITLE)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!error && data) {
      setLearnedContent(data.content);
      setLearnedEntryId(data.id);
    }
  };



  const toggleAiReplies = async (enabled: boolean) => {
    if (!tenantId) { toast.error('No account selected'); return; }
    setAiRepliesEnabled(enabled);
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'ai_replies_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('app_settings')
        .update({ value: enabled })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('app_settings')
        .insert({ key: 'ai_replies_enabled', value: enabled, tenant_id: tenantId } as any));
    }

    // Keep the tenant row in sync so every reply path sees the same switch.
    await supabase.from('tenants').update({ ai_replies_enabled: enabled }).eq('id', tenantId);



    if (error) {
      toast.error('Failed to update setting');
      setAiRepliesEnabled(!enabled);
    } else {
      toast.success(enabled ? 'AI replies enabled' : 'AI replies disabled');
    }
  };

  const toggleLearnFromConversations = async (enabled: boolean) => {
    if (!tenantId) { toast.error('No account selected'); return; }
    setLearnEnabled(enabled);
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'learn_from_conversations_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('app_settings')
        .update({ value: enabled })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('app_settings')
        .insert({ key: 'learn_from_conversations_enabled', value: enabled, tenant_id: tenantId } as any));
    }

    if (error) {
      toast.error('Failed to update setting');
      setLearnEnabled(!enabled);
    } else {
      toast.success(enabled ? 'Learning from conversations enabled' : 'Learning disabled');
    }
  };


  const fetchKnowledge = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from('ai_knowledge')
      .select('id,content')
      .eq('title', KNOWLEDGE_ENTRY_TITLE)
      .eq('tenant_id', tenantId)
      .maybeSingle();


    if (error) {
      toast.error('Failed to load knowledge');
    } else if (data) {
      setContent(data.content);
      setEntryId(data.id);
    }
    setLoading(false);
  };

  const saveKnowledge = async () => {
    setSaving(true);
    try {
      let id = entryId;
      if (id) {
        const { error } = await supabase
          .from('ai_knowledge')
          .update({ content, is_active: true })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ai_knowledge')
          .insert({ title: KNOWLEDGE_ENTRY_TITLE, content, is_active: true, tenant_id: tenantId } as any)
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        setEntryId(id);
      }
      // Regenerate embedding for semantic retrieval (best-effort)
      if (id) {
        supabase.functions.invoke('embed-knowledge', { headers: actingHeaders(), body: { id } }).catch(() => {});
      }
      toast.success('Knowledge saved successfully');
    } catch (error) {
      toast.error('Failed to save changes');
    }
    setSaving(false);
  };

  // Follows a background import until it finishes, keeping the live status in
  // state and nudging the job back to life if a batch was cut off.
  const watchShopifyImport = async () => {
    setShopifyImporting(true);
    try {
      // Runs until done/error/stopped — big catalogs (8k+ products) take hours.
      for (;;) {
        const { data: st } = await supabase.functions.invoke('shopify-import-knowledge', {
          headers: actingHeaders(), body: { mode: 'status' },
        });
        if (st) {
          setShopifyStatus(st);
          if (st.state === 'error') throw new Error(st.error || 'Import failed');
          if (st.state === 'stopped') { toast.info('Import stopped'); break; }
          if (st.state === 'done') {
            setShopifyImportResult(st);
            setShopifyLastImportedAt(st.last_imported_at);
            toast.success(`Imported ${st.imported?.products ?? 0} products`);
            fetchKnowledgeImages();
            fetchImportedProducts();
            break;
          }
          if (st.state === 'running' && Date.now() - new Date(st.updated_at || 0).getTime() > 90 * 1000) {
            await supabase.functions.invoke('shopify-import-knowledge', {
              headers: actingHeaders(), body: { resume: true },
            });
          }
          if (st.state === 'idle') break;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    }
    setShopifyImporting(false);
  };

  const handleShopifyImport = async () => {
    // Continue where a stopped/interrupted import left off instead of restarting.
    const resume = shopifyStatus?.state === 'stopped' || shopifyStatus?.state === 'error';
    setShopifyImporting(true);
    setShopifyImportResult(null);
    if (!resume) setShopifyStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-import-knowledge', {
        headers: actingHeaders(), body: resume ? { resume: true } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.info(
        data?.total
          ? `Import started — ${data.total} products found. You can leave this page, it keeps running.`
          : 'Import started — it keeps running even if you leave this page.',
      );
    } catch (err: any) {
      setShopifyImporting(false);
      toast.error(err?.message || 'Import failed');
      return;
    }
    watchShopifyImport();
  };

  const handleShopifyStopImport = async () => {
    setShopifyStopping(true);
    try {
      await supabase.functions.invoke('shopify-import-knowledge', {
        headers: actingHeaders(), body: { mode: 'stop' },
      });
      toast.info('Stopping after the current batch…');
    } catch { /* ignore */ }
    setShopifyStopping(false);
  };

  // Re-attach to an import already running (e.g. after a page reload).
  useEffect(() => {
    if (!shopifyConnected) return;
    let cancelled = false;
    (async () => {
      const { data: st } = await supabase.functions.invoke('shopify-import-knowledge', {
        headers: actingHeaders(), body: { mode: 'status' },
      });
      if (cancelled || !st) return;
      setShopifyStatus(st.state === 'idle' ? null : st);
      if (st.state === 'running') watchShopifyImport();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyConnected]);



  const handleShopifyClear = async () => {
    if (!confirm('Remove all Shopify-imported products and images from your knowledge base? This cannot be undone.')) return;
    setShopifyClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-clear-knowledge', { headers: actingHeaders(), body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setShopifyImportResult(null);
      setShopifyLastImportedAt(null);
      toast.success('Shopify import cleared');
      fetchKnowledgeImages();
      fetchImportedProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to clear');
    }
    setShopifyClearing(false);
  };

  const copyImportReport = () => {
    if (!shopifyImportResult) return;
    const r = shopifyImportResult;
    const when = new Date(r.last_imported_at).toLocaleString();
    const lines = [
      `Last imported: ${when}`,
      `Imported: ${r.imported.products} products, ${r.imported.images} images` +
        (r.imported.skipped_existing_images > 0 ? ` (${r.imported.skipped_existing_images} already up-to-date)` : ''),
    ];
    if (r.failed.length) {
      lines.push('', `Couldn't import ${r.failed.length} item(s):`);
      for (const f of r.failed) lines.push(` - "${f.product}" — ${f.reason}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Report copied');
  };

  const fetchFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    setFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: urlInput.trim() },
      });
      if (error) throw error;
      if (data.success) {
        const separator = content.trim() ? '\n\n---\n\n' : '';
        const newContent = `${content}${separator}## Content from ${data.url}\n\n${data.content}`;
        setContent(newContent);
        setUrlInput('');
        toast.success('Content fetched and added');
      } else {
        toast.error(data.error || 'Failed to fetch URL');
      }
    } catch (error) {
      toast.error('Failed to fetch content from URL');
    }
    setFetchingUrl(false);
  };

  const extractProductsFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter your website URL');
      return;
    }
    setExtractingProducts(true);
    const url = urlInput.trim();
    try {
      // The import runs in resumable chunks so huge catalogues don't time out.
      let cursor: any = null;
      let total = 0;
      let withPrice = 0;
      let site = url;
      const progressId = 'website-import-progress';
      for (let step = 0; step < 200; step++) {
        const { data, error } = await supabase.functions.invoke('import-website-products', {
          headers: actingHeaders(),
          body: { url, cursor },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        total = data.total_inserted ?? data.inserted ?? total;
        withPrice += data.with_price || 0;
        site = data.site || site;
        if (data.done) break;
        cursor = data.cursor;
        toast.loading(`Importing… ${total} products so far`, { id: progressId });
      }
      toast.dismiss(progressId);
      toast.success(
        `Imported ${total} product${total === 1 ? '' : 's'} (${withPrice} with prices) from ${site}`,
      );
      setUrlInput('');
      setShowWebsiteList(true);
      fetchImportedProducts?.();
      fetchWebsiteProducts();
    } catch (err: any) {
      toast.dismiss('website-import-progress');
      toast.error(err?.message || 'Failed to extract products');
    }
    setExtractingProducts(false);
  };



  const analyzeConversations = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-conversations', {});
      if (error) throw error;
      if (data.success) {
        setLearnedContent(data.insights);
        if (learnedEntryId) {
          await supabase
            .from('ai_knowledge')
            .update({ content: data.insights, is_active: learnEnabled })
            .eq('id', learnedEntryId);
        } else {
          const { data: newEntry } = await supabase
            .from('ai_knowledge')
            .insert({ title: LEARNED_KNOWLEDGE_TITLE, content: data.insights, is_active: learnEnabled, tenant_id: tenantId } as any)
            .select()
            .single();
          if (newEntry) setLearnedEntryId(newEntry.id);
        }
        toast.success(`Analyzed ${data.messageCount} messages from ${data.conversationCount} conversations`);
      } else {
        toast.error(data.error || 'Failed to analyze conversations');
      }
    } catch (error) {
      toast.error('Failed to analyze conversations');
    }
    setAnalyzing(false);
  };

  const saveLearnedContent = async () => {
    setSaving(true);
    try {
      let id = learnedEntryId;
      if (id) {
        const { error } = await supabase
          .from('ai_knowledge')
          .update({ content: learnedContent, is_active: learnEnabled })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ai_knowledge')
          .insert({ title: LEARNED_KNOWLEDGE_TITLE, content: learnedContent, is_active: learnEnabled, tenant_id: tenantId } as any)
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        setLearnedEntryId(id);
      }
      if (id) supabase.functions.invoke('embed-knowledge', { headers: actingHeaders(), body: { id } }).catch(() => {});
      toast.success('Learned content saved');
    } catch (error) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };
  const settingsTourSteps: TourStep[] = [
    {
      id: "settings-welcome",
      title: "Settings",
      body: "This is where you configure your AI assistant, connect integrations, and manage your business knowledge.",
    },
    {
      id: "ai-auto-replies",
      target: '[data-tour="ai-auto-replies"]',
      title: "AI Auto-Replies",
      body: "AI auto-replies are controlled per chat from the chat header. You can also toggle the global default here.",
    },
    {
      id: "whatsapp-business",
      target: '[data-tour="whatsapp-business"]',
      title: "WhatsApp Business",
      body: "Manage your WhatsApp Business connection. Reconnect if your Meta account access expires.",
    },
    {
      id: "shopify-store",
      target: '[data-tour="shopify-store"]',
      title: "Shopify Store",
      body: "Connect your Shopify store to import products into the AI knowledge base. This lets the AI answer questions about your products accurately.",
      action: "Disconnect and reconnect anytime.",
    },
    {
      id: "knowledge-tabs",
      target: '[data-tour="knowledge-tabs"]',
      title: "Knowledge Base",
      body: "The AI learns from three sources: Knowledge (text), Images (product photos), and Learn (conversation history).",
      action: "Tap each tab to explore.",
    },
    {
      id: "knowledge-content",
      target: '[data-tour="knowledge-content"]',
      title: "Teach the AI your business",
      body: "Paste everything the AI should know: products, prices, policies, FAQs, hours. You can also import content from a URL.",
      action: "Without a knowledge base, the AI won't have answers to give your customers.",
      beforeShow: async () => { setActiveSettingsTab('knowledge'); await sleep(150); },
    },
    {
      id: "images-tab",
      target: '[data-tour="images-tab-trigger"]',
      title: "Product Images",
      body: "Add product photos with descriptions. The AI sends them when customers ask to see items.",
      beforeShow: async () => { setActiveSettingsTab('images'); await sleep(150); },
    },
    {
      id: "learn-tab",
      target: '[data-tour="learn-tab-trigger"]',
      title: "Learn from Conversations",
      body: "Let the AI analyze your chat history to extract patterns, FAQs, and insights. This improves responses over time.",
      beforeShow: async () => { setActiveSettingsTab('learn'); await sleep(150); },
    },
    {
      id: "settings-finish",
      title: "You're ready to train your AI! 🎉",
      body: "Start by filling in your Knowledge base. The more detail you provide, the better your AI will serve your customers.",
    },
  ];

  const handleTourClose = useCallback((completed: boolean) => {
    setTourOpen(false);
    if (completed) toast.success('Settings tour complete!');
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background safe-top safe-bottom">
      {!isShopifyBilled && !billingOriginLoading && <PaymentTestModeBanner />}
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-header px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="text-header-foreground hover:bg-primary/80"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold text-header-foreground">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <SubscriptionCard userId={user?.id} />

          {isTenantAdmin && (
            <>
              <TeamManager />
              <TeamActivity />
            </>
          )}


          {/* AI Auto-Replies are now controlled per chat from the chat header. */}
          <Card data-tour="ai-auto-replies">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Auto-Replies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Global AI auto-replies</p>
                  <p className="text-xs text-muted-foreground">
                    Master switch. When off, the AI will not reply to any conversation, regardless of per-chat settings.
                  </p>
                </div>
                <Switch checked={aiRepliesEnabled} onCheckedChange={toggleAiReplies} />
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Reply language</p>
                  <p className="text-xs text-muted-foreground">
                    Choose which language the AI replies in. Pick a single language to lock it, or keep “All” so it mirrors each customer.
                  </p>
                </div>
                <Select value={aiLanguage} onValueChange={(v) => saveAiLanguage(v as AiLanguage)}>
                  <SelectTrigger className="w-full sm:max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_LANGUAGE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {AI_LANGUAGE_OPTIONS.find((o) => o.value === aiLanguage)?.hint}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">AI upselling &amp; recommendations</p>
                  <p className="text-xs text-muted-foreground">
                    When on, the AI suggests one relevant add-on or matching item (e.g. “want fries with that?”, “these pants match that top”),
                    and if a customer asks about a product but doesn’t order, it recommends an alternative or mentions any ongoing sale. Never pushy — one suggestion max.
                  </p>
                </div>
                <Switch checked={aiUpsellEnabled} onCheckedChange={toggleAiUpsell} />
              </div>
              <p className="text-xs text-muted-foreground">
                You can also control AI replies <strong>per chat</strong> using the bot icon in each conversation header.
              </p>
            </CardContent>
          </Card>

          <Card data-tour="whatsapp-business">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                WhatsApp Business
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className={`h-5 w-5 shrink-0 ${whatsAppConnected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{whatsAppConnected ? 'Connected' : 'Reconnect required'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {whatsAppConnected ? whatsAppPhone : 'Reconnect once to refresh Meta account access.'}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleWhatsAppReconnect} disabled={whatsAppConnecting || !sdkReady}>
                  {whatsAppConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Facebook className="h-4 w-4 mr-1" />Reconnect</>}
                </Button>
              </div>
              {whatsAppConnected && isTenantAdmin && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={handleMetaDisconnect} className="text-destructive hover:text-destructive">
                    Disconnect from Meta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instagram Direct — second channel of the same inbox */}
          <Card data-tour="instagram-direct">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                  <Instagram className="h-3.5 w-3.5" />
                </span>
                Instagram Direct
              </CardTitle>
              <CardDescription>
                Answer Instagram DMs in the same inbox, alongside WhatsApp Business.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2
                    className={`h-5 w-5 shrink-0 ${instagram.connected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {instagram.loading ? 'Checking…' : instagram.connected ? 'Connected' : 'Not connected'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {instagram.connected
                        ? instagram.username
                          ? `@${instagram.username}`
                          : 'Instagram professional account linked'
                        : 'Requires an Instagram professional account linked to your Facebook Page.'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={instagram.connected ? 'outline' : 'default'}
                  disabled={igConnecting}
                  onClick={() => (instagram.connected ? navigate('/integrations') : startInstagramConnect())}
                >
                  {igConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {instagram.connected ? 'Manage' : 'Connect Instagram'}
                </Button>
              </div>
              {instagram.connected && isTenantAdmin && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={handleInstagramDisconnect}
                  >
                    Disconnect from Meta
                  </Button>
                </div>
              )}


            </CardContent>
          </Card>

          {whatsAppConnected && <WhatsAppHealthCard />}




          {/* Shopify Integration */}
          <Card data-tour="shopify-store">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Store className="h-4 w-4" />
                Shopify Store
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shopifyConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Store Connected</p>
                        <p className="text-xs text-muted-foreground">{shopDomain || 'Shopify store linked'}</p>
                      </div>
                    </div>
                    {isTenantAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShopifyDisconnect}
                        className="text-destructive hover:text-destructive"
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Product import now lives below in <span className="font-medium">Knowledge → Import</span>,
                      where you choose Shopify, a website, or a file.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Connect your Shopify store to enable AI-powered product and order management via WhatsApp.
                  </p>
                  <div className="flex gap-2">
                    <SettingsInput
                      placeholder="your-store.myshopify.com"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      disabled={shopifyConnecting}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleShopifyConnect}
                      disabled={shopifyConnecting || !shopDomain.trim()}
                      size="sm"
                    >
                      {shopifyConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><ShoppingBag className="h-4 w-4 mr-1" />Connect</>
                      )}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTokenConnect((v) => !v)}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    {showTokenConnect ? 'Hide advanced' : 'Advanced: connect with a custom app token'}
                  </button>

                  {showTokenConnect && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        In your Shopify admin go to Settings → Apps and sales channels → Develop apps → Create an app,
                        grant <span className="font-medium">read_products, read_inventory, read_orders, write_orders</span>,
                        install it, then paste the Admin API access token (starts with <code>shpat_</code>) here.
                      </p>
                      <SettingsInput
                        placeholder="shpat_..."
                        value={shopifyToken}
                        onChange={(e) => setShopifyToken(e.target.value)}
                        disabled={shopifyConnecting}
                        autoComplete="off"
                      />
                      <Button
                        onClick={handleShopifyTokenConnect}
                        disabled={shopifyConnecting || !shopDomain.trim() || !shopifyToken.trim()}
                        size="sm"
                        variant="secondary"
                      >
                        {shopifyConnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Connect with token'
                        )}
                      </Button>
                    </div>
                  )}
                </div>

              )}
            </CardContent>
          </Card>

          <RestaurantSettingsBlock />
          <RealEstateSettingsBlock />
          <WellnessSettingsBlock />
          <HealthcareSettingsBlock />
          <EducationSettingsBlock />

          {/* Tabs */}
          <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3" data-tour="knowledge-tabs">
              <TabsTrigger value="knowledge" className="flex items-center gap-2" data-tour="knowledge-tab-trigger">
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Knowledge</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2" data-tour="images-tab-trigger">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Images</span>
              </TabsTrigger>
              <TabsTrigger value="learn" className="flex items-center gap-2" data-tour="learn-tab-trigger">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Learn</span>
              </TabsTrigger>
            </TabsList>

            {/* Knowledge Base Tab */}
            <TabsContent value="knowledge" className="space-y-4" data-tour="knowledge-content">
              <p className="text-sm text-muted-foreground">
                Add all information the AI needs to respond to customers. This can include product details, 
                pricing, FAQs, policies, and any other relevant information.
              </p>

              {/* Unified import: website / Shopify / file */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Import
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Choose where your products and information come from.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'website', label: 'Website', icon: Link },
                      { key: 'shopify', label: 'Shopify', icon: ShoppingBag },
                      { key: 'file', label: 'File', icon: FileUp },
                    ] as const).map((opt) => {
                      const Icon = opt.icon;
                      const active = importSource === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setImportSource(opt.key)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-xs font-medium transition-colors min-h-[56px] ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {importSource === 'website' && (
                    <div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://yourstore.com"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          className="flex-1 text-base"
                          onKeyDown={(e) => e.key === 'Enter' && extractProductsFromUrl()}
                        />
                        <Button
                          onClick={extractProductsFromUrl}
                          disabled={extractingProducts || fetchingUrl}
                        >
                          {extractingProducts ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Extract products'
                          )}
                        </Button>
                        <Button
                          onClick={fetchFromUrl}
                          disabled={fetchingUrl || extractingProducts}
                          variant="secondary"
                        >
                          {fetchingUrl ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Fetch text'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Extract products</strong> scans your website (product pages, sitemap, or Shopify catalog)
                        and saves each product with its price as its own knowledge entry the AI can quote and sell from.
                        Re-running replaces the previous website import. <strong>Fetch text</strong> just appends the page
                        text to your general knowledge below.
                      </p>

                      {websiteProducts.length > 0 && (
                        <div className="mt-3 rounded-md border bg-muted/20">
                          <div className="flex items-center justify-between px-3 py-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setShowWebsiteList((v) => !v)}
                              className="text-xs font-medium hover:underline text-left"
                            >
                              {websiteProducts.length} product{websiteProducts.length === 1 ? '' : 's'} imported from your website
                              {' · '}
                              {websiteProducts.filter((p) => p.price).length} with prices
                              {' · '}
                              {websiteProducts.filter((p) => p.image).length} with images
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => setShowWebsiteList((v) => !v)}>
                                {showWebsiteList ? 'Hide' : 'Show'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={clearWebsiteProducts}
                                disabled={clearingWebsiteProducts}
                              >
                                {clearingWebsiteProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove all'}
                              </Button>
                            </div>
                          </div>
                          {showWebsiteList && (
                            <div className="max-h-72 overflow-y-auto px-3 pb-3 space-y-2 text-xs">
                              {websiteProducts.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 border-b last:border-0 py-2">
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.title}
                                      loading="lazy"
                                      className="h-10 w-10 rounded object-cover border shrink-0"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center shrink-0">
                                      <Image className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{p.title}</p>
                                    <p className="text-muted-foreground">
                                      {p.price ? (
                                        <>
                                          {p.price}
                                          {p.comparePrice && (
                                            <span className="line-through ml-1 opacity-60">{p.comparePrice}</span>
                                          )}
                                        </>
                                      ) : (
                                        'No price found'
                                      )}
                                    </p>
                                  </div>
                                  {p.url && (
                                    <a
                                      href={p.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary shrink-0 hover:underline"
                                    >
                                      View
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {importSource === 'shopify' && (
                    !shopifyConnected ? (
                      <p className="text-xs text-muted-foreground">
                        Connect your Shopify store first in the <span className="font-medium">Shopify Store</span> card above,
                        then come back here to import your products.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">Import products into knowledge base</p>
                          <p className="text-xs text-muted-foreground">
                            Last imported: {shopifyLastImportedAt
                              ? new Date(shopifyLastImportedAt).toLocaleString()
                              : 'Never imported'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={handleShopifyImport} disabled={shopifyImporting || shopifyClearing}>
                            {shopifyImporting ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                {shopifyStatus?.processed != null
                                  ? `Importing… ${shopifyStatus.processed}${shopifyStatus.total ? ` / ${shopifyStatus.total}` : ''} products`
                                  : 'Importing…'}
                              </>
                            ) : (
                              <><ShoppingBag className="h-4 w-4 mr-1" />
                                {shopifyStatus?.state === 'stopped' ? 'Resume import' : 'Import all products'}
                              </>
                            )}
                          </Button>
                          {shopifyImporting && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleShopifyStopImport}
                              disabled={shopifyStopping}
                            >
                              {shopifyStopping ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                              Stop import
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleShopifyClear}
                            disabled={shopifyImporting || shopifyClearing}
                            className="text-destructive hover:text-destructive"
                          >
                            {shopifyClearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                            Clear Shopify import
                          </Button>
                        </div>

                        {shopifyStatus && shopifyStatus.state !== 'done' && (
                          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span>
                                {shopifyStatus.state === 'running' ? 'Import in progress'
                                  : shopifyStatus.state === 'stopped' ? 'Import stopped'
                                  : shopifyStatus.state === 'error' ? 'Import interrupted'
                                  : 'Import status'}
                              </span>
                              <span className="text-muted-foreground">
                                {shopifyStatus.processed ?? 0}
                                {shopifyStatus.total ? ` / ${shopifyStatus.total}` : ''} products
                                {shopifyStatus.total
                                  ? ` (${Math.min(100, Math.round(((shopifyStatus.processed ?? 0) / shopifyStatus.total) * 100))}%)`
                                  : ''}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{
                                  width: shopifyStatus.total
                                    ? `${Math.min(100, ((shopifyStatus.processed ?? 0) / shopifyStatus.total) * 100)}%`
                                    : '100%',
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>Batch size: {shopifyStatus.batch_size ?? 12} products</span>
                              <span>Batches done: {shopifyStatus.batches ?? 0}</span>
                              <span>Images saved: {shopifyStatus.imported?.images ?? 0}</span>
                              <span>Speed: {shopifyStatus.products_per_min ?? 0}/min</span>
                              <span>
                                Running for: {shopifyStatus.elapsed_ms
                                  ? `${Math.floor(shopifyStatus.elapsed_ms / 60000)} min`
                                  : '—'}
                              </span>
                              <span>
                                Time left: {shopifyStatus.eta_seconds != null
                                  ? shopifyStatus.eta_seconds > 3600
                                    ? `~${Math.round(shopifyStatus.eta_seconds / 3600)} h`
                                    : `~${Math.max(1, Math.round(shopifyStatus.eta_seconds / 60))} min`
                                  : '—'}
                              </span>
                              {shopifyStatus.last_product && (
                                <span className="col-span-2 truncate">Last product: {shopifyStatus.last_product}</span>
                              )}
                              {shopifyStatus.updated_at && (
                                <span className="col-span-2">
                                  Last activity: {new Date(shopifyStatus.updated_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {shopifyStatus.state === 'error' && shopifyStatus.error && (
                              <p className="text-xs text-destructive">
                                Stopped at product {shopifyStatus.processed ?? 0}: {shopifyStatus.error}. Press
                                {' '}"Import all products" to continue from here.
                              </p>
                            )}
                            {shopifyStatus.state === 'stopped' && (
                              <p className="text-xs text-muted-foreground">
                                Stopped after {shopifyStatus.processed ?? 0} products — resuming continues from here.
                              </p>
                            )}
                          </div>
                        )}

                        {shopifyImportResult && (
                          <div className="rounded-md border p-3 text-xs space-y-2 bg-muted/30">
                            <p className="font-medium">
                              Imported {shopifyImportResult.imported.products} products,{' '}
                              {shopifyImportResult.imported.images} images
                              {shopifyImportResult.imported.skipped_existing_images > 0
                                ? ` (${shopifyImportResult.imported.skipped_existing_images} already up-to-date)`
                                : ''}
                            </p>
                            {shopifyImportResult.failed.length > 0 && (
                              <>
                                <p className="text-destructive font-medium">
                                  Couldn't import {shopifyImportResult.failed.length} item(s):
                                </p>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                  {shopifyImportResult.failed.map((f, i) => (
                                    <div key={i}>• "{f.product}" — {f.reason}</div>
                                  ))}
                                </div>
                                <Button size="sm" variant="ghost" onClick={copyImportReport}>Copy report</Button>
                              </>
                            )}
                          </div>
                        )}
                        {importedProducts.length > 0 && (
                          <div className="rounded-md border bg-muted/20">
                            <button
                              type="button"
                              onClick={() => setShowImportedList((v) => !v)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 rounded-md"
                            >
                              <span>{importedProducts.length} product{importedProducts.length === 1 ? '' : 's'} in knowledge base</span>
                              <span className="text-muted-foreground">{showImportedList ? 'Hide' : 'Show'}</span>
                            </button>
                            {showImportedList && (
                              <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1 text-xs">
                                {importedProducts.map((p) => (
                                  <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-1.5 gap-2">
                                    <span className="truncate">{p.title}</span>
                                    {p.shopify_product_id && (
                                      <span className="text-muted-foreground shrink-0">#{p.shopify_product_id}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {importSource === 'file' && <FileImportCard embedded />}
                </CardContent>
              </Card>



              {/* Main Knowledge Content */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Knowledge Content</CardTitle>
                    <Button
                      onClick={saveKnowledge}
                      disabled={saving}
                      size="sm"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Enter all information the AI should know about your business, products, services, policies, FAQs, etc."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={20}
                      className="resize-none font-mono text-sm"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add items with multiple pictures. The AI sends the first picture when requested, and the next one if the customer asks for more.
              </p>

              {/* Upload New Item Images */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" />
                    Add Item Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Item name (e.g. 'Red T-Shirt')"
                    value={newImageLabel}
                    onChange={(e) => setNewImageLabel(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description for the AI (e.g. 'A red cotton t-shirt, available in sizes S-XL, priced at $25')"
                    value={newImageDesc}
                    onChange={(e) => setNewImageDesc(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                  
                  {/* Pending files preview */}
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((file, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${idx + 1}`}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <button
                            onClick={() => removePendingFile(idx)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      id="knowledge-image-upload"
                      className="hidden"
                      onChange={handleAddFiles}
                    />
                    <Button
                      onClick={() => document.getElementById('knowledge-image-upload')?.click()}
                      variant="outline"
                      className="flex-1"
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Add Pictures ({pendingFiles.length})
                    </Button>
                    <Button
                      onClick={handleUploadAll}
                      disabled={uploadingImage || !newImageLabel.trim() || !newImageDesc.trim() || pendingFiles.length === 0}
                      className="flex-1"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        'Upload All'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Grouped Image List */}
              {(() => {
                const grouped = knowledgeImages.reduce<Record<string, KnowledgeImage[]>>((acc, img) => {
                  const key = img.label;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(img);
                  return acc;
                }, {});

                const groupEntries = Object.entries(grouped);
                if (groupEntries.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No images added yet</p>
                      <p className="text-xs mt-1">Add items with multiple pictures for the AI to share.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {groupEntries.map(([label, imgs]) => (
                      <Card key={label}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{label}</p>
                              <p className="text-xs text-muted-foreground">{imgs.length} photo(s)</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {imgs.map((img, idx) => (
                              <div key={img.id} className="relative group">
                                <img
                                  src={img.image_url}
                                  alt={`${img.label} ${idx + 1}`}
                                  className="w-20 h-20 rounded-lg object-cover"
                                />
                                <button
                                  onClick={() => deleteKnowledgeImage(img.id)}
                                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-xs font-bold hidden group-hover:flex"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>


            {/* Learn from Conversations Tab */}
            <TabsContent value="learn" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Learn from Conversations
                  </CardTitle>
                  <CardDescription>
                    Let AI analyze your conversation history to learn common questions, patterns, and improve responses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Use learned insights</p>
                      <p className="text-xs text-muted-foreground">
                        Include learned patterns when generating AI responses.
                      </p>
                    </div>
                    <Switch
                      checked={learnEnabled}
                      onCheckedChange={toggleLearnFromConversations}
                    />
                  </div>

                  <div className="pt-2 border-t">
                    <Button
                      onClick={analyzeConversations}
                      disabled={analyzing}
                      className="w-full"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing conversations...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Analyze All Conversations
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      AI will review all messages and extract patterns, FAQs, and insights.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Learned Content */}
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">Learned Insights</CardTitle>
                    <CardDescription className="text-xs">
                      AI-generated summary from your conversation history
                    </CardDescription>
                  </div>
                  <Button
                    onClick={saveLearnedContent}
                    disabled={saving || !learnedContent}
                    size="sm"
                    variant="outline"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Edits
                  </Button>
                </CardHeader>
                <CardContent>
                  {learnedContent ? (
                    <Textarea
                      value={learnedContent}
                      onChange={(e) => setLearnedContent(e.target.value)}
                      rows={15}
                      className="resize-none font-mono text-sm"
                      placeholder="Learned insights will appear here after analysis..."
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No insights yet</p>
                      <p className="text-xs mt-1">Click "Analyze All Conversations" to generate insights from your chat history.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Sign out */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </CardTitle>
              <CardDescription className="text-xs">
                End your session on this device. You can sign back in anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate('/', { replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </CardContent>
          </Card>
      </div>
      <ProductTour
        steps={settingsTourSteps}
        open={tourOpen}
        initialStep={tourInitialStep}
        userId={user?.id}
        onClose={handleTourClose}
      />
    </div>
    </div>
  );
}

function RestaurantSettingsBlock() {
  const { vertical } = useTenantVertical();
  if (vertical !== 'restaurant') return null;
  return <RestaurantSettings />;
}

function RealEstateSettingsBlock() {
  const { vertical } = useTenantVertical();
  if (vertical !== 'real_estate') return null;
  return <RealEstateSettings />;
}

function WellnessSettingsBlock() {
  const { vertical } = useTenantVertical();
  if (vertical !== 'wellness' && vertical !== 'service') return null;
  return <WellnessSettings />;
}

function HealthcareSettingsBlock() {
  const { vertical } = useTenantVertical();
  if (vertical !== 'healthcare') return null;
  return <HealthcareSettings />;
}

function EducationSettingsBlock() {
  const { vertical } = useTenantVertical();
  if (vertical !== 'education') return null;
  return <EducationSettings />;
}
