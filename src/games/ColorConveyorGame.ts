import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type ConveyorColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

interface ConveyorItem {
  id: number;
  color: ConveyorColor;
  icon: string;
  xPercent: number; // 0 to 100
}

const COLOR_MAP: Record<ConveyorColor, { label: string; bg: string; icon: string }> = {
  RED: { label: 'Red', bg: '#ef4444', icon: '🔴' },
  BLUE: { label: 'Blue', bg: '#3b82f6', icon: '🔵' },
  GREEN: { label: 'Green', bg: '#10b981', icon: '🟢' },
  YELLOW: { label: 'Yellow', bg: '#f59e0b', icon: '🟡' }
};

export class ColorConveyorGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'color-conveyor')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerItems: Map<PlayerId, ConveyorItem[]> = new Map();
  private nextItemId = 1;
  private spawnTimers: Map<PlayerId, number> = new Map();
  private gameTime = 0;
  private maxDuration = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerItems.clear();
    this.spawnTimers.clear();
    this.gameTime = 0;

    players.forEach(p => {
      this.playerItems.set(p.id, []);
      this.spawnTimers.set(p.id, 0);
      this.playerScores[p.id] = 0;
    });

    this.container.className = 'game-screen color-conveyor-game';
    this.container.innerHTML = `
      <div class="cc-hud">
        <div class="cc-timer" id="cc-timer">20.0s</div>
        <div class="cc-title">COLOR CONVEYOR 📦</div>
      </div>
      <div class="cc-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="cc-player-belt" id="cc-belt-${p.id}" style="--p-col: ${p.color}">
            <div class="cc-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="cc-score" id="cc-score-${p.id}">0 pts</span>
            </div>
            <div class="cc-conveyor-track">
              <div class="cc-items-track" id="cc-track-${p.id}"></div>
              <div class="cc-target-zone">🎯 SORT ZONE</div>
            </div>
            <div class="cc-sort-buttons">
              <button class="cc-btn cc-btn-red" data-player="${p.id}" data-color="RED">🔴</button>
              <button class="cc-btn cc-btn-blue" data-player="${p.id}" data-color="BLUE">🔵</button>
              <button class="cc-btn cc-btn-green" data-player="${p.id}" data-color="GREEN">🟢</button>
              <button class="cc-btn cc-btn-yellow" data-player="${p.id}" data-color="YELLOW">🟡</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind sort buttons
    this.container.querySelectorAll('.cc-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const color = btn.getAttribute('data-color') as ConveyorColor;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'SORT', color);
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = this.setGameInterval(() => {
      this.gameTime += 0.1;
      const timeLeft = Math.max(0, this.maxDuration - this.gameTime);
      const timerEl = this.container.querySelector('#cc-timer');
      if (timerEl) timerEl.textContent = `${timeLeft.toFixed(1)}s`;

      if (timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);

    // Initial item for each player
    this.context.players.forEach(p => {
      this.spawnItem(p.id);
    });
  }

  private spawnItem(playerId: PlayerId): void {
    const items = this.playerItems.get(playerId);
    if (!items) return;
    const colors: ConveyorColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
    const chosen = colors[Math.floor(Math.random() * colors.length)];
    items.push({
      id: this.nextItemId++,
      color: chosen,
      icon: COLOR_MAP[chosen].icon,
      xPercent: 0
    });
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.context.players.forEach(p => {
      const items = this.playerItems.get(p.id) || [];
      let timer = (this.spawnTimers.get(p.id) || 0) + deltaTime;

      if (timer > 1.3) {
        timer = 0;
        this.spawnItem(p.id);
      }
      this.spawnTimers.set(p.id, timer);

      // Advance items across belt (0 to 100%)
      const speed = 40 + Math.min(20, this.gameTime * 1.2);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.xPercent += speed * deltaTime;

        // If fell off conveyor without sorting
        if (it.xPercent > 105) {
          items.splice(i, 1);
          // Miss penalty
          this.playerScores[p.id] = Math.max(0, (this.playerScores[p.id] || 0) - 1);
          const scoreEl = this.container.querySelector(`#cc-score-${p.id}`);
          if (scoreEl) scoreEl.textContent = `${this.playerScores[p.id]} pts`;
        }
      }

      this.renderPlayerBelt(p.id);
    });
  }

  private renderPlayerBelt(playerId: PlayerId): void {
    const track = this.container.querySelector(`#cc-track-${playerId}`);
    if (!track) return;
    const items = this.playerItems.get(playerId) || [];
    track.innerHTML = items
      .map(
        it => `
      <div class="cc-box-item color-${it.color.toLowerCase()}" style="left: ${it.xPercent}%">
        ${it.icon}
      </div>
    `
      )
      .join('');
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'SORT') return;
    const items = this.playerItems.get(playerId);
    if (!items || items.length === 0) return;

    const chosenColor = data as ConveyorColor;

    // Find the item nearest the end (xPercent between 55% and 100%)
    const targetIdx = items.findIndex(it => it.xPercent >= 50 && it.xPercent <= 102);

    if (targetIdx !== -1) {
      const item = items[targetIdx];
      if (item.color === chosenColor) {
        // Correct sort!
        items.splice(targetIdx, 1);
        this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 3;
        this.context.audio.playPop();
        this.context.haptics.light();
      } else {
        // Wrong sort!
        items.splice(targetIdx, 1);
        this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 2);
        this.context.audio.playError();
        this.context.haptics.medium();
      }
    } else {
      // Tapped with nothing in zone
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 1);
      this.context.audio.playTone(200, 0.08, 'sawtooth');
    }

    const scoreEl = this.container.querySelector(`#cc-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
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
