import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Mp3Recorder } from '@/lib/mp3Recorder';

interface VoiceRecorderButtonProps {
  onRecorded: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceRecorderButton({ onRecorded, disabled, className }: VoiceRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<Mp3Recorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop().catch(() => undefined);
    };
  }, []);

  const start = async () => {
    if (!Mp3Recorder.supported) {
      toast({
        title: 'Recording not supported',
        description: 'This browser cannot record voice notes.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const recorder = new Mp3Recorder();
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        title: 'Microphone blocked',
        description: 'Allow microphone access to record a voice message.',
        variant: 'destructive',
      });
    }
  };

  const stop = async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recorder) return;
    try {
      const file = await recorder.stop();
      if (!file) {
        toast({
          title: 'Nothing recorded',
          description: 'That recording was empty — please try again.',
          variant: 'destructive',
        });
        return;
      }
      onRecorded(file);
    } catch {
      toast({
        title: 'Recording failed',
        description: 'Could not process the voice message. Please try again.',
        variant: 'destructive',
      });
    }
  };


  if (recording) {
    return (
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={stop}
        className={cn('h-9 w-auto min-w-[4.75rem] shrink-0 gap-1 px-2', className, 'w-auto')}
        title="Stop recording and attach"
      >
        <Square className="h-3.5 w-3.5" />
        <span className="text-xs tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={start}
      disabled={disabled}
      className={className ?? 'text-muted-foreground hover:text-foreground shrink-0 h-8 w-8 sm:h-9 sm:w-9'}
      aria-label="Record a voice message"
      title="Record a voice message"
    >
      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  );
}
