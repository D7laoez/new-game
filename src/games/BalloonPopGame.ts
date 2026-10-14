import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Balloon {
  id: number;
  playerId: PlayerId;
  x: number; // percent (10 to 90)
  y: number; // percent (100 to -15)
  speed: number;
  type: 'NORMAL' | 'GOLD' | 'CACTUS';
  element: HTMLElement | null;
}

export class BalloonPopGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'balloon-pop')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private balloons: Balloon[] = [];
  private nextBalloonId = 1;
  private spawnIntervalId: number | null = null;
  private gameTimerId: number | null = null;
  private timeLeft = 18;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.balloons = [];
    this.timeLeft = 18;

    this.container.className = 'game-screen balloon-pop-game';
    this.container.innerHTML = `
      <div class="bp-hud">
        <div class="hud-timer" id="bp-timer">⏱️ 18s</div>
        <div class="hud-tip">Pop 🎈 (+1) & 🌟 (+3) • Dodge 🌵 (-3)</div>
      </div>
      <div class="bp-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="bp-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="bp-zone-header">
              <span class="bp-avatar">${p.avatar}</span>
              <span class="bp-name">${p.name}</span>
              <span class="bp-score" id="bp-score-${p.id}">0 pts</span>
            </div>
            <div class="bp-sky" id="bp-sky-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#bp-timer')!;
  }

  protected onStart(): void {
    this.gameTimerId = this.setGameInterval(() => {
      this.timeLeft--;
      if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 1000);

    this.spawnIntervalId = this.setGameInterval(() => {
      this.spawnBalloons();
    }, 600);

    this.spawnBalloons();
  }

  private spawnBalloons(): void {
    if (!this.isRunning || this.isFinished) return;

    for (const player of this.context.players) {
      const sky = this.container.querySelector(`#bp-sky-${player.id}`);
      if (!sky) continue;

      const rand = Math.random();
      let type: 'NORMAL' | 'GOLD' | 'CACTUS' = 'NORMAL';
      let icon = '🎈';
      if (rand < 0.2) {
        type = 'GOLD';
        icon = '🌟';
      } else if (rand < 0.4) {
        type = 'CACTUS';
        icon = '🌵';
      }

      const balloonId = this.nextBalloonId++;
      const bEl = document.createElement('div');
      bEl.className = `bp-balloon type-${type.toLowerCase()}`;
      bEl.textContent = icon;
      bEl.style.left = `${15 + Math.random() * 70}%`;
      bEl.style.bottom = `-40px`;

      bEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        this.handleInput(player.id, 'POP', balloonId);
      });

      sky.appendChild(bEl);

      this.balloons.push({
        id: balloonId,
        playerId: player.id,
        x: 15 + Math.random() * 70,
        y: 0,
        speed: 35 + Math.random() * 35,
        type,
        element: bEl
      });
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.y += b.speed * deltaTime;

      if (b.element) {
        b.element.style.bottom = `${b.y}%`;
      }

      // If escaped off top
      if (b.y > 105) {
        if (b.element) b.element.remove();
        this.balloons.splice(i, 1);
      }
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'POP') return;
    const balloonId = data as number;
    const bIdx = this.balloons.findIndex(b => b.id === balloonId && b.playerId === playerId);
    if (bIdx === -1) return;

    const balloon = this.balloons[bIdx];
    let pts = 0;

    if (balloon.type === 'NORMAL') {
      pts = 1;
      this.context.audio.playPop();
      this.context.haptics.light();
    } else if (balloon.type === 'GOLD') {
      pts = 3;
      this.context.audio.playScore();
      this.context.haptics.heavy();
    } else if (balloon.type === 'CACTUS') {
      pts = -3;
      this.context.audio.playError();
      this.context.haptics.heavy();
    }

    this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) + pts);

    const scoreEl = this.container.querySelector(`#bp-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    if (balloon.element) {
      balloon.element.classList.add('popped');
      balloon.element.textContent = balloon.type === 'CACTUS' ? '💥' : '✨';
      setTimeout(() => balloon.element?.remove(), 150);
    }
    this.balloons.splice(bIdx, 1);
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    this.cleanupBalloons();

    const players = this.context.players;
    const sorted = [...players].sort(
      (a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0)
    );

    let winnerId: PlayerId | 'TIE' | null = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats: this.playerScores
    });
  }

  private cleanupBalloons(): void {
    if (this.gameTimerId) {
      clearInterval(this.gameTimerId);
      this.gameTimerId = null;
    }
    if (this.spawnIntervalId) {
      clearInterval(this.spawnIntervalId);
      this.spawnIntervalId = null;
    }
    this.balloons.forEach(b => b.element?.remove());
    this.balloons = [];
  }

  protected onDestroy(): void {
    this.cleanupBalloons();
  }
}
