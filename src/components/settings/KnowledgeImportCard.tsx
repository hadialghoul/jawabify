import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { actingHeaders } from '../../lib/actingTenant';
import { invokeErrorMessage } from '../../lib/functionError';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type WebsiteEntry = {
  id: string;
  title: string;
  price?: string;
};

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const text = String(reader.result || '');
      const comma = text.indexOf(',');
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.readAsDataURL(blob);
  });
}

function grabLabel(content: string, label: string): string | undefined {
  const m = content.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : undefined;
}

export function KnowledgeImportCard({ variant = 'default' }: { variant?: 'default' | 'service' }) {
  const { tenantId } = useAuth();
  const toast = useToast();
  const isService = variant === 'service';
  const [source, setSource] = useState<'website' | 'file'>('website');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [websiteEntries, setWebsiteEntries] = useState<WebsiteEntry[]>([]);
  const [showList, setShowList] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refreshWebsiteEntries = useCallback(async () => {
    if (!tenantId) {
      setWebsiteEntries([]);
      return;
    }
    const rows: { id: string; title: string; content: string }[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 40000; from += PAGE) {
      const { data, error } = await supabase
        .from('ai_knowledge')
        .select('id, title, content')
        .eq('tenant_id', tenantId)
        .eq('type', 'website_product')
        .order('title', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      rows.push(...((data as any[]) || []));
      if (!data || data.length < PAGE) break;
    }
    setWebsiteEntries(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        price: grabLabel(r.content || '', 'Price'),
      })),
    );
  }, [tenantId]);

  useEffect(() => {
    refreshWebsiteEntries();
  }, [refreshWebsiteEntries]);

  const importWebsite = async () => {
    let siteUrl = url.trim().replace(/[\s_,.;:'"<>()\[\]]+$/g, '');
    if (!siteUrl) return toast.error('Paste a website address');
    if (!/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`;
    setImporting(true);
    try {
      let cursor: any = null;
      let total = 0;
      let withPrice = 0;
      let site = siteUrl;
      let mode: string | undefined;
      const noun = isService ? 'service' : 'product';
      for (let step = 0; step < 200; step++) {
        const { data, error } = await supabase.functions.invoke('import-website-products', {
          headers: actingHeaders(),
          body: { url: siteUrl, cursor, ...(isService ? { vertical: 'service' } : {}) },
        });
        if (error) throw new Error(await invokeErrorMessage(error, data));
        if (data?.error) throw new Error(String(data.error));
        total = data.total_inserted ?? data.inserted ?? total;
        withPrice += data.with_price || 0;
        site = data.site || site;
        mode = data.mode || mode;
        if (data.done) break;
        cursor = data.cursor;
      }
      if (mode === 'about') {
        toast.success(`No services listed on ${site} \u2014 saved an about paragraph instead`);
      } else {
        toast.success(
          `Imported ${total} ${noun}${total === 1 ? '' : 's'} (${withPrice} with prices) from ${site}`,
        );
      }
      setUrl('');
      setShowList(true);
      await refreshWebsiteEntries();
    } catch (e: any) {
      toast.error(e?.message || 'Website import failed');
    } finally {
      setImporting(false);
    }
  };

  const removeAllWebsite = () => {
    if (!tenantId) return;
    Alert.alert(
      'Remove all website imports?',
      isService
        ? 'This removes all services imported from your website URL.'
        : 'This removes all products imported from your website URL.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            const { error } = await supabase
              .from('ai_knowledge')
              .delete()
              .eq('tenant_id', tenantId)
              .eq('type', 'website_product');
            setClearing(false);
            if (error) {
              toast.error('Failed to remove website imports');
              return;
            }
            setWebsiteEntries([]);
            toast.success(isService ? 'Website services removed' : 'Website products removed');
          },
        },
      ],
    );
  };

  const importFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20MB');
      return;
    }
    setFileName(asset.name);
    setImporting(true);
    try {
      const base64 = await uriToBase64(asset.uri);
      const { data, error } = await supabase.functions.invoke('import-knowledge-file', {
        headers: actingHeaders(),
        body: {
          mode: 'unstructured',
          file_base64: base64,
          mime: asset.mimeType || 'application/octet-stream',
          filename: asset.name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Import failed');
      toast.success(
        isService
          ? `Imported ${data?.inserted ?? 0} service${data?.inserted === 1 ? '' : 's'} into the knowledge base.`
          : `Imported ${data?.inserted ?? 0} item${data?.inserted === 1 ? '' : 's'} into the knowledge base.`,
      );
    } catch (e: any) {
      toast.error(e?.message || 'File import failed');
    } finally {
      setImporting(false);
    }
  };

  const clearImports = () => {
    Alert.alert('Clear file imports?', 'This removes knowledge that was imported from files.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setImporting(true);
          const { data, error } = await supabase.functions.invoke('import-knowledge-file', {
            headers: actingHeaders(),
            body: { mode: 'clear' },
          });
          setImporting(false);
          if (error) toast.error(error.message);
          else toast.success(`Cleared ${data?.deleted ?? 0} file imports`);
        },
      },
    ]);
  };

  const downloadCsvTemplate = async () => {
    const rows = [
      ['title', 'price', 'description', 'sku', 'category', 'tags', 'image url'],
      ['Strategy call', '120', '60-min consulting call', 'SVC-01', 'Consulting', 'call,zoom', ''],
      ['Website audit', '450', 'Full site + funnel review', 'SVC-02', 'Consulting', 'audit', ''],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: 'knowledge-import-template.csv' });
    } catch {
      toast.error('Could not share CSV template');
    }
  };

  const withPriceCount = websiteEntries.filter((e) => e.price).length;

  return (
    <Card>
      <Text style={styles.h2}>Import</Text>
      <Text style={styles.sub}>
        {isService
          ? 'Import the services from your website, or upload your service list, price sheet or FAQ document.'
          : 'Bring services, products, or a price sheet into the knowledge base \u2014 same as the website.'}
      </Text>
      <View style={styles.row}>
        <Button title="Website" variant={source === 'website' ? 'primary' : 'outline'} onPress={() => setSource('website')} />
        <Button title="File" variant={source === 'file' ? 'primary' : 'outline'} onPress={() => setSource('file')} />
      </View>
      {source === 'website' ? (
        <>
          <Input
            value={url}
            onChangeText={setUrl}
            placeholder={isService ? 'https://yourbusiness.com' : 'https://yourstore.com'}
            autoCapitalize="none"
          />
          {isService ? (
            <Text style={styles.sub}>
              <Text style={styles.strong}>Extract services</Text> reads your website and saves each service you offer
              {' \u2014 '}what it includes, how long it takes and its price when shown. If your site lists no services, we
              save a short paragraph about your business instead. Re-running replaces the previous website import.
            </Text>
          ) : (
            <Text style={styles.sub}>
              <Text style={styles.strong}>Extract products</Text> scans your website and saves each product with its price
              as its own knowledge entry. Re-running replaces the previous website import.
            </Text>
          )}
          <Button
            title={
              importing
                ? 'Importing\u2026'
                : isService
                  ? 'Extract services'
                  : 'Extract products'
            }
            loading={importing}
            onPress={importWebsite}
          />
          {websiteEntries.length > 0 ? (
            <View style={styles.listBox}>
              <View style={styles.listHead}>
                <Text style={styles.summary}>
                  {websiteEntries.length} {isService ? (websiteEntries.length === 1 ? 'entry' : 'entries') : websiteEntries.length === 1 ? 'product' : 'products'}{' '}
                  imported from your website {'\u00B7'} {withPriceCount} with prices
                </Text>
                <View style={styles.row}>
                  <Button title={showList ? 'Hide' : 'Show'} variant="outline" onPress={() => setShowList((v) => !v)} />
                  <Button
                    title={clearing ? 'Removing\u2026' : 'Remove all'}
                    variant="destructive"
                    loading={clearing}
                    disabled={clearing}
                    onPress={removeAllWebsite}
                  />
                </View>
              </View>
              {showList
                ? websiteEntries.map((e) => (
                    <View key={e.id} style={styles.entryRow}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text style={styles.entryMeta}>{e.price || 'No price found'}</Text>
                    </View>
                  ))
                : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.sub}>Upload a spreadsheet, PDF, Word file, or image. The AI reads it into the knowledge base.</Text>
          {fileName ? <Text style={styles.sub}>Last file: {fileName}</Text> : null}
          {isService ? (
            <Button title="Download CSV template" variant="outline" onPress={downloadCsvTemplate} />
          ) : null}
          <Button title={importing ? 'Importing\u2026' : 'Choose file'} loading={importing} onPress={importFile} />
          <Button title="Clear file imports" variant="outline" disabled={importing} onPress={clearImports} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  strong: { fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: colors.muted,
  },
  listHead: { gap: 8 },
  summary: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  entryRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8, gap: 2 },
  entryTitle: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  entryMeta: { fontSize: 12, color: colors.mutedForeground },
});