import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const GRID_SIZE = 6; // 6x6 = 36 tiles

export class TerritoryBattleGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'territory-battle')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private grid: (PlayerId | null)[][] = [];
  private timeLeft = 20;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.timeLeft = 20;

    // Initialize 6x6 grid
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    // Initial corner spawns for players
    const corners: [number, number][] = [
      [0, 0],
      [GRID_SIZE - 1, GRID_SIZE - 1],
      [0, GRID_SIZE - 1],
      [GRID_SIZE - 1, 0]
    ];

    players.forEach((p, idx) => {
      this.playerScores[p.id] = 1;
      const [r, c] = corners[idx % corners.length];
      this.grid[r][c] = p.id;
    });

    this.container.className = 'game-screen territory-battle-game';
    this.container.innerHTML = `
      <div class="tb-hud">
        <div class="hud-timer" id="tb-timer">20.0s</div>
        <div class="hud-tip">Tap adjacent tiles to expand your territory! 🚩</div>
      </div>
      <div class="tb-scoreboard">
        ${players
          .map(
            p => `
          <div class="tb-score-pill" id="tb-pill-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <span>${p.avatar} ${p.name}</span>
            <strong id="tb-count-${p.id}">1 tile</strong>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="tb-board" id="tb-board"></div>
    `;

    this.timerEl = this.container.querySelector('#tb-timer')!;
    this.renderBoard();
  }

  private isAdjacentToPlayerTerritory(r: number, c: number, playerId: PlayerId): boolean {
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
        if (this.grid[nr][nc] === playerId) {
          return true;
        }
      }
    }
    return false;
  }

  private renderBoard(): void {
    const boardEl = this.container.querySelector('#tb-board');
    if (!boardEl) return;

    let html = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const ownerId = this.grid[r][c];
        const owner = ownerId ? this.context.players.find(p => p.id === ownerId) : null;
        const color = owner ? owner.color : 'rgba(255, 255, 255, 0.08)';
        const avatar = owner ? owner.avatar : '';

        html += `
          <button class="tb-tile ${owner ? 'owned' : 'neutral'}"
                  data-r="${r}" data-c="${c}"
                  style="--tile-color: ${color}">
            <span>${avatar}</span>
          </button>
        `;
      }
    }
    boardEl.innerHTML = html;

    // Bind pointer events
    boardEl.querySelectorAll('.tb-tile').forEach(tile => {
      tile.addEventListener('pointerdown', e => {
        e.preventDefault();
        const r = parseInt(tile.getAttribute('data-r') || '0', 10);
        const c = parseInt(tile.getAttribute('data-c') || '0', 10);

        // Detect which player tapped based on quadrant or active player if solo
        // In local party multi-touch: we check who can claim it or pass the closest player
        // For input handling, the framework calls handleInput with the specific playerId
        // Here we default to closest player or active players
        const claimingPlayer = this.findClaimingPlayer(r, c);
        if (claimingPlayer) {
          this.handleInput(claimingPlayer, 'CLAIM', { r, c });
        }
      });
    });
  }

  private findClaimingPlayer(r: number, c: number): PlayerId | null {
    // If adjacent to a player's territory, that player claims it
    for (const p of this.context.players) {
      if (this.isAdjacentToPlayerTerritory(r, c, p.id)) {
        return p.id;
      }
    }
    // Otherwise pick player whose home quadrant is closest
    let bestDist = Infinity;
    let bestPlayer = this.context.players[0].id;
    const corners: [number, number][] = [
      [0, 0],
      [GRID_SIZE - 1, GRID_SIZE - 1],
      [0, GRID_SIZE - 1],
      [GRID_SIZE - 1, 0]
    ];
    this.context.players.forEach((p, idx) => {
      const [cr, cc] = corners[idx % corners.length];
      const dist = Math.abs(r - cr) + Math.abs(c - cc);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = p.id;
      }
    });
    return bestPlayer;
  }

  protected onStart(): void {
    this.setGameInterval(() => {
      this.timeLeft -= 0.1;
      if (this.timerEl) {
        this.timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;
      }

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'CLAIM') return;
    const { r, c } = (data as { r: number; c: number }) || { r: -1, c: -1 };
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;

    // Check if tile is already owned by this player
    if (this.grid[r][c] === playerId) return;

    // Must be adjacent to existing territory or valid starting move
    const isAdjacent = this.isAdjacentToPlayerTerritory(r, c, playerId);
    const currentOwned = this.countPlayerTiles(playerId);

    if (isAdjacent || currentOwned === 0) {
      this.grid[r][c] = playerId;
      this.context.audio.playPop();
      this.context.haptics.light();

      // Recalculate all scores
      this.updateScoresAndUI();
    }
  }

  private countPlayerTiles(playerId: PlayerId): number {
    let count = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === playerId) {
          count++;
        }
      }
    }
    return count;
  }

  private updateScoresAndUI(): void {
    this.context.players.forEach(p => {
      const count = this.countPlayerTiles(p.id);
      this.playerScores[p.id] = count;
      const countEl = this.container.querySelector(`#tb-count-${p.id}`);
      if (countEl) {
        countEl.textContent = `${count} tile${count === 1 ? '' : 's'}`;
      }
    });

    // Re-render board tiles
    const boardEl = this.container.querySelector('#tb-board');
    if (boardEl) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const tile = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
          if (tile) {
            const ownerId = this.grid[r][c];
            const owner = ownerId ? this.context.players.find(p => p.id === ownerId) : null;
            if (owner) {
              tile.className = 'tb-tile owned';
              tile.style.setProperty('--tile-color', owner.color);
              tile.innerHTML = `<span>${owner.avatar}</span>`;
            } else {
              tile.className = 'tb-tile neutral';
              tile.style.setProperty('--tile-color', 'rgba(255, 255, 255, 0.08)');
              tile.innerHTML = '<span></span>';
            }
          }
        }
      }
    }

    // If whole board is filled
    const allFilled = this.grid.every(row => row.every(cell => cell !== null));
    if (allFilled) {
      this.concludeGame();
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    players.forEach(p => {
      const count = this.playerScores[p.id] || 0;
      const pct = Math.round((count / (GRID_SIZE * GRID_SIZE)) * 100);
      rawStats[p.id] = `${count} tiles (${pct}%)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
