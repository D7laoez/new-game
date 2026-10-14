import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class ReactionGridGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'reaction-grid')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private activeTargetCell: Map<PlayerId, number> = new Map();
  private targetSpawnTimes: Map<PlayerId, number> = new Map();
  private fastestReactionMs: Record<PlayerId, number> = { 1: 9999, 2: 9999, 3: 9999, 4: 9999 };
  private gameTime = 0;
  private maxDuration = 18.0;
  private timerIntervalId: number | null = null;
  private targetTimeoutIds: Map<PlayerId, number> = new Map();

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.fastestReactionMs = { 1: 9999, 2: 9999, 3: 9999, 4: 9999 };
    this.activeTargetCell.clear();
    this.targetSpawnTimes.clear();
    this.gameTime = 0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
    });

    this.container.className = 'game-screen reaction-grid-game';
    this.container.innerHTML = `
      <div class="rg-hud">
        <div class="rg-timer" id="rg-timer">18.0s</div>
        <div class="rg-title">REACTION GRID ⚡</div>
      </div>
      <div class="rg-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="rg-player-station" id="rg-station-${p.id}" style="--p-col: ${p.color}">
            <div class="rg-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="rg-score" id="rg-score-${p.id}">0 pts</span>
            </div>
            <div class="rg-cells-grid" id="rg-grid-${p.id}">
              ${Array.from({ length: 9 })
                .map(
                  (_, idx) => `
                <button class="rg-cell" data-player="${p.id}" data-index="${idx}"></button>
              `
                )
                .join('')}
            </div>
            <div class="rg-feedback" id="rg-feed-${p.id}">Tap flashing targets!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind cells
    this.container.querySelectorAll('.rg-cell').forEach(cell => {
      const pId = parseInt(cell.getAttribute('data-player') || '1', 10) as PlayerId;
      const index = parseInt(cell.getAttribute('data-index') || '0', 10);
      cell.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP', index);
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.gameTime += 0.1;
      const timeLeft = Math.max(0, this.maxDuration - this.gameTime);
      const timerEl = this.container.querySelector('#rg-timer');
      if (timerEl) timerEl.textContent = `${timeLeft.toFixed(1)}s`;

      if (timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);

    // Initial targets
    this.context.players.forEach(p => {
      this.spawnTargetForPlayer(p.id);
    });
  }

  private spawnTargetForPlayer(playerId: PlayerId): void {
    if (!this.isRunning || this.isFinished) return;

    // Clear previous timeout
    const existing = this.targetTimeoutIds.get(playerId);
    if (existing) clearTimeout(existing);

    // Random cell 0..8
    const cellIdx = Math.floor(Math.random() * 9);
    this.activeTargetCell.set(playerId, cellIdx);
    this.targetSpawnTimes.set(playerId, performance.now());

    // Render active target
    const grid = this.container.querySelector(`#rg-grid-${playerId}`);
    if (grid) {
      grid.querySelectorAll('.rg-cell').forEach((c, idx) => {
        if (idx === cellIdx) {
          c.className = 'rg-cell active-target';
          c.textContent = '🎯';
        } else {
          c.className = 'rg-cell';
          c.textContent = '';
        }
      });
    }

    // Auto despawn target after 1.5s if missed
    const tId = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      this.spawnTargetForPlayer(playerId);
    }, 1500);
    this.targetTimeoutIds.set(playerId, tId);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'TAP') return;

    const clickedIndex = data as number;
    const targetIndex = this.activeTargetCell.get(playerId);
    const feedEl = this.container.querySelector(`#rg-feed-${playerId}`);
    const scoreEl = this.container.querySelector(`#rg-score-${playerId}`);

    if (clickedIndex === targetIndex) {
      // Hit!
      const reactionTime = Math.round(performance.now() - (this.targetSpawnTimes.get(playerId) || performance.now()));
      if (reactionTime < this.fastestReactionMs[playerId]) {
        this.fastestReactionMs[playerId] = reactionTime;
      }

      const pts = reactionTime < 350 ? 5 : reactionTime < 600 ? 3 : 2;
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
      this.context.audio.playPop();
      this.context.haptics.light();

      if (feedEl) feedEl.textContent = `HIT! ${reactionTime}ms (+${pts} pts)`;
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

      this.spawnTargetForPlayer(playerId);
    } else {
      // Missed!
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 1);
      this.context.audio.playTone(180, 0.08, 'sawtooth');
      this.context.haptics.medium();

      if (feedEl) feedEl.textContent = 'MISS! -1 pt ❌';
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.targetTimeoutIds.forEach(id => clearTimeout(id));

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    const rawStats: Record<PlayerId, number | string> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    players.forEach(p => {
      const best = this.fastestReactionMs[p.id];
      rawStats[p.id] = best < 9000 ? `${best}ms` : 'None';
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.targetTimeoutIds.forEach(id => clearTimeout(id));
  }
}
