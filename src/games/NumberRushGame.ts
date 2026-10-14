import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface PlayerRushState {
  currentTarget: number;
  completed: boolean;
  isPenalized: boolean;
  score: number;
  finishTime: number;
}

export class NumberRushGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'number-rush')!;

  private playerStates: Map<PlayerId, PlayerRushState> = new Map();
  private maxNumber = 12;
  private timeLeft = 20;
  private timerIntervalId: number | null = null;
  private timerEl!: HTMLElement;
  private startTime = 0;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxNumber = diff === 'EASY' ? 9 : diff === 'HARD' ? 16 : 12;
    this.timeLeft = 20;
    this.playerStates.clear();

    players.forEach(p => {
      this.playerStates.set(p.id, {
        currentTarget: 1,
        completed: false,
        isPenalized: false,
        score: 0,
        finishTime: 0
      });
    });

    this.container.className = 'game-screen number-rush-game';
    this.container.innerHTML = `
      <div class="nr-hud">
        <div class="hud-timer" id="nr-timer">⏱️ 20s</div>
        <div class="hud-tip">Tap 1 ➔ ${this.maxNumber} in ascending order!</div>
      </div>
      <div class="nr-arena player-grid-${players.length}">
        ${players
          .map(p => {
            // Shuffle 1 to maxNumber
            const nums = Array.from({ length: this.maxNumber }, (_, i) => i + 1);
            nums.sort(() => Math.random() - 0.5);

            return `
            <div class="nr-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
              <div class="nr-zone-header">
                <span class="nr-avatar">${p.avatar}</span>
                <span class="nr-name">${p.name}</span>
                <span class="nr-target-badge" id="nr-target-${p.id}">Find: 1</span>
              </div>
              <div class="nr-number-grid">
                ${nums
                  .map(
                    n => `
                  <button class="nr-num-btn" data-player-id="${p.id}" data-num="${n}" type="button">
                    ${n}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#nr-timer')!;

    this.container.querySelectorAll('.nr-num-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const pId = parseInt(btn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const num = parseInt(btn.getAttribute('data-num') || '0', 10);
        this.handleInput(pId, 'TAP_NUM', { num, button: btn as HTMLButtonElement });
      });
    });
  }

  protected onStart(): void {
    this.startTime = Date.now();
    this.timerIntervalId = window.setInterval(() => {
      this.timeLeft--;
      if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 1000);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'TAP_NUM') return;
    const state = this.playerStates.get(playerId);
    if (!state || state.completed || state.isPenalized) return;

    const { num, button } = data as { num: number; button: HTMLButtonElement };

    if (num === state.currentTarget) {
      // Correct!
      state.score += 1;
      state.currentTarget++;
      button.classList.add('correct');
      button.disabled = true;
      this.context.audio.playPop();
      this.context.haptics.light();

      const targetBadge = this.container.querySelector(`#nr-target-${playerId}`);
      if (targetBadge) {
        if (state.currentTarget <= this.maxNumber) {
          targetBadge.textContent = `Find: ${state.currentTarget}`;
        } else {
          targetBadge.textContent = `DONE! 🎉`;
          targetBadge.classList.add('finished');
        }
      }

      if (state.currentTarget > this.maxNumber) {
        state.completed = true;
        state.finishTime = Date.now() - this.startTime;
        this.context.audio.playSuccess();
        this.context.haptics.heavy();

        // Check if all players completed
        let allDone = true;
        for (const s of this.playerStates.values()) {
          if (!s.completed) {
            allDone = false;
            break;
          }
        }
        if (allDone) {
          setTimeout(() => this.concludeGame(), 400);
        }
      }
    } else {
      // Wrong tap! Penalty
      state.isPenalized = true;
      button.classList.add('wrong');
      this.context.audio.playError();
      this.context.haptics.medium();

      setTimeout(() => {
        button.classList.remove('wrong');
        state.isPenalized = false;
      }, 400);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    this.playerStates.forEach((state, pId) => {
      // Points based on numbers cleared + bonus for fast finish
      let pts = state.score;
      if (state.completed) {
        const bonus = Math.max(0, Math.round((20000 - state.finishTime) / 1000));
        pts += bonus;
      }
      scores[pId] = pts;
      rawStats[pId] = state.score;
    });

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({ scores, winnerId, rawStats });
  }

  protected onDestroy(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }
}
