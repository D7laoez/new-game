import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface DirInfo {
  dir: Direction;
  icon: string;
}

const DIRECTIONS: DirInfo[] = [
  { dir: 'UP', icon: '⬆️' },
  { dir: 'DOWN', icon: '⬇️' },
  { dir: 'LEFT', icon: '⬅️' },
  { dir: 'RIGHT', icon: '➡️' }
];

export class FollowTheArrowGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'follow-the-arrow')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private currentArrow: DirInfo = DIRECTIONS[0];
  private currentWave = 0;
  private maxWaves = 6;
  private waveTimeoutId: number | null = null;
  private answeredThisWave: Set<PlayerId> = new Set();
  private firstCorrectPlayer: PlayerId | null = null;

  private arrowIconEl!: HTMLElement;
  private waveTagEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxWaves = diff === 'EASY' ? 5 : diff === 'HARD' ? 8 : 6;
    this.currentWave = 0;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.answeredThisWave.clear();

    this.container.className = 'game-screen follow-arrow-game';
    this.container.innerHTML = `
      <div class="fa-hud">
        <div class="hud-timer" id="fa-wave-tag">Arrow 1 / ${this.maxWaves}</div>
        <div class="fa-target-box" id="fa-target-box">
          <span class="fa-arrow-large" id="fa-target-arrow">🧭</span>
        </div>
        <div class="hud-tip">Match the glowing arrow on your D-pad!</div>
      </div>
      <div class="fa-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="fa-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="fa-zone-header">
              <span class="fa-avatar">${p.avatar}</span>
              <span class="fa-name">${p.name}</span>
              <span class="fa-score" id="fa-score-${p.id}">0 pts</span>
            </div>
            <div class="fa-dpad">
              <button class="fa-btn fa-up" data-player-id="${p.id}" data-dir="UP" type="button">⬆️</button>
              <div class="fa-dpad-middle">
                <button class="fa-btn fa-left" data-player-id="${p.id}" data-dir="LEFT" type="button">⬅️</button>
                <div class="fa-center-dot">🎯</div>
                <button class="fa-btn fa-right" data-player-id="${p.id}" data-dir="RIGHT" type="button">➡️</button>
              </div>
              <button class="fa-btn fa-down" data-player-id="${p.id}" data-dir="DOWN" type="button">⬇️</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.arrowIconEl = this.container.querySelector('#fa-target-arrow')!;
    this.waveTagEl = this.container.querySelector('#fa-wave-tag')!;

    this.container.querySelectorAll('.fa-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const dir = btn.getAttribute('data-dir') as Direction;
        this.handleInput(pId, 'DIR', dir);
      });
    });
  }

  protected onStart(): void {
    this.nextWave();
  }

  private nextWave(): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.currentWave >= this.maxWaves) {
      this.concludeGame();
      return;
    }

    this.currentWave++;
    this.answeredThisWave.clear();
    this.firstCorrectPlayer = null;

    if (this.waveTagEl) {
      this.waveTagEl.textContent = `Arrow ${this.currentWave} / ${this.maxWaves}`;
    }

    // Pick random direction different from last
    let nextDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    while (nextDir.dir === this.currentArrow.dir && DIRECTIONS.length > 1) {
      nextDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    }
    this.currentArrow = nextDir;

    if (this.arrowIconEl) {
      this.arrowIconEl.textContent = this.currentArrow.icon;
      this.arrowIconEl.className = 'fa-arrow-large pop-in';
      setTimeout(() => this.arrowIconEl.classList.remove('pop-in'), 200);
    }
    this.context.audio.playTone(480, 0.08);

    // Auto advance wave after 2.2 seconds if not all answered
    if (this.waveTimeoutId) clearTimeout(this.waveTimeoutId);
    this.waveTimeoutId = window.setTimeout(() => {
      this.nextWave();
    }, 2200);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'DIR') return;
    if (this.answeredThisWave.has(playerId)) return;

    const dir = data as Direction;

    if (dir === this.currentArrow.dir) {
      this.answeredThisWave.add(playerId);
      let pts = 2;

      if (!this.firstCorrectPlayer) {
        this.firstCorrectPlayer = playerId;
        pts = 5; // First to answer bonus!
        this.context.audio.playScore();
        this.context.haptics.heavy();
      } else {
        this.context.audio.playSuccess();
        this.context.haptics.light();
      }

      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
    } else {
      // Wrong direction penalty
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 2);
      this.context.audio.playError();
      this.context.haptics.medium();
    }

    const scoreEl = this.container.querySelector(`#fa-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    // If all active players answered, advance immediately
    if (this.answeredThisWave.size >= this.context.players.length) {
      if (this.waveTimeoutId) clearTimeout(this.waveTimeoutId);
      this.waveTimeoutId = window.setTimeout(() => this.nextWave(), 350);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.waveTimeoutId) {
      clearTimeout(this.waveTimeoutId);
      this.waveTimeoutId = null;
    }

    const players = this.context.players;
    const sorted = [...players].sort(
      (a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0)
    );

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
    if (this.waveTimeoutId) {
      clearTimeout(this.waveTimeoutId);
      this.waveTimeoutId = null;
    }
  }
}
