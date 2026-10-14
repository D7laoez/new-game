import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface PlayerDiceState {
  dice: [number, number, number];
  rollsLeft: number;
  locked: boolean;
  score: number;
  roundNumber: number;
}

export class DiceBattleGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'dice-battle')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerStates: Map<PlayerId, PlayerDiceState> = new Map();
  private timeLeft = 15;
  private readonly maxRounds = 2;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerStates.clear();
    this.timeLeft = 15;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerStates.set(p.id, {
        dice: [1, 2, 3],
        rollsLeft: 3,
        locked: false,
        score: 0,
        roundNumber: 1
      });
    });

    this.container.className = 'game-screen dice-battle-game';
    this.container.innerHTML = `
      <div class="db-hud">
        <div class="hud-timer" id="db-timer">15.0s</div>
        <div class="hud-tip">Roll high-scoring combinations: Triples, Pairs, Straights! 🎲</div>
      </div>
      <div class="db-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="db-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="db-zone-header">
              <span class="db-avatar">${p.avatar}</span>
              <span class="db-name">${p.name}</span>
              <span class="db-score" id="db-score-${p.id}">0 pts (R1/2)</span>
            </div>
            <div class="db-cup" id="db-cup-${p.id}">
              <div class="db-die" id="db-die-${p.id}-0">🎲</div>
              <div class="db-die" id="db-die-${p.id}-1">🎲</div>
              <div class="db-die" id="db-die-${p.id}-2">🎲</div>
            </div>
            <div class="db-combo-label" id="db-combo-${p.id}">Tap Roll to start</div>
            <div class="db-actions">
              <button class="db-roll-btn" id="db-roll-${p.id}">ROLL (3 left) 🎲</button>
              <button class="db-lock-btn" id="db-lock-${p.id}">LOCK SCORE 🔒</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#db-timer')!;

    players.forEach(p => {
      const rollBtn = this.container.querySelector(`#db-roll-${p.id}`);
      const lockBtn = this.container.querySelector(`#db-lock-${p.id}`);

      if (rollBtn) {
        rollBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'ROLL');
        });
      }
      if (lockBtn) {
        lockBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'LOCK');
        });
      }
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

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished) return;
    const state = this.playerStates.get(playerId);
    if (!state || state.locked) return;

    if (action === 'ROLL') {
      if (state.rollsLeft <= 0) return;

      // Roll 3 random dice 1..6
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      state.dice = [d1, d2, d3];
      state.rollsLeft--;

      this.context.audio.playWhoosh();
      this.context.haptics.light();

      // Animate dice shake
      const cup = this.container.querySelector(`#db-cup-${playerId}`);
      if (cup) {
        cup.classList.add('shaking');
        this.setGameTimeout(() => cup.classList.remove('shaking'), 300);
      }

      this.renderPlayerDice(playerId);

      const rollBtn = this.container.querySelector(`#db-roll-${playerId}`) as HTMLButtonElement;
      if (rollBtn) {
        rollBtn.textContent = state.rollsLeft > 0 ? `ROLL (${state.rollsLeft} left) 🎲` : 'NO ROLLS LEFT';
        if (state.rollsLeft === 0) rollBtn.disabled = true;
      }
    } else if (action === 'LOCK') {
      this.lockRoundForPlayer(playerId);
    }
  }

  private renderPlayerDice(playerId: PlayerId): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.dice.forEach((val, idx) => {
      const dieEl = this.container.querySelector(`#db-die-${playerId}-${idx}`);
      if (dieEl) {
        dieEl.textContent = DICE_FACES[val - 1];
      }
    });

    const combo = this.evaluateDiceCombo(state.dice);
    const comboEl = this.container.querySelector(`#db-combo-${playerId}`);
    if (comboEl) {
      comboEl.textContent = `${combo.name}: +${combo.pts} pts`;
    }
  }

  private evaluateDiceCombo(dice: [number, number, number]): { name: string; pts: number } {
    const [a, b, c] = [...dice].sort((x, y) => x - y);

    // Triple
    if (a === b && b === c) {
      return { name: `Triple ${a}s! 🔥`, pts: 25 + a * 2 };
    }
    // Straight
    if (b === a + 1 && c === b + 1) {
      return { name: 'Straight! ⚡', pts: 20 };
    }
    // Pair
    if (a === b || b === c || a === c) {
      const pairVal = a === b ? a : c;
      return { name: `Pair of ${pairVal}s ✨`, pts: 12 + pairVal };
    }
    // High Sum
    const sum = a + b + c;
    return { name: `Sum: ${sum}`, pts: sum };
  }

  private lockRoundForPlayer(playerId: PlayerId): void {
    const state = this.playerStates.get(playerId);
    if (!state || state.locked) return;

    const combo = this.evaluateDiceCombo(state.dice);
    state.score += combo.pts;
    this.playerScores[playerId] = state.score;

    this.context.audio.playSuccess();
    this.context.haptics.heavy();

    const scoreEl = this.container.querySelector(`#db-score-${playerId}`);
    if (scoreEl) {
      scoreEl.textContent = `${state.score} pts (R${state.roundNumber}/${this.maxRounds})`;
    }

    if (state.roundNumber >= this.maxRounds) {
      state.locked = true;
      const rollBtn = this.container.querySelector(`#db-roll-${playerId}`) as HTMLButtonElement;
      const lockBtn = this.container.querySelector(`#db-lock-${playerId}`) as HTMLButtonElement;
      if (rollBtn) rollBtn.disabled = true;
      if (lockBtn) {
        lockBtn.disabled = true;
        lockBtn.textContent = 'FINAL SCORE 🏆';
      }

      const allDone = this.context.players.every(p => this.playerStates.get(p.id)?.locked);
      if (allDone) {
        this.setGameTimeout(() => this.concludeGame(), 500);
      }
    } else {
      // Advance to Round 2
      state.roundNumber++;
      state.rollsLeft = 3;
      const rollBtn = this.container.querySelector(`#db-roll-${playerId}`) as HTMLButtonElement;
      if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.textContent = `ROLL (${state.rollsLeft} left) 🎲`;
      }
      if (scoreEl) {
        scoreEl.textContent = `${state.score} pts (R${state.roundNumber}/${this.maxRounds})`;
      }
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;

    const players = this.context.players;

    // Lock any unconfirmed rounds
    players.forEach(p => {
      const s = this.playerStates.get(p.id);
      if (s && !s.locked) {
        const combo = this.evaluateDiceCombo(s.dice);
        s.score += combo.pts;
        this.playerScores[p.id] = s.score;
        s.locked = true;
      }
    });

    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    players.forEach(p => {
      rawStats[p.id] = `${this.playerScores[p.id]} points rolled`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
