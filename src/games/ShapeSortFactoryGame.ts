import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type ShapeType = 'CIRCLE' | 'SQUARE' | 'TRIANGLE' | 'STAR';

interface FactoryItem {
  id: number;
  shape: ShapeType;
  icon: string;
}

const SHAPES_DATA: Record<ShapeType, { label: string; icon: string }> = {
  CIRCLE: { label: 'Circle', icon: '🔴' },
  SQUARE: { label: 'Square', icon: '🟦' },
  TRIANGLE: { label: 'Triangle', icon: '🔺' },
  STAR: { label: 'Star', icon: '⭐' }
};

export class ShapeSortFactoryGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'shape-sort-factory')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private currentItems: Map<PlayerId, FactoryItem> = new Map();
  private targetRules: Map<PlayerId, ShapeType> = new Map();
  private nextItemId = 1;
  private timeLeft = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentItems.clear();
    this.targetRules.clear();
    this.timeLeft = 20.0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.spawnItemForPlayer(p.id);
    });

    this.container.className = 'game-screen shape-sort-game';
    this.container.innerHTML = `
      <div class="ssf-hud">
        <div class="ssf-timer" id="ssf-timer">20.0s</div>
        <div class="ssf-title">SHAPE SORT FACTORY 🏭</div>
      </div>
      <div class="ssf-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ssf-player-station" id="ssf-station-${p.id}" style="--p-col: ${p.color}">
            <div class="ssf-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ssf-score" id="ssf-score-${p.id}">0 pts</span>
            </div>
            <div class="ssf-display-zone">
              <div class="ssf-conveyor-belt">
                <div class="ssf-active-item" id="ssf-item-${p.id}">
                  ${this.currentItems.get(p.id)?.icon}
                </div>
              </div>
            </div>
            <div class="ssf-bins-grid">
              <button class="ssf-bin" data-player="${p.id}" data-shape="CIRCLE">🔴 Circle</button>
              <button class="ssf-bin" data-player="${p.id}" data-shape="SQUARE">🟦 Square</button>
              <button class="ssf-bin" data-player="${p.id}" data-shape="TRIANGLE">🔺 Triangle</button>
              <button class="ssf-bin" data-player="${p.id}" data-shape="STAR">⭐ Star</button>
            </div>
            <div class="ssf-feedback" id="ssf-feed-${p.id}">Sort into matching bin!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind bin buttons
    this.container.querySelectorAll('.ssf-bin').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const shape = btn.getAttribute('data-shape') as ShapeType;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'SORT', shape);
      });
    });
  }

  private spawnItemForPlayer(playerId: PlayerId): void {
    const shapes: ShapeType[] = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'STAR'];
    const chosen = shapes[Math.floor(Math.random() * shapes.length)];
    const item: FactoryItem = {
      id: this.nextItemId++,
      shape: chosen,
      icon: SHAPES_DATA[chosen].icon
    };
    this.currentItems.set(playerId, item);
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.timeLeft -= 0.1;
      const timerEl = this.container.querySelector('#ssf-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'SORT') return;

    const chosenShape = data as ShapeType;
    const curItem = this.currentItems.get(playerId);
    if (!curItem) return;

    const feedEl = this.container.querySelector(`#ssf-feed-${playerId}`);
    const scoreEl = this.container.querySelector(`#ssf-score-${playerId}`);
    const itemEl = this.container.querySelector(`#ssf-item-${playerId}`);

    if (curItem.shape === chosenShape) {
      // Correct sort!
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 3;
      this.context.audio.playPop();
      this.context.haptics.light();
      if (feedEl) feedEl.textContent = 'CORRECT! +3 pts ✅';
    } else {
      // Wrong sort!
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 2);
      this.context.audio.playError();
      this.context.haptics.medium();
      if (feedEl) feedEl.textContent = 'WRONG BIN! -2 pts ❌';
    }

    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    // Spawn next
    this.spawnItemForPlayer(playerId);
    const nextItem = this.currentItems.get(playerId);
    if (itemEl && nextItem) {
      itemEl.textContent = nextItem.icon;
    }
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
