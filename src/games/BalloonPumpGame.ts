import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface BalloonState {
  pressure: number; // 0 to 100
  popped: boolean;
  popTime: number | null;
}

export class BalloonPumpGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'balloon-pump')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerBalloons: Map<PlayerId, BalloonState> = new Map();
  private finishOrder: PlayerId[] = [];
  private timeLeft = 15;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerBalloons.clear();
    this.finishOrder = [];
    this.timeLeft = 15;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerBalloons.set(p.id, {
        pressure: 0,
        popped: false,
        popTime: null
      });
    });

    this.container.className = 'game-screen balloon-pump-game';
    this.container.innerHTML = `
      <div class="bp-hud">
        <div class="hud-timer" id="bp-timer">15.0s</div>
        <div class="hud-tip">Mash PUMP to inflate your balloon to 100% and POP! 🎈💥</div>
      </div>
      <div class="bp-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="bp-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="bp-zone-header">
              <span class="bp-avatar">${p.avatar}</span>
              <span class="bp-name">${p.name}</span>
              <span class="bp-pressure" id="bp-pressure-${p.id}">0%</span>
            </div>
            <div class="bp-balloon-stage">
              <div class="bp-balloon" id="bp-balloon-${p.id}" style="background: radial-gradient(circle at 35% 35%, #fff 0%, ${p.color} 50%, ${p.darkColor} 100%);">
                <span class="bp-knot">🎈</span>
              </div>
            </div>
            <button class="bp-pump-btn" id="bp-pump-${p.id}" aria-label="Pump Balloon for ${p.name}">
              PUMP! 💨
            </button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#bp-timer')!;

    // Bind pump buttons
    players.forEach(p => {
      const btn = this.container.querySelector(`#bp-pump-${p.id}`);
      if (btn) {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'PUMP');
        });
      }
    });
  }

  protected onStart(): void {
    this.setGameInterval(() => {
      this.timeLeft -= 0.1;
      if (this.timerEl) {
        this.timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;
      }

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'PUMP') return;
    const bState = this.playerBalloons.get(playerId);
    if (!bState || bState.popped) return;

    // Increment pressure
    bState.pressure = Math.min(100, bState.pressure + 4);
    this.context.audio.playWhoosh();
    this.context.haptics.light();

    const pressureEl = this.container.querySelector(`#bp-pressure-${playerId}`);
    const balloonEl = this.container.querySelector(`#bp-balloon-${playerId}`) as HTMLElement;

    if (pressureEl) {
      pressureEl.textContent = `${bState.pressure}%`;
    }

    if (balloonEl) {
      // Scale from 0.4 up to 1.8
      const scale = 0.4 + (bState.pressure / 100) * 1.4;
      balloonEl.style.transform = `scale(${scale.toFixed(2)})`;
    }

    if (bState.pressure >= 100) {
      // POP!
      bState.popped = true;
      bState.popTime = performance.now();
      this.finishOrder.push(playerId);

      this.context.audio.playExplosion();
      this.context.haptics.heavy();

      if (balloonEl) {
        balloonEl.classList.add('popped');
        balloonEl.innerHTML = '<span class="bp-boom">💥</span>';
      }

      const btn = this.container.querySelector(`#bp-pump-${playerId}`) as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.textContent = `POPPED! 🏆 #${this.finishOrder.length}`;
      }

      // Check if all active players popped or single player finished
      const allDone = this.context.players.every(p => this.playerBalloons.get(p.id)?.popped);
      if (allDone || (this.context.players.length > 1 && this.finishOrder.length === this.context.players.length - 1)) {
        this.setGameTimeout(() => this.concludeGame(), 600);
      }
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;

    const players = this.context.players;

    // Calculate score based on finish order, then unpopped pressure
    players.forEach(p => {
      const bState = this.playerBalloons.get(p.id);
      if (!bState) return;

      if (bState.popped) {
        const orderIdx = this.finishOrder.indexOf(p.id);
        // 1st: 15pts, 2nd: 10pts, 3rd: 6pts, 4th: 3pts
        const rankPts = [15, 10, 6, 3];
        this.playerScores[p.id] = rankPts[orderIdx] ?? 3;
      } else {
        // Proportionate points for unpopped
        this.playerScores[p.id] = Math.round((bState.pressure / 100) * 4);
      }
    });

    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    players.forEach(p => {
      const bState = this.playerBalloons.get(p.id);
      if (bState?.popped) {
        const rank = this.finishOrder.indexOf(p.id) + 1;
        rawStats[p.id] = `Popped #${rank} (${this.playerScores[p.id]} pts)`;
      } else {
        rawStats[p.id] = `${bState?.pressure || 0}% pumped (${this.playerScores[p.id]} pts)`;
      }
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
