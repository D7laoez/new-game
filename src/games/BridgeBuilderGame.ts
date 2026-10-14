import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

// 5x5 river grid
// Col 0 = Left bank, Col 4 = Right bank
// Players must connect Col 0 to Col 4 by placing bridge planks on Col 1, 2, 3
export class BridgeBuilderGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'bridge-builder')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerGrids: Map<PlayerId, boolean[][]> = new Map();
  private playerPiecesLeft: Map<PlayerId, number> = new Map();
  private playerCompleted: Map<PlayerId, boolean> = new Map();
  private maxPieces = 6;
  private timeLeft = 25.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerGrids.clear();
    this.playerPiecesLeft.clear();
    this.playerCompleted.clear();
    this.timeLeft = 25.0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerPiecesLeft.set(p.id, this.maxPieces);
      this.playerCompleted.set(p.id, false);

      // 5x5 grid (all false initially except banks on col 0 and col 4)
      const grid: boolean[][] = [];
      for (let r = 0; r < 5; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < 5; c++) {
          row.push(c === 0 || c === 4);
        }
        grid.push(row);
      }
      this.playerGrids.set(p.id, grid);
    });

    this.container.className = 'game-screen bridge-builder-game';
    this.container.innerHTML = `
      <div class="bb-hud">
        <div class="bb-timer" id="bb-timer">25.0s</div>
        <div class="bb-title">BRIDGE BUILDER 🌉</div>
        <div class="bb-hint">Connect the green banks across the water!</div>
      </div>
      <div class="bb-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="bb-player-zone" id="bb-zone-${p.id}" style="--p-col: ${p.color}">
            <div class="bb-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="bb-planks" id="bb-planks-${p.id}">Planks: 6</span>
            </div>
            <div class="bb-river-grid" id="bb-grid-${p.id}"></div>
            <div class="bb-feedback" id="bb-feed-${p.id}">Tap water tiles to place planks!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.renderGrids();
  }

  private renderGrids(): void {
    this.context.players.forEach(p => {
      const gridEl = this.container.querySelector(`#bb-grid-${p.id}`);
      if (!gridEl) return;
      const grid = this.playerGrids.get(p.id);
      if (!grid) return;

      let html = '';
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const isBank = c === 0 || c === 4;
          const isPlank = grid[r][c] && !isBank;

          let cls = 'bb-cell';
          let icon = '🌊';
          if (isBank) {
            cls += ' bank';
            icon = '🌱';
          } else if (isPlank) {
            cls += ' plank';
            icon = '🪵';
          }

          html += `
            <button class="${cls}" data-player="${p.id}" data-r="${r}" data-c="${c}">
              ${icon}
            </button>
          `;
        }
      }
      gridEl.innerHTML = html;

      // Bind cell clicks
      gridEl.querySelectorAll('.bb-cell').forEach(btn => {
        const r = parseInt(btn.getAttribute('data-r') || '0', 10);
        const c = parseInt(btn.getAttribute('data-c') || '0', 10);
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'PLACE_PLANK', { r, c });
        });
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = this.setGameInterval(() => {
      this.timeLeft -= 0.1;
      const timerEl = this.container.querySelector('#bb-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'PLACE_PLANK') return;
    if (this.playerCompleted.get(playerId)) return;

    const { r, c } = data as { r: number; c: number };
    if (c === 0 || c === 4) return; // Cannot place on banks

    const grid = this.playerGrids.get(playerId);
    let pieces = this.playerPiecesLeft.get(playerId) || 0;
    if (!grid) return;

    if (!grid[r][c]) {
      // Place plank
      if (pieces <= 0) {
        this.context.audio.playTone(180, 0.05, 'sawtooth');
        return;
      }
      grid[r][c] = true;
      pieces--;
      this.playerPiecesLeft.set(playerId, pieces);
      this.context.audio.playPop();
    } else {
      // Remove plank
      grid[r][c] = false;
      pieces++;
      this.playerPiecesLeft.set(playerId, pieces);
      this.context.audio.playTone(250, 0.05);
    }

    const planksEl = this.container.querySelector(`#bb-planks-${playerId}`);
    if (planksEl) planksEl.textContent = `Planks: ${pieces}`;

    // Validate connectivity from Col 0 to Col 4 via BFS
    const connected = this.checkPath(grid);
    if (connected) {
      this.playerCompleted.set(playerId, true);
      const points = Math.max(5, Math.round(15 + this.timeLeft * 0.4));
      this.playerScores[playerId] = points;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      const feedEl = this.container.querySelector(`#bb-feed-${playerId}`);
      if (feedEl) feedEl.textContent = `BRIDGE CONNECTED! +${points} pts 🏆`;

      const allDone = this.context.players.every(p => this.playerCompleted.get(p.id));
      if (allDone) {
        this.setGameTimeout(() => this.concludeGame(), 600);
      }
    }

    this.renderGrids();
  }

  private checkPath(grid: boolean[][]): boolean {
    // BFS from any cell in Col 0 to Col 4
    const queue: [number, number][] = [];
    const visited: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));

    for (let r = 0; r < 5; r++) {
      queue.push([r, 0]);
      visited[r][0] = true;
    }

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (c === 4) return true; // Reached right bank!

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5 && !visited[nr][nc] && grid[nr][nc]) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    return false;
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
