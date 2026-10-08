import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { InstagramPageOption } from '../lib/instagramConnect';
import { colors, radius } from '../theme';

export function InstagramPagePicker({
  pages,
  visible,
  onSelect,
  onCancel,
}: {
  pages: InstagramPageOption[];
  visible: boolean;
  onSelect: (pageId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose the Instagram account</Text>
          <Text style={styles.sub}>Pick the Facebook Page linked to your Instagram account.</Text>
          <ScrollView style={styles.list}>
            {pages.map((p) => (
              <Pressable key={p.pageId} style={styles.row} onPress={() => onSelect(p.pageId)}>
                <Text style={styles.name}>{p.igUsername ? `@${p.igUsername}` : 'Instagram account'}</Text>
                <Text style={styles.page}>Page: {p.pageName}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancel} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    maxHeight: '70%',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground, marginTop: 6, marginBottom: 12 },
  list: { maxHeight: 320 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  page: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 15, color: colors.mutedForeground },
});
