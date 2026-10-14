import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Card {
  value: number; // 2 to 14
  suit: string; // ♠️, ♥️, ♦️, ♣️
  label: string;
}

const SUITS = ['♠️', '♥️', '♦️', '♣️'];

function drawRandomCard(differentFrom?: number): Card {
  let val: number;
  do {
    val = Math.floor(Math.random() * 13) + 2; // 2 through 14
  } while (differentFrom !== undefined && val === differentFrom);

  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  let label = val.toString();
  if (val === 11) label = 'J';
  if (val === 12) label = 'Q';
  if (val === 13) label = 'K';
  if (val === 14) label = 'A';

  return { value: val, suit, label };
}

interface PlayerCardState {
  currentCard: Card;
  streak: number;
  guessesMade: number;
  maxGuesses: number;
}

export class HigherOrLowerGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'higher-or-lower')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerStates: Map<PlayerId, PlayerCardState> = new Map();
  private timeLeft = 20;
  private readonly maxGuesses = 6;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerStates.clear();
    this.timeLeft = 20;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerStates.set(p.id, {
        currentCard: drawRandomCard(),
        streak: 0,
        guessesMade: 0,
        maxGuesses: this.maxGuesses
      });
    });

    this.container.className = 'game-screen higher-or-lower-game';
    this.container.innerHTML = `
      <div class="hol-hud">
        <div class="hud-timer" id="hol-timer">20.0s</div>
        <div class="hud-tip">Predict if the next card will be HIGHER or LOWER! 🃏</div>
      </div>
      <div class="hol-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="hol-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="hol-zone-header">
              <span class="hol-avatar">${p.avatar}</span>
              <span class="hol-name">${p.name}</span>
              <span class="hol-score" id="hol-score-${p.id}">0 pts (0/${this.maxGuesses})</span>
            </div>
            <div class="hol-card-display">
              <div class="hol-card" id="hol-card-${p.id}">
                <span class="hol-card-val" id="hol-val-${p.id}">7</span>
                <span class="hol-card-suit" id="hol-suit-${p.id}">♠️</span>
              </div>
            </div>
            <div class="hol-btn-group">
              <button class="hol-btn higher" id="hol-higher-${p.id}">
                HIGHER 🔼
              </button>
              <button class="hol-btn lower" id="hol-lower-${p.id}">
                LOWER 🔽
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#hol-timer')!;

    // Render initial cards and bind buttons
    players.forEach(p => {
      this.renderPlayerCard(p.id);
      const higherBtn = this.container.querySelector(`#hol-higher-${p.id}`);
      const lowerBtn = this.container.querySelector(`#hol-lower-${p.id}`);

      if (higherBtn) {
        higherBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'GUESS', 'HIGHER');
        });
      }
      if (lowerBtn) {
        lowerBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'GUESS', 'LOWER');
        });
      }
    });
  }

  private renderPlayerCard(playerId: PlayerId): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const valEl = this.container.querySelector(`#hol-val-${playerId}`);
    const suitEl = this.container.querySelector(`#hol-suit-${playerId}`);
    const cardEl = this.container.querySelector(`#hol-card-${playerId}`);

    if (valEl) valEl.textContent = state.currentCard.label;
    if (suitEl) suitEl.textContent = state.currentCard.suit;

    if (cardEl) {
      const isRed = state.currentCard.suit === '♥️' || state.currentCard.suit === '♦️';
      cardEl.className = `hol-card ${isRed ? 'red-suit' : 'black-suit'}`;
    }
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
    if (!this.isRunning || this.isFinished || action !== 'GUESS') return;
    const state = this.playerStates.get(playerId);
    if (!state || state.guessesMade >= state.maxGuesses) return;

    const guess = data as 'HIGHER' | 'LOWER';
    const oldCard = state.currentCard;
    const newCard = drawRandomCard(oldCard.value); // guaranteed different value

    const isHigher = newCard.value > oldCard.value;
    const isCorrect = (guess === 'HIGHER' && isHigher) || (guess === 'LOWER' && !isHigher);

    state.currentCard = newCard;
    state.guessesMade++;

    const cardEl = this.container.querySelector(`#hol-card-${playerId}`);
    const scoreEl = this.container.querySelector(`#hol-score-${playerId}`);

    if (isCorrect) {
      state.streak++;
      const gain = 10 + state.streak * 2;
      this.playerScores[playerId] += gain;

      this.context.audio.playSuccess();
      this.context.haptics.light();

      if (cardEl) {
        cardEl.classList.add('flash-correct');
        this.setGameTimeout(() => cardEl.classList.remove('flash-correct'), 300);
      }
    } else {
      state.streak = 0;
      this.context.audio.playError();
      this.context.haptics.error();

      if (cardEl) {
        cardEl.classList.add('flash-wrong');
        this.setGameTimeout(() => cardEl.classList.remove('flash-wrong'), 300);
      }
    }

    if (scoreEl) {
      scoreEl.textContent = `${this.playerScores[playerId]} pts (${state.guessesMade}/${state.maxGuesses})`;
    }

    this.renderPlayerCard(playerId);

    if (state.guessesMade >= state.maxGuesses) {
      const higherBtn = this.container.querySelector(`#hol-higher-${playerId}`) as HTMLButtonElement;
      const lowerBtn = this.container.querySelector(`#hol-lower-${playerId}`) as HTMLButtonElement;
      if (higherBtn) higherBtn.disabled = true;
      if (lowerBtn) lowerBtn.disabled = true;
    }

    const allFinished = this.context.players.every(p => {
      const s = this.playerStates.get(p.id);
      return (s?.guessesMade || 0) >= this.maxGuesses;
    });

    if (allFinished) {
      this.setGameTimeout(() => this.concludeGame(), 400);
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
      const s = this.playerStates.get(p.id);
      rawStats[p.id] = `${s?.guessesMade || 0} rounds (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
