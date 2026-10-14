import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type SignalState = 'IDLE' | 'FORBIDDEN' | 'WAITING' | 'PRESS_NOW';

export class DontPressItGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'dont-press-it')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private roundCount = 0;
  private maxRounds = 4;
  private signalState: SignalState = 'IDLE';
  private roundTimeoutIds: number[] = [];
  private roundOrder: PlayerId[] = [];
  private roundDisqualified: Set<PlayerId> = new Set();
  private signalStartTime = 0;

  private bannerEl!: HTMLElement;
  private roundTagEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.roundCount = 0;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.roundDisqualified.clear();

    this.container.className = 'game-screen dont-press-game';
    this.container.innerHTML = `
      <div class="dp-hud">
        <div class="hud-timer" id="dp-round-tag">Round 1 / ${this.maxRounds}</div>
        <div class="dp-signal-banner state-idle" id="dp-signal-banner">
          <span class="dp-icon" id="dp-icon">🛑</span>
          <h2 class="dp-text" id="dp-text">Get Ready...</h2>
        </div>
      </div>
      <div class="dp-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="dp-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="dp-zone-header">
              <span class="dp-avatar">${p.avatar}</span>
              <span class="dp-name">${p.name}</span>
              <span class="dp-score" id="dp-score-${p.id}">0 pts</span>
            </div>
            <button class="dp-buzzer-btn" data-player-id="${p.id}" type="button">
              <span class="buzzer-cap">SMASH! 💥</span>
            </button>
            <div class="dp-status" id="dp-status-${p.id}">Ready</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.bannerEl = this.container.querySelector('#dp-signal-banner')!;
    this.roundTagEl = this.container.querySelector('#dp-round-tag')!;

    this.container.querySelectorAll('.dp-buzzer-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        this.handleInput(pId, 'PRESS');
      });
    });
  }

  protected onStart(): void {
    this.startNextRoundSequence();
  }

  private setBanner(state: SignalState, icon: string, text: string): void {
    this.signalState = state;
    if (this.bannerEl) {
      this.bannerEl.className = `dp-signal-banner state-${state.toLowerCase()}`;
      const iconEl = this.bannerEl.querySelector('#dp-icon');
      const textEl = this.bannerEl.querySelector('#dp-text');
      if (iconEl) iconEl.textContent = icon;
      if (textEl) textEl.textContent = text;
    }
  }

  private startNextRoundSequence(): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.roundCount >= this.maxRounds) {
      this.concludeGame();
      return;
    }

    this.roundCount++;
    this.roundOrder = [];
    this.roundDisqualified.clear();

    if (this.roundTagEl) {
      this.roundTagEl.textContent = `Round ${this.roundCount} / ${this.maxRounds}`;
    }

    // Reset status labels
    this.context.players.forEach(p => {
      const statusEl = this.container.querySelector(`#dp-status-${p.id}`);
      if (statusEl) {
        statusEl.textContent = 'Ready';
        statusEl.className = 'dp-status';
      }
    });

    this.setBanner('IDLE', '⏳', 'Get Ready...');

    // Phase 1: Forbidden prompt after 1s
    const t1 = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      this.setBanner('FORBIDDEN', '🛑', "DON'T PRESS!");
      this.context.audio.playTone(250, 0.15, 'sawtooth');

      // Phase 2: Teasing 'WAIT...' prompt after 1.5s
      const t2 = window.setTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.setBanner('WAITING', '⚠️', 'WAIT FOR IT...');
        this.context.audio.playTone(330, 0.1, 'triangle');

        // Phase 3: Sudden random green flash after 1.2 to 2.8s
        const randomDelay = 1200 + Math.random() * 1600;
        const t3 = window.setTimeout(() => {
          if (!this.isRunning || this.isFinished) return;
          this.setBanner('PRESS_NOW', '⚡', 'PRESS NOW!!!');
          this.signalStartTime = Date.now();
          this.context.audio.playStart();
          this.context.haptics.heavy();

          // Auto conclude round after 2.5s if not all pressed
          const t4 = window.setTimeout(() => {
            this.startNextRoundSequence();
          }, 2500);
          this.roundTimeoutIds.push(t4);
        }, randomDelay);

        this.roundTimeoutIds.push(t3);
      }, 1500);

      this.roundTimeoutIds.push(t2);
    }, 1000);

    this.roundTimeoutIds.push(t1);
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'PRESS') return;

    const statusEl = this.container.querySelector(`#dp-status-${playerId}`);

    if (this.signalState === 'PRESS_NOW') {
      if (this.roundOrder.includes(playerId) || this.roundDisqualified.has(playerId)) return;

      this.roundOrder.push(playerId);
      const pos = this.roundOrder.length;
      let pts = 1;
      if (pos === 1) pts = 10;
      else if (pos === 2) pts = 6;
      else if (pos === 3) pts = 3;

      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
      this.context.audio.playSuccess();
      this.context.haptics.medium();

      if (statusEl) {
        statusEl.textContent = `#${pos} (+${pts} pts)`;
        statusEl.className = 'dp-status winner';
      }

      const scoreEl = this.container.querySelector(`#dp-score-${playerId}`);
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

      // If all qualified players responded, go to next round
      const eligibleCount = this.context.players.length - this.roundDisqualified.size;
      if (this.roundOrder.length >= eligibleCount) {
        this.clearAllTimers();
        const nextTimer = window.setTimeout(() => this.startNextRoundSequence(), 1000);
        this.roundTimeoutIds.push(nextTimer);
      }
    } else {
      // Pressed too early! Disqualified this round & penalty
      if (this.roundDisqualified.has(playerId)) return;
      this.roundDisqualified.add(playerId);

      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 3);
      this.context.audio.playError();
      this.context.haptics.heavy();

      if (statusEl) {
        statusEl.textContent = 'EARLY! -3 pts ❌';
        statusEl.className = 'dp-status disqualified';
      }

      const scoreEl = this.container.querySelector(`#dp-score-${playerId}`);
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    this.clearRoundTimers();

    const players = this.context.players;
    const sorted = [...players].sort(
      (a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0)
    );

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

  private clearRoundTimers(): void {
    this.roundTimeoutIds.forEach(id => clearTimeout(id));
    this.roundTimeoutIds = [];
  }

  protected onDestroy(): void {
    this.clearRoundTimers();
  }
}
