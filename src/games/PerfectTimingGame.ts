import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface PlayerTimingState {
  id: PlayerId;
  position: number; // 0 to 100
  direction: number; // 1 or -1
  speed: number;
  attemptsLeft: number;
  score: number;
  lastRating: 'PERFECT' | 'GOOD' | 'MISS' | null;
}

export class PerfectTimingGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'perfect-timing')!;

  private playerStates: Map<PlayerId, PlayerTimingState> = new Map();
  private maxAttempts = 3;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    const baseSpeed = diff === 'EASY' ? 90 : diff === 'HARD' ? 170 : 130;

    this.playerStates.clear();
    players.forEach((p, idx) => {
      this.playerStates.set(p.id, {
        id: p.id,
        position: (idx * 25) % 100,
        direction: idx % 2 === 0 ? 1 : -1,
        speed: baseSpeed + (Math.random() * 20 - 10),
        attemptsLeft: this.maxAttempts,
        score: 0,
        lastRating: null
      });
    });

    this.container.className = 'game-screen perfect-timing-game';
    this.container.innerHTML = `
      <div class="pt-hud">
        <div class="pt-title">TAP WHEN THE NEEDLE IS IN THE CENTER! 🎯</div>
        <div class="pt-subtitle">3 Attempts per Player</div>
      </div>

      <div class="pt-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="pt-player-zone" data-player-id="${p.id}" id="pt-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="pt-zone-header">
              <span class="pt-avatar">${p.avatar}</span>
              <span class="pt-name">${p.name}</span>
              <span class="pt-attempts" id="pt-att-${p.id}">3/3 Left</span>
              <span class="pt-score" id="pt-score-${p.id}">0 pts</span>
            </div>

            <div class="pt-track-wrapper">
              <div class="pt-track">
                <div class="pt-zone-miss-left"></div>
                <div class="pt-zone-good"></div>
                <div class="pt-zone-perfect"></div>
                <div class="pt-zone-good"></div>
                <div class="pt-zone-miss-right"></div>
                <div class="pt-needle" id="pt-needle-${p.id}" style="left: 0%"></div>
              </div>
            </div>

            <div class="pt-feedback" id="pt-feedback-${p.id}">READY</div>
            <button class="pt-tap-btn" id="pt-btn-${p.id}" type="button">TAP NOW! 🎯</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Touch & pointer handlers
    this.container.querySelectorAll('.pt-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP');
      });
    });
  }

  protected onStart(): void {
    // Game loop running
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.playerStates.forEach(state => {
      if (state.attemptsLeft <= 0) return;

      state.position += state.direction * state.speed * deltaTime;

      if (state.position >= 100) {
        state.position = 100;
        state.direction = -1;
      } else if (state.position <= 0) {
        state.position = 0;
        state.direction = 1;
      }

      const needle = this.container.querySelector(`#pt-needle-${state.id}`) as HTMLElement;
      if (needle) {
        needle.style.left = `${state.position}%`;
      }
    });
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'TAP' || !this.isRunning || this.isFinished) return;

    const state = this.playerStates.get(playerId);
    if (!state || state.attemptsLeft <= 0) return;

    state.attemptsLeft--;

    // Evaluate accuracy: center is 50
    const distance = Math.abs(state.position - 50);
    const feedbackEl = this.container.querySelector(`#pt-feedback-${playerId}`);
    const scoreEl = this.container.querySelector(`#pt-score-${playerId}`);
    const attEl = this.container.querySelector(`#pt-att-${playerId}`);
    const btnEl = this.container.querySelector(`#pt-btn-${playerId}`);

    if (distance <= 6) {
      // PERFECT
      state.score += 30;
      state.lastRating = 'PERFECT';
      this.context.audio.playSuccess();
      this.context.haptics.heavy();
      if (feedbackEl) {
        feedbackEl.textContent = 'PERFECT! 🎯 (+30)';
        feedbackEl.className = 'pt-feedback fb-perfect';
      }
    } else if (distance <= 16) {
      // GOOD
      state.score += 15;
      state.lastRating = 'GOOD';
      this.context.audio.playTap();
      this.context.haptics.medium();
      if (feedbackEl) {
        feedbackEl.textContent = 'GOOD! 👍 (+15)';
        feedbackEl.className = 'pt-feedback fb-good';
      }
    } else {
      // MISS
      state.lastRating = 'MISS';
      this.context.audio.playError();
      this.context.haptics.error();
      if (feedbackEl) {
        feedbackEl.textContent = 'MISS! ❌ (+0)';
        feedbackEl.className = 'pt-feedback fb-miss';
      }
    }

    if (scoreEl) scoreEl.textContent = `${state.score} pts`;
    if (attEl) attEl.textContent = `${state.attemptsLeft}/${this.maxAttempts} Left`;

    if (state.attemptsLeft <= 0 && btnEl) {
      btnEl.textContent = 'DONE! ✅';
      (btnEl as HTMLElement).style.opacity = '0.5';
    }

    // Check if all players completed their attempts
    let allDone = true;
    this.playerStates.forEach(s => {
      if (s.attemptsLeft > 0) allDone = false;
    });

    if (allDone) {
      this.finishGame();
    }
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.playerStates.forEach(s => {
      scores[s.id] = s.score;
      rawStats[s.id] = `${s.score} pts (${this.maxAttempts - s.attemptsLeft} hits)`;
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
    }, 1200);
  }
}
