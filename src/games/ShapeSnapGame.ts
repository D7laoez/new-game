import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const SHAPES = ['⭐', '🔺', '🔷', '🟡', '💖', '🍀'];

export class ShapeSnapGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'shape-snap')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private shapeLeft = '⭐';
  private shapeRight = '🔷';
  private isMatch = false;
  private matchesFound = 0;
  private maxMatches = 5;
  private cycleTimeoutId: number | null = null;
  private snapAwardedThisMatch = false;

  private cardLeftEl!: HTMLElement;
  private cardRightEl!: HTMLElement;
  private roundTagEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.matchesFound = 0;
    this.snapAwardedThisMatch = false;

    this.container.className = 'game-screen shape-snap-game';
    this.container.innerHTML = `
      <div class="ss-hud">
        <div class="hud-timer" id="ss-round-tag">Matches: 0 / ${this.maxMatches}</div>
        <div class="hud-tip">When both cards MATCH, smash SNAP! False snap = -3 pts!</div>
      </div>

      <div class="ss-duel-cards">
        <div class="ss-card ss-card-left" id="ss-card-left">⭐</div>
        <div class="ss-card-vs">VS</div>
        <div class="ss-card ss-card-right" id="ss-card-right">🔷</div>
      </div>

      <div class="ss-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ss-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="ss-zone-header">
              <span class="ss-avatar">${p.avatar}</span>
              <span class="ss-name">${p.name}</span>
              <span class="ss-score" id="ss-score-${p.id}">0 pts</span>
            </div>
            <button class="ss-snap-btn" data-player-id="${p.id}" type="button">
              SNAP! ⚡
            </button>
            <div class="ss-feedback" id="ss-feed-${p.id}">Ready</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.cardLeftEl = this.container.querySelector('#ss-card-left')!;
    this.cardRightEl = this.container.querySelector('#ss-card-right')!;
    this.roundTagEl = this.container.querySelector('#ss-round-tag')!;

    this.container.querySelectorAll('.ss-snap-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        this.handleInput(pId, 'SNAP');
      });
    });
  }

  protected onStart(): void {
    this.cycleCards();
  }

  private cycleCards(): void {
    if (!this.isRunning || this.isFinished) return;

    this.snapAwardedThisMatch = false;

    // 35% chance to generate a matching pair
    const willMatch = Math.random() < 0.35;

    if (willMatch) {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      this.shapeLeft = shape;
      this.shapeRight = shape;
      this.isMatch = true;
    } else {
      const idx1 = Math.floor(Math.random() * SHAPES.length);
      let idx2 = Math.floor(Math.random() * SHAPES.length);
      while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * SHAPES.length);
      }
      this.shapeLeft = SHAPES[idx1];
      this.shapeRight = SHAPES[idx2];
      this.isMatch = false;
    }

    if (this.cardLeftEl && this.cardRightEl) {
      this.cardLeftEl.textContent = this.shapeLeft;
      this.cardRightEl.textContent = this.shapeRight;

      if (this.isMatch) {
        this.cardLeftEl.classList.add('pulse-match');
        this.cardRightEl.classList.add('pulse-match');
      } else {
        this.cardLeftEl.classList.remove('pulse-match');
        this.cardRightEl.classList.remove('pulse-match');
      }
    }

    this.context.audio.playTone(400, 0.05);

    // Dwell duration: matches stay slightly longer (1200ms) than non-matches (850ms)
    const dwell = this.isMatch ? 1300 : 900;
    this.cycleTimeoutId = window.setTimeout(() => {
      this.cycleCards();
    }, dwell);
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'SNAP') return;

    const feedEl = this.container.querySelector(`#ss-feed-${playerId}`);
    const scoreEl = this.container.querySelector(`#ss-score-${playerId}`);

    if (this.isMatch) {
      if (this.snapAwardedThisMatch) return;
      this.snapAwardedThisMatch = true;

      // Winner of this snap!
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 5;
      this.matchesFound++;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      if (feedEl) {
        feedEl.textContent = 'MATCH! +5 pts 🔥';
        feedEl.className = 'ss-feedback match';
      }
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

      if (this.roundTagEl) {
        this.roundTagEl.textContent = `Matches: ${this.matchesFound} / ${this.maxMatches}`;
      }

      if (this.matchesFound >= this.maxMatches) {
        setTimeout(() => this.concludeGame(), 500);
      } else {
        // Next card cycle shortly
        if (this.cycleTimeoutId) clearTimeout(this.cycleTimeoutId);
        this.cycleTimeoutId = window.setTimeout(() => this.cycleCards(), 400);
      }
    } else {
      // False snap! Penalty
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 3);
      this.context.audio.playError();
      this.context.haptics.heavy();

      if (feedEl) {
        feedEl.textContent = 'FALSE SNAP! -3 pts ❌';
        feedEl.className = 'ss-feedback false-snap';
      }
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

      setTimeout(() => {
        if (feedEl && feedEl.classList.contains('false-snap')) {
          feedEl.textContent = 'Ready';
          feedEl.className = 'ss-feedback';
        }
      }, 500);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.cycleTimeoutId) {
      clearTimeout(this.cycleTimeoutId);
      this.cycleTimeoutId = null;
    }

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

  protected onDestroy(): void {
    if (this.cycleTimeoutId) {
      clearTimeout(this.cycleTimeoutId);
      this.cycleTimeoutId = null;
    }
  }
}
