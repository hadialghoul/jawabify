import * as lamejs from '@breezystack/lamejs';

/**
 * Records microphone audio as PCM and encodes a complete MP3 file.
 * MP3 (audio/mpeg) is the one container WhatsApp, Instagram and every browser
 * accept — Safari's fragmented MP4 and Chrome's WebM are both rejected by Meta.
 */
export class Mp3Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 44100;

  static get supported() {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    return !!AC && !!navigator.mediaDevices?.getUserMedia;
  }

  async start() {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    this.ctx = new AC() as AudioContext;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.sampleRate = this.ctx.sampleRate;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.processor.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  /** Stops capture and returns a complete MP3 file (null when nothing was captured). */
  async stop(): Promise<File | null> {
    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
    } catch {
      /* already torn down */
    }
    const ctx = this.ctx;
    this.ctx = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    await ctx?.close().catch(() => undefined);

    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    if (total < 2048) return null;

    const pcm = new Int16Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    }
    this.chunks = [];

    const encoder = new lamejs.Mp3Encoder(1, this.sampleRate, 96);
    const out: Uint8Array[] = [];
    const BLOCK = 1152;
    for (let i = 0; i < pcm.length; i += BLOCK) {
      const buf = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
      if (buf.length > 0) out.push(new Uint8Array(buf));
    }
    const tail = encoder.flush();
    if (tail.length > 0) out.push(new Uint8Array(tail));

    const blob = new Blob(out as BlobPart[], { type: 'audio/mpeg' });
    if (blob.size < 1024) return null;
    return new File([blob], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  }
}
