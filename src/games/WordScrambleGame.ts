import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface WordChallenge {
  scrambled: string;
  answer: string;
  hint: string;
}

const WORDS_DATABASE: WordChallenge[] = [
  { scrambled: 'MGAE', answer: 'GAME', hint: '🎮 Fun activity' },
  { scrambled: 'APRYT', answer: 'PARTY', hint: '🎉 Celebration' },
  { scrambled: 'SLMILE', answer: 'SMILE', hint: '😊 Happy face' },
  { scrambled: 'SEDEP', answer: 'SPEED', hint: '⚡ Velocity' },
  { scrambled: 'TIEGM', answer: 'TIGER', hint: '🐯 Wild cat' },
  { scrambled: 'SUTRA', answer: 'STARS', hint: '⭐ In the night sky' },
  { scrambled: 'PAELP', answer: 'APPLE', hint: '🍎 Red sweet fruit' },
  { scrambled: 'COKCL', answer: 'CLOCK', hint: '⏰ Ticking device' },
  { scrambled: 'MCIUS', answer: 'MUSIC', hint: '🎵 Melodic sounds' },
  { scrambled: 'WAERT', answer: 'WATER', hint: '💧 Essential liquid' }
];

export class WordScrambleGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'word-scramble')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerInputs: Map<PlayerId, string> = new Map();
  private currentChallenge!: WordChallenge;
  private currentRound = 1;
  private maxRounds = 4;
  private roundAnsweredBy: Set<PlayerId> = new Set();
  private roundTimer = 15.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentRound = 1;
    this.roundAnsweredBy.clear();
    this.playerInputs.clear();

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerInputs.set(p.id, '');
    });

    this.container.className = 'game-screen word-scramble-game';
    this.setupRoundUI();
  }

  private setupRoundUI(): void {
    const players = this.context.players;
    this.currentChallenge = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
    this.roundAnsweredBy.clear();
    this.roundTimer = 15.0;

    // Scramble letters
    const letters = this.currentChallenge.scrambled.split('');

    this.container.innerHTML = `
      <div class="ws-hud">
        <div class="ws-round-tag" id="ws-round-tag">Round ${this.currentRound} / ${this.maxRounds}</div>
        <div class="ws-timer" id="ws-timer">15.0s</div>
        <div class="ws-puzzle-box">
          <div class="ws-scrambled-text">${this.currentChallenge.scrambled}</div>
          <div class="ws-hint">Hint: ${this.currentChallenge.hint}</div>
        </div>
      </div>
      <div class="ws-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ws-player-deck" id="ws-deck-${p.id}" style="--p-col: ${p.color}">
            <div class="ws-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ws-score" id="ws-score-${p.id}">0 pts</span>
            </div>
            <div class="ws-input-display" id="ws-input-${p.id}">_</div>
            <div class="ws-letter-buttons">
              ${letters
                .map(
                  (char, idx) => `
                <button class="ws-char-btn" data-player="${p.id}" data-char="${char}" data-idx="${idx}">${char}</button>
              `
                )
                .join('')}
              <button class="ws-clear-btn" data-player="${p.id}">⌫</button>
            </div>
            <div class="ws-feedback" id="ws-feed-${p.id}">Spell the word!</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind character buttons
    this.container.querySelectorAll('.ws-char-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const char = btn.getAttribute('data-char') || '';
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'ADD_CHAR', { char, btn });
      });
    });

    // Bind clear buttons
    this.container.querySelectorAll('.ws-clear-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'CLEAR');
      });
    });
  }

  protected onStart(): void {
    this.startRoundTimer();
  }

  private startRoundTimer(): void {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => {
      this.roundTimer -= 0.1;
      const timerEl = this.container.querySelector('#ws-timer');
      if (timerEl) timerEl.textContent = `${Math.max(0, this.roundTimer).toFixed(1)}s`;

      if (this.roundTimer <= 0) {
        this.concludeRound();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished) return;
    if (this.roundAnsweredBy.has(playerId)) return;

    const cur = this.playerInputs.get(playerId) || '';
    const inputDisplay = this.container.querySelector(`#ws-input-${playerId}`);
    const feedEl = this.container.querySelector(`#ws-feed-${playerId}`);

    if (action === 'ADD_CHAR') {
      const { char, btn } = data as { char: string; btn: HTMLButtonElement };
      if (btn.disabled) return;
      btn.disabled = true;

      const next = cur + char;
      this.playerInputs.set(playerId, next);
      if (inputDisplay) inputDisplay.textContent = next;
      this.context.audio.playPop();

      // Check if matches target word
      if (next.toUpperCase() === this.currentChallenge.answer.toUpperCase()) {
        this.roundAnsweredBy.add(playerId);
        const pts = this.roundAnsweredBy.size === 1 ? 8 : 4;
        this.playerScores[playerId] = (this.playerScores[playerId] || 0) + pts;
        this.context.audio.playSuccess();
        this.context.haptics.heavy();

        if (feedEl) feedEl.textContent = `SOLVED! +${pts} pts 🎉`;
        const scoreEl = this.container.querySelector(`#ws-score-${playerId}`);
        if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;

        // Check if all active players answered
        if (this.roundAnsweredBy.size >= this.context.players.length) {
          this.concludeRound();
        }
      } else if (next.length >= this.currentChallenge.answer.length) {
        // Wrong word entered
        this.context.audio.playError();
        this.context.haptics.medium();
        if (feedEl) feedEl.textContent = 'WRONG! Try again ❌';
      }
    } else if (action === 'CLEAR') {
      this.playerInputs.set(playerId, '');
      if (inputDisplay) inputDisplay.textContent = '_';
      this.container.querySelectorAll(`.ws-char-btn[data-player="${playerId}"]`).forEach(b => {
        (b as HTMLButtonElement).disabled = false;
      });
      if (feedEl) feedEl.textContent = 'Cleared';
      this.context.audio.playTone(250, 0.05);
    }
  }

  private concludeRound(): void {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    if (this.currentRound >= this.maxRounds) {
      this.concludeGame();
    } else {
      this.currentRound++;
      this.setupRoundUI();
      this.startRoundTimer();
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
