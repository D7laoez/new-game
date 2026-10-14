import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type TileContent = 'DIAMOND' | 'GOLD' | 'EMPTY' | 'ROCK';

interface DigTile {
  content: TileContent;
  dug: boolean;
}

export class TreasureDigGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'treasure-dig')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerGrids: Map<PlayerId, DigTile[]> = new Map();
  private timeLeft = 18;
  private timerIntervalId: number | null = null;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.timeLeft = 18;
    this.playerGrids.clear();

    // 9 tiles per player (3x3)
    players.forEach(p => {
      const items: TileContent[] = [
        'DIAMOND',
        'GOLD',
        'GOLD',
        'GOLD',
        'ROCK',
        'EMPTY',
        'EMPTY',
        'EMPTY',
        'EMPTY'
      ];
      items.sort(() => Math.random() - 0.5);

      this.playerGrids.set(
        p.id,
        items.map(content => ({ content, dug: false }))
      );
    });

    this.container.className = 'game-screen treasure-dig-game';
    this.container.innerHTML = `
      <div class="td-hud">
        <div class="hud-timer" id="td-timer">⏱️ 18s</div>
        <div class="hud-tip">Dig 💎 (+5) & 🪙 (+2) • Avoid 🪨</div>
      </div>
      <div class="td-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="td-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="td-zone-header">
              <span class="td-avatar">${p.avatar}</span>
              <span class="td-name">${p.name}</span>
              <span class="td-score" id="td-score-${p.id}">0 pts</span>
            </div>
            <div class="td-grid">
              ${[0, 1, 2, 3, 4, 5, 6, 7, 8]
                .map(
                  idx => `
                <button class="td-tile" data-player-id="${p.id}" data-tile-idx="${idx}" type="button">
                  🟫
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#td-timer')!;

    this.container.querySelectorAll('.td-tile').forEach(tileBtn => {
      tileBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(tileBtn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const idx = parseInt(tileBtn.getAttribute('data-tile-idx') || '0', 10);
        this.handleInput(pId, 'DIG', { idx, button: tileBtn as HTMLButtonElement });
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
    if (!this.isRunning || this.isFinished || action !== 'DIG') return;
    const { idx, button } = data as { idx: number; button: HTMLButtonElement };

    const grid = this.playerGrids.get(playerId);
    if (!grid || !grid[idx] || grid[idx].dug) return;

    const tile = grid[idx];
    tile.dug = true;
    button.classList.add('dug');

    if (tile.content === 'DIAMOND') {
      button.textContent = '💎';
      button.classList.add('diamond');
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 5;
      this.context.audio.playScore();
      this.context.haptics.heavy();
    } else if (tile.content === 'GOLD') {
      button.textContent = '🪙';
      button.classList.add('gold');
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 2;
      this.context.audio.playSuccess();
      this.context.haptics.medium();
    } else if (tile.content === 'ROCK') {
      button.textContent = '🪨';
      button.classList.add('rock');
      this.context.audio.playError();
      this.context.haptics.light();
    } else {
      button.textContent = '🕳️';
      button.classList.add('empty');
      this.context.audio.playPop();
      this.context.haptics.light();
    }

    const scoreEl = this.container.querySelector(`#td-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    // Check if player dug all tiles
    const allDug = grid.every(t => t.dug);
    if (allDug) {
      // Regenerate fresh dirt patch for continued digging
      setTimeout(() => {
        const newItems: TileContent[] = [
          'DIAMOND',
          'GOLD',
          'GOLD',
          'ROCK',
          'EMPTY',
          'EMPTY',
          'EMPTY',
          'EMPTY',
          'EMPTY'
        ];
        newItems.sort(() => Math.random() - 0.5);
        this.playerGrids.set(
          playerId,
          newItems.map(content => ({ content, dug: false }))
        );

        this.container
          .querySelectorAll(`.td-tile[data-player-id="${playerId}"]`)
          .forEach((b, i) => {
            b.className = 'td-tile';
            b.textContent = '🟫';
          });
      }, 350);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
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
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }
}
