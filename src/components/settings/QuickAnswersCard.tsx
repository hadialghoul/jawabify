import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MessageSquareText, Plus, Trash2, Upload } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Card, Input } from '../ui';
import { colors } from '../../theme';

type QA = {
  id: string;
  question: string;
  answer_type: 'text' | 'voice';
  answer_text: string | null;
  audio_url: string | null;
  audio_mime: string | null;
  enabled: boolean;
};

export function QuickAnswersCard() {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<QA[]>([]);
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [answer, setAnswer] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tenantId) return;
    const { data } = await (supabase as any)
      .from('quick_answers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at');
    setItems(data || []);
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const pickAudio = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['audio/*', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/x-m4a'],
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const mime = asset.mimeType || '';
    if (mime && !/^audio\/(mpeg|mp3|mp4|aac|ogg|amr|x-m4a)/.test(mime)) {
      toast.error('Use an mp3, m4a, aac or ogg audio file');
      return;
    }
    if (asset.size && asset.size > 16 * 1024 * 1024) {
      toast.error('Audio must be under 16MB');
      return;
    }
    setAudioUri(asset.uri);
    setAudioName(asset.name);
    setAudioMime(mime || 'audio/mpeg');
  };

  const add = async () => {
    if (!tenantId) return;
    if (!question.trim()) return toast.error('Write the question');
    if (type === 'text' && !answer.trim()) return toast.error('Write the answer');
    if (type === 'voice' && !audioUri) return toast.error('Upload a voice note');
    setSaving(true);
    try {
      let audio_url: string | null = null;
      let audio_mime: string | null = null;
      if (type === 'voice' && audioUri) {
        audio_mime = (audioMime || 'audio/mpeg').split(';')[0];
        const ext =
          audio_mime.split('/')[1]?.replace('x-m4a', 'm4a').replace('mpeg', 'mp3') ||
          audioName?.split('.').pop() ||
          'mp3';
        const pathName = `quick-answers/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const fileRes = await fetch(audioUri);
        const blob = await fileRes.blob();
        const { data: up, error } = await supabase.storage
          .from('chat-media')
          .upload(pathName, blob, { contentType: audio_mime });
        if (error || !up) throw new Error('Could not upload the voice note');
        audio_url = supabase.storage.from('chat-media').getPublicUrl(up.path).data.publicUrl;
      }
      const { error } = await (supabase as any).from('quick_answers').insert({
        tenant_id: tenantId,
        question: question.trim(),
        answer_type: type,
        answer_text: answer.trim() || null,
        audio_url,
        audio_mime,
      });
      if (error) throw error;
      setQuestion('');
      setAnswer('');
      setAudioUri(null);
      setAudioName(null);
      setAudioMime(null);
      toast.success('Quick answer added');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (qa: QA, v: boolean) => {
    setItems((s) => s.map((x) => (x.id === qa.id ? { ...x, enabled: v } : x)));
    await (supabase as any).from('quick_answers').update({ enabled: v }).eq('id', qa.id);
  };

  const remove = async (qa: QA) => {
    await (supabase as any).from('quick_answers').delete().eq('id', qa.id);
    setItems((s) => s.filter((x) => x.id !== qa.id));
  };

  return (
    <Card>
      <View style={styles.head}>
        <MessageSquareText size={16} color={colors.primary} />
        <Text style={styles.h2}>Quick answers</Text>
      </View>
      <Text style={styles.sub}>
        Add common questions with your own written answer or a recorded voice note. When a customer asks one of them (in any wording or language), it's sent exactly as you made it instead of an AI reply.
      </Text>

      {items.map((qa) => (
        <View key={qa.id} style={styles.item}>
          <View style={styles.itemTop}>
            <Text style={[styles.label, { flex: 1 }]}>{qa.question}</Text>
            <Switch
              value={qa.enabled}
              onValueChange={(v) => toggle(qa, v)}
              trackColor={{ true: colors.primary }}
            />
            <Pressable onPress={() => remove(qa)} hitSlop={8} style={styles.iconBtn}>
              <Trash2 size={16} color={colors.destructive} />
            </Pressable>
          </View>
          {qa.answer_type === 'voice' && qa.audio_url ? (
            <Text style={styles.sub}>Voice note attached</Text>
          ) : null}
          {qa.answer_text ? <Text style={styles.sub}>{qa.answer_text}</Text> : null}
        </View>
      ))}

      <View style={styles.form}>
        <Text style={styles.label}>Question</Text>
        <Input
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. Where are you located?"
        />
        <View style={styles.row}>
          <Button
            title="Written answer"
            variant={type === 'text' ? 'primary' : 'outline'}
            onPress={() => setType('text')}
          />
          <Button
            title="Voice note"
            variant={type === 'voice' ? 'primary' : 'outline'}
            onPress={() => setType('voice')}
          />
        </View>
        {type === 'voice' ? (
          <>
            <Button
              title={audioName ? `Selected: ${audioName}` : 'Upload audio'}
              variant="outline"
              icon={<Upload size={14} color={colors.foreground} />}
              onPress={pickAudio}
            />
            <Text style={styles.sub}>Upload mp3, m4a or ogg (under 16MB).</Text>
          </>
        ) : null}
        <Text style={styles.label}>
          {type === 'voice' ? 'Text sent with the voice note (optional)' : 'Answer'}
        </Text>
        <Input
          value={answer}
          onChangeText={setAnswer}
          placeholder="e.g. We're in Hamra, Beirut — open 10am to 9pm."
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Button
          title={saving ? 'Saving…' : 'Add quick answer'}
          loading={saving}
          icon={<Plus size={14} color="#fff" />}
          onPress={add}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
  form: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
});
