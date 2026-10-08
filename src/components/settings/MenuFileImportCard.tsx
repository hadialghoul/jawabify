import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileUp } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { actingHeaders } from '../../lib/actingTenant';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

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

type PreviewRow = { name: string; price: number; description?: string | null; category?: string | null };

/** Restaurant menu import — same backend as website MenuFileImportCard. */
export function MenuFileImportCard({ onImported }: { onImported?: () => void }) {
  const toast = useToast();
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain',
        'image/*',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    setPreview(null);
    setFileName(asset.name);
    try {
      const file_base64 = await uriToBase64(asset.uri);
      const { data, error } = await supabase.functions.invoke('import-menu-file', {
        headers: actingHeaders(),
        body: { file_base64, mime: asset.mimeType, filename: asset.name, currency, dry_run: true },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const rows = ((data as any)?.preview ?? []) as PreviewRow[];
      if (!rows.length) throw new Error('No menu items found in this file');
      setPreview(rows);
      toast.success(`Found ${rows.length} item${rows.length === 1 ? '' : 's'} — review and confirm`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not read this file');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview?.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-menu-file', {
        headers: actingHeaders(),
        body: { items: preview, currency },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const { inserted = 0, skipped = 0 } = (data as any) || {};
      toast.success(`Imported ${inserted} item${inserted === 1 ? '' : 's'}${skipped ? ` · ${skipped} already existed` : ''}`);
      setPreview(null);
      setFileName('');
      onImported?.();
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <FileUp size={16} color={colors.primary} />
        <Text style={styles.h2}>Import menu</Text>
      </View>
      <Text style={styles.sub}>
        Upload a PDF, Excel, CSV or photo of your menu. Items go into the Menu tab for the WhatsApp assistant.
      </Text>
      <Input value={currency} onChangeText={setCurrency} placeholder="Currency (USD)" autoCapitalize="characters" />
      <Button title={busy ? 'Reading…' : 'Choose menu file'} loading={busy} variant="outline" onPress={pick} />
      {fileName ? <Text style={styles.sub}>File: {fileName}</Text> : null}
      {preview ? (
        <>
          <Text style={styles.label}>Preview ({preview.length})</Text>
          {preview.slice(0, 8).map((r, i) => (
            <Text key={`${r.name}-${i}`} style={styles.sub}>
              {r.name} — {r.price} {currency}
            </Text>
          ))}
          {preview.length > 8 ? <Text style={styles.sub}>…and {preview.length - 8} more</Text> : null}
          <Button title="Confirm import" loading={busy} onPress={confirm} />
          <Button title="Cancel" variant="ghost" onPress={() => setPreview(null)} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginTop: 8 },
});
