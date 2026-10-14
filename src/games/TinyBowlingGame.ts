import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Pin {
  x: number;
  y: number;
  standing: boolean;
}

export class TinyBowlingGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'tiny-bowling')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerFrames: Map<PlayerId, number> = new Map();
  private maxFrames = 3;
  private currentTurnPlayerIndex = 0;
  private aimAngle = 0;
  private aimDir = 1;
  private power = 50;
  private powerDir = 1;
  private isAiming = true;
  private isPowerPhase = false;
  private isRolling = false;
  private ballX = 50;
  private ballY = 90;
  private ballVx = 0;
  private ballVy = 0;
  private pins: Pin[] = [];

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerFrames.clear();
    this.currentTurnPlayerIndex = 0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerFrames.set(p.id, 0);
    });

    this.container.className = 'game-screen tiny-bowling-game';
    this.container.innerHTML = `
      <div class="tb-hud">
        <div class="tb-turn-indicator" id="tb-turn-indicator">Player 1 Turn</div>
        <div class="tb-score-list">
          ${players
            .map(
              p => `
            <div class="tb-score-chip" style="--p-col: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="tb-score-${p.id}">0 pins</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="tb-lane-arena" id="tb-arena">
        <div class="tb-pins-deck" id="tb-pins"></div>
        <div class="tb-aim-line" id="tb-aim-line"></div>
        <div class="tb-ball" id="tb-ball">🎳</div>
      </div>
      <div class="tb-controls">
        <div class="tb-power-meter">
          <div class="tb-power-fill" id="tb-power-fill"></div>
        </div>
        <button class="tb-action-btn" id="tb-action-btn">AIM & ROLL 🎯</button>
      </div>
    `;

    this.resetPins();
    this.updateTurnDisplay();

    const actionBtn = this.container.querySelector('#tb-action-btn');
    actionBtn?.addEventListener('pointerdown', e => {
      e.preventDefault();
      const curPlayer = this.context.players[this.currentTurnPlayerIndex];
      if (curPlayer) {
        this.handleInput(curPlayer.id, 'ROLL');
      }
    });
  }

  private resetPins(): void {
    // 6 pins triangle: (row 1: 1 pin, row 2: 2 pins, row 3: 3 pins)
    this.pins = [
      { x: 50, y: 15, standing: true },
      { x: 44, y: 22, standing: true },
      { x: 56, y: 22, standing: true },
      { x: 38, y: 29, standing: true },
      { x: 50, y: 29, standing: true },
      { x: 62, y: 29, standing: true }
    ];
    this.renderPins();
    this.ballX = 50;
    this.ballY = 88;
    this.ballVx = 0;
    this.ballVy = 0;
    this.isAiming = true;
    this.isPowerPhase = false;
    this.isRolling = false;
    this.aimAngle = 0;
    this.power = 50;
    this.renderBall();
    const btn = this.container.querySelector('#tb-action-btn');
    if (btn) btn.textContent = 'LOCK AIM 🎯';
  }

  private renderPins(): void {
    const deck = this.container.querySelector('#tb-pins');
    if (!deck) return;
    deck.innerHTML = this.pins
      .map(
        (p, idx) => `
      <div class="tb-pin ${p.standing ? 'standing' : 'fallen'}" style="left: ${p.x}%; top: ${p.y}%">
        ${p.standing ? '🎳' : '💥'}
      </div>
    `
      )
      .join('');
  }

  private renderBall(): void {
    const ball = this.container.querySelector('#tb-ball') as HTMLElement;
    if (ball) {
      ball.style.left = `${this.ballX}%`;
      ball.style.top = `${this.ballY}%`;
    }
    const aimLine = this.container.querySelector('#tb-aim-line') as HTMLElement;
    if (aimLine) {
      aimLine.style.transform = `translateX(-50%) rotate(${this.aimAngle}deg)`;
      aimLine.style.display = this.isAiming ? 'block' : 'none';
    }
  }

  private updateTurnDisplay(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const ind = this.container.querySelector('#tb-turn-indicator');
    if (ind && curPlayer) {
      const frame = (this.playerFrames.get(curPlayer.id) || 0) + 1;
      ind.textContent = `${curPlayer.avatar} ${curPlayer.name}'s Turn (Roll ${frame}/${this.maxFrames})`;
      ind.setAttribute('style', `color: ${curPlayer.color}`);
    }
  }

  protected onStart(): void {
    // Game is turn based
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.isAiming) {
      this.aimAngle += this.aimDir * 45 * deltaTime;
      if (this.aimAngle > 35) {
        this.aimAngle = 35;
        this.aimDir = -1;
      } else if (this.aimAngle < -35) {
        this.aimAngle = -35;
        this.aimDir = 1;
      }
      this.renderBall();
    } else if (this.isPowerPhase) {
      this.power += this.powerDir * 120 * deltaTime;
      if (this.power >= 100) {
        this.power = 100;
        this.powerDir = -1;
      } else if (this.power <= 10) {
        this.power = 10;
        this.powerDir = 1;
      }
      const pFill = this.container.querySelector('#tb-power-fill') as HTMLElement;
      if (pFill) pFill.style.width = `${this.power}%`;
    } else if (this.isRolling) {
      this.ballX += this.ballVx * deltaTime;
      this.ballY += this.ballVy * deltaTime;
      this.renderBall();

      // Check pin hits
      this.pins.forEach(p => {
        if (p.standing) {
          const dist = Math.hypot(this.ballX - p.x, this.ballY - p.y);
          if (dist < 7) {
            p.standing = false;
            this.context.audio.playPop();
            this.context.haptics.heavy();
          }
        }
      });
      this.renderPins();

      // End of lane
      if (this.ballY <= 12) {
        this.isRolling = false;
        this.resolveRoll();
      }
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'ROLL') return;
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    if (!curPlayer || curPlayer.id !== playerId) return;

    const btn = this.container.querySelector('#tb-action-btn');

    if (this.isAiming) {
      this.isAiming = false;
      this.isPowerPhase = true;
      this.context.audio.playTone(400, 0.08);
      if (btn) btn.textContent = 'SET POWER & RELEASE! 💥';
    } else if (this.isPowerPhase) {
      this.isPowerPhase = false;
      this.isRolling = true;
      this.context.audio.playWhoosh();

      // Calculate velocity from angle & power
      const rad = (this.aimAngle * Math.PI) / 180;
      const speed = 40 + (this.power / 100) * 45;
      this.ballVx = Math.sin(rad) * speed;
      this.ballVy = -Math.cos(rad) * speed;
      if (btn) btn.textContent = 'ROLLING... 🎳';
    }
  }

  private resolveRoll(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const fallenCount = this.pins.filter(p => !p.standing).length;

    this.playerScores[curPlayer.id] = (this.playerScores[curPlayer.id] || 0) + fallenCount;
    const scoreEl = this.container.querySelector(`#tb-score-${curPlayer.id}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[curPlayer.id]} pins`;

    const frames = (this.playerFrames.get(curPlayer.id) || 0) + 1;
    this.playerFrames.set(curPlayer.id, frames);

    // Check if session complete
    const allDone = this.context.players.every(p => (this.playerFrames.get(p.id) || 0) >= this.maxFrames);

    setTimeout(() => {
      if (allDone) {
        this.concludeGame();
      } else {
        // Next player's turn
        this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.context.players.length;
        this.resetPins();
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
