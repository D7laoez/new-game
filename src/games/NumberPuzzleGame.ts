import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Puzzle {
  sequence: string; // e.g. "3, 6, 9, [ ? ], 15"
  correctAnswer: number;
  options: number[];
}

const PUZZLE_TEMPLATES: (() => Puzzle)[] = [
  () => {
    const step = Math.floor(Math.random() * 5) + 2;
    const start = Math.floor(Math.random() * 10) + 1;
    const nums = [start, start + step, start + step * 2, start + step * 3, start + step * 4];
    const missingIdx = 3;
    const ans = nums[missingIdx];
    const seq = nums.map((n, i) => (i === missingIdx ? '[ ? ]' : n.toString())).join(', ');
    const options = [ans, ans + step, ans - 1, ans + 2].sort(() => Math.random() - 0.5);
    return { sequence: seq, correctAnswer: ans, options };
  },
  () => {
    const mult = 2;
    const start = Math.floor(Math.random() * 4) + 2;
    const nums = [start, start * mult, start * mult * 2, start * mult * 3];
    const missingIdx = 2;
    const ans = nums[missingIdx];
    const seq = nums.map((n, i) => (i === missingIdx ? '[ ? ]' : n.toString())).join(', ');
    const options = [ans, ans + 4, ans - 2, ans * 2].sort(() => Math.random() - 0.5);
    return { sequence: seq, correctAnswer: ans, options };
  },
  () => {
    const start = Math.floor(Math.random() * 3) + 1;
    const nums = [start * start, (start + 1) * (start + 1), (start + 2) * (start + 2), (start + 3) * (start + 3)];
    const missingIdx = 3;
    const ans = nums[missingIdx];
    const seq = nums.map((n, i) => (i === missingIdx ? '[ ? ]' : n.toString())).join(', ');
    const options = [ans, ans - 5, ans + 7, ans + 10].sort(() => Math.random() - 0.5);
    return { sequence: seq, correctAnswer: ans, options };
  },
  () => {
    const step = Math.floor(Math.random() * 4) + 3;
    const start = 50;
    const nums = [start, start - step, start - step * 2, start - step * 3];
    const missingIdx = 2;
    const ans = nums[missingIdx];
    const seq = nums.map((n, i) => (i === missingIdx ? '[ ? ]' : n.toString())).join(', ');
    const options = [ans, ans - step, ans + 2, ans - 4].sort(() => Math.random() - 0.5);
    return { sequence: seq, correctAnswer: ans, options };
  }
];

export class NumberPuzzleGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'number-puzzle')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerPuzzles: Map<PlayerId, Puzzle> = new Map();
  private playerSolvedCount: Map<PlayerId, number> = new Map();
  private timeLeft = 25;
  private readonly targetSolved = 5;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerPuzzles.clear();
    this.playerSolvedCount.clear();
    this.timeLeft = 25;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerSolvedCount.set(p.id, 0);
      this.assignNewPuzzle(p.id);
    });

    this.container.className = 'game-screen number-puzzle-game';
    this.container.innerHTML = `
      <div class="np-hud">
        <div class="hud-timer" id="np-timer">25.0s</div>
        <div class="hud-tip">Find the missing pattern number in the sequence! 🔢</div>
      </div>
      <div class="np-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="np-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="np-zone-header">
              <span class="np-avatar">${p.avatar}</span>
              <span class="np-name">${p.name}</span>
              <span class="np-score" id="np-score-${p.id}">0 pts (0/${this.targetSolved})</span>
            </div>
            <div class="np-sequence-box" id="np-seq-${p.id}">...</div>
            <div class="np-options-grid" id="np-opts-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#np-timer')!;
    players.forEach(p => this.renderPlayerPuzzle(p.id));
  }

  private assignNewPuzzle(playerId: PlayerId): void {
    const template = PUZZLE_TEMPLATES[Math.floor(Math.random() * PUZZLE_TEMPLATES.length)];
    this.playerPuzzles.set(playerId, template());
  }

  private renderPlayerPuzzle(playerId: PlayerId): void {
    const puzzle = this.playerPuzzles.get(playerId);
    const seqEl = this.container.querySelector(`#np-seq-${playerId}`);
    const optsEl = this.container.querySelector(`#np-opts-${playerId}`);
    if (!puzzle || !seqEl || !optsEl) return;

    seqEl.textContent = puzzle.sequence;

    let html = '';
    puzzle.options.forEach(opt => {
      html += `
        <button class="np-opt-btn" data-val="${opt}">
          ${opt}
        </button>
      `;
    });
    optsEl.innerHTML = html;

    optsEl.querySelectorAll('.np-opt-btn').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const val = parseInt(btn.getAttribute('data-val') || '0', 10);
        this.handleInput(playerId, 'ANSWER', { choice: val });
      });
    });
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
    if (!this.isRunning || this.isFinished || action !== 'ANSWER') return;
    const puzzle = this.playerPuzzles.get(playerId);
    const solved = this.playerSolvedCount.get(playerId) || 0;
    if (!puzzle || solved >= this.targetSolved) return;

    const { choice } = (data as { choice: number }) || { choice: NaN };
    const isCorrect = choice === puzzle.correctAnswer;
    const optsEl = this.container.querySelector(`#np-opts-${playerId}`);
    const btn = optsEl?.querySelector(`[data-val="${choice}"]`);

    if (isCorrect) {
      const newSolved = solved + 1;
      this.playerSolvedCount.set(playerId, newSolved);
      this.playerScores[playerId] += 12;

      this.context.audio.playSuccess();
      this.context.haptics.light();

      if (btn) btn.classList.add('correct');

      const scoreEl = this.container.querySelector(`#np-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${newSolved}/${this.targetSolved})`;
      }

      if (newSolved >= this.targetSolved) {
        const allDone = this.context.players.every(p => (this.playerSolvedCount.get(p.id) || 0) >= this.targetSolved);
        if (allDone) {
          this.setGameTimeout(() => this.concludeGame(), 400);
        }
      } else {
        this.setGameTimeout(() => {
          if (!this.isRunning || this.isFinished) return;
          this.assignNewPuzzle(playerId);
          this.renderPlayerPuzzle(playerId);
        }, 200);
      }
    } else {
      // Wrong choice
      this.playerScores[playerId] = Math.max(0, this.playerScores[playerId] - 2);
      this.context.audio.playError();
      this.context.haptics.error();

      if (btn) {
        btn.classList.add('wrong');
        this.setGameTimeout(() => btn.classList.remove('wrong'), 300);
      }

      const scoreEl = this.container.querySelector(`#np-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${solved}/${this.targetSolved})`;
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
      rawStats[p.id] = `${this.playerSolvedCount.get(p.id) || 0} solved (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
