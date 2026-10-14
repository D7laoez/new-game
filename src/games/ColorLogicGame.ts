import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface ColorDef {
  name: string;
  nameAr: string;
  css: string;
}

const COLORS: ColorDef[] = [
  { name: 'RED', nameAr: 'أحمر', css: '#ef4444' },
  { name: 'BLUE', nameAr: 'أزرق', css: '#3b82f6' },
  { name: 'GREEN', nameAr: 'أخضر', css: '#10b981' },
  { name: 'YELLOW', nameAr: 'أصفر', css: '#f59e0b' }
];

interface StroopPrompt {
  wordText: string;
  inkColor: ColorDef;
}

export class ColorLogicGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'color-logic')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerPrompts: Map<PlayerId, StroopPrompt> = new Map();
  private playerRounds: Map<PlayerId, number> = new Map();
  private timeLeft = 25;
  private readonly targetRounds = 8;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerPrompts.clear();
    this.playerRounds.clear();
    this.timeLeft = 25;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerRounds.set(p.id, 0);
      this.generatePromptForPlayer(p.id);
    });

    this.container.className = 'game-screen color-logic-game';
    this.container.innerHTML = `
      <div class="cl-hud">
        <div class="hud-timer" id="cl-timer">25.0s</div>
        <div class="hud-tip">STROP EFFECT: Tap the font INK color, NOT the word! 🎨</div>
      </div>
      <div class="cl-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="cl-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="cl-zone-header">
              <span class="cl-avatar">${p.avatar}</span>
              <span class="cl-name">${p.name}</span>
              <span class="cl-score" id="cl-score-${p.id}">0 pts (0/${this.targetRounds})</span>
            </div>
            <div class="cl-word-box" id="cl-word-${p.id}">...</div>
            <div class="cl-buttons-grid">
              ${COLORS.map(
                c => `
                <button class="cl-btn" data-color="${c.name}" style="--c-bg: ${c.css};">
                  ${c.name}
                </button>
              `
              ).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#cl-timer')!;

    players.forEach(p => {
      this.renderPlayerPrompt(p.id);

      const zone = this.container.querySelector(`[data-player-id="${p.id}"]`);
      zone?.querySelectorAll('.cl-btn').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          const colorName = btn.getAttribute('data-color') || '';
          this.handleInput(p.id, 'TAP_COLOR', { color: colorName });
        });
      });
    });
  }

  private generatePromptForPlayer(playerId: PlayerId): void {
    // Pick word and ink color ensuring mismatch most of the time for true Stroop effect
    const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    let inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    // 80% chance to be mismatch
    if (Math.random() < 0.8) {
      while (inkColor.name === wordColor.name) {
        inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
    }

    this.playerPrompts.set(playerId, {
      wordText: wordColor.name,
      inkColor
    });
  }

  private renderPlayerPrompt(playerId: PlayerId): void {
    const prompt = this.playerPrompts.get(playerId);
    const wordEl = this.container.querySelector(`#cl-word-${playerId}`) as HTMLElement;
    if (!prompt || !wordEl) return;

    wordEl.textContent = prompt.wordText;
    wordEl.style.color = prompt.inkColor.css;
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
    if (!this.isRunning || this.isFinished || action !== 'TAP_COLOR') return;
    const prompt = this.playerPrompts.get(playerId);
    const roundCount = this.playerRounds.get(playerId) || 0;
    if (!prompt || roundCount >= this.targetRounds) return;

    const { color } = (data as { color: string }) || { color: '' };
    const isCorrect = color === prompt.inkColor.name;
    const wordEl = this.container.querySelector(`#cl-word-${playerId}`) as HTMLElement;

    if (isCorrect) {
      const newRound = roundCount + 1;
      this.playerRounds.set(playerId, newRound);
      this.playerScores[playerId] += 10;

      this.context.audio.playSuccess();
      this.context.haptics.light();

      if (wordEl) {
        wordEl.classList.add('flash-correct');
        this.setGameTimeout(() => wordEl.classList.remove('flash-correct'), 200);
      }

      const scoreEl = this.container.querySelector(`#cl-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${newRound}/${this.targetRounds})`;
      }

      if (newRound >= this.targetRounds) {
        const allDone = this.context.players.every(p => (this.playerRounds.get(p.id) || 0) >= this.targetRounds);
        if (allDone) {
          this.setGameTimeout(() => this.concludeGame(), 400);
        }
      } else {
        this.generatePromptForPlayer(playerId);
        this.renderPlayerPrompt(playerId);
      }
    } else {
      // Wrong ink color selected
      this.playerScores[playerId] = Math.max(0, this.playerScores[playerId] - 2);
      this.context.audio.playError();
      this.context.haptics.error();

      if (wordEl) {
        wordEl.classList.add('flash-wrong');
        this.setGameTimeout(() => wordEl.classList.remove('flash-wrong'), 250);
      }

      const scoreEl = this.container.querySelector(`#cl-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${roundCount}/${this.targetRounds})`;
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
      rawStats[p.id] = `${this.playerRounds.get(p.id) || 0} rounds (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
