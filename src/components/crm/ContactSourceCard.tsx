import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { adsManagerUrl, sourceLabel } from '../../lib/jawabifyOctUpdates';
import { colors, radius } from '../../theme';

type AdDetail = {
  image_url?: string;
  headline?: string;
  body?: string;
  platform?: string;
  ad_id?: string;
  source_url?: string;
};

type SourceRow = {
  source_type: string | null;
  source_detail: AdDetail | null;
  source_at: string | null;
  last_referral: AdDetail | null;
  last_referral_at: string | null;
};

function AdCard({ title, detail }: { title: string; detail: AdDetail }) {
  return (
    <View style={styles.ad}>
      <Text style={styles.label}>{title}</Text>
      {detail.image_url ? <Image source={{ uri: detail.image_url }} style={styles.image} /> : null}
      {detail.headline ? <Text style={styles.value}>{detail.headline}</Text> : null}
      {detail.body ? <Text style={styles.muted}>{detail.body}</Text> : null}
      {detail.platform ? <Text style={styles.muted}>{detail.platform}</Text> : null}
      {detail.ad_id ? <Text style={styles.muted}>ID {detail.ad_id}</Text> : null}
      {detail.ad_id ? (
        <Pressable onPress={() => Linking.openURL(adsManagerUrl(detail.ad_id!))}>
          <Text style={styles.link}>Ads Manager</Text>
        </Pressable>
      ) : null}
      {detail.source_url ? (
        <Pressable onPress={() => Linking.openURL(detail.source_url!)}>
          <Text style={styles.link}>Ad link</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ContactSourceCard({ contactId }: { contactId: string }) {
  const [row, setRow] = useState<SourceRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('contacts')
      .select('source_type, source_detail, source_at, last_referral, last_referral_at')
      .eq('id', contactId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRow((data as SourceRow) || null);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const detail = row?.source_detail;
  const latest = row?.last_referral;
  const showAd = row?.source_type === 'ad' || row?.source_type === 'social_post';
  const latestDifferent = latest?.ad_id && latest.ad_id !== detail?.ad_id;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Came from</Text>
      <Text style={styles.value}>{sourceLabel(row?.source_type)}</Text>
      {showAd && detail ? <AdCard title="Ad" detail={detail} /> : null}
      {latestDifferent ? <AdCard title="Latest ad" detail={latest!} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  label: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
  value: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  muted: { fontSize: 13, color: colors.mutedForeground },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  ad: { gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 8 },
  image: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.muted },
});
