import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Gate {
  x: number;
  gapY: number; // Center of gate
  gapHeight: number;
}

export class PaperPlaneFlightGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'paper-plane-flight')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerFrames: Map<PlayerId, number> = new Map();
  private maxAttempts = 3;
  private currentTurnPlayerIndex = 0;
  private aimAngle = 0;
  private aimDir = 1;
  private power = 50;
  private powerDir = 1;
  private isAiming = true;
  private isPowerPhase = false;
  private isFlying = false;
  private planeX = 10;
  private planeY = 80;
  private planeVx = 0;
  private planeVy = 0;
  private gates: Gate[] = [
    { x: 35, gapY: 45, gapHeight: 30 },
    { x: 65, gapY: 55, gapHeight: 30 },
    { x: 90, gapY: 40, gapHeight: 30 }
  ];

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerFrames.clear();
    this.currentTurnPlayerIndex = 0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerFrames.set(p.id, 0);
    });

    this.container.className = 'game-screen paper-plane-game';
    this.container.innerHTML = `
      <div class="ppf-hud">
        <div class="ppf-turn-indicator" id="ppf-turn-indicator">Player 1 Flight</div>
        <div class="ppf-score-list">
          ${players
            .map(
              p => `
            <div class="ppf-score-chip" style="--p-col: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="ppf-score-${p.id}">0 pts</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="ppf-air-arena" id="ppf-arena">
        ${this.gates
          .map(
            (g, idx) => `
          <div class="ppf-gate" style="left: ${g.x}%; top: ${g.gapY - g.gapHeight / 2}%; height: ${g.gapHeight}%">
            <span class="ppf-gate-label">Gate ${idx + 1}</span>
          </div>
        `
          )
          .join('')}
        <div class="ppf-aim-line" id="ppf-aim-line"></div>
        <div class="ppf-plane" id="ppf-plane">✈️</div>
      </div>
      <div class="ppf-controls">
        <div class="ppf-power-meter">
          <div class="ppf-power-fill" id="ppf-power-fill"></div>
        </div>
        <button class="ppf-action-btn" id="ppf-action-btn">SET LAUNCH ANGLE ✈️</button>
      </div>
    `;

    this.resetFlight();
    this.updateTurnDisplay();

    const btn = this.container.querySelector('#ppf-action-btn');
    btn?.addEventListener('pointerdown', e => {
      e.preventDefault();
      const curPlayer = this.context.players[this.currentTurnPlayerIndex];
      if (curPlayer) {
        this.handleInput(curPlayer.id, 'LAUNCH');
      }
    });
  }

  private resetFlight(): void {
    this.planeX = 10;
    this.planeY = 80;
    this.planeVx = 0;
    this.planeVy = 0;
    this.isAiming = true;
    this.isPowerPhase = false;
    this.isFlying = false;
    this.aimAngle = -45;
    this.power = 50;
    this.renderPlane();
    const btn = this.container.querySelector('#ppf-action-btn');
    if (btn) btn.textContent = 'LOCK ANGLE 📐';
  }

  private renderPlane(): void {
    const plane = this.container.querySelector('#ppf-plane') as HTMLElement;
    if (plane) {
      plane.style.left = `${this.planeX}%`;
      plane.style.top = `${this.planeY}%`;
    }
    const aim = this.container.querySelector('#ppf-aim-line') as HTMLElement;
    if (aim) {
      aim.style.left = `${this.planeX}%`;
      aim.style.top = `${this.planeY}%`;
      aim.style.transform = `rotate(${this.aimAngle}deg)`;
      aim.style.display = this.isAiming ? 'block' : 'none';
    }
  }

  private updateTurnDisplay(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const ind = this.container.querySelector('#ppf-turn-indicator');
    if (ind && curPlayer) {
      const att = (this.playerFrames.get(curPlayer.id) || 0) + 1;
      ind.textContent = `${curPlayer.avatar} ${curPlayer.name}'s Flight (${att}/${this.maxAttempts})`;
      ind.setAttribute('style', `color: ${curPlayer.color}`);
    }
  }

  protected onStart(): void {}

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.isAiming) {
      this.aimAngle += this.aimDir * 60 * deltaTime;
      if (this.aimAngle > -15) {
        this.aimAngle = -15;
        this.aimDir = -1;
      } else if (this.aimAngle < -75) {
        this.aimAngle = -75;
        this.aimDir = 1;
      }
      this.renderPlane();
    } else if (this.isPowerPhase) {
      this.power += this.powerDir * 120 * deltaTime;
      if (this.power >= 100) {
        this.power = 100;
        this.powerDir = -1;
      } else if (this.power <= 15) {
        this.power = 15;
        this.powerDir = 1;
      }
      const fill = this.container.querySelector('#ppf-power-fill') as HTMLElement;
      if (fill) fill.style.width = `${this.power}%`;
    } else if (this.isFlying) {
      this.planeX += this.planeVx * deltaTime;
      this.planeY += this.planeVy * deltaTime;
      this.planeVy += 25 * deltaTime; // Gravity

      this.renderPlane();

      // Check crash into ground or edge
      if (this.planeY >= 92 || this.planeX >= 98 || this.planeY <= 5) {
        this.isFlying = false;
        this.resolveFlight();
      }
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'LAUNCH') return;
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    if (!curPlayer || curPlayer.id !== playerId) return;

    const btn = this.container.querySelector('#ppf-action-btn');

    if (this.isAiming) {
      this.isAiming = false;
      this.isPowerPhase = true;
      this.context.audio.playTone(380, 0.08);
      if (btn) btn.textContent = 'SET POWER & LAUNCH! 🚀';
    } else if (this.isPowerPhase) {
      this.isPowerPhase = false;
      this.isFlying = true;
      this.context.audio.playWhoosh();

      const rad = (this.aimAngle * Math.PI) / 180;
      const speed = 25 + (this.power / 100) * 45;
      this.planeVx = Math.cos(rad) * speed;
      this.planeVy = Math.sin(rad) * speed;
      if (btn) btn.textContent = 'SOARING... ✈️';
    }
  }

  private resolveFlight(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    let gatesPassed = 0;

    this.gates.forEach(g => {
      if (this.planeX >= g.x) {
        gatesPassed++;
      }
    });

    const flightPoints = gatesPassed * 3 + Math.round(this.planeX * 0.05);
    this.playerScores[curPlayer.id] = (this.playerScores[curPlayer.id] || 0) + flightPoints;
    this.context.audio.playSuccess();
    this.context.haptics.heavy();

    const scoreEl = this.container.querySelector(`#ppf-score-${curPlayer.id}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[curPlayer.id]} pts`;

    const frames = (this.playerFrames.get(curPlayer.id) || 0) + 1;
    this.playerFrames.set(curPlayer.id, frames);

    const allDone = this.context.players.every(p => (this.playerFrames.get(p.id) || 0) >= this.maxAttempts);

    this.setGameTimeout(() => {
      if (this.isFinished) return;
      if (allDone) {
        this.concludeGame();
      } else {
        this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.context.players.length;
        this.resetFlight();
        this.updateTurnDisplay();
      }
    }, 1200);
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
