import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type SequenceColor = 0 | 1 | 2 | 3; // Red, Blue, Green, Yellow

const PAD_CONFIG: { color: SequenceColor; emoji: string; bg: string }[] = [
  { color: 0, emoji: '🔴', bg: '#ef4444' },
  { color: 1, emoji: '🔵', bg: '#3b82f6' },
  { color: 2, emoji: '🟢', bg: '#10b981' },
  { color: 3, emoji: '🟡', bg: '#f59e0b' }
];

export class MemorySequenceDuelGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'memory-sequence-duel')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerProgress: Map<PlayerId, number> = new Map();
  private playerEliminated: Map<PlayerId, boolean> = new Map();
  private currentSequence: SequenceColor[] = [];
  private sequenceLength = 3;
  private maxRounds = 5;
  private currentRound = 1;
  private isShowingSequence = true;
  private showTimeoutId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentRound = 1;
    this.sequenceLength = 3;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerProgress.set(p.id, 0);
      this.playerEliminated.set(p.id, false);
    });

    this.container.className = 'game-screen memory-seq-duel-game';
    this.container.innerHTML = `
      <div class="msd-hud">
        <div class="msd-round-tag" id="msd-round-tag">Round 1 / 5 (3 Steps)</div>
        <div class="msd-screen-status" id="msd-status">MEMORIZE THE SEQUENCE! 👀</div>
      </div>
      <div class="msd-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="msd-player-station" id="msd-station-${p.id}" style="--p-col: ${p.color}">
            <div class="msd-player-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="msd-score" id="msd-score-${p.id}">0 pts</span>
            </div>
            <div class="msd-pads-grid">
              ${PAD_CONFIG.map(
                pad => `
                <button class="msd-pad msd-pad-${pad.color}" data-player="${p.id}" data-color="${pad.color}">
                  ${pad.emoji}
                </button>
              `
              ).join('')}
            </div>
            <div class="msd-feedback" id="msd-feed-${p.id}">Wait for playback...</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind pads
    this.container.querySelectorAll('.msd-pad').forEach(pad => {
      const pId = parseInt(pad.getAttribute('data-player') || '1', 10) as PlayerId;
      const color = parseInt(pad.getAttribute('data-color') || '0', 10) as SequenceColor;
      pad.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP', color);
      });
    });
  }

  protected onStart(): void {
    this.startNewSequenceRound();
  }

  private startNewSequenceRound(): void {
    this.isShowingSequence = true;
    this.context.players.forEach(p => {
      this.playerProgress.set(p.id, 0);
      this.playerEliminated.set(p.id, false);
      const feed = this.container.querySelector(`#msd-feed-${p.id}`);
      if (feed) feed.textContent = '👀 Watch closely!';
    });

    const statusEl = this.container.querySelector('#msd-status');
    if (statusEl) statusEl.textContent = 'MEMORIZE THE SEQUENCE! 👀';

    const roundEl = this.container.querySelector('#msd-round-tag');
    if (roundEl) roundEl.textContent = `Round ${this.currentRound} / ${this.maxRounds} (${this.sequenceLength} Steps)`;

    // Generate random sequence
    this.currentSequence = [];
    for (let i = 0; i < this.sequenceLength; i++) {
      this.currentSequence.push(Math.floor(Math.random() * 4) as SequenceColor);
    }

    // Playback sequence with highlights
    this.playSequenceStep(0);
  }

  private playSequenceStep(index: number): void {
    if (index >= this.currentSequence.length) {
      // Done showing, players can now input
      this.isShowingSequence = false;
      const statusEl = this.container.querySelector('#msd-status');
      if (statusEl) statusEl.textContent = 'REPRODUCE NOW! 🧠';
      this.context.players.forEach(p => {
        const feed = this.container.querySelector(`#msd-feed-${p.id}`);
        if (feed) feed.textContent = `Step 1 / ${this.sequenceLength}`;
      });
      return;
    }

    const color = this.currentSequence[index];
    this.highlightAllPads(color);
    this.context.audio.playTone(300 + color * 100, 0.2);

    this.showTimeoutId = window.setTimeout(() => {
      this.unhighlightAllPads();
      this.showTimeoutId = window.setTimeout(() => {
        this.playSequenceStep(index + 1);
      }, 250);
    }, 450);
  }

  private highlightAllPads(color: SequenceColor): void {
    this.container.querySelectorAll(`.msd-pad-${color}`).forEach(pad => {
      pad.classList.add('flash-active');
    });
  }

  private unhighlightAllPads(): void {
    this.container.querySelectorAll('.msd-pad').forEach(pad => {
      pad.classList.remove('flash-active');
    });
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || this.isShowingSequence || action !== 'TAP') return;
    if (this.playerEliminated.get(playerId)) return;

    const chosenColor = data as SequenceColor;
    const curIdx = this.playerProgress.get(playerId) ?? 0;
    const expectedColor = this.currentSequence[curIdx];

    const feedEl = this.container.querySelector(`#msd-feed-${playerId}`);

    if (chosenColor === expectedColor) {
      // Correct step
      const nextIdx = curIdx + 1;
      this.playerProgress.set(playerId, nextIdx);
      this.context.audio.playTone(350 + chosenColor * 80, 0.1);
      this.context.haptics.light();

      if (feedEl) feedEl.textContent = `Step ${nextIdx} / ${this.sequenceLength} ✅`;

      if (nextIdx >= this.sequenceLength) {
        // Player completed the round sequence!
        this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 5;
        const scoreEl = this.container.querySelector(`#msd-score-${playerId}`);
        if (scoreEl) scoreEl.textContent = `${this.playerScores[playerId]} pts`;
        if (feedEl) feedEl.textContent = 'COMPLETED! +5 pts ⭐';

        this.context.audio.playSuccess();
        this.context.haptics.heavy();

        // Check if all players either finished or eliminated
        this.checkRoundProgression();
      }
    } else {
      // Wrong step! Eliminated for this round
      this.playerEliminated.set(playerId, true);
      this.context.audio.playError();
      this.context.haptics.heavy();
      if (feedEl) feedEl.textContent = 'MISTAKE! ❌ (0 pts)';

      this.checkRoundProgression();
    }
  }

  private checkRoundProgression(): void {
    const allDone = this.context.players.every(p => {
      const progress = this.playerProgress.get(p.id) || 0;
      const eliminated = this.playerEliminated.get(p.id);
      return progress >= this.sequenceLength || eliminated;
    });

    if (allDone) {
      setTimeout(() => {
        if (this.currentRound >= this.maxRounds) {
          this.concludeGame();
        } else {
          this.currentRound++;
          this.sequenceLength++;
          this.startNewSequenceRound();
        }
      }, 1000);
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    if (this.showTimeoutId) clearTimeout(this.showTimeoutId);

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
    if (this.showTimeoutId) clearTimeout(this.showTimeoutId);
  }
}
