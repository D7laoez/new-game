import { IAudioManager } from '../types/index.ts';

export class AudioManager implements IAudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.8;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  playTone(freq: number, duration = 0.1, type: OscillatorType = 'sine'): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback
    }
  }

  playTap(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }

  playCountdown(count: number): void {
    if (count > 0) {
      this.playTone(480, 0.12, 'square');
    } else {
      // GO!
      this.playTone(880, 0.25, 'triangle');
    }
  }

  playStart(): void {
    this.playTone(660, 0.15, 'triangle');
  }

  playSuccess(): void {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine'), idx * 60);
    });
  }

  playError(): void {
    if (!this.enabled) return;
    this.playTone(180, 0.22, 'sawtooth');
  }

  playScore(): void {
    this.playTone(880, 0.08, 'triangle');
  }

  playTugPull(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(this.volume * 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  playPop(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(this.volume * 0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playWinner(): void {
    if (!this.enabled) return;
    const fanfare = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 120, d: 0.12 },
      { f: 783.99, t: 240, d: 0.12 },
      { f: 1046.5, t: 360, d: 0.4 }
    ];
    fanfare.forEach(item => {
      setTimeout(() => this.playTone(item.f, item.d, 'triangle'), item.t);
    });
  }
}
