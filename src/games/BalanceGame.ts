import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface PlayerBalanceState {
  id: PlayerId;
  ballPos: number; // 0 to 100, center is 50
  velocity: number;
  isAlive: boolean;
  survivalTime: number;
  gustForce: number;
  gustTimer: number;
}

export class BalanceGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'balance')!;

  private playerStates: Map<PlayerId, PlayerBalanceState> = new Map();
  private maxDuration = 20.0;
  private gameTime = 0;

  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxDuration = diff === 'EASY' ? 18.0 : diff === 'HARD' ? 24.0 : 20.0;
    this.gameTime = 0;
    this.playerStates.clear();

    players.forEach(p => {
      this.playerStates.set(p.id, {
        id: p.id,
        ballPos: 50,
        velocity: 0,
        isAlive: true,
        survivalTime: 0,
        gustForce: (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 20),
        gustTimer: 1.0
      });
    });

    this.container.className = 'game-screen balance-game';
    this.container.innerHTML = `
      <div class="bl-hud">
        <div class="bl-timer" id="bl-timer">${this.maxDuration.toFixed(1)}s</div>
        <div class="bl-title">KEEP THE BALL BALANCED IN THE CENTER! ⚖️</div>
      </div>

      <div class="bl-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="bl-player-zone" data-player-id="${p.id}" id="bl-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="bl-zone-header">
              <span class="bl-avatar">${p.avatar}</span>
              <span class="bl-name">${p.name}</span>
              <span class="bl-status" id="bl-stat-${p.id}">BALANCED</span>
            </div>

            <div class="bl-tray-wrapper">
              <div class="bl-tray-track">
                <div class="bl-safe-zone"></div>
                <div class="bl-ball" id="bl-ball-${p.id}" style="left: 50%">⚽</div>
              </div>
            </div>

            <div class="bl-controls">
              <button class="bl-btn btn-tilt-left" data-dir="-1" type="button">◀ TILT LEFT</button>
              <button class="bl-btn btn-tilt-right" data-dir="1" type="button">TILT RIGHT ▶</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#bl-timer')!;

    // Input handlers
    this.container.querySelectorAll('.bl-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.querySelectorAll('.bl-btn').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          const dir = parseInt(btn.getAttribute('data-dir') || '0', 10);
          this.handleInput(pId, 'TILT', dir);
        });
      });
    });
  }

  protected onStart(): void {
    // Start loop
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.gameTime += deltaTime;
    const remaining = Math.max(0, this.maxDuration - this.gameTime);
    if (this.timerEl) {
      this.timerEl.textContent = `${remaining.toFixed(1)}s`;
    }

    if (remaining <= 0) {
      this.finishGame();
      return;
    }

    const diff = this.context.difficulty || 'NORMAL';
    const gustStrength = diff === 'EASY' ? 25 : diff === 'HARD' ? 55 : 40;

    let anyAlive = false;

    this.playerStates.forEach(state => {
      if (!state.isAlive) return;
      anyAlive = true;
      state.survivalTime = this.gameTime;

      // Update gust timer & direction
      state.gustTimer -= deltaTime;
      if (state.gustTimer <= 0) {
        state.gustTimer = 0.8 + Math.random() * 1.4;
        state.gustForce = (Math.random() > 0.5 ? 1 : -1) * (gustStrength + Math.random() * 20);
      }

      // Physics integration: apply gust + natural tilt acceleration
      state.velocity += state.gustForce * deltaTime;
      // Gravity acceleration away from center (unstable equilibrium)
      const distFromCenter = state.ballPos - 50;
      state.velocity += distFromCenter * 1.8 * deltaTime;

      // Friction
      state.velocity *= 0.94;
      state.ballPos += state.velocity * deltaTime;

      const ballEl = this.container.querySelector(`#bl-ball-${state.id}`) as HTMLElement;
      if (ballEl) {
        ballEl.style.left = `${Math.max(0, Math.min(100, state.ballPos))}%`;
      }

      // Fall off check (0% or 100%)
      if (state.ballPos <= 4 || state.ballPos >= 96) {
        state.isAlive = false;
        this.context.audio.playError();
        this.context.haptics.heavy();

        const zone = this.container.querySelector(`#bl-zone-${state.id}`);
        const stat = this.container.querySelector(`#bl-stat-${state.id}`);
        if (zone) zone.classList.add('zone-eliminated');
        if (stat) {
          stat.textContent = 'DROPPED! 💥';
          stat.className = 'bl-status dropped';
        }
      }
    });

    if (!anyAlive) {
      this.finishGame();
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'TILT' || !this.isRunning || this.isFinished) return;

    const state = this.playerStates.get(playerId);
    if (!state || !state.isAlive) return;

    const dir = data as number; // -1 or 1
    // Nudge velocity in opposite direction to restore balance
    state.velocity += dir * 28;

    this.context.audio.playTap();
    this.context.haptics.light();
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.playerStates.forEach(s => {
      const pts = Math.round(s.survivalTime * 10) + (s.isAlive ? 100 : 0);
      scores[s.id] = pts;
      rawStats[s.id] = `${s.survivalTime.toFixed(1)}s balanced`;
    });

    const activePlayers = this.context.players;
    const sorted = [...activePlayers].sort(
      (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
    );

    const winnerId =
      sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id]
        ? 'TIE'
        : sorted[0].id;

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1000);
  }
}
