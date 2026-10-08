import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors } from '../theme';
import { Button, Card } from './ui';

export function GrowthUpgradePanel({
  feature = 'Campaigns',
  onUpgrade,
}: {
  feature?: string;
  onUpgrade: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Sparkles size={22} color={colors.primary} />
        </View>
        <Text style={styles.title}>{feature} is a Growth feature</Text>
        <Text style={styles.body}>
          Upgrade to Growth ($90/month) to unlock campaigns, CRM, team members, tagging, AI upselling, Instagram and chat
          analysis.
        </Text>
        <Button title="Upgrade to Growth" onPress={onUpgrade} />
        <Text style={styles.hint}>Takes you to Subscription & billing in Settings.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 12, alignItems: 'stretch' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  body: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  hint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center' },
});