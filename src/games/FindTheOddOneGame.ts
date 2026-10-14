import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface OddRound {
  baseSymbol: string;
  oddSymbol: string;
  oddIndex: number;
}

const SYMBOL_PAIRS: [string, string][] = [
  ['🐱', '🐶'],
  ['🍎', '🍏'],
  ['⭐', '🌟'],
  ['🚗', '🚕'],
  ['🍩', '🍪'],
  ['🌸', '🌺'],
  ['⚽', '🏀'],
  ['🦊', '🐺'],
  ['💎', '💍'],
  ['☀️', '🌤️'],
  ['🍕', '🍔'],
  ['🎈', '🎉']
];

export class FindTheOddOneGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'find-the-odd-one')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerRounds: Map<PlayerId, OddRound> = new Map();
  private playerFinds: Map<PlayerId, number> = new Map();
  private timeLeft = 15;
  private readonly targetFinds = 7;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerFinds.clear();
    this.playerRounds.clear();
    this.timeLeft = 15;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerFinds.set(p.id, 0);
      this.generateRoundForPlayer(p.id);
    });

    this.container.className = 'game-screen find-the-odd-one-game';
    this.container.innerHTML = `
      <div class="foo-hud">
        <div class="hud-timer" id="foo-timer">15.0s</div>
        <div class="hud-tip">Spot the odd symbol that differs! 🔍</div>
      </div>
      <div class="foo-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="foo-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="foo-zone-header">
              <span class="foo-avatar">${p.avatar}</span>
              <span class="foo-name">${p.name}</span>
              <span class="foo-score" id="foo-score-${p.id}">0 pts (0/${this.targetFinds})</span>
            </div>
            <div class="foo-grid" id="foo-grid-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#foo-timer')!;
    players.forEach(p => this.renderPlayerGrid(p.id));
  }

  private generateRoundForPlayer(playerId: PlayerId): void {
    const pair = SYMBOL_PAIRS[Math.floor(Math.random() * SYMBOL_PAIRS.length)];
    // Randomly assign which is base and which is odd
    const isFirstBase = Math.random() < 0.5;
    const baseSymbol = isFirstBase ? pair[0] : pair[1];
    const oddSymbol = isFirstBase ? pair[1] : pair[0];
    const oddIndex = Math.floor(Math.random() * 9); // 3x3 grid = 9 cells

    this.playerRounds.set(playerId, {
      baseSymbol,
      oddSymbol,
      oddIndex
    });
  }

  private renderPlayerGrid(playerId: PlayerId): void {
    const gridEl = this.container.querySelector(`#foo-grid-${playerId}`);
    const round = this.playerRounds.get(playerId);
    if (!gridEl || !round) return;

    let html = '';
    for (let i = 0; i < 9; i++) {
      const sym = i === round.oddIndex ? round.oddSymbol : round.baseSymbol;
      html += `
        <button class="foo-cell" data-idx="${i}" aria-label="Symbol ${i + 1}">
          <span>${sym}</span>
        </button>
      `;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.foo-cell').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        this.handleInput(playerId, 'TAP', { index: idx });
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
    if (!this.isRunning || this.isFinished || action !== 'TAP') return;
    const round = this.playerRounds.get(playerId);
    if (!round) return;

    const { index } = (data as { index: number }) || { index: -1 };
    const gridEl = this.container.querySelector(`#foo-grid-${playerId}`);
    const cellBtn = gridEl?.querySelector(`[data-idx="${index}"]`);

    if (index === round.oddIndex) {
      // Correct!
      const currentFinds = (this.playerFinds.get(playerId) || 0) + 1;
      this.playerFinds.set(playerId, currentFinds);
      this.playerScores[playerId] = currentFinds * 10;

      this.context.audio.playPop();
      this.context.haptics.light();

      const scoreEl = this.container.querySelector(`#foo-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${currentFinds}/${this.targetFinds})`;
      }

      if (cellBtn) {
        cellBtn.classList.add('correct');
      }

      if (currentFinds >= this.targetFinds) {
        // Player completed all rounds
        this.context.audio.playSuccess();
        this.setGameTimeout(() => this.concludeGame(), 300);
        return;
      }

      this.setGameTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.generateRoundForPlayer(playerId);
        this.renderPlayerGrid(playerId);
      }, 150);
    } else {
      // Wrong!
      this.context.audio.playError();
      this.context.haptics.error();
      if (cellBtn) {
        cellBtn.classList.add('wrong');
        this.setGameTimeout(() => cellBtn.classList.remove('wrong'), 250);
      }
      // Small penalty
      this.playerScores[playerId] = Math.max(0, this.playerScores[playerId] - 2);
      const scoreEl = this.container.querySelector(`#foo-score-${playerId}`);
      if (scoreEl) {
        scoreEl.textContent = `${this.playerScores[playerId]} pts (${this.playerFinds.get(playerId) || 0}/${this.targetFinds})`;
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
      rawStats[p.id] = `${this.playerFinds.get(p.id) || 0} found (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
