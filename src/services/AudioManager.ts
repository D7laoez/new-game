import { IAudioManager } from '../types/index.ts';

export class AudioManager implements IAudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.8;

  constructor(enabled = true) {
    this.enabled = enabled;
    this.setupGestureUnlock();
  }

  private setupGestureUnlock(): void {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.initCtx();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
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

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  getVolume(): number {
    return this.volume;
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

  playTick(): void {
    if (!this.enabled) return;
    this.playTone(900, 0.05, 'sine');
  }

  playCountdown(count: number): void {
    if (count > 0) {
      this.playTone(480 + count * 40, 0.12, 'square');
    } else {
      this.playTone(880, 0.25, 'triangle');
      setTimeout(() => this.playTone(1100, 0.15, 'triangle'), 80);
    }
  }

  playStart(): void {
    this.playTone(660, 0.15, 'triangle');
    setTimeout(() => this.playTone(880, 0.1, 'triangle'), 100);
  }

  playSuccess(): void {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine'), idx * 60);
    });
  }

  playError(): void {
    if (!this.enabled) return;
    this.playTone(180, 0.22, 'sawtooth');
    setTimeout(() => this.playTone(140, 0.18, 'sawtooth'), 120);
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

  playExplosion(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  playWhoosh(): void {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  playBuzzer(): void {
    if (!this.enabled) return;
    this.playTone(130, 0.12, 'sawtooth');
    setTimeout(() => this.playTone(130, 0.12, 'sawtooth'), 150);
  }

  playCoin(): void {
    if (!this.enabled) return;
    this.playTone(1200, 0.08, 'sine');
    setTimeout(() => this.playTone(1600, 0.08, 'sine'), 60);
  }

  playWarning(): void {
    if (!this.enabled) return;
    this.playTone(300, 0.15, 'square');
    setTimeout(() => this.playTone(250, 0.15, 'square'), 180);
  }

  // ========== Background Music (Web Audio loop) ==========
  private musicEnabled = true;
  private musicVolume = 0.22;
  private musicNodes: { osc1?: OscillatorNode; osc2?: OscillatorNode; gain?: GainNode } | null = null;
  private musicTimer: number | null = null;

  isMusicEnabled(): boolean { return this.musicEnabled; }
  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
    else this.playMusic();
  }
  getMusicVolume(): number { return this.musicVolume; }
  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicNodes?.gain) {
      try { this.musicNodes.gain.gain.setValueAtTime(this.musicVolume * 0.35, this.musicNodes.gain.context.currentTime); } catch {}
    }
  }
  playMusic(): void {
    if (!this.musicEnabled || !this.enabled) return;
    if (this.musicNodes) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.musicVolume * 0.32, ctx.currentTime + 1.2);
      gain.connect(ctx.destination);
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle'; osc2.type = 'sine';
      osc1.frequency.setValueAtTime(110, ctx.currentTime);
      osc2.frequency.setValueAtTime(220, ctx.currentTime);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.35, ctx.currentTime);
      lfoGain.gain.setValueAtTime(6, ctx.currentTime);
      lfo.connect(lfoGain); lfoGain.connect(osc1.frequency);
      osc1.connect(gain); osc2.connect(gain);
      osc1.start(); osc2.start(); lfo.start();
      this.musicNodes = { osc1, osc2, gain };
      // gentle chord progression via periodic freq shifts
      const chords: [number, number][] = [[110,165],[98,147],[130,196],[110,165]];
      let idx = 0;
      this.musicTimer = window.setInterval(() => {
        if (!this.musicNodes || !this.musicEnabled || !this.enabled) return;
        const c = chords[idx % chords.length]; idx++;
        try {
          const now = ctx.currentTime;
          osc1.frequency.linearRampToValueAtTime(c[0], now + 0.6);
          osc2.frequency.linearRampToValueAtTime(c[1], now + 0.6);
        } catch {}
      }, 3800);
    } catch {}
  }
  stopMusic(): void {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (!this.musicNodes) return;
    try {
      const g = this.musicNodes.gain!;
      const now = g.context.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.linearRampToValueAtTime(0, now + 0.6);
      setTimeout(() => {
        try { this.musicNodes?.osc1?.stop(); this.musicNodes?.osc2?.stop(); this.musicNodes?.osc1?.disconnect(); this.musicNodes?.osc2?.disconnect(); g.disconnect(); } catch {}
        this.musicNodes = null;
      }, 700);
    } catch { this.musicNodes = null; }
    if (!this.musicEnabled) this.musicNodes = null;
    else {
      // fade-out path already cleared
      setTimeout(()=>{ if(!this.musicEnabled) this.musicNodes=null; }, 800);
    }
  }
}
