import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { adsManagerUrl, sourceLabel } from '../../lib/jawabifyOctUpdates';
import { colors, radius } from '../../theme';
import { HorizontalBarChart } from '../charts';

type AdDetail = { image_url?: string; headline?: string; ad_id?: string; platform?: string };

export function ConversationSourcesCard() {
  const { tenantId } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [topAds, setTopAds] = useState<{ count: number; detail: AdDetail }[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    supabase
      .from('contacts')
      .select('source_type, source_detail')
      .eq('tenant_id', tenantId)
      .not('source_type', 'is', null)
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        const ads = new Map<string, { count: number; detail: AdDetail }>();
        for (const row of data || []) {
          const type = (row as any).source_type as string;
          next[type] = (next[type] || 0) + 1;
          const detail = (row as any).source_detail as AdDetail | null;
          if ((type === 'ad' || type === 'social_post') && detail?.ad_id) {
            const current = ads.get(detail.ad_id) || { count: 0, detail };
            current.count += 1;
            ads.set(detail.ad_id, current);
          }
        }
        setCounts(next);
        setTopAds([...ads.values()].sort((a, b) => b.count - a.count).slice(0, 5));
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const bars = Object.entries(counts).map(([type, count]) => ({ label: sourceLabel(type), count }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Where conversations came from</Text>
      {bars.length === 0 ? <Text style={styles.muted}>No source recorded yet.</Text> : null}
      {bars.length > 0 ? <HorizontalBarChart data={bars} labelKey="label" valueKey="count" height={Math.max(80, bars.length * 28)} /> : null}
      {topAds.map((ad) => (
        <Pressable key={ad.detail.ad_id} style={styles.ad} onPress={() => ad.detail.ad_id && Linking.openURL(adsManagerUrl(ad.detail.ad_id))}>
          {ad.detail.image_url ? <Image source={{ uri: ad.detail.image_url }} style={styles.image} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.value}>{ad.detail.headline || `ID ${ad.detail.ad_id}`}</Text>
            <Text style={styles.muted}>
              {ad.count} · {ad.detail.platform || 'Ad'}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  muted: { fontSize: 13, color: colors.mutedForeground },
  value: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  ad: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  image: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.muted },
});
