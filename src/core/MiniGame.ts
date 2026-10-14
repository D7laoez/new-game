import {
  IMiniGame,
  GameMetadata,
  MiniGameContext,
  MiniGameResult,
  PlayerId
} from '../types/index.ts';

export abstract class BaseMiniGame implements IMiniGame {
  abstract readonly metadata: GameMetadata;

  protected context!: MiniGameContext;
  protected isRunning = false;
  protected isFinished = false;
  protected container!: HTMLElement;
  protected animFrameId: number | null = null;
  protected lastTimestamp = 0;

  initialize(context: MiniGameContext): void {
    this.context = context;
    this.container = context.container;
    this.container.innerHTML = '';
    this.isRunning = false;
    this.isFinished = false;
    this.onInit();
  }

  protected abstract onInit(): void;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.onStart();
    this.loop(this.lastTimestamp);
  }

  protected abstract onStart(): void;

  private loop = (timestamp: number): void => {
    if (!this.isRunning) return;
    const delta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    this.update(Math.min(delta, 0.1));
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  update(_deltaTime: number): void {
    // Override in subclass
  }

  abstract handleInput(playerId: PlayerId, action: string, data?: unknown): void;

  finishWithResult(result: MiniGameResult): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onFinish();
    this.context.onFinish(result);
  }

  finish(): void {
    // Default finish if called directly
  }

  protected activeTimeouts: Set<number> = new Set();
  protected activeIntervals: Set<number> = new Set();

  protected setGameTimeout(callback: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.activeTimeouts.delete(id);
      if (!this.isRunning && !this.isFinished) return;
      callback();
    }, ms);
    this.activeTimeouts.add(id);
    return id;
  }

  protected clearGameTimeout(id: number): void {
    window.clearTimeout(id);
    this.activeTimeouts.delete(id);
  }

  protected setGameInterval(callback: () => void, ms: number): number {
    const id = window.setInterval(() => {
      if (!this.isRunning || this.isFinished) return;
      callback();
    }, ms);
    this.activeIntervals.add(id);
    return id;
  }

  protected clearGameInterval(id: number): void {
    window.clearInterval(id);
    this.activeIntervals.delete(id);
  }

  protected clearAllTimers(): void {
    this.activeTimeouts.forEach(id => window.clearTimeout(id));
    this.activeTimeouts.clear();
    this.activeIntervals.forEach(id => window.clearInterval(id));
    this.activeIntervals.clear();
  }

  protected onFinish(): void {
    // Optional hook
  }

  destroy(): void {
    this.isRunning = false;
    this.isFinished = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.clearAllTimers();
    this.onDestroy();
    this.container.innerHTML = '';
  }

  protected onDestroy(): void {
    // Clean up event listeners or timers
  }
}
