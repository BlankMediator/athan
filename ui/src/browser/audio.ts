/** One audio context is unlocked by the user's click, then reused for scheduled calls. */
export class BrowserAudio {
  playing: string | null = null;
  paused = false;
  loading = false;
  private context?: AudioContext;
  private generation = 0;
  private finish?: () => void;
  private decoded = new Map<string, AudioBuffer>();
  constructor(private changed: () => void, private load: (path: string) => Promise<Blob>) {}
  unlock(): Promise<void> {
    this.context ??= new AudioContext();
    // resume() must run before an IndexedDB read or any other awaited operation.
    const resume = this.context.resume();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tap Enable Athan or Play to allow audio in this browser.')), 4000);
      resume.then(() => { clearTimeout(timer); resolve(); }, error => { clearTimeout(timer); reject(error); });
    });
  }
  async pause(paused: boolean) {
    if (!this.playing || !this.context) return;
    this.paused = paused; this.changed();
    try { if (paused) await this.context.suspend(); else await this.unlock(); }
    catch (error) { this.paused = true; this.changed(); throw error; }
  }
  stop() {
    this.generation++; this.finish?.(); this.finish = undefined;
    this.playing = null; this.paused = false; this.loading = false; this.changed();
  }
  async play(files: string[], repeat: number, volume: number, maxSeconds: number) {
    this.stop(); const generation = this.generation;
    const context = this.context;
    if (!context) throw new Error('Tap Enable Athan or Play to allow audio in this browser.');
    try {
      if (context.state !== 'running') await this.unlock();
      for (let n = 0; n < repeat; n++) for (const path of files) {
        if (generation !== this.generation) return;
        this.playing = path; this.loading = true; this.changed();
        let buffer = this.decoded.get(path);
        if (!buffer) {
          const blob = await this.load(path);
          buffer = await context.decodeAudioData(await blob.arrayBuffer());
          if (generation !== this.generation) return;
          this.decoded.set(path, buffer);
          while (this.decoded.size > 2) this.decoded.delete(this.decoded.keys().next().value!);
        }
        if (generation !== this.generation) return;
        this.loading = false; this.changed();
        await new Promise<void>((resolve, reject) => {
          const source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffer; gain.gain.value = volume / 100;
          source.connect(gain); gain.connect(context.destination);
          let finished = false;
          const finish = (error?: unknown) => {
            if (finished) return; finished = true;
            source.onended = null;
            try { source.stop(); } catch { /* May not have started. */ }
            source.disconnect(); gain.disconnect(); if (error) reject(error); else resolve();
          };
          this.finish = () => finish(); source.onended = () => finish();
          try { source.start(0, 0, Math.min(buffer.duration, maxSeconds)); }
          catch (error) { finish(error); }
        });
      }
    } finally {
      if (generation === this.generation) { this.playing = null; this.paused = false; this.loading = false; this.finish = undefined; this.changed(); }
    }
  }
}
