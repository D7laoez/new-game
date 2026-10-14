import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Stone {
  playerId: PlayerId;
  x: number; // 10% to 90%
  y: number; // 0% to 100%
  resting: boolean;
}

export class MiniCurlingGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'mini-curling')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private stones: Stone[] = [];
  private currentTurnPlayerIndex = 0;
  private currentRoundNumber = 1;
  private maxRounds = 2; // Each player gets 2 stones
  private stonesThrownPerPlayer: Map<PlayerId, number> = new Map();
  private targetX = 50;
  private targetY = 22; // Center of curling house
  private aimAngle = 0;
  private aimDir = 1;
  private power = 50;
  private powerDir = 1;
  private isAiming = true;
  private isPowerPhase = false;
  private isStoneMoving = false;
  private activeStoneX = 50;
  private activeStoneY = 85;
  private activeStoneVx = 0;
  private activeStoneVy = 0;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.stones = [];
    this.currentTurnPlayerIndex = 0;
    this.stonesThrownPerPlayer.clear();

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.stonesThrownPerPlayer.set(p.id, 0);
    });

    this.container.className = 'game-screen mini-curling-game';
    this.container.innerHTML = `
      <div class="mc-hud">
        <div class="mc-turn-indicator" id="mc-turn-indicator">Player 1 Turn</div>
        <div class="mc-score-list">
          ${players
            .map(
              p => `
            <div class="mc-score-chip" style="--p-col: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="mc-score-${p.id}">0 pts</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="mc-ice-sheet" id="mc-sheet">
        <div class="mc-house-target">
          <div class="mc-ring mc-ring-outer"></div>
          <div class="mc-ring mc-ring-inner"></div>
          <div class="mc-button-center">🎯</div>
        </div>
        <div class="mc-aim-arrow" id="mc-aim-arrow"></div>
        <div class="mc-active-stone" id="mc-active-stone">🥌</div>
        <div class="mc-stones-layer" id="mc-stones-layer"></div>
      </div>
      <div class="mc-controls">
        <div class="mc-power-meter">
          <div class="mc-power-fill" id="mc-power-fill"></div>
        </div>
        <button class="mc-action-btn" id="mc-action-btn">SET AIM 🥌</button>
      </div>
    `;

    this.resetStoneLaunch();
    this.updateTurnDisplay();

    const actionBtn = this.container.querySelector('#mc-action-btn');
    actionBtn?.addEventListener('pointerdown', e => {
      e.preventDefault();
      const curPlayer = this.context.players[this.currentTurnPlayerIndex];
      if (curPlayer) {
        this.handleInput(curPlayer.id, 'CURL');
      }
    });
  }

  private resetStoneLaunch(): void {
    this.activeStoneX = 50;
    this.activeStoneY = 85;
    this.activeStoneVx = 0;
    this.activeStoneVy = 0;
    this.isAiming = true;
    this.isPowerPhase = false;
    this.isStoneMoving = false;
    this.aimAngle = 0;
    this.power = 50;
    this.renderStonePosition();
    const btn = this.container.querySelector('#mc-action-btn');
    if (btn) btn.textContent = 'LOCK AIM 🎯';
  }

  private renderStonePosition(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const stone = this.container.querySelector('#mc-active-stone') as HTMLElement;
    if (stone && curPlayer) {
      stone.style.left = `${this.activeStoneX}%`;
      stone.style.top = `${this.activeStoneY}%`;
      stone.style.filter = `drop-shadow(0 0 8px ${curPlayer.color})`;
    }
    const arrow = this.container.querySelector('#mc-aim-arrow') as HTMLElement;
    if (arrow) {
      arrow.style.left = `${this.activeStoneX}%`;
      arrow.style.top = `${this.activeStoneY}%`;
      arrow.style.transform = `translateX(-50%) rotate(${this.aimAngle}deg)`;
      arrow.style.display = this.isAiming ? 'block' : 'none';
    }
  }

  private renderRestingStones(): void {
    const layer = this.container.querySelector('#mc-stones-layer');
    if (!layer) return;
    layer.innerHTML = this.stones
      .map(
        s => `
      <div class="mc-resting-stone" style="left: ${s.x}%; top: ${s.y}%">🥌</div>
    `
      )
      .join('');
  }

  private updateTurnDisplay(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const ind = this.container.querySelector('#mc-turn-indicator');
    if (ind && curPlayer) {
      const thrown = (this.stonesThrownPerPlayer.get(curPlayer.id) || 0) + 1;
      ind.textContent = `${curPlayer.avatar} ${curPlayer.name}'s Shot (${thrown}/${this.maxRounds})`;
      ind.setAttribute('style', `color: ${curPlayer.color}`);
    }
  }

  protected onStart(): void {}

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.isAiming) {
      this.aimAngle += this.aimDir * 50 * deltaTime;
      if (this.aimAngle > 35) {
        this.aimAngle = 35;
        this.aimDir = -1;
      } else if (this.aimAngle < -35) {
        this.aimAngle = -35;
        this.aimDir = 1;
      }
      this.renderStonePosition();
    } else if (this.isPowerPhase) {
      this.power += this.powerDir * 110 * deltaTime;
      if (this.power >= 100) {
        this.power = 100;
        this.powerDir = -1;
      } else if (this.power <= 10) {
        this.power = 10;
        this.powerDir = 1;
      }
      const pFill = this.container.querySelector('#mc-power-fill') as HTMLElement;
      if (pFill) pFill.style.width = `${this.power}%`;
    } else if (this.isStoneMoving) {
      this.activeStoneX += this.activeStoneVx * deltaTime;
      this.activeStoneY += this.activeStoneVy * deltaTime;

      // Friction
      this.activeStoneVx *= 0.97;
      this.activeStoneVy *= 0.97;

      // Boundaries
      if (this.activeStoneX < 10 || this.activeStoneX > 90) {
        this.activeStoneVx = -this.activeStoneVx * 0.7;
        this.activeStoneX = Math.max(10, Math.min(90, this.activeStoneX));
      }

      this.renderStonePosition();

      // Stone stops
      const speed = Math.hypot(this.activeStoneVx, this.activeStoneVy);
      if (speed < 1.2 || this.activeStoneY <= 15) {
        this.isStoneMoving = false;
        this.resolveStoneThrow();
      }
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'CURL') return;
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    if (!curPlayer || curPlayer.id !== playerId) return;

    const btn = this.container.querySelector('#mc-action-btn');

    if (this.isAiming) {
      this.isAiming = false;
      this.isPowerPhase = true;
      this.context.audio.playTone(420, 0.08);
      if (btn) btn.textContent = 'SET POWER & RELEASE! 🥌';
    } else if (this.isPowerPhase) {
      this.isPowerPhase = false;
      this.isStoneMoving = true;
      this.context.audio.playWhoosh();

      const rad = (this.aimAngle * Math.PI) / 180;
      const speed = 25 + (this.power / 100) * 45;
      this.activeStoneVx = Math.sin(rad) * speed;
      this.activeStoneVy = -Math.cos(rad) * speed;
      if (btn) btn.textContent = 'SLIDING ON ICE... 🧊';
    }
  }

  private resolveStoneThrow(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const distToCenter = Math.hypot(this.activeStoneX - this.targetX, this.activeStoneY - this.targetY);

    this.stones.push({
      playerId: curPlayer.id,
      x: this.activeStoneX,
      y: this.activeStoneY,
      resting: true
    });
    this.renderRestingStones();

    // Award immediate accuracy points
    const pts = distToCenter < 10 ? 10 : distToCenter < 20 ? 6 : distToCenter < 35 ? 3 : 1;
    this.playerScores[curPlayer.id] = (this.playerScores[curPlayer.id] || 0) + pts;
    this.context.audio.playPop();
    this.context.haptics.heavy();

    const scoreEl = this.container.querySelector(`#mc-score-${curPlayer.id}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[curPlayer.id]} pts`;

    const count = (this.stonesThrownPerPlayer.get(curPlayer.id) || 0) + 1;
    this.stonesThrownPerPlayer.set(curPlayer.id, count);

    const allDone = this.context.players.every(p => (this.stonesThrownPerPlayer.get(p.id) || 0) >= this.maxRounds);

    setTimeout(() => {
      if (allDone) {
        this.concludeGame();
      } else {
        this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.context.players.length;
        this.resetStoneLaunch();
        this.updateTurnDisplay();
      }
    }, 1000);
  }

  private concludeGame(): void {
    if (this.isFinished) return;
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

  protected onDestroy(): void {}
}
