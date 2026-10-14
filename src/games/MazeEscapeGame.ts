import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

// 7x7 grid maze
// 0 = path, 1 = wall
const MAZE_GRID = [
  [0, 0, 1, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 1],
  [0, 0, 1, 1, 1, 0, 0],
  [1, 0, 0, 0, 1, 1, 0],
  [0, 0, 1, 0, 0, 0, 0]
];

export class MazeEscapeGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'maze-escape')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerPos: Map<PlayerId, { r: number; c: number }> = new Map();
  private playerEscaped: Map<PlayerId, boolean> = new Map();
  private playerMoves: Map<PlayerId, number> = new Map();
  private timeLeft = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerPos.clear();
    this.playerEscaped.clear();
    this.playerMoves.clear();
    this.timeLeft = 20.0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerPos.set(p.id, { r: 0, c: 0 }); // Start top-left
      this.playerEscaped.set(p.id, false);
      this.playerMoves.set(p.id, 0);
    });

    this.container.className = 'game-screen maze-escape-game';
    this.container.innerHTML = `
      <div class="me-hud">
        <div class="me-timer" id="me-timer">20.0s</div>
        <div class="me-title">MAZE ESCAPE 🧭</div>
      </div>
      <div class="me-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="me-player-deck" id="me-deck-${p.id}" style="--p-col: ${p.color}">
            <div class="me-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="me-score" id="me-score-${p.id}">0 pts</span>
            </div>
            <div class="me-maze-board" id="me-board-${p.id}"></div>
            <div class="me-dpad">
              <button class="me-btn me-up" data-player="${p.id}" data-dir="UP">▲</button>
              <div class="me-dpad-row">
                <button class="me-btn me-left" data-player="${p.id}" data-dir="LEFT">◀</button>
                <button class="me-btn me-down" data-player="${p.id}" data-dir="DOWN">▼</button>
                <button class="me-btn me-right" data-player="${p.id}" data-dir="RIGHT">▶</button>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.renderBoards();

    // Bind directional dpad
    this.container.querySelectorAll('.me-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const dir = btn.getAttribute('data-dir') || 'UP';
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'MOVE', dir);
      });
    });
  }

  private renderBoards(): void {
    this.context.players.forEach(p => {
      const board = this.container.querySelector(`#me-board-${p.id}`);
      if (!board) return;
      const pos = this.playerPos.get(p.id) || { r: 0, c: 0 };
      const escaped = this.playerEscaped.get(p.id) || false;

      let html = '';
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isWall = MAZE_GRID[r][c] === 1;
          const isGoal = r === 6 && c === 6;
          const isPlayer = !escaped && pos.r === r && pos.c === c;

          let cellClass = 'me-cell';
          let content = '';

          if (isWall) cellClass += ' wall';
          else if (isGoal) {
            cellClass += ' goal';
            content = '🏁';
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
    this.timerIntervalId = window.setInterval(() => {
      this.timeLeft -= 0.1;
      const timerEl = this.container.querySelector('#me-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'MOVE') return;
    if (this.playerEscaped.get(playerId)) return;

    const dir = data as string;
    const pos = this.playerPos.get(playerId) || { r: 0, c: 0 };
    let nr = pos.r;
    let nc = pos.c;

    if (dir === 'UP') nr--;
    else if (dir === 'DOWN') nr++;
    else if (dir === 'LEFT') nc--;
    else if (dir === 'RIGHT') nc++;

    // Validate boundaries
    if (nr < 0 || nr >= 7 || nc < 0 || nc >= 7) {
      this.context.audio.playTone(180, 0.05, 'sawtooth');
      return;
    }

    // Validate walls
    if (MAZE_GRID[nr][nc] === 1) {
      this.context.audio.playTone(180, 0.05, 'sawtooth');
      return;
    }

    // Valid move!
    this.playerPos.set(playerId, { r: nr, c: nc });
    const moves = (this.playerMoves.get(playerId) || 0) + 1;
    this.playerMoves.set(playerId, moves);
    this.context.audio.playPop();

    // Check goal (6, 6)
    if (nr === 6 && nc === 6) {
      this.playerEscaped.set(playerId, true);
      const escapePoints = Math.round(10 + Math.max(0, this.timeLeft) * 0.5);
      this.playerScores[playerId] = escapePoints;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      const scoreEl = this.container.querySelector(`#me-score-${playerId}`);
      if (scoreEl) scoreEl.textContent = `${escapePoints} pts (Escaped! 🏆)`;

      // If all escaped
      const allEscaped = this.context.players.every(p => this.playerEscaped.get(p.id));
      if (allEscaped) {
        setTimeout(() => this.concludeGame(), 500);
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
