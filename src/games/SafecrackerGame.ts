import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

// 3-digit secret code per player
export class SafecrackerGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'safecracker')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerCodes: Map<PlayerId, number[]> = new Map();
  private playerGuesses: Map<PlayerId, number[]> = new Map();
  private playerAttempts: Map<PlayerId, number> = new Map();
  private playerSolved: Map<PlayerId, boolean> = new Map();
  private maxAttempts = 5;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerCodes.clear();
    this.playerGuesses.clear();
    this.playerAttempts.clear();
    this.playerSolved.clear();

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      // 3 distinct digits 1..6
      const digits: number[] = [];
      while (digits.length < 3) {
        const d = Math.floor(Math.random() * 6) + 1;
        if (!digits.includes(d)) digits.push(d);
      }
      this.playerCodes.set(p.id, digits);
      this.playerGuesses.set(p.id, []);
      this.playerAttempts.set(p.id, 0);
      this.playerSolved.set(p.id, false);
    });

    this.container.className = 'game-screen safecracker-game';
    this.container.innerHTML = `
      <div class="sc-hud">
        <div class="sc-title">SAFECRACKER 🔐</div>
        <div class="sc-hint">Deduce the 3-digit code! Clues: 🟢 Exact, 🟡 Wrong position</div>
      </div>
      <div class="sc-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="sc-player-vault" id="sc-vault-${p.id}" style="--p-col: ${p.color}">
            <div class="sc-vault-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="sc-attempts" id="sc-att-${p.id}">Attempts: 0 / 5</span>
            </div>
            <div class="sc-display" id="sc-disp-${p.id}">_ _ _</div>
            <div class="sc-clues-history" id="sc-clues-${p.id}"></div>
            <div class="sc-keypad">
              ${[1, 2, 3, 4, 5, 6]
                .map(
                  n => `
                <button class="sc-key" data-player="${p.id}" data-num="${n}">${n}</button>
              `
                )
                .join('')}
              <button class="sc-key sc-action-clear" data-player="${p.id}" data-action="CLEAR">⌫</button>
              <button class="sc-key sc-action-test" data-player="${p.id}" data-action="TEST">CRACK 🔓</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind keypad
    this.container.querySelectorAll('.sc-key').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const num = btn.getAttribute('data-num');
      const action = btn.getAttribute('data-action');

      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (num) {
          this.handleInput(pId, 'ADD_DIGIT', parseInt(num, 10));
        } else if (action === 'CLEAR') {
          this.handleInput(pId, 'CLEAR');
        } else if (action === 'TEST') {
          this.handleInput(pId, 'TEST');
        }
      });
    });
  }

  protected onStart(): void {}

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished) return;
    if (this.playerSolved.get(playerId)) return;

    const guess = this.playerGuesses.get(playerId) || [];
    const dispEl = this.container.querySelector(`#sc-disp-${playerId}`);

    if (action === 'ADD_DIGIT') {
      const digit = data as number;
      if (guess.length < 3 && !guess.includes(digit)) {
        guess.push(digit);
        this.playerGuesses.set(playerId, guess);
        this.context.audio.playTone(350 + digit * 40, 0.05);
        if (dispEl) dispEl.textContent = guess.join(' ') + (guess.length === 3 ? '' : ' _');
      }
    } else if (action === 'CLEAR') {
      this.playerGuesses.set(playerId, []);
      if (dispEl) dispEl.textContent = '_ _ _';
      this.context.audio.playTone(200, 0.05);
    } else if (action === 'TEST') {
      if (guess.length === 3) {
        this.evaluateGuess(playerId, guess);
      }
    }
  }

  private evaluateGuess(playerId: PlayerId, guess: number[]): void {
    const secret = this.playerCodes.get(playerId) || [1, 2, 3];
    let exact = 0;
    let wrongPos = 0;

    guess.forEach((d, idx) => {
      if (d === secret[idx]) {
        exact++;
      } else if (secret.includes(d)) {
        wrongPos++;
      }
    });

    const attempts = (this.playerAttempts.get(playerId) || 0) + 1;
    this.playerAttempts.set(playerId, attempts);

    const attEl = this.container.querySelector(`#sc-att-${playerId}`);
    if (attEl) attEl.textContent = `Attempts: ${attempts} / ${this.maxAttempts}`;

    const cluesEl = this.container.querySelector(`#sc-clues-${playerId}`);
    if (cluesEl) {
      cluesEl.innerHTML += `
        <div class="sc-clue-row">
          <span>${guess.join('')}</span>
          <span>🟢 ${exact} Exact • 🟡 ${wrongPos} Wrong Pos</span>
        </div>
      `;
    }

    if (exact === 3) {
      // Safe cracked!
      this.playerSolved.set(playerId, true);
      const points = Math.max(4, 16 - attempts * 2);
      this.playerScores[playerId] = points;
      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      const dispEl = this.container.querySelector(`#sc-disp-${playerId}`);
      if (dispEl) dispEl.textContent = 'OPEN! 🏆';
    } else {
      this.context.audio.playError();
      this.context.haptics.light();
      this.playerGuesses.set(playerId, []);
      const dispEl = this.container.querySelector(`#sc-disp-${playerId}`);
      if (dispEl) dispEl.textContent = '_ _ _';
    }

    // Check game finish
    const allDone = this.context.players.every(
      p => this.playerSolved.get(p.id) || (this.playerAttempts.get(p.id) || 0) >= this.maxAttempts
    );

    if (allDone) {
      this.setGameTimeout(() => this.concludeGame(), 600);
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

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats: this.playerScores
    });
  }

  protected onDestroy(): void {}
}
