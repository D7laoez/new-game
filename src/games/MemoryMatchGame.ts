import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface CardItem {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EMOJI_POOL = ['🦄', '🦁', '🐸', '🐙', '🦖', '🐼', '🦊', '🐬', '💎', '🚀', '⭐', '🔥'];

export class MemoryMatchGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'memory-match')!;

  private cards: CardItem[] = [];
  private flippedIndices: number[] = [];
  private currentTurnIndex = 0;
  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private matchesFound: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private isProcessing = false;
  private duration = 40.0;

  private gridEl!: HTMLElement;
  private turnBannerEl!: HTMLElement;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    const pairCount = diff === 'EASY' ? 4 : diff === 'HARD' ? 8 : 6;

    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.matchesFound = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentTurnIndex = 0;
    this.flippedIndices = [];
    this.isProcessing = false;
    this.duration = diff === 'EASY' ? 45.0 : diff === 'HARD' ? 30.0 : 35.0;

    // Generate and shuffle card pairs
    const selectedEmojis = EMOJI_POOL.slice(0, pairCount);
    const deck = [...selectedEmojis, ...selectedEmojis];
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.cards = deck.map((emoji, id) => ({
      id,
      emoji,
      isFlipped: false,
      isMatched: false
    }));

    this.container.className = 'game-screen memory-match-game';
    this.container.innerHTML = `
      <div class="mm-hud">
        <div class="mm-timer" id="mm-timer">${this.duration.toFixed(0)}s</div>
        <div class="mm-turn-banner" id="mm-turn-banner">
          ${players.length > 1 ? `Turn: ${players[0].name}` : 'Match all pairs!'}
        </div>
        <div class="mm-scores-strip">
          ${players
            .map(
              p => `
            <div class="mm-player-chip" id="mm-chip-${p.id}" style="--p-color: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="mm-score-${p.id}">0 pairs</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="mm-board">
        <div class="mm-grid cols-${pairCount <= 4 ? 4 : 4}" id="mm-grid"></div>
      </div>
    `;

    this.gridEl = this.container.querySelector('#mm-grid')!;
    this.turnBannerEl = this.container.querySelector('#mm-turn-banner')!;
    this.timerEl = this.container.querySelector('#mm-timer')!;

    this.renderCards();
    this.updateTurnUI();
  }

  private renderCards(): void {
    this.gridEl.innerHTML = this.cards
      .map(
        (c, idx) => `
      <div class="mm-card ${c.isFlipped ? 'flipped' : ''} ${c.isMatched ? 'matched' : ''}" data-index="${idx}">
        <div class="mm-card-inner">
          <div class="mm-card-front">❓</div>
          <div class="mm-card-back">${c.emoji}</div>
        </div>
      </div>
    `
      )
      .join('');

    this.gridEl.querySelectorAll('.mm-card').forEach(cardEl => {
      const idx = parseInt(cardEl.getAttribute('data-index') || '0', 10);
      cardEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        const activePlayer = this.context.players[this.currentTurnIndex];
        this.handleInput(activePlayer.id, 'FLIP', idx);
      });
    });
  }

  protected onStart(): void {
    this.updateTurnUI();
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.duration -= deltaTime;
    if (this.timerEl) {
      this.timerEl.textContent = `${Math.max(0, this.duration).toFixed(0)}s`;
    }

    if (this.duration <= 0) {
      this.finishGame();
    }
  }

  private updateTurnUI(): void {
    const players = this.context.players;
    const activePlayer = players[this.currentTurnIndex];

    if (this.turnBannerEl) {
      if (players.length > 1) {
        this.turnBannerEl.textContent = `Turn: ${activePlayer.avatar} ${activePlayer.name}`;
        this.turnBannerEl.style.color = activePlayer.color;
      } else {
        this.turnBannerEl.textContent = 'Find matching pairs!';
      }
    }

    players.forEach((p, idx) => {
      const chip = this.container.querySelector(`#mm-chip-${p.id}`);
      if (chip) {
        if (idx === this.currentTurnIndex && players.length > 1) {
          chip.classList.add('active-turn');
        } else {
          chip.classList.remove('active-turn');
        }
      }
    });
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'FLIP' || !this.isRunning || this.isFinished || this.isProcessing) return;

    const cardIndex = data as number;
    const card = this.cards[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return;

    // Flip card
    card.isFlipped = true;
    this.flippedIndices.push(cardIndex);
    this.context.audio.playTap();
    this.context.haptics.light();
    this.renderCards();

    if (this.flippedIndices.length === 2) {
      this.isProcessing = true;
      const [idx1, idx2] = this.flippedIndices;
      const card1 = this.cards[idx1];
      const card2 = this.cards[idx2];

      if (card1.emoji === card2.emoji) {
        // MATCH!
        card1.isMatched = true;
        card2.isMatched = true;
        this.matchesFound[playerId] = (this.matchesFound[playerId] || 0) + 1;
        this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 25;

        this.context.audio.playSuccess();
        this.context.haptics.medium();

        const scoreEl = this.container.querySelector(`#mm-score-${playerId}`);
        if (scoreEl) {
          scoreEl.textContent = `${this.matchesFound[playerId]} pairs`;
        }

        this.flippedIndices = [];
        this.isProcessing = false;
        this.renderCards();

        // Check if all cards matched
        if (this.cards.every(c => c.isMatched)) {
          this.finishGame();
        }
      } else {
        // NO MATCH: flip back after short delay
        this.context.audio.playError();
        this.context.haptics.error();

        setTimeout(() => {
          if (!this.isRunning || this.isFinished) return;
          card1.isFlipped = false;
          card2.isFlipped = false;
          this.flippedIndices = [];
          this.isProcessing = false;

          // Next player turn
          this.currentTurnIndex = (this.currentTurnIndex + 1) % this.context.players.length;
          this.updateTurnUI();
          this.renderCards();
        }, 800);
      }
    }
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const activePlayers = this.context.players;
    const sorted = [...activePlayers].sort(
      (a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0)
    );

    const winnerId =
      sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]
        ? 'TIE'
        : sorted[0].id;

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    activePlayers.forEach(p => {
      rawStats[p.id] = `${this.matchesFound[p.id] || 0} pairs`;
    });

    setTimeout(() => {
      this.finishWithResult({
        scores: { ...this.playerScores },
        winnerId,
        rawStats
      });
    }, 1000);
  }
}
