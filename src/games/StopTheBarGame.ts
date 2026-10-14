import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface PlayerAttemptState {
  attemptsLeft: number;
  stopped: boolean;
  score: number;
  lastFeedback: string;
}

export class StopTheBarGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'stop-the-bar')!;

  private playerStates: Map<PlayerId, PlayerAttemptState> = new Map();
  private barPosition = 0; // 0 to 100
  private barDirection = 1;
  private barSpeed = 120; // percent per second
  private maxAttempts = 3;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.barSpeed = diff === 'EASY' ? 90 : diff === 'HARD' ? 160 : 120;
    this.barPosition = 0;
    this.barDirection = 1;

    this.playerStates.clear();
    players.forEach(p => {
      this.playerStates.set(p.id, {
        attemptsLeft: this.maxAttempts,
        stopped: false,
        score: 0,
        lastFeedback: 'Tap STOP!'
      });
    });

    this.container.className = 'game-screen stop-the-bar-game';
    this.container.innerHTML = `
      <div class="stb-hud">
        <div class="stb-title">🎯 Stop in the Bullseye!</div>
        <div class="stb-tip">3 Attempts • Center gives +10 pts</div>
      </div>

      <div class="stb-track-container">
        <div class="stb-track" id="stb-track">
          <div class="stb-zone-wide"></div>
          <div class="stb-zone-sweet"></div>
          <div class="stb-zone-bullseye"></div>
          <div class="stb-indicator" id="stb-indicator"></div>
        </div>
      </div>

      <div class="stb-player-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="stb-player-card" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="stb-player-info">
              <span class="stb-avatar">${p.avatar}</span>
              <span class="stb-name">${p.name}</span>
            </div>
            <div class="stb-score-badge" id="stb-score-${p.id}">0 pts</div>
            <div class="stb-attempts-dots" id="stb-dots-${p.id}">
              <span class="stb-dot active"></span>
              <span class="stb-dot active"></span>
              <span class="stb-dot active"></span>
            </div>
            <div class="stb-feedback" id="stb-feed-${p.id}">Ready</div>
            <button class="btn btn-primary stb-stop-btn" data-player-id="${p.id}" type="button">STOP! 🎯</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.container.querySelectorAll('.stb-stop-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        this.handleInput(pId, 'STOP');
      });
    });
  }

  protected onStart(): void {
    // Animation loop runs via update()
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.barPosition += this.barDirection * this.barSpeed * deltaTime;
    if (this.barPosition >= 100) {
      this.barPosition = 100;
      this.barDirection = -1;
    } else if (this.barPosition <= 0) {
      this.barPosition = 0;
      this.barDirection = 1;
    }

    const indicator = this.container.querySelector('#stb-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.left = `${this.barPosition}%`;
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished || action !== 'STOP') return;
    const state = this.playerStates.get(playerId);
    if (!state || state.attemptsLeft <= 0) return;

    const currentPos = this.barPosition;
    const distFromCenter = Math.abs(currentPos - 50);

    let roundPts = 0;
    let feedback = '';

    if (distFromCenter <= 3.5) {
      roundPts = 10;
      feedback = 'BULLSEYE! 🎯 +10';
      this.context.audio.playScore();
      this.context.haptics.heavy();
    } else if (distFromCenter <= 10) {
      roundPts = 6;
      feedback = 'GREAT! ✨ +6';
      this.context.audio.playSuccess();
      this.context.haptics.medium();
    } else if (distFromCenter <= 20) {
      roundPts = 3;
      feedback = 'GOOD! 👍 +3';
      this.context.audio.playTap();
      this.context.haptics.light();
    } else {
      roundPts = 0;
      feedback = 'MISSED! ❌ +0';
      this.context.audio.playError();
      this.context.haptics.light();
    }

    state.score += roundPts;
    state.attemptsLeft--;
    state.lastFeedback = feedback;

    // Update UI for player
    const scoreEl = this.container.querySelector(`#stb-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = `${state.score} pts`;

    const feedEl = this.container.querySelector(`#stb-feed-${playerId}`);
    if (feedEl) feedEl.textContent = feedback;

    const dotsEl = this.container.querySelector(`#stb-dots-${playerId}`);
    if (dotsEl) {
      const dots = dotsEl.querySelectorAll('.stb-dot');
      dots.forEach((dot, idx) => {
        if (idx >= state.attemptsLeft) dot.classList.remove('active');
      });
    }

    if (state.attemptsLeft <= 0) {
      const btn = this.container.querySelector(`.stb-stop-btn[data-player-id="${playerId}"]`) as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'DONE ✅';
        btn.classList.add('disabled');
      }
    }

    // Check if all players completed 3 attempts
    let allFinished = true;
    for (const s of this.playerStates.values()) {
      if (s.attemptsLeft > 0) {
        allFinished = false;
        break;
      }
    }

    if (allFinished) {
      setTimeout(() => this.concludeGame(), 600);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerStates.forEach((state, pId) => {
      scores[pId] = state.score;
    });

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({ scores, winnerId, rawStats: scores });
  }
}
