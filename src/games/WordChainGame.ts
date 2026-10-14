import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

// Bundled offline dictionary
const OFFLINE_DICTIONARY: Set<string> = new Set([
  'GAME', 'ECHO', 'OPEN', 'NEON', 'NIGHT', 'TIGER', 'ROBOT', 'TRAIN', 'NEST', 'TREE',
  'EARTH', 'HEART', 'TABLE', 'EAGLE', 'LEMON', 'MOON', 'NORTH', 'HONEY', 'YOUTH', 'HERO',
  'OCEAN', 'NURSE', 'ELBOW', 'WATER', 'RIVER', 'RADIO', 'ORANGE', 'ENERGY', 'YARD', 'DOOR',
  'ROCK', 'KING', 'GOLD', 'DARK', 'KITE', 'EDGE', 'EXIT', 'TOWER', 'RAIN', 'STAR'
]);

export class WordChainGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'word-chain')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private usedWords: Set<string> = new Set();
  private currentLastLetter = 'G';
  private currentTurnPlayerIndex = 0;
  private turnTimeLeft = 12.0;
  private timerIntervalId: number | null = null;
  private currentInput = '';
  private turnsPlayed = 0;
  private maxTurns = 8;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.usedWords.clear();
    this.currentLastLetter = 'G';
    this.currentTurnPlayerIndex = 0;
    this.turnsPlayed = 0;
    this.currentInput = '';

    players.forEach(p => {
      this.playerScores[p.id] = 0;
    });

    this.container.className = 'game-screen word-chain-game';
    this.container.innerHTML = `
      <div class="wc-hud">
        <div class="wc-timer" id="wc-timer">12.0s</div>
        <div class="wc-turn-indicator" id="wc-turn">Player 1 Turn</div>
        <div class="wc-chain-requirement">
          Next Word Must Start With: <strong class="wc-required-letter" id="wc-req-letter">G</strong>
        </div>
      </div>
      <div class="wc-center-arena">
        <div class="wc-history-box" id="wc-history">
          <span class="wc-tag">Chain: Start with 'G'</span>
        </div>
        <div class="wc-input-box">
          <span class="wc-typed-word" id="wc-typed">_</span>
        </div>
      </div>
      <div class="wc-keypad" id="wc-keypad">
        <div class="wc-keys-row">
          ${['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(k => `<button class="wc-key" data-key="${k}">${k}</button>`).join('')}
        </div>
        <div class="wc-keys-row">
          ${['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(k => `<button class="wc-key" data-key="${k}">${k}</button>`).join('')}
        </div>
        <div class="wc-keys-row">
          <button class="wc-key wc-key-action" data-action="SUBMIT">SUBMIT ⏎</button>
          ${['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(k => `<button class="wc-key" data-key="${k}">${k}</button>`).join('')}
          <button class="wc-key wc-key-action" data-action="BACK">⌫</button>
        </div>
      </div>
    `;

    this.bindKeypad();
    this.updateTurnDisplay();
  }

  private bindKeypad(): void {
    this.container.querySelectorAll('.wc-key').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        const action = btn.getAttribute('data-action');
        const curPlayer = this.context.players[this.currentTurnPlayerIndex];

        if (key) {
          this.handleInput(curPlayer.id, 'ADD_CHAR', key);
        } else if (action === 'BACK') {
          this.handleInput(curPlayer.id, 'DELETE');
        } else if (action === 'SUBMIT') {
          this.handleInput(curPlayer.id, 'SUBMIT');
        }
      });
    });
  }

  private updateTurnDisplay(): void {
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    const turnEl = this.container.querySelector('#wc-turn');
    if (turnEl && curPlayer) {
      turnEl.textContent = `${curPlayer.avatar} ${curPlayer.name}'s Turn`;
      turnEl.setAttribute('style', `color: ${curPlayer.color}`);
    }
    const reqEl = this.container.querySelector('#wc-req-letter');
    if (reqEl) reqEl.textContent = this.currentLastLetter;
  }

  protected onStart(): void {
    this.startTurnTimer();
  }

  private startTurnTimer(): void {
    this.turnTimeLeft = 12.0;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    this.timerIntervalId = window.setInterval(() => {
      this.turnTimeLeft -= 0.1;
      const timerEl = this.container.querySelector('#wc-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.turnTimeLeft).toFixed(1)}s`;

      if (this.turnTimeLeft <= 0) {
        // Time expired! Penalty
        const curPlayer = this.context.players[this.currentTurnPlayerIndex];
        this.context.audio.playError();
        this.advanceTurn();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished) return;
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];
    if (curPlayer.id !== playerId) return;

    const typedEl = this.container.querySelector('#wc-typed');

    if (action === 'ADD_CHAR') {
      const char = data as string;
      if (this.currentInput.length < 8) {
        this.currentInput += char;
        if (typedEl) typedEl.textContent = this.currentInput;
        this.context.audio.playTone(350, 0.05);
      }
    } else if (action === 'DELETE') {
      this.currentInput = this.currentInput.slice(0, -1);
      if (typedEl) typedEl.textContent = this.currentInput || '_';
      this.context.audio.playTone(250, 0.05);
    } else if (action === 'SUBMIT') {
      this.validateSubmission();
    }
  }

  private validateSubmission(): void {
    const word = this.currentInput.toUpperCase();
    const curPlayer = this.context.players[this.currentTurnPlayerIndex];

    // Check starts with required letter
    if (!word.startsWith(this.currentLastLetter)) {
      this.context.audio.playError();
      this.context.haptics.medium();
      return;
    }

    // Check not repeated
    if (this.usedWords.has(word)) {
      this.context.audio.playError();
      return;
    }

    // Check word validity in dictionary (or length >= 3)
    const isValid = OFFLINE_DICTIONARY.has(word) || word.length >= 3;

    if (isValid) {
      this.usedWords.add(word);
      const pts = word.length * 2;
      this.playerScores[curPlayer.id] = (this.playerScores[curPlayer.id] || 0) + pts;
      this.currentLastLetter = word.charAt(word.length - 1);

      this.context.audio.playSuccess();
      this.context.haptics.heavy();

      // Append to history
      const hist = this.container.querySelector('#wc-history');
      if (hist) {
        hist.innerHTML += ` <span class="wc-word-badge">${word} (${curPlayer.avatar})</span> ➔`;
      }

      this.currentInput = '';
      const typedEl = this.container.querySelector('#wc-typed');
      if (typedEl) typedEl.textContent = '_';

      this.advanceTurn();
    } else {
      this.context.audio.playError();
    }
  }

  private advanceTurn(): void {
    this.turnsPlayed++;
    if (this.turnsPlayed >= this.maxTurns) {
      this.concludeGame();
    } else {
      this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.context.players.length;
      this.currentInput = '';
      const typedEl = this.container.querySelector('#wc-typed');
      if (typedEl) typedEl.textContent = '_';
      this.updateTurnDisplay();
      this.startTurnTimer();
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
