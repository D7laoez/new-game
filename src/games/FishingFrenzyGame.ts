import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type FishingState = 'WAITING' | 'NIBBLE' | 'BITE';

export class FishingFrenzyGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'fishing-frenzy')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerFishingState: Map<PlayerId, FishingState> = new Map();
  private playerTimers: Map<PlayerId, number[]> = new Map();
  private timeLeft = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerFishingState.clear();
    this.playerTimers.clear();
    this.timeLeft = 20.0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerFishingState.set(p.id, 'WAITING');
      this.playerTimers.set(p.id, []);
    });

    this.container.className = 'game-screen fishing-frenzy-game';
    this.container.innerHTML = `
      <div class="ff-hud">
        <div class="ff-timer" id="ff-timer">20.0s</div>
        <div class="ff-title">FISHING FRENZY 🎣</div>
      </div>
      <div class="ff-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ff-player-pond" id="ff-pond-${p.id}" style="--p-col: ${p.color}">
            <div class="ff-pond-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ff-score" id="ff-score-${p.id}">0 pts</span>
            </div>
            <div class="ff-water-scene">
              <div class="ff-bobber state-waiting" id="ff-bobber-${p.id}">🪱</div>
              <div class="ff-bite-alert" id="ff-alert-${p.id}">Wait...</div>
            </div>
            <button class="ff-reel-btn" data-player="${p.id}">REEL IN! 🎣</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind reel buttons
    this.container.querySelectorAll('.ff-reel-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'REEL');
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.timeLeft -= 0.1;
      const timerEl = this.container.querySelector('#ff-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);

    this.context.players.forEach(p => {
      this.scheduleNextBite(p.id);
    });
  }

  private scheduleNextBite(playerId: PlayerId): void {
    if (!this.isRunning || this.isFinished) return;

    this.clearPlayerTimers(playerId);
    this.playerFishingState.set(playerId, 'WAITING');
    this.updateBobberUI(playerId, 'WAITING');

    const waitDelay = 1000 + Math.random() * 1800;

    const t1 = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;

      // False nibble (50% chance)
      if (Math.random() < 0.4) {
        this.playerFishingState.set(playerId, 'NIBBLE');
        this.updateBobberUI(playerId, 'NIBBLE');
        this.context.audio.playTone(300, 0.05);

        const t2 = window.setTimeout(() => {
          if (!this.isRunning || this.isFinished) return;
          this.triggerRealBite(playerId);
        }, 700);
        this.playerTimers.get(playerId)?.push(t2);
      } else {
        this.triggerRealBite(playerId);
      }
    }, waitDelay);

    this.playerTimers.get(playerId)?.push(t1);
  }

  private triggerRealBite(playerId: PlayerId): void {
    this.playerFishingState.set(playerId, 'BITE');
    this.updateBobberUI(playerId, 'BITE');
    this.context.audio.playPop();
    this.context.haptics.heavy();

    // Fish escapes after 800ms
    const tEscape = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      if (this.playerFishingState.get(playerId) === 'BITE') {
        this.scheduleNextBite(playerId);
      }
    }, 850);
    this.playerTimers.get(playerId)?.push(tEscape);
  }

  private updateBobberUI(playerId: PlayerId, state: FishingState): void {
    const bobber = this.container.querySelector(`#ff-bobber-${playerId}`);
    const alert = this.container.querySelector(`#ff-alert-${playerId}`);

    if (bobber) {
      bobber.className = `ff-bobber state-${state.toLowerCase()}`;
      bobber.textContent = state === 'BITE' ? '🐟' : state === 'NIBBLE' ? '〰️' : '🪱';
    }
    if (alert) {
      alert.textContent = state === 'BITE' ? 'BITE NOW! ⚡' : state === 'NIBBLE' ? 'Nibble...' : 'Waiting...';
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'REEL') return;

    const state = this.playerFishingState.get(playerId);
    const scoreEl = this.container.querySelector(`#ff-score-${playerId}`);

    if (state === 'BITE') {
      // Caught the fish!
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 3;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts (Caught! 🐟)`;
      this.scheduleNextBite(playerId);
    } else {
      // False reel penalty!
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 1);
      this.context.audio.playError();
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts (Too Early! ❌)`;
      this.scheduleNextBite(playerId);
    }
  }

  private clearPlayerTimers(playerId: PlayerId): void {
    const list = this.playerTimers.get(playerId) || [];
    list.forEach(t => clearTimeout(t));
    this.playerTimers.set(playerId, []);
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.context.players.forEach(p => this.clearPlayerTimers(p.id));

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats: this.playerScores
    });
  }

  protected onDestroy(): void {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.context.players.forEach(p => this.clearPlayerTimers(p.id));
  }
}
