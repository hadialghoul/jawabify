import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Mic, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  url: string;
  type?: string;
  className?: string;
}

const SPEEDS = [1, 1.5, 2];
const BAR_COUNT = 34;

function canPlay(type?: string) {
  if (typeof document === 'undefined') return true;
  const el = document.createElement('audio');
  const candidates = [type, type === 'audio/ogg' ? 'audio/ogg; codecs=opus' : undefined].filter(
    Boolean
  ) as string[];
  if (!candidates.length) return true;
  return candidates.some((t) => el.canPlayType(t) !== '');
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Stable pseudo-waveform derived from the file URL so bars never jump between renders. */
function waveform(url: string) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const base = ((h >>> 8) % 100) / 100;
    // Taper the edges a little so it reads like speech, not a block.
    const taper = Math.sin((Math.PI * (i + 1)) / (BAR_COUNT + 1));
    bars.push(0.22 + base * 0.78 * (0.45 + 0.55 * taper));
  }
  return bars;
}

/** WhatsApp-style voice note: play, waveform scrubber, speed pill and download fallback. */
export function VoiceNotePlayer({ url, type, className }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [rate, setRate] = useState(1);

  const bars = useMemo(() => waveform(url), [url]);

  useEffect(() => {
    setUnsupported(!canPlay(type));
  }, [type]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) {
        el.playbackRate = rate;
        await el.play();
      } else {
        el.pause();
      }
    } catch {
      setUnsupported(true);
    }
  };

  const cycleRate = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seekFromEvent = (clientX: number) => {
    const track = trackRef.current;
    const el = audioRef.current;
    if (!track || !el || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(ratio * duration);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  if (unsupported) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex w-56 max-w-full items-center gap-2 rounded-xl bg-background/20 px-3 py-2 text-sm underline-offset-2 hover:underline sm:w-64',
          className
        )}
      >
        <Mic className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Voice message</span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </a>
    );
  }

  return (
    <div className={cn('w-60 max-w-full sm:w-72', className)}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
          className="shrink-0 opacity-90 transition-opacity hover:opacity-100"
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>

        {/* Waveform scrubber */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(current)}
          onPointerDown={(e) => {
            seekFromEvent(e.clientX);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) seekFromEvent(e.clientX);
          }}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el) return;
            if (e.key === 'ArrowRight') el.currentTime = Math.min(duration, el.currentTime + 2);
            if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 2);
          }}
          className="relative flex h-7 min-w-0 flex-1 cursor-pointer touch-none items-center gap-[2px]"
        >
          {bars.map((h, i) => {
            const played = i / bars.length < progress;
            return (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  played ? 'bg-current opacity-95' : 'bg-current opacity-35'
                )}
                style={{ height: `${Math.round(h * 22)}px` }}
              />
            );
          })}
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[hsl(var(--primary))] shadow"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>

        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Playback speed ${rate}x, tap to change`}
          className="shrink-0 rounded-full bg-foreground/15 px-2 py-[3px] text-xs font-semibold tabular-nums transition-colors hover:bg-foreground/25"
        >
          {rate}×
        </button>
      </div>

      <div className="mt-0.5 pl-7 text-[11px] tabular-nums opacity-70">
        {fmt(playing || current > 0 ? current : duration)}
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          const el = e.target as HTMLAudioElement;
          el.playbackRate = rate;
          setDuration(el.duration);
        }}
        onDurationChange={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => setUnsupported(true)}
      />
    </div>
  );
}
