import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface MathQuestion {
  prompt: string;
  options: number[];
  answer: number;
}

export class SumSprintGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'sum-sprint')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerQuestionIndex: Map<PlayerId, number> = new Map();
  private questions: MathQuestion[] = [];
  private totalQuestions = 8;
  private gameTime = 0;
  private maxDuration = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerQuestionIndex.clear();
    this.gameTime = 0;

    // Generate questions pool
    this.questions = [];
    for (let i = 0; i < this.totalQuestions; i++) {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const ans = a + b;
      const wrong1 = ans + (Math.random() < 0.5 ? -2 : 2);
      const wrong2 = ans + (Math.random() < 0.5 ? -4 : 3);
      const options = [ans, wrong1, wrong2].sort(() => Math.random() - 0.5);
      this.questions.push({
        prompt: `${a} + ${b} = ?`,
        options,
        answer: ans
      });
    }

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerQuestionIndex.set(p.id, 0);
    });

    this.container.className = 'game-screen sum-sprint-game';
    this.container.innerHTML = `
      <div class="ssp-hud">
        <div class="ssp-timer" id="ssp-timer">20.0s</div>
        <div class="ssp-title">SUM SPRINT ➕</div>
      </div>
      <div class="ssp-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ssp-player-desk" id="ssp-desk-${p.id}" style="--p-col: ${p.color}">
            <div class="ssp-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ssp-score" id="ssp-score-${p.id}">0 pts</span>
            </div>
            <div class="ssp-question-box" id="ssp-q-${p.id}">${this.questions[0].prompt}</div>
            <div class="ssp-options-grid" id="ssp-opts-${p.id}">
              ${this.questions[0].options
                .map(
                  opt => `
                <button class="ssp-opt-btn" data-player="${p.id}" data-val="${opt}">${opt}</button>
              `
                )
                .join('')}
            </div>
            <div class="ssp-progress" id="ssp-prog-${p.id}">Problem 1 / ${this.totalQuestions}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.bindOptions();
  }

  private bindOptions(): void {
    this.container.querySelectorAll('.ssp-opt-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const val = parseInt(btn.getAttribute('data-val') || '0', 10);
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'ANSWER', val);
      });
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.gameTime += 0.1;
      const timeLeft = Math.max(0, this.maxDuration - this.gameTime);
      const timerEl = this.container.querySelector('#ssp-timer');
      if (timerEl) timerEl.textContent = `${timeLeft.toFixed(1)}s`;

      if (timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'ANSWER') return;

    const chosenVal = data as number;
    const curIdx = this.playerQuestionIndex.get(playerId) ?? 0;
    if (curIdx >= this.totalQuestions) return;

    const question = this.questions[curIdx];
    const scoreEl = this.container.querySelector(`#ssp-score-${playerId}`);
    const qEl = this.container.querySelector(`#ssp-q-${playerId}`);
    const optsEl = this.container.querySelector(`#ssp-opts-${playerId}`);
    const progEl = this.container.querySelector(`#ssp-prog-${playerId}`);

    if (chosenVal === question.answer) {
      // Correct!
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 3;
      this.context.audio.playPop();
      this.context.haptics.light();
    } else {
      // Wrong!
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 1);
      this.context.audio.playError();
      this.context.haptics.medium();
    }

    if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

    const nextIdx = curIdx + 1;
    this.playerQuestionIndex.set(playerId, nextIdx);

    if (nextIdx < this.totalQuestions) {
      const nextQ = this.questions[nextIdx];
      if (qEl) qEl.textContent = nextQ.prompt;
      if (progEl) progEl.textContent = `Problem ${nextIdx + 1} / ${this.totalQuestions}`;
      if (optsEl) {
        optsEl.innerHTML = nextQ.options
          .map(
            opt => `
          <button class="ssp-opt-btn" data-player="${playerId}" data-val="${opt}">${opt}</button>
        `
          )
          .join('');

        optsEl.querySelectorAll('.ssp-opt-btn').forEach(btn => {
          const val = parseInt(btn.getAttribute('data-val') || '0', 10);
          btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            this.handleInput(playerId, 'ANSWER', val);
          });
        });
      }
    } else {
      if (qEl) qEl.textContent = 'DONE! 🎉';
      if (optsEl) optsEl.innerHTML = '<span class="ssp-done">Finished All Questions!</span>';

      const allDone = this.context.players.every(p => (this.playerQuestionIndex.get(p.id) || 0) >= this.totalQuestions);
      if (allDone) {
        setTimeout(() => this.concludeGame(), 400);
      }
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
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
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
  }
}
