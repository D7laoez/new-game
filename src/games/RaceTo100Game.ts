import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface RunnerState {
  meters: number;
  lastFoot: 'LEFT' | 'RIGHT' | null;
  isStumbled: boolean;
  completed: boolean;
}

export class RaceTo100Game extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'race-to-100')!;

  private runnerStates: Map<PlayerId, RunnerState> = new Map();
  private timeLeft = 15;
  private timerIntervalId: number | null = null;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.timeLeft = 15;
    this.runnerStates.clear();

    players.forEach(p => {
      this.runnerStates.set(p.id, {
        meters: 0,
        lastFoot: null,
        isStumbled: false,
        completed: false
      });
    });

    this.container.className = 'game-screen race-100-game';
    this.container.innerHTML = `
      <div class="r100-hud">
        <div class="hud-timer" id="r100-timer">⏱️ 15s</div>
        <div class="hud-tip">Alternate LEFT 👟 and RIGHT 👟 pedals! Don't stumble!</div>
      </div>
      <div class="r100-track-board">
        ${players
          .map(
            p => `
          <div class="r100-lane" style="--p-color: ${p.color}">
            <div class="r100-lane-header">
              <span class="r100-lane-avatar">${p.avatar} ${p.name}</span>
              <span class="r100-lane-dist" id="r100-dist-${p.id}">0m</span>
            </div>
            <div class="r100-progress-bar">
              <div class="r100-progress-fill" id="r100-fill-${p.id}" style="width: 0%;">
                <span class="r100-runner-icon">🏃</span>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="r100-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="r100-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="r100-pedals">
              <button class="r100-pedal-btn btn-left" data-player-id="${p.id}" data-foot="LEFT" type="button">
                👟 L
              </button>
              <button class="r100-pedal-btn btn-right" data-player-id="${p.id}" data-foot="RIGHT" type="button">
                R 👟
              </button>
            </div>
            <div class="r100-feedback" id="r100-feed-${p.id}">Ready!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#r100-timer')!;

    this.container.querySelectorAll('.r100-pedal-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const foot = btn.getAttribute('data-foot') as 'LEFT' | 'RIGHT';
        this.handleInput(pId, 'STEP', foot);
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.timeLeft--;
      if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 1000);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'STEP') return;
    const runner = this.runnerStates.get(playerId);
    if (!runner || runner.completed || runner.isStumbled) return;

    const foot = data as 'LEFT' | 'RIGHT';

    if (runner.lastFoot === null || runner.lastFoot !== foot) {
      // Good alternating step!
      runner.lastFoot = foot;
      runner.meters = Math.min(100, runner.meters + 2);
      this.context.audio.playPop();
      this.context.haptics.light();

      const feedEl = this.container.querySelector(`#r100-feed-${playerId}`);
      if (feedEl) feedEl.textContent = `${runner.meters}m / 100m`;

      const distEl = this.container.querySelector(`#r100-dist-${playerId}`);
      if (distEl) distEl.textContent = `${runner.meters}m`;

      const fillEl = this.container.querySelector(`#r100-fill-${playerId}`) as HTMLElement;
      if (fillEl) fillEl.style.width = `${runner.meters}%`;

      if (runner.meters >= 100) {
        runner.completed = true;
        this.context.audio.playWinner();
        this.context.haptics.heavy();
        if (feedEl) feedEl.textContent = `FINISHED! 🏁`;
        setTimeout(() => this.concludeGame(), 300);
      }
    } else {
      // Same foot! Stumble!
      runner.isStumbled = true;
      this.context.audio.playError();
      this.context.haptics.heavy();

      const feedEl = this.container.querySelector(`#r100-feed-${playerId}`);
      if (feedEl) {
        feedEl.textContent = 'STUMBLE! ⚠️';
        feedEl.classList.add('stumbled');
      }

      setTimeout(() => {
        runner.isStumbled = false;
        if (feedEl) {
          feedEl.textContent = `${runner.meters}m / 100m`;
          feedEl.classList.remove('stumbled');
        }
      }, 350);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.runnerStates.forEach((runner, pId) => {
      scores[pId] = runner.meters;
    });

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({ scores, winnerId, rawStats: scores });
  }

  protected onDestroy(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }
}
