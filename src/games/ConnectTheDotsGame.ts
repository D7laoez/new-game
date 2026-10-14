import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Dot {
  id: number; // 1 to 8
  x: number; // percentage (10 to 90)
  y: number; // percentage (15 to 85)
}

const FIXED_DOT_CONFIGS: Dot[][] = [
  // Star pattern
  [
    { id: 1, x: 50, y: 15 },
    { id: 2, x: 65, y: 35 },
    { id: 3, x: 90, y: 40 },
    { id: 4, x: 72, y: 60 },
    { id: 5, x: 78, y: 85 },
    { id: 6, x: 50, y: 72 },
    { id: 7, x: 22, y: 85 },
    { id: 8, x: 28, y: 60 }
  ],
  // Constellation pattern
  [
    { id: 1, x: 18, y: 25 },
    { id: 2, x: 38, y: 20 },
    { id: 3, x: 62, y: 30 },
    { id: 4, x: 82, y: 22 },
    { id: 5, x: 80, y: 65 },
    { id: 6, x: 55, y: 80 },
    { id: 7, x: 30, y: 70 },
    { id: 8, x: 15, y: 55 }
  ]
];

export class ConnectTheDotsGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'connect-the-dots')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerNextDot: Map<PlayerId, number> = new Map();
  private playerDots: Map<PlayerId, Dot[]> = new Map();
  private playerCompleted: Map<PlayerId, boolean> = new Map();
  private timeLeft = 25;
  private readonly totalDots = 8;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerNextDot.clear();
    this.playerDots.clear();
    this.playerCompleted.clear();
    this.timeLeft = 25;

    const patternIdx = Math.floor(Math.random() * FIXED_DOT_CONFIGS.length);
    const chosenDots = FIXED_DOT_CONFIGS[patternIdx];

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerNextDot.set(p.id, 1);
      this.playerDots.set(p.id, chosenDots);
      this.playerCompleted.set(p.id, false);
    });

    this.container.className = 'game-screen connect-the-dots-game';
    this.container.innerHTML = `
      <div class="ctd-hud">
        <div class="hud-timer" id="ctd-timer">25.0s</div>
        <div class="hud-tip">Tap the dots in ascending numerical order: 1 ➔ 2 ➔ 3... ✏️</div>
      </div>
      <div class="ctd-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ctd-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="ctd-zone-header">
              <span class="ctd-avatar">${p.avatar}</span>
              <span class="ctd-name">${p.name}</span>
              <span class="ctd-progress" id="ctd-prog-${p.id}">Dot: 1 / ${this.totalDots}</span>
            </div>
            <div class="ctd-canvas-wrap" id="ctd-wrap-${p.id}">
              <svg class="ctd-svg" id="ctd-svg-${p.id}"></svg>
              <div class="ctd-dots-layer" id="ctd-dots-${p.id}"></div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#ctd-timer')!;
    players.forEach(p => this.renderPlayerArena(p.id));
  }

  private renderPlayerArena(playerId: PlayerId): void {
    const dotsLayer = this.container.querySelector(`#ctd-dots-${playerId}`);
    const dots = this.playerDots.get(playerId);
    const nextDot = this.playerNextDot.get(playerId) || 1;
    if (!dotsLayer || !dots) return;

    let html = '';
    dots.forEach(d => {
      const isConnected = d.id < nextDot;
      const isCurrent = d.id === nextDot;
      html += `
        <button class="ctd-dot ${isConnected ? 'connected' : ''} ${isCurrent ? 'current' : ''}"
                data-id="${d.id}"
                style="left: ${d.x}%; top: ${d.y}%;"
                aria-label="Dot ${d.id}">
          ${d.id}
        </button>
      `;
    });
    dotsLayer.innerHTML = html;

    dotsLayer.querySelectorAll('.ctd-dot').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const id = parseInt(btn.getAttribute('data-id') || '0', 10);
        this.handleInput(playerId, 'CONNECT_DOT', { dotId: id });
      });
    });

    this.renderSvgLines(playerId);
  }

  private renderSvgLines(playerId: PlayerId): void {
    const svgEl = this.container.querySelector(`#ctd-svg-${playerId}`);
    const dots = this.playerDots.get(playerId);
    const nextDot = this.playerNextDot.get(playerId) || 1;
    if (!svgEl || !dots) return;

    let linesHtml = '';
    for (let i = 1; i < nextDot; i++) {
      const d1 = dots.find(d => d.id === i);
      const d2 = dots.find(d => d.id === i + 1);
      if (d1 && d2) {
        linesHtml += `
          <line x1="${d1.x}%" y1="${d1.y}%" x2="${d2.x}%" y2="${d2.y}%"
                stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        `;
      }
    }
    svgEl.innerHTML = linesHtml;
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

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'CONNECT_DOT') return;
    if (this.playerCompleted.get(playerId)) return;

    const { dotId } = (data as { dotId: number }) || { dotId: 0 };
    const nextTarget = this.playerNextDot.get(playerId) || 1;
    const dotsLayer = this.container.querySelector(`#ctd-dots-${playerId}`);
    const targetBtn = dotsLayer?.querySelector(`[data-id="${dotId}"]`);

    if (dotId === nextTarget) {
      // Correct dot!
      this.context.audio.playPop();
      this.context.haptics.light();
      this.playerScores[playerId] += 5;

      const newNext = nextTarget + 1;
      this.playerNextDot.set(playerId, newNext);

      const progEl = this.container.querySelector(`#ctd-prog-${playerId}`);
      if (progEl) {
        progEl.textContent = `Dot: ${Math.min(newNext, this.totalDots)} / ${this.totalDots}`;
      }

      this.renderPlayerArena(playerId);

      if (newNext > this.totalDots) {
        // Completed the full shape!
        this.playerCompleted.set(playerId, true);
        const timeBonus = Math.max(5, Math.round(this.timeLeft * 0.5));
        this.playerScores[playerId] += timeBonus;

        this.context.audio.playSuccess();
        this.context.haptics.heavy();

        if (progEl) progEl.textContent = `COMPLETED! 🏆 (+${timeBonus} bonus)`;

        const allDone = this.context.players.every(p => this.playerCompleted.get(p.id));
        if (allDone) {
          this.setGameTimeout(() => this.concludeGame(), 600);
        }
      }
    } else {
      // Wrong dot tapped!
      this.context.audio.playError();
      this.context.haptics.error();
      if (targetBtn) {
        targetBtn.classList.add('error-shake');
        this.setGameTimeout(() => targetBtn.classList.remove('error-shake'), 300);
      }
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

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    players.forEach(p => {
      const next = this.playerNextDot.get(p.id) || 1;
      const connectedCount = Math.min(next - 1, this.totalDots);
      rawStats[p.id] = `${connectedCount}/${this.totalDots} dots connected (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
