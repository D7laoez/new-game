import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface MathProblem {
  equation: string;
  answer: number;
  options: number[];
}

export class QuickMathGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'quick-math')!;

  private currentProblem!: MathProblem;
  private roundCount = 0;
  private maxRounds = 5;
  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private firstCorrectPlayer: PlayerId | null = null;
  private playersAnswered: Set<PlayerId> = new Set();
  private roundTimerId: number | null = null;

  private eqDisplayEl!: HTMLElement;
  private roundTagEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxRounds = diff === 'EASY' ? 4 : diff === 'HARD' ? 6 : 5;
    this.roundCount = 0;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };

    this.container.className = 'game-screen quick-math-game';
    this.container.innerHTML = `
      <div class="qm-hud">
        <div class="qm-round-tag" id="qm-round-tag">Question 1 / ${this.maxRounds}</div>
        <div class="qm-equation-card" id="qm-equation-card">
          <span class="qm-eq-text" id="qm-eq-text">...</span>
        </div>
      </div>

      <div class="qm-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="qm-player-zone" data-player-id="${p.id}" id="qm-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="qm-player-header">
              <span class="qm-avatar">${p.avatar}</span>
              <span class="qm-name">${p.name}</span>
              <span class="qm-score" id="qm-score-${p.id}">0 pts</span>
            </div>
            <div class="qm-options-grid" id="qm-opts-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.eqDisplayEl = this.container.querySelector('#qm-eq-text')!;
    this.roundTagEl = this.container.querySelector('#qm-round-tag')!;
  }

  protected onStart(): void {
    this.nextQuestion();
  }

  private generateProblem(): MathProblem {
    const diff = this.context.difficulty || 'NORMAL';
    let a = 0;
    let b = 0;
    let ans = 0;
    let op = '+';

    const ops = diff === 'EASY' ? ['+', '-'] : diff === 'HARD' ? ['+', '-', '×', '÷'] : ['+', '-', '×'];
    op = ops[Math.floor(Math.random() * ops.length)];

    if (op === '+') {
      a = Math.floor(Math.random() * 15) + 2;
      b = Math.floor(Math.random() * 15) + 2;
      ans = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 18) + 6;
      b = Math.floor(Math.random() * (a - 1)) + 1;
      ans = a - b;
    } else if (op === '×') {
      a = Math.floor(Math.random() * 8) + 2;
      b = Math.floor(Math.random() * 7) + 2;
      ans = a * b;
    } else {
      // Division
      b = Math.floor(Math.random() * 6) + 2;
      ans = Math.floor(Math.random() * 7) + 2;
      a = b * ans;
    }

    // Generate 3 wrong options
    const wrongSet = new Set<number>();
    while (wrongSet.size < 3) {
      const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 4) + 1);
      const wrong = Math.max(0, ans + delta);
      if (wrong !== ans) wrongSet.add(wrong);
    }

    const options = [ans, ...Array.from(wrongSet)];
    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      equation: `${a} ${op} ${b} = ?`,
      answer: ans,
      options
    };
  }

  private nextQuestion(): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.roundCount >= this.maxRounds) {
      this.finishGame();
      return;
    }

    this.roundCount++;
    this.playersAnswered.clear();
    this.firstCorrectPlayer = null;

    if (this.roundTagEl) {
      this.roundTagEl.textContent = `Question ${this.roundCount} / ${this.maxRounds}`;
    }

    this.currentProblem = this.generateProblem();
    if (this.eqDisplayEl) {
      this.eqDisplayEl.textContent = this.currentProblem.equation;
    }

    this.context.audio.playTone(480, 0.1, 'sine');

    // Populate buttons for each player
    this.context.players.forEach(p => {
      const optsEl = this.container.querySelector(`#qm-opts-${p.id}`);
      if (optsEl) {
        optsEl.innerHTML = this.currentProblem.options
          .map(
            opt => `
          <button class="qm-opt-btn" data-val="${opt}" type="button">${opt}</button>
        `
          )
          .join('');

        optsEl.querySelectorAll('.qm-opt-btn').forEach(btn => {
          btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            const val = parseInt(btn.getAttribute('data-val') || '0', 10);
            this.handleInput(p.id, 'ANSWER', val);
          });
        });
      }
    });

    // Auto proceed if no one answers within 5 seconds
    this.roundTimerId = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      this.nextQuestion();
    }, 4500);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'ANSWER' || !this.isRunning || this.isFinished) return;
    if (this.playersAnswered.has(playerId)) return;

    this.playersAnswered.add(playerId);
    const chosenVal = data as number;
    const isCorrect = chosenVal === this.currentProblem.answer;

    const scoreEl = this.container.querySelector(`#qm-score-${playerId}`);
    const zoneEl = this.container.querySelector(`#qm-zone-${playerId}`);

    if (isCorrect) {
      let pts = 15;
      if (!this.firstCorrectPlayer) {
        this.firstCorrectPlayer = playerId;
        pts += 10; // Speed bonus
        this.context.audio.playSuccess();
        this.context.haptics.heavy();
      } else {
        this.context.audio.playTap();
        this.context.haptics.medium();
      }
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
      if (zoneEl) {
        zoneEl.classList.add('pop-green');
        setTimeout(() => zoneEl.classList.remove('pop-green'), 300);
      }
    } else {
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 5);
      this.context.audio.playError();
      this.context.haptics.error();
      if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
      if (zoneEl) {
        zoneEl.classList.add('pop-red');
        setTimeout(() => zoneEl.classList.remove('pop-red'), 300);
      }
    }

    // If all players answered, advance immediately
    if (this.playersAnswered.size >= this.context.players.length) {
      if (this.roundTimerId !== null) {
        clearTimeout(this.roundTimerId);
        this.roundTimerId = null;
      }
      setTimeout(() => this.nextQuestion(), 400);
    }
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.context.players.forEach(p => {
      scores[p.id] = this.playerScores[p.id] || 0;
      rawStats[p.id] = `${this.playerScores[p.id] || 0} pts`;
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

  protected onDestroy(): void {
    if (this.roundTimerId !== null) {
      clearTimeout(this.roundTimerId);
      this.roundTimerId = null;
    }
  }
}
