import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { Contact } from '../../types';
import { KeyboardSheet } from '../KeyboardSheet';
import { Button, Input } from '../ui';
import { colors, radius } from '../../theme';

export type ClientEdits = {
  name: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
};

export function EditClientSheet({
  contact,
  visible,
  onClose,
  onSave,
}: {
  contact: Contact | null;
  visible: boolean;
  onClose: () => void;
  onSave: (contactId: string, edits: ClientEdits) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contact || !visible) return;
    setName(contact.name || '');
    setPhone(contact.phoneNumber || '');
    setEmail(contact.email ?? '');
    setAddress(contact.address ?? '');
    setNotes(contact.notes ?? '');
    setTags(contact.tags ?? []);
    setTagInput('');
  }, [contact?.id, visible]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!contact) return;
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;
    setSaving(true);
    const ok = await onSave(contact.id, {
      name: name.trim() || cleanPhone,
      phoneNumber: cleanPhone,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      tags,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <KeyboardSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Edit client</Text>
      <Text style={styles.label}>Name</Text>
      <Input value={name} onChangeText={setName} placeholder="Name" />
      <Text style={styles.label}>Phone</Text>
      <Input value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
      <Text style={styles.label}>Email</Text>
      <Input value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
      <Text style={styles.label}>Address</Text>
      <Input value={address} onChangeText={setAddress} placeholder="Address" />
      <Text style={styles.label}>Notes</Text>
      <Input value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
      <Text style={styles.label}>Tags</Text>
      <View style={styles.tagsRow}>
        {tags.map((t) => (
          <Pressable key={t} onPress={() => setTags(tags.filter((x) => x !== t))} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
            <X size={12} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
      <View style={styles.tagInputRow}>
        <View style={{ flex: 1 }}>
          <Input value={tagInput} onChangeText={setTagInput} placeholder="Add tag" onSubmitEditing={addTag} />
        </View>
        <Button title="Add" variant="outline" onPress={addTag} />
      </View>
      <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
      <Button title="Cancel" variant="ghost" onPress={onClose} />
    </KeyboardSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginTop: 8, marginBottom: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  tagInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
});
