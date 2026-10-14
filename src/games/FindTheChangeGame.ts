import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const POOL = ['🍎', '🍌', '🍕', '🚀', '⭐', '💎', '⚽', '🚗', '🐶', '🐱', '🌵', '🎈', '👑', '🎸', '🔥'];

interface ChangeRound {
  items: string[];
  changedIndex: number;
  originalItem: string;
  newItem: string;
  phase: 'MEMORIZE' | 'SELECT';
}

export class FindTheChangeGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'find-the-change')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerRounds: Map<PlayerId, ChangeRound> = new Map();
  private playerRoundCounts: Map<PlayerId, number> = new Map();
  private timeLeft = 20;
  private readonly totalRounds = 4;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerRounds.clear();
    this.playerRoundCounts.clear();
    this.timeLeft = 20;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerRoundCounts.set(p.id, 0);
    });

    this.container.className = 'game-screen find-the-change-game';
    this.container.innerHTML = `
      <div class="ftc-hud">
        <div class="hud-timer" id="ftc-timer">20.0s</div>
        <div class="hud-tip" id="ftc-tip">Memorize the items, then spot what changed! 👀</div>
      </div>
      <div class="ftc-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ftc-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="ftc-zone-header">
              <span class="ftc-avatar">${p.avatar}</span>
              <span class="ftc-name">${p.name}</span>
              <span class="ftc-score" id="ftc-score-${p.id}">0 pts (0/${this.totalRounds})</span>
            </div>
            <div class="ftc-status" id="ftc-status-${p.id}">Memorizing...</div>
            <div class="ftc-grid" id="ftc-grid-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#ftc-timer')!;
    players.forEach(p => this.startNewRoundForPlayer(p.id));
  }

  private startNewRoundForPlayer(playerId: PlayerId): void {
    const roundCount = this.playerRoundCounts.get(playerId) || 0;
    if (roundCount >= this.totalRounds) return;

    // Pick 6 unique random items
    const shuffled = [...POOL].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6);
    const changedIdx = Math.floor(Math.random() * 6);
    const original = selected[changedIdx];

    // Pick a replacement not in selected
    const replacement = shuffled.slice(6).find(x => !selected.includes(x)) || '🎁';

    const roundData: ChangeRound = {
      items: [...selected],
      changedIndex: changedIdx,
      originalItem: original,
      newItem: replacement,
      phase: 'MEMORIZE'
    };
    this.playerRounds.set(playerId, roundData);

    this.renderPlayerGrid(playerId);

    const statusEl = this.container.querySelector(`#ftc-status-${playerId}`);
    if (statusEl) statusEl.textContent = '👀 Memorize these 6 items!';

    // After 1.5 seconds, swap the item and switch to SELECT phase
    this.setGameTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      const curRound = this.playerRounds.get(playerId);
      if (!curRound || curRound.phase !== 'MEMORIZE') return;

      curRound.items[curRound.changedIndex] = curRound.newItem;
      curRound.phase = 'SELECT';

      if (statusEl) statusEl.textContent = '❓ Which item just changed? Tap it!';
      this.context.audio.playWhoosh();
      this.renderPlayerGrid(playerId);
    }, 1500);
  }

  private renderPlayerGrid(playerId: PlayerId): void {
    const gridEl = this.container.querySelector(`#ftc-grid-${playerId}`);
    const round = this.playerRounds.get(playerId);
    if (!gridEl || !round) return;

    let html = '';
    round.items.forEach((item, idx) => {
      const isSelectPhase = round.phase === 'SELECT';
      html += `
        <button class="ftc-cell ${isSelectPhase ? 'selectable' : 'locked'}"
                data-idx="${idx}"
                aria-label="Item ${idx + 1}">
          <span>${item}</span>
        </button>
      `;
    });
    gridEl.innerHTML = html;

    if (round.phase === 'SELECT') {
      gridEl.querySelectorAll('.ftc-cell').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
          this.handleInput(playerId, 'SELECT_ITEM', { index: idx });
        });
      });
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
    if (!this.isRunning || this.isFinished || action !== 'SELECT_ITEM') return;
    const round = this.playerRounds.get(playerId);
    if (!round || round.phase !== 'SELECT') return;

    const { index } = (data as { index: number }) || { index: -1 };
    const gridEl = this.container.querySelector(`#ftc-grid-${playerId}`);
    const cellBtn = gridEl?.querySelector(`[data-idx="${index}"]`);
    const statusEl = this.container.querySelector(`#ftc-status-${playerId}`);

    const isCorrect = index === round.changedIndex;
    const currentCompleted = (this.playerRoundCounts.get(playerId) || 0) + 1;
    this.playerRoundCounts.set(playerId, currentCompleted);

    if (isCorrect) {
      this.playerScores[playerId] += 15;
      this.context.audio.playSuccess();
      this.context.haptics.light();
      if (cellBtn) cellBtn.classList.add('correct');
      if (statusEl) statusEl.textContent = 'CORRECT! 🎉 Spot on!';
    } else {
      this.context.audio.playError();
      this.context.haptics.error();
      if (cellBtn) cellBtn.classList.add('wrong');
      const correctBtn = gridEl?.querySelector(`[data-idx="${round.changedIndex}"]`);
      if (correctBtn) correctBtn.classList.add('reveal');
      if (statusEl) statusEl.textContent = `MISSED! It was ${round.newItem}`;
    }

    const scoreEl = this.container.querySelector(`#ftc-score-${playerId}`);
    if (scoreEl) {
      scoreEl.textContent = `${this.playerScores[playerId]} pts (${currentCompleted}/${this.totalRounds})`;
    }

    // Disable all cells in player's grid for transition
    gridEl?.querySelectorAll('.ftc-cell').forEach(btn => ((btn as HTMLButtonElement).disabled = true));

    if (currentCompleted >= this.totalRounds) {
      const allDone = this.context.players.every(p => (this.playerRoundCounts.get(p.id) || 0) >= this.totalRounds);
      if (allDone) {
        this.setGameTimeout(() => this.concludeGame(), 600);
      }
    } else {
      this.setGameTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.startNewRoundForPlayer(playerId);
      }, 800);
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
      rawStats[p.id] = `${this.playerRoundCounts.get(p.id) || 0} rounds (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
