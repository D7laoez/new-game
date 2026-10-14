import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

// 6x6 Ice Board
// 0 = ice (slide), 1 = rock obstacle, 2 = flag goal
const ICE_BOARD = [
  [0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 1],
  [0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 2] // Goal at (5, 5)
];

export class IceSlideGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'ice-slide')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerPos: Map<PlayerId, { r: number; c: number }> = new Map();
  private playerReachedGoal: Map<PlayerId, boolean> = new Map();
  private playerMovesCount: Map<PlayerId, number> = new Map();
  private timeLeft = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerPos.clear();
    this.playerReachedGoal.clear();
    this.playerMovesCount.clear();
    this.timeLeft = 20.0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerPos.set(p.id, { r: 0, c: 0 }); // Top left
      this.playerReachedGoal.set(p.id, false);
      this.playerMovesCount.set(p.id, 0);
    });

    this.container.className = 'game-screen ice-slide-game';
    this.container.innerHTML = `
      <div class="is-hud">
        <div class="is-timer" id="is-timer">20.0s</div>
        <div class="is-title">ICE SLIDE 🧊</div>
      </div>
      <div class="is-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="is-player-station" id="is-station-${p.id}" style="--p-col: ${p.color}">
            <div class="is-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="is-score" id="is-score-${p.id}">0 pts</span>
            </div>
            <div class="is-ice-board" id="is-board-${p.id}"></div>
            <div class="is-dpad">
              <button class="is-btn is-up" data-player="${p.id}" data-dir="UP">▲</button>
              <div class="is-dpad-row">
                <button class="is-btn is-left" data-player="${p.id}" data-dir="LEFT">◀</button>
                <button class="is-btn is-down" data-player="${p.id}" data-dir="DOWN">▼</button>
                <button class="is-btn is-right" data-player="${p.id}" data-dir="RIGHT">▶</button>
              </div>
            </div>
            <div class="is-feedback" id="is-feed-${p.id}">Slide to the flag! ⛳</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.renderBoards();

    // Bind directional dpad
    this.container.querySelectorAll('.is-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const dir = btn.getAttribute('data-dir') || 'UP';
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'SLIDE', dir);
      });
    });
  }

  private renderBoards(): void {
    this.context.players.forEach(p => {
      const board = this.container.querySelector(`#is-board-${p.id}`);
      if (!board) return;
      const pos = this.playerPos.get(p.id) || { r: 0, c: 0 };
      const reached = this.playerReachedGoal.get(p.id) || false;

      let html = '';
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const isRock = ICE_BOARD[r][c] === 1;
          const isGoal = ICE_BOARD[r][c] === 2;
          const isPlayer = !reached && pos.r === r && pos.c === c;

          let cellClass = 'is-cell';
          let content = '';

          if (isRock) {
            cellClass += ' rock';
            content = '🪨';
          } else if (isGoal) {
            cellClass += ' goal';
            content = '⛳';
          }

          if (isPlayer) {
            cellClass += ' player';
            content = p.avatar;
          }

          html += `<div class="${cellClass}">${content}</div>`;
        }
      }
      board.innerHTML = html;
    });
  }

  protected onStart(): void {
    this.timerIntervalId = this.setGameInterval(() => {
      this.timeLeft -= 0.1;
      const timerEl = this.container.querySelector('#is-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'SLIDE') return;
    if (this.playerReachedGoal.get(playerId)) return;

    const dir = data as string;
    let { r, c } = this.playerPos.get(playerId) || { r: 0, c: 0 };
    let dr = 0;
    let dc = 0;

    if (dir === 'UP') dr = -1;
    else if (dir === 'DOWN') dr = 1;
    else if (dir === 'LEFT') dc = -1;
    else if (dir === 'RIGHT') dc = 1;

    // Slide on ice until hitting rock or wall or goal
    let moved = false;
    while (true) {
      const nextR = r + dr;
      const nextC = c + dc;

      // Hit boundary
      if (nextR < 0 || nextR >= 6 || nextC < 0 || nextC >= 6) break;
      // Hit obstacle
      if (ICE_BOARD[nextR][nextC] === 1) break;

      r = nextR;
      c = nextC;
      moved = true;

      // Stop immediately if reached goal
      if (ICE_BOARD[r][c] === 2) break;
    }

    if (!moved) {
      this.context.audio.playTone(180, 0.05, 'sawtooth');
      return;
    }

    this.playerPos.set(playerId, { r, c });
    const moves = (this.playerMovesCount.get(playerId) || 0) + 1;
    this.playerMovesCount.set(playerId, moves);
    this.context.audio.playWhoosh();

    const feedEl = this.container.querySelector(`#is-feed-${playerId}`);
    if (feedEl) feedEl.textContent = `Moves: ${moves}`;

    // Check goal
    if (ICE_BOARD[r][c] === 2) {
      this.playerReachedGoal.set(playerId, true);
      const points = Math.max(5, Math.round(15 - moves + this.timeLeft * 0.3));
      this.playerScores[playerId] = points;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      const scoreEl = this.container.querySelector(`#is-score-${playerId}`);
      if (scoreEl) scoreEl.textContent = `${points} pts (Goal! 🏆)`;
      if (feedEl) feedEl.textContent = 'GOAL REACHED! 🎉';

      const allDone = this.context.players.every(p => this.playerReachedGoal.get(p.id));
      if (allDone) {
        this.setGameTimeout(() => this.concludeGame(), 600);
      }
    }

    this.renderBoards();
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

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
  }
}
