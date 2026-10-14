import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class RapidTapGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'rapid-tap')!;

  private timeLeft = 5.0; // 5-second rapid frenzy
  private playerTaps: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.timeLeft = 5.0;
    this.playerTaps = { 1: 0, 2: 0, 3: 0, 4: 0 };

    this.container.className = 'game-screen rapid-tap-game';
    this.container.innerHTML = `
      <div class="rt-hud">
        <div class="rt-timer-box">
          <span class="rt-timer-icon">⏱️</span>
          <span class="rt-timer-num" id="rt-timer">5.0s</span>
        </div>
        <div class="rt-instructions">TAP AS FAST AS YOU CAN!</div>
      </div>
      <div class="rt-zones player-grid-${players.length}" id="rt-zones">
        ${players
          .map(
            p => `
          <div class="rt-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="rt-player-info">
              <span class="rt-avatar">${p.avatar}</span>
              <span class="rt-name">${p.name}</span>
            </div>
            <div class="rt-score-display" id="rt-score-${p.id}">0</div>
            <div class="rt-meter">
              <div class="rt-meter-fill" id="rt-fill-${p.id}" style="height: 0%"></div>
            </div>
            <div class="rt-tap-hint">TAP!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#rt-timer')!;

    // Multi-touch input listener
    this.container.querySelectorAll('.rt-zone').forEach(el => {
      const pId = parseInt(el.getAttribute('data-player-id') || '1', 10) as PlayerId;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP');
      });
    });
  }

  protected onStart(): void {
    this.timeLeft = 5.0;
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.timeLeft -= deltaTime;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.timerEl.textContent = '0.0s';
      this.finishGame();
      return;
    }

    this.timerEl.textContent = `${this.timeLeft.toFixed(1)}s`;
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'TAP' || !this.isRunning || this.isFinished) return;

    this.playerTaps[playerId] = (this.playerTaps[playerId] || 0) + 1;
    const taps = this.playerTaps[playerId];

    // Audio & haptic
    this.context.audio.playTap();
    this.context.haptics.light();

    // Visual feedback
    const scoreEl = this.container.querySelector(`#rt-score-${playerId}`);
    const fillEl = this.container.querySelector(`#rt-fill-${playerId}`) as HTMLElement;
    const zoneEl = this.container.querySelector(`[data-player-id="${playerId}"]`);

    if (scoreEl) scoreEl.textContent = taps.toString();
    if (fillEl) {
      // 50 taps is considered full scale
      const percent = Math.min(100, (taps / 40) * 100);
      fillEl.style.height = `${percent}%`;
    }
    if (zoneEl) {
      zoneEl.classList.remove('pulse');
      void (zoneEl as HTMLElement).offsetWidth; // trigger reflow
      zoneEl.classList.add('pulse');
    }
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playTone(330, 0.4, 'sawtooth');

    // Rank players by tap count
    const activePlayers = this.context.players;
    const sorted = [...activePlayers].sort(
      (a, b) => (this.playerTaps[b.id] ?? 0) - (this.playerTaps[a.id] ?? 0)
    );

    const winnerId =
      sorted.length > 1 && this.playerTaps[sorted[0].id] === this.playerTaps[sorted[1].id]
        ? 'TIE'
        : sorted[0].id;

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    activePlayers.forEach(p => {
      rawStats[p.id] = `${this.playerTaps[p.id]} taps`;
    });

    setTimeout(() => {
      this.finishWithResult({
        scores: { ...this.playerTaps },
        winnerId,
        rawStats
      });
    }, 1000);
  }
}
