import { useEffect, useRef, useState } from "react";
import { MessageSquareText, Mic, Square, Trash2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mp3Recorder } from "@/lib/mp3Recorder";

type QA = {
  id: string;
  question: string;
  answer_type: "text" | "voice";
  answer_text: string | null;
  audio_url: string | null;
  audio_mime: string | null;
  enabled: boolean;
};

// WhatsApp accepts ogg/opus, mp4/aac, mpeg, amr — not webm.
const UPLOAD_AUDIO_MSG =
  "This browser can't record a WhatsApp voice note — upload an audio file (mp3, m4a, ogg) instead.";

const pickRecorderMime = () =>
  ["audio/ogg;codecs=opus", "audio/mp4", "audio/mpeg"].find((m) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
  );

const micBlocked = (err: unknown) => {
  const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name;
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
};

export function QuickAnswersCard() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<QA[]>([]);
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [answer, setAnswer] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const mp3Ref = useRef<Mp3Recorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!tenantId) return;
    const { data } = await (supabase as any)
      .from("quick_answers").select("*").eq("tenant_id", tenantId).order("created_at");
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tenantId]);

  const startRec = async () => {
    // Prefer Mp3Recorder on mobile — MediaRecorder formats are often rejected by WhatsApp.
    if (Mp3Recorder.supported) {
      try {
        const rec = new Mp3Recorder();
        await rec.start();
        mp3Ref.current = rec;
        setRecording(true);
        return;
      } catch (err) {
        if (micBlocked(err)) {
          toast.error("Microphone access was blocked");
          return;
        }
        toast.error(UPLOAD_AUDIO_MSG);
        return;
      }
    }
    const mime = pickRecorderMime();
    if (!mime) {
      return toast.error(UPLOAD_AUDIO_MSG);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudio(new Blob(chunks, { type: mime.split(";")[0] }));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access was blocked");
    }
  };
  const stopRec = async () => {
    if (mp3Ref.current) {
      const rec = mp3Ref.current;
      mp3Ref.current = null;
      setRecording(false);
      try {
        const file = await rec.stop();
        if (!file) {
          toast.error("Recording was too short — try again or upload an mp3/m4a file.");
          return;
        }
        setAudio(file);
      } catch {
        toast.error(UPLOAD_AUDIO_MSG);
      }
      return;
    }
    recRef.current?.stop();
    setRecording(false);
  };

  const onFile = (f?: File) => {
    if (!f) return;
    if (!/^audio\/(mpeg|mp3|mp4|aac|ogg|amr|x-m4a)/.test(f.type)) return toast.error("Use an mp3, m4a, aac or ogg audio file");
    if (f.size > 16 * 1024 * 1024) return toast.error("Audio must be under 16MB");
    setAudio(f);
  };

  const add = async () => {
    if (!tenantId) return;
    if (!question.trim()) return toast.error("Write the question");
    if (type === "text" && !answer.trim()) return toast.error("Write the answer");
    if (type === "voice" && !audio) return toast.error("Record or upload a voice note");
    setSaving(true);
    let audio_url: string | null = null;
    let audio_mime: string | null = null;
    if (type === "voice" && audio) {
      audio_mime = (audio.type || "audio/mpeg").split(";")[0];
      const ext = audio_mime.split("/")[1]?.replace("x-m4a", "m4a").replace("mpeg", "mp3") || "mp3";
      const path = `quick-answers/${tenantId}/${crypto.randomUUID()}.${ext}`;
      const { data: up, error } = await supabase.storage.from("chat-media").upload(path, audio, { contentType: audio_mime });
      if (error || !up) { setSaving(false); return toast.error("Could not upload the voice note"); }
      audio_url = supabase.storage.from("chat-media").getPublicUrl(up.path).data.publicUrl;
    }
    const { error } = await (supabase as any).from("quick_answers").insert({
      tenant_id: tenantId, question: question.trim(), answer_type: type,
      answer_text: answer.trim() || null, audio_url, audio_mime,
    });
    setSaving(false);
    if (error) return toast.error("Could not save");
    setQuestion(""); setAnswer(""); setAudio(null);
    toast.success("Quick answer added");
    load();
  };

  const toggle = async (qa: QA, v: boolean) => {
    setItems((s) => s.map((x) => (x.id === qa.id ? { ...x, enabled: v } : x)));
    await (supabase as any).from("quick_answers").update({ enabled: v }).eq("id", qa.id);
  };
  const remove = async (qa: QA) => {
    await (supabase as any).from("quick_answers").delete().eq("id", qa.id);
    setItems((s) => s.filter((x) => x.id !== qa.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-primary" /> Quick answers
        </CardTitle>
        <CardDescription>
          Add common questions with your own written answer or a recorded voice note. When a customer asks one of them (in any wording or language), it's sent exactly as you made it instead of an AI reply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((qa) => (
              <div key={qa.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{qa.question}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={qa.enabled} onCheckedChange={(v) => toggle(qa, v)} aria-label="Enabled" />
                    <Button size="icon" variant="ghost" onClick={() => remove(qa)} aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {qa.answer_type === "voice" && qa.audio_url && <audio controls src={qa.audio_url} className="w-full h-9" />}
                {qa.answer_text && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{qa.answer_text}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qa-q">Question</Label>
            <Input id="qa-q" className="text-base" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Where are you located?" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={type === "text" ? "default" : "outline"} onClick={() => setType("text")}>Written answer</Button>
            <Button type="button" size="sm" variant={type === "voice" ? "default" : "outline"} onClick={() => setType("voice")}>Voice note</Button>
          </div>
          {type === "voice" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {recording ? (
                  <Button type="button" size="sm" variant="destructive" onClick={stopRec}><Square className="w-4 h-4 mr-1" /> Stop</Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={startRec}><Mic className="w-4 h-4 mr-1" /> Record</Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Upload audio</Button>
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
              {audio && <audio controls src={URL.createObjectURL(audio)} className="w-full h-9" />}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="qa-a">{type === "voice" ? "Text sent with the voice note (optional)" : "Answer"}</Label>
            <Textarea id="qa-a" className="text-base" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. We're in Hamra, Beirut — open 10am to 9pm." />
          </div>
          <Button onClick={add} disabled={saving || recording}><Plus className="w-4 h-4 mr-1" /> Add quick answer</Button>
        </div>
      </CardContent>
    </Card>
  );
}
