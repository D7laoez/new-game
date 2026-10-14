import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface FallingItem {
  id: number;
  xPercent: number; // 10% to 90%
  yPercent: number; // 0% to 100%
  speed: number;
  type: 'FRUIT' | 'BOMB';
  icon: string;
}

const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉'];

export class CatchTheFruitGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'catch-the-fruit')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerBasketX: Map<PlayerId, number> = new Map(); // 15% to 85%
  private playerItems: Map<PlayerId, FallingItem[]> = new Map();
  private nextItemId = 1;
  private spawnTimers: Map<PlayerId, number> = new Map();
  private gameTime = 0;
  private maxDuration = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerBasketX.clear();
    this.playerItems.clear();
    this.spawnTimers.clear();
    this.gameTime = 0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerBasketX.set(p.id, 50);
      this.playerItems.set(p.id, []);
      this.spawnTimers.set(p.id, 0);
    });

    this.container.className = 'game-screen catch-the-fruit-game';
    this.container.innerHTML = `
      <div class="ctf-hud">
        <div class="ctf-timer" id="ctf-timer">20.0s</div>
        <div class="ctf-title">CATCH THE FRUIT 🧺</div>
      </div>
      <div class="ctf-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ctf-player-yard" id="ctf-yard-${p.id}" style="--p-col: ${p.color}">
            <div class="ctf-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ctf-score" id="ctf-score-${p.id}">0 pts</span>
            </div>
            <div class="ctf-sky-arena" id="ctf-sky-${p.id}">
              <div class="ctf-items-layer" id="ctf-items-${p.id}"></div>
              <div class="ctf-basket" id="ctf-basket-${p.id}" style="left: 50%">🧺</div>
            </div>
            <div class="ctf-controls">
              <button class="ctf-ctrl-btn" data-player="${p.id}" data-dir="LEFT">◀</button>
              <button class="ctf-ctrl-btn" data-player="${p.id}" data-dir="RIGHT">▶</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind controls
    this.container.querySelectorAll('.ctf-ctrl-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const dir = btn.getAttribute('data-dir') as 'LEFT' | 'RIGHT';
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, dir);
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.gameTime += 0.1;
      const timeLeft = Math.max(0, this.maxDuration - this.gameTime);
      const timerEl = this.container.querySelector('#ctf-timer');
      if (timerEl) timerEl.textContent = `${timeLeft.toFixed(1)}s`;

      if (timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);

    // Initial item spawn
    this.context.players.forEach(p => {
      this.spawnItem(p.id);
    });
  }

  private spawnItem(playerId: PlayerId): void {
    const items = this.playerItems.get(playerId);
    if (!items) return;

    const isBomb = Math.random() < 0.25;
    items.push({
      id: this.nextItemId++,
      xPercent: 15 + Math.random() * 70,
      yPercent: -5,
      speed: 35 + Math.min(25, this.gameTime * 1.5),
      type: isBomb ? 'BOMB' : 'FRUIT',
      icon: isBomb ? '💣' : FRUITS[Math.floor(Math.random() * FRUITS.length)]
    });
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.context.players.forEach(p => {
      const items = this.playerItems.get(p.id) || [];
      let timer = (this.spawnTimers.get(p.id) || 0) + deltaTime;

      if (timer > 0.9) {
        timer = 0;
        this.spawnItem(p.id);
      }
      this.spawnTimers.set(p.id, timer);

      const basketX = this.playerBasketX.get(p.id) || 50;

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.yPercent += item.speed * deltaTime;

        // Catch collision around y=85%
        if (item.yPercent >= 80 && item.yPercent <= 92) {
          const dist = Math.abs(item.xPercent - basketX);
          if (dist < 15) {
            // Caught item!
            items.splice(i, 1);
            if (item.type === 'FRUIT') {
              this.playerScores[p.id] = (this.playerScores[p.id] || 0) + 2;
              this.context.audio.playPop();
              this.context.haptics.light();
            } else {
              // Bomb!
              this.playerScores[p.id] = Math.max(0, (this.playerScores[p.id] || 0) - 3);
              this.context.audio.playExplosion();
              this.context.haptics.heavy();
            }

            const scoreEl = this.container.querySelector(`#ctf-score-${p.id}`);
            if (scoreEl) scoreEl.textContent = `${this.playerScores[p.id]} pts`;
            continue;
          }
        }

        // Fell past bottom
        if (item.yPercent > 105) {
          items.splice(i, 1);
        }
      }

      this.renderPlayerItems(p.id);
    });
  }

  private renderPlayerItems(playerId: PlayerId): void {
    const layer = this.container.querySelector(`#ctf-items-${playerId}`);
    if (!layer) return;
    const items = this.playerItems.get(playerId) || [];
    layer.innerHTML = items
      .map(
        it => `
      <div class="ctf-item" style="left: ${it.xPercent}%; top: ${it.yPercent}%">
        ${it.icon}
      </div>
    `
      )
      .join('');
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished) return;
    let curX = this.playerBasketX.get(playerId) || 50;

    if (action === 'LEFT') {
      curX = Math.max(15, curX - 12);
    } else if (action === 'RIGHT') {
      curX = Math.min(85, curX + 12);
    }

    this.playerBasketX.set(playerId, curX);
    const basket = this.container.querySelector(`#ctf-basket-${playerId}`) as HTMLElement;
    if (basket) {
      basket.style.left = `${curX}%`;
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
