import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const PAD_COLORS = ['#FF4757', '#00D2D3', '#FFA502', '#2ED573'];
const PAD_FREQS = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5

export class PatternMemoryGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'pattern-memory')!;

  private sequence: number[] = [];
  private playerInputs: Map<PlayerId, number[]> = new Map();
  private playerStreaks: Map<PlayerId, number> = new Map();
  private eliminatedPlayers: Set<PlayerId> = new Set();
  private currentStep = 0;
  private isShowingSequence = false;
  private roundNumber = 1;
  private maxRounds = 5;

  private centerDisplayEl!: HTMLElement;
  private statusEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.sequence = [];
    this.playerInputs.clear();
    this.playerStreaks.clear();
    this.eliminatedPlayers.clear();
    this.currentStep = 0;
    this.roundNumber = 1;

    players.forEach(p => {
      this.playerStreaks.set(p.id, 0);
      this.playerInputs.set(p.id, []);
    });

    this.container.className = 'game-screen pattern-memory-game';
    this.container.innerHTML = `
      <div class="pm-hud">
        <div class="pm-status" id="pm-status">Watch the Sequence!</div>
        <div class="pm-level" id="pm-level">Round 1 of 5</div>
      </div>

      <div class="pm-center" id="pm-center">
        <div class="pm-orb" id="pm-orb">🔮</div>
      </div>

      <div class="pm-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="pm-player-zone" data-player-id="${p.id}" id="pm-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="pm-player-header">
              <span class="pm-avatar">${p.avatar}</span>
              <span class="pm-name">${p.name}</span>
              <span class="pm-streak" id="pm-streak-${p.id}">Score: 0</span>
            </div>
            <div class="pm-pad-grid">
              ${PAD_COLORS.map(
                (col, i) => `
                <button class="pm-pad" data-index="${i}" style="background-color: ${col};" type="button"></button>
              `
              ).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.centerDisplayEl = this.container.querySelector('#pm-center')!;
    this.statusEl = this.container.querySelector('#pm-status')!;

    // Attach listeners
    this.container.querySelectorAll('.pm-player-zone').forEach(zoneEl => {
      const pId = parseInt(zoneEl.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zoneEl.querySelectorAll('.pm-pad').forEach(pad => {
        pad.addEventListener('pointerdown', e => {
          e.preventDefault();
          const padIdx = parseInt(pad.getAttribute('data-index') || '0', 10);
          this.handleInput(pId, 'PAD', padIdx);
        });
      });
    });
  }

  protected onStart(): void {
    this.startRound();
  }

  private startRound(): void {
    if (!this.isRunning || this.isFinished) return;

    this.isShowingSequence = true;
    this.statusEl.textContent = 'Watch the Sequence... 👀';
    this.statusEl.className = 'pm-status status-watch';

    const levelEl = this.container.querySelector('#pm-level');
    if (levelEl) levelEl.textContent = `Round ${this.roundNumber} of ${this.maxRounds}`;

    // Add a random step to the sequence (0, 1, 2, or 3)
    this.sequence.push(Math.floor(Math.random() * 4));

    // Reset player inputs for this round
    this.context.players.forEach(p => {
      if (!this.eliminatedPlayers.has(p.id)) {
        this.playerInputs.set(p.id, []);
      }
    });

    // Playback sequence
    let delay = 600;
    this.sequence.forEach((padIndex, stepIdx) => {
      setTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.flashPad(padIndex);
        if (stepIdx === this.sequence.length - 1) {
          setTimeout(() => {
            if (!this.isRunning || this.isFinished) return;
            this.isShowingSequence = false;
            this.statusEl.textContent = 'YOUR TURN! REPEAT THE PATTERN!';
            this.statusEl.className = 'pm-status status-repeat';
          }, 400);
        }
      }, delay);
      delay += 550;
    });
  }

  private flashPad(index: number): void {
    const orb = this.container.querySelector('#pm-orb') as HTMLElement;
    if (orb) {
      orb.style.backgroundColor = PAD_COLORS[index];
      orb.classList.add('flash');
      setTimeout(() => orb.classList.remove('flash'), 300);
    }
    this.context.audio.playTone(PAD_FREQS[index], 0.25, 'triangle');
    this.context.haptics.light();
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'PAD' || this.isShowingSequence || !this.isRunning || this.isFinished) return;
    if (this.eliminatedPlayers.has(playerId)) return;

    const padIndex = data as number;
    const inputs = this.playerInputs.get(playerId) || [];
    const expected = this.sequence[inputs.length];

    // Audio & light
    this.context.audio.playTone(PAD_FREQS[padIndex], 0.15, 'sine');

    if (padIndex === expected) {
      // Correct pad!
      inputs.push(padIndex);
      this.playerInputs.set(playerId, inputs);
      this.playerStreaks.set(playerId, (this.playerStreaks.get(playerId) || 0) + 1);

      const streakEl = this.container.querySelector(`#pm-streak-${playerId}`);
      if (streakEl) streakEl.textContent = `Score: ${this.playerStreaks.get(playerId)}`;

      // Check if this player finished the full sequence for this round
      if (inputs.length === this.sequence.length) {
        this.context.audio.playSuccess();
        this.context.haptics.light();
        this.checkRoundProgression();
      }
    } else {
      // Mistake!
      this.eliminatedPlayers.add(playerId);
      this.context.audio.playError();
      this.context.haptics.error();

      const zone = this.container.querySelector(`#pm-zone-${playerId}`);
      if (zone) zone.classList.add('zone-eliminated');

      // Check if all players are eliminated or completed
      this.checkRoundProgression();
    }
  }

  private checkRoundProgression(): void {
    const activePlayers = this.context.players;
    const allEliminated = activePlayers.every(p => this.eliminatedPlayers.has(p.id));

    // Check if remaining non-eliminated players finished this round
    const remainingPlayers = activePlayers.filter(p => !this.eliminatedPlayers.has(p.id));
    const allFinishedRound = remainingPlayers.every(
      p => (this.playerInputs.get(p.id) || []).length === this.sequence.length
    );

    if (allEliminated || this.roundNumber >= this.maxRounds) {
      this.finishGame();
      return;
    }

    if (allFinishedRound && remainingPlayers.length > 0) {
      this.roundNumber++;
      setTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.startRound();
      }, 1000);
    }
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.context.players.forEach(p => {
      const streak = this.playerStreaks.get(p.id) || 0;
      scores[p.id] = streak * 20;
      rawStats[p.id] = `${streak} correct notes`;
    });

    const activePlayers = this.context.players;
    const sorted = [...activePlayers].sort(
      (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
    );

    const winnerId =
      sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id] ? 'TIE' : sorted[0].id;

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1200);
  }
}
