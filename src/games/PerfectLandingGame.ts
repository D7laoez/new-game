import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class PerfectLandingGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'perfect-landing')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerLanded: Map<PlayerId, boolean> = new Map();
  private playerPositionX: Map<PlayerId, number> = new Map(); // 0% to 100%
  private playerSpeed: Map<PlayerId, number> = new Map();
  private playerDirection: Map<PlayerId, number> = new Map();
  private targetZoneStart = 40; // 40% to 60%
  private targetZoneEnd = 60;
  private currentAttempt = 1;
  private maxAttempts = 3;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentAttempt = 1;
    this.resetRound();

    players.forEach(p => {
      this.playerScores[p.id] = 0;
    });

    this.container.className = 'game-screen perfect-landing-game';
    this.container.innerHTML = `
      <div class="pl-hud">
        <div class="pl-round-tag" id="pl-round-tag">Attempt 1 / 3</div>
        <div class="pl-hint">Stop the lander inside the Green Target Zone! 🛸</div>
      </div>
      <div class="pl-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="pl-player-strip" id="pl-strip-${p.id}" style="--p-col: ${p.color}">
            <div class="pl-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="pl-score" id="pl-score-${p.id}">0 pts</span>
            </div>
            <div class="pl-landing-track">
              <div class="pl-target-zone" style="left: ${this.targetZoneStart}%; width: ${this.targetZoneEnd - this.targetZoneStart}%">
                🎯 LAND HERE
              </div>
              <div class="pl-lander" id="pl-lander-${p.id}">🛸</div>
            </div>
            <button class="pl-land-btn" data-player="${p.id}">LAND NOW! 🛑</button>
            <div class="pl-feedback" id="pl-feed-${p.id}">Tap to deploy landing gear!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind landing buttons
    this.container.querySelectorAll('.pl-land-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'LAND');
      });
    });
  }

  private resetRound(): void {
    const players = this.context.players;
    this.playerLanded.clear();
    this.playerPositionX.clear();
    this.playerSpeed.clear();
    this.playerDirection.clear();

    // Zone gets narrower with attempts
    const zoneWidth = Math.max(12, 22 - (this.currentAttempt - 1) * 4);
    const start = 20 + Math.random() * (70 - zoneWidth);
    this.targetZoneStart = Math.round(start);
    this.targetZoneEnd = Math.round(start + zoneWidth);

    players.forEach(p => {
      this.playerLanded.set(p.id, false);
      this.playerPositionX.set(p.id, 0);
      this.playerSpeed.set(p.id, 65 + (this.currentAttempt - 1) * 20);
      this.playerDirection.set(p.id, 1);
    });

    const roundTag = this.container.querySelector('#pl-round-tag');
    if (roundTag) roundTag.textContent = `Attempt ${this.currentAttempt} / ${this.maxAttempts}`;

    this.container.querySelectorAll('.pl-target-zone').forEach(tz => {
      const el = tz as HTMLElement;
      el.style.left = `${this.targetZoneStart}%`;
      el.style.width = `${this.targetZoneEnd - this.targetZoneStart}%`;
    });

    this.container.querySelectorAll('.pl-land-btn').forEach(btn => {
      (btn as HTMLButtonElement).disabled = false;
    });
  }

  protected onStart(): void {}

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.context.players.forEach(p => {
      if (this.playerLanded.get(p.id)) return;

      let x = this.playerPositionX.get(p.id) || 0;
      let dir = this.playerDirection.get(p.id) || 1;
      const speed = this.playerSpeed.get(p.id) || 60;

      x += dir * speed * deltaTime;

      if (x >= 95) {
        x = 95;
        dir = -1;
      } else if (x <= 5) {
        x = 5;
        dir = 1;
      }

      this.playerPositionX.set(p.id, x);
      this.playerDirection.set(p.id, dir);

      const lander = this.container.querySelector(`#pl-lander-${p.id}`) as HTMLElement;
      if (lander) lander.style.left = `${x}%`;
    });
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'LAND') return;
    if (this.playerLanded.get(playerId)) return;

    this.playerLanded.set(playerId, true);
    const x = this.playerPositionX.get(playerId) || 0;
    const btn = this.container.querySelector(`.pl-land-btn[data-player="${playerId}"]`) as HTMLButtonElement;
    if (btn) btn.disabled = true;

    const feedEl = this.container.querySelector(`#pl-feed-${playerId}`);
    const scoreEl = this.container.querySelector(`#pl-score-${playerId}`);

    const mid = (this.targetZoneStart + this.targetZoneEnd) / 2;
    const distToMid = Math.abs(x - mid);

    if (x >= this.targetZoneStart && x <= this.targetZoneEnd) {
      // Perfect or good landing!
      const pts = distToMid < 3 ? 10 : 6;
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      if (feedEl) feedEl.textContent = pts === 10 ? 'BULLSEYE! +10 pts 🎯' : 'GOOD LANDING! +6 pts ✅';
    } else {
      // Crash outside zone!
      this.context.audio.playExplosion();
      this.context.haptics.medium();
      if (feedEl) feedEl.textContent = 'MISSED ZONE! 0 pts 💥';
    }

    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    // Check if all landed
    const allLanded = this.context.players.every(p => this.playerLanded.get(p.id));
    if (allLanded) {
      setTimeout(() => {
        if (this.currentAttempt >= this.maxAttempts) {
          this.concludeGame();
        } else {
          this.currentAttempt++;
          this.resetRound();
        }
      }, 1200);
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

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats: this.playerScores
    });
  }

  protected onDestroy(): void {}
}
