import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface PlayerBridgeState {
  currentRow: number;
  completed: boolean;
  score: number;
}

export class SafeTileGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'safe-tile')!;

  private totalRows = 4;
  private safePath: number[] = []; // Column index (0, 1, or 2) for each row
  private playerStates: Map<PlayerId, PlayerBridgeState> = new Map();
  private timeLeft = 22;
  private timerIntervalId: number | null = null;
  private previewTimeoutId: number | null = null;
  private timerEl!: HTMLElement;
  private isPreviewPhase = true;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.totalRows = diff === 'EASY' ? 3 : diff === 'HARD' ? 5 : 4;
    this.timeLeft = 22;
    this.isPreviewPhase = true;

    // Generate random safe column (0, 1, or 2) for each row
    this.safePath = [];
    for (let r = 0; r < this.totalRows; r++) {
      this.safePath.push(Math.floor(Math.random() * 3));
    }

    this.playerStates.clear();
    players.forEach(p => {
      this.playerStates.set(p.id, {
        currentRow: 0,
        completed: false,
        score: 0
      });
    });

    this.container.className = 'game-screen safe-tile-game';
    this.container.innerHTML = `
      <div class="st-hud">
        <div class="hud-timer" id="st-timer">👀 Memorize Safe Path!</div>
        <div class="hud-tip">Step on green tiles • Avoid traps!</div>
      </div>
      <div class="st-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="st-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="st-zone-header">
              <span class="st-avatar">${p.avatar}</span>
              <span class="st-name">${p.name}</span>
              <span class="st-progress" id="st-prog-${p.id}">Row 0 / ${this.totalRows}</span>
            </div>
            <div class="st-bridge-grid" id="st-grid-${p.id}">
              ${Array.from({ length: this.totalRows }, (_, rIdx) => {
                const row = this.totalRows - 1 - rIdx; // Display top to bottom
                return `
                <div class="st-bridge-row" data-row="${row}">
                  ${[0, 1, 2]
                    .map(
                      col => `
                    <button class="st-tile" data-player-id="${p.id}" data-row="${row}" data-col="${col}" type="button">
                      ⬜
                    </button>
                  `
                    )
                    .join('')}
                </div>
              `;
              }).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#st-timer')!;

    // Attach click handlers
    this.container.querySelectorAll('.st-tile').forEach(tileBtn => {
      tileBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (this.isPreviewPhase) return;
        const pId = parseInt(tileBtn.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const row = parseInt(tileBtn.getAttribute('data-row') || '0', 10);
        const col = parseInt(tileBtn.getAttribute('data-col') || '0', 10);
        this.handleInput(pId, 'STEP', { row, col, button: tileBtn as HTMLButtonElement });
      });
    });
  }

  protected onStart(): void {
    // Show preview of safe path
    this.flashPreview(true);

    this.previewTimeoutId = window.setTimeout(() => {
      this.flashPreview(false);
      this.isPreviewPhase = false;
      if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s - CROSS NOW!`;

      this.timerIntervalId = window.setInterval(() => {
        this.timeLeft--;
        if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s`;

        if (this.timeLeft <= 0) {
          this.concludeGame();
        }
      }, 1000);
    }, 2400);
  }

  private flashPreview(show: boolean): void {
    for (let r = 0; r < this.totalRows; r++) {
      const safeCol = this.safePath[r];
      this.container.querySelectorAll(`.st-tile[data-row="${r}"][data-col="${safeCol}"]`).forEach(el => {
        if (show) {
          el.classList.add('safe-preview');
          el.textContent = '🟩';
        } else {
          el.classList.remove('safe-preview');
          el.textContent = '⬜';
        }
      });
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || this.isPreviewPhase || action !== 'STEP') return;
    const state = this.playerStates.get(playerId);
    if (!state || state.completed) return;

    const { row, col, button } = data as { row: number; col: number; button: HTMLButtonElement };

    // Must step on the current required row
    if (row !== state.currentRow) {
      return;
    }

    const expectedCol = this.safePath[row];
    if (col === expectedCol) {
      // Safe tile!
      button.classList.add('stepped-safe');
      button.textContent = '🟩';
      state.currentRow++;
      state.score += 3;
      this.context.audio.playPop();
      this.context.haptics.light();

      const prog = this.container.querySelector(`#st-prog-${playerId}`);
      if (prog) {
        prog.textContent = `Row ${state.currentRow} / ${this.totalRows}`;
      }

      if (state.currentRow >= this.totalRows) {
        state.completed = true;
        state.score += 5; // Finish bonus
        this.context.audio.playSuccess();
        this.context.haptics.heavy();
        if (prog) prog.textContent = `SAFE! 🏆`;

        setTimeout(() => this.concludeGame(), 600);
      }
    } else {
      // Trap tile! Fall down and reset
      button.classList.add('stepped-trap');
      button.textContent = '💥';
      this.context.audio.playError();
      this.context.haptics.heavy();

      // Reset row progress for this player
      state.currentRow = 0;
      const prog = this.container.querySelector(`#st-prog-${playerId}`);
      if (prog) prog.textContent = `FALL! Reset! ❌`;

      setTimeout(() => {
        this.container
          .querySelectorAll(`.st-tile[data-player-id="${playerId}"]`)
          .forEach(t => {
            t.classList.remove('stepped-safe', 'stepped-trap');
            t.textContent = '⬜';
          });
        if (prog) prog.textContent = `Row 0 / ${this.totalRows}`;
      }, 500);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.previewTimeoutId) {
      clearTimeout(this.previewTimeoutId);
      this.previewTimeoutId = null;
    }

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

  protected onDestroy(): void {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    if (this.previewTimeoutId) clearTimeout(this.previewTimeoutId);
  }
}
