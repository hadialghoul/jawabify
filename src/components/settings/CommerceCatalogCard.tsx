import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Store } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { checkCommerceCatalog, getCommerceStatus, setMetaCatalogEnabled, setShopifyCartLinkEnabled, VERVE_TENANT_ID } from '../../lib/jawabifyOctUpdates';
import { Button, Card } from '../ui';
import { colors } from '../../theme';

export function CommerceCatalogCard() {
  const { tenantId, isTenantAdmin } = useAuth();
  const toast = useToast();
  const [metaOn, setMetaOn] = useState(false);
  const [shopifyOn, setShopifyOn] = useState(true);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState('');
  const [steps, setSteps] = useState<string[]>([]);

  useEffect(() => {
    if (tenantId !== VERVE_TENANT_ID) return;
    getCommerceStatus()
      .then((data) => {
        setMetaOn(data?.enabled === true);
        setShopifyOn(data?.shopify_cart_link_enabled !== false);
      })
      .catch((e: any) => toast.error(e?.message || 'Could not load store checkout'));
  }, [tenantId]);

  if (tenantId !== VERVE_TENANT_ID) return null;

  const saveMeta = async (enabled: boolean) => {
    if (!isTenantAdmin) {
      toast.error('Only the account owner or an admin can change store checkout.');
      return;
    }
    const previous = metaOn;
    setMetaOn(enabled);
    try {
      await setMetaCatalogEnabled(enabled);
    } catch (e: any) {
      setMetaOn(previous);
      toast.error(e?.message || 'Could not save the Meta catalog');
    }
  };

  const saveShopify = async (enabled: boolean) => {
    if (!isTenantAdmin) {
      toast.error('Only the account owner or an admin can change store checkout.');
      return;
    }
    const previous = shopifyOn;
    setShopifyOn(enabled);
    try {
      await setShopifyCartLinkEnabled(enabled);
    } catch (e: any) {
      setShopifyOn(previous);
      toast.error(e?.message || 'Could not save the Shopify cart link');
    }
  };

  const check = async () => {
    setChecking(true);
    setReport('');
    setSteps([]);
    try {
      const data = await checkCommerceCatalog();
      if (data?.ok === false || data?.error) {
        setReport(String(data.error || "Couldn't load your catalog"));
        setSteps([
          'Go to business.facebook.com/commerce and create a catalog (E-commerce / Online products).',
          'Add products with a name, price, photo, and a content ID (SKU).',
          'In WhatsApp Manager, connect that catalog to your WhatsApp Business account.',
          'On the phone number, turn on Show catalog and Enable cart.',
          'Share the catalog with the same business that owns the WhatsApp number, then check again.',
        ]);
        return;
      }
      const count = Array.isArray(data?.items) ? data.items.length : 0;
      const name = data?.catalog?.name ? `Connected to "${data.catalog.name}". ` : '';
      const cartHint =
        data?.commerce && (!data.commerce.is_catalog_visible || !data.commerce.is_cart_enabled)
          ? ' Turn on Show catalog and Enable cart in WhatsApp Manager so customers can shop.'
          : '';
      setReport(`${name}${count} product${count === 1 ? '' : 's'} found.${cartHint}`);
    } catch (e: any) {
      setReport(e?.message || 'Could not check the catalog');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <Store size={16} color={colors.primary} />
        <Text style={styles.title}>Store checkout</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Meta Commerce catalog</Text>
        <Switch value={metaOn} disabled={!isTenantAdmin} onValueChange={saveMeta} trackColor={{ true: colors.primary }} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Shopify pre-filled cart link</Text>
        <Switch value={shopifyOn} disabled={!isTenantAdmin} onValueChange={saveShopify} trackColor={{ true: colors.primary }} />
      </View>
      <Button title={checking ? 'Checking…' : 'Check catalog'} variant="outline" loading={checking} onPress={check} />
      {report ? <Text style={styles.sub}>{report}</Text> : null}
      {steps.map((step) => (
        <Text key={step} style={styles.sub}>• {step}</Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  label: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
