import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class TinyGolfGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'tiny-golf')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerStrokes: Map<PlayerId, number> = new Map();
  private maxStrokes = 3;
  private currentTurnPlayerIndex = 0;
  private aimAngle = 0;
  private aimDir = 1;
  private power = 50;
  private powerDir = 1;
  private isAiming = true;
  private isPowerPhase = false;
  private isBallMoving = false;
  private ballX = 50;
  private ballY = 85;
  private ballVx = 0;
  private ballVy = 0;
  private holeX = 50;
  private holeY = 18;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerStrokes.clear();
    this.currentTurnPlayerIndex = 0;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerStrokes.set(p.id, 0);
    });

    this.container.className = 'game-screen tiny-golf-game';
    this.container.innerHTML = `
      <div class="tg-hud">
        <div class="tg-turn-indicator" id="tg-turn-indicator">Player 1 Turn</div>
        <div class="tg-score-list">
          ${players
            .map(
              p => `
            <div class="tg-score-chip" style="--p-col: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="tg-score-${p.id}">0 pts</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="tg-green-arena" id="tg-arena">
        <div class="tg-hole" id="tg-hole" style="left: ${this.holeX}%; top: ${this.holeY}%">🕳️ ⛳</div>
        <div class="tg-aim-arrow" id="tg-aim-arrow"></div>
        <div class="tg-ball" id="tg-ball">⚪</div>
        <div class="tg-bunker" style="left: 20%; top: 40%">🏜️</div>
        <div class="tg-bunker" style="left: 75%; top: 45%">🏜️</div>
      </div>
      <div class="tg-controls">
        <div class="tg-power-meter">
          <div class="tg-power-fill" id="tg-power-fill"></div>
        </div>
        <button class="tg-action-btn" id="tg-action-btn">SET AIM ⛳</button>
      </div>
    `;

    this.resetHole();
    this.updateTurnDisplay();

    const actionBtn = this.container.querySelector('#tg-action-btn');
    actionBtn?.addEventListener('pointerdown', e => {
      e.preventDefault();
      const curPlayer = this.context.players[this.currentTurnPlayerIndex];
      if (curPlayer) {
        this.handleInput(curPlayer.id, 'SWING');
      }
    });
  }

  private resetHole(): void {
    this.ballX = 50;
    this.ballY = 85;
    this.ballVx = 0;
    this.ballVy = 0;
    this.isAiming = true;
    this.isPowerPhase = false;
    this.isBallMoving = false;
    this.aimAngle = 0;
    this.power = 50;
    this.renderBall();
    const btn = this.container.querySelector('#tg-action-btn');
    if (btn) btn.textContent = 'LOCK AIM 🎯';
  }

  private renderBall(): void {
    const ball = this.container.querySelector('#tg-ball') as HTMLElement;
    if (ball) {
      ball.style.left = `${this.ballX}%`;
      ball.style.top = `${this.ballY}%`;
    }
    const arrow = this.container.querySelector('#tg-aim-arrow') as HTMLElement;
    if (arrow) {
      arrow.style.left = `${this.ballX}%`;
      arrow.style.top = `${this.ballY}%`;
      arrow.style.transform = `translateX(-50%) rotate(${this.aimAngle}deg)`;
      arrow.style.display = this.isAiming ? 'block' : 'none';
    }
  }

  private updateTurnDisplay(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const ind = this.container.querySelector('#tg-turn-indicator');
    if (ind && curPlayer) {
      const stroke = (this.playerStrokes.get(curPlayer.id) || 0) + 1;
      ind.textContent = `${curPlayer.avatar} ${curPlayer.name}'s Shot (${stroke}/${this.maxStrokes})`;
      ind.setAttribute('style', `color: ${curPlayer.color}`);
    }
  }

  protected onStart(): void {}

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.isAiming) {
      this.aimAngle += this.aimDir * 55 * deltaTime;
      if (this.aimAngle > 40) {
        this.aimAngle = 40;
        this.aimDir = -1;
      } else if (this.aimAngle < -40) {
        this.aimAngle = -40;
        this.aimDir = 1;
      }
      this.renderBall();
    } else if (this.isPowerPhase) {
      this.power += this.powerDir * 110 * deltaTime;
      if (this.power >= 100) {
        this.power = 100;
        this.powerDir = -1;
      } else if (this.power <= 10) {
        this.power = 10;
        this.powerDir = 1;
      }
      const pFill = this.container.querySelector('#tg-power-fill') as HTMLElement;
      if (pFill) pFill.style.width = `${this.power}%`;
    } else if (this.isBallMoving) {
      this.ballX += this.ballVx * deltaTime;
      this.ballY += this.ballVy * deltaTime;

      // Friction
      this.ballVx *= 0.96;
      this.ballVy *= 0.96;

      // Wall bounce
      if (this.ballX < 5 || this.ballX > 95) {
        this.ballVx = -this.ballVx * 0.7;
        this.ballX = Math.max(5, Math.min(95, this.ballX));
      }
      if (this.ballY < 5 || this.ballY > 95) {
        this.ballVy = -this.ballVy * 0.7;
        this.ballY = Math.max(5, Math.min(95, this.ballY));
      }

      this.renderBall();

      // Check hole in one or distance
      const distToHole = Math.hypot(this.ballX - this.holeX, this.ballY - this.holeY);
      const isStopped = Math.hypot(this.ballVx, this.ballVy) < 1.5;

      if (distToHole < 5) {
        // In the hole!
        this.isBallMoving = false;
        this.resolveShot(true, distToHole);
      } else if (isStopped) {
        this.isBallMoving = false;
        this.resolveShot(false, distToHole);
      }
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'SWING') return;
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    if (!curPlayer || curPlayer.id !== playerId) return;

    const btn = this.container.querySelector('#tg-action-btn');

    if (this.isAiming) {
      this.isAiming = false;
      this.isPowerPhase = true;
      this.context.audio.playTone(450, 0.08);
      if (btn) btn.textContent = 'SET POWER & PUTT! ⛳';
    } else if (this.isPowerPhase) {
      this.isPowerPhase = false;
      this.isBallMoving = true;
      this.context.audio.playWhoosh();

      const rad = (this.aimAngle * Math.PI) / 180;
      const speed = 25 + (this.power / 100) * 55;
      this.ballVx = Math.sin(rad) * speed;
      this.ballVy = -Math.cos(rad) * speed;
      if (btn) btn.textContent = 'PUTTING... 🏌️';
    }
  }

  private resolveShot(inHole: boolean, distToHole: number): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    let pts = 0;

    if (inHole) {
      pts = 10;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();
    } else {
      // Award points based on proximity
      pts = distToHole < 15 ? 6 : distToHole < 30 ? 3 : 1;
      this.context.audio.playPop();
      this.context.haptics.medium();
    }

    this.playerScores[curPlayer.id] = (this.playerScores[curPlayer.id] || 0) + pts;
    const scoreEl = this.container.querySelector(`#tg-score-${curPlayer.id}`);
    if (scoreEl) scoreEl.textContent = `${this.playerScores[curPlayer.id]} pts`;

    const strokes = (this.playerStrokes.get(curPlayer.id) || 0) + 1;
    this.playerStrokes.set(curPlayer.id, strokes);

    const allDone = this.context.players.every(p => (this.playerStrokes.get(p.id) || 0) >= this.maxStrokes);

    setTimeout(() => {
      if (allDone) {
        this.concludeGame();
      } else {
        this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.context.players.length;
        this.resetHole();
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
