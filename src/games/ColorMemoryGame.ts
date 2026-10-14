import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

const COLOR_TILES = [
  { name: 'Red', hex: '#FF4757', freq: 261.63 },
  { name: 'Cyan', hex: '#00D2D3', freq: 329.63 },
  { name: 'Yellow', hex: '#FFA502', freq: 392.0 },
  { name: 'Green', hex: '#2ED573', freq: 523.25 },
  { name: 'Purple', hex: '#9B59B6', freq: 587.33 }
];

export class ColorMemoryGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'color-memory')!;

  private sequence: number[] = [];
  private playerInputs: Map<PlayerId, number[]> = new Map();
  private playerStreaks: Map<PlayerId, number> = new Map();
  private eliminatedPlayers: Set<PlayerId> = new Set();
  private isShowingSequence = false;
  private currentStage = 1;
  private maxStages = 6;

  private centralOrbEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private stageEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxStages = diff === 'EASY' ? 4 : diff === 'HARD' ? 7 : 5;
    this.currentStage = 1;
    this.sequence = [];
    this.playerInputs.clear();
    this.playerStreaks.clear();
    this.eliminatedPlayers.clear();

    players.forEach(p => {
      this.playerStreaks.set(p.id, 0);
      this.playerInputs.set(p.id, []);
    });

    this.container.className = 'game-screen color-memory-game';
    this.container.innerHTML = `
      <div class="cm-hud">
        <div class="cm-stage-tag" id="cm-stage-tag">Stage 1 / ${this.maxStages}</div>
        <div class="cm-status" id="cm-status">Watch the color sequence! 🌈</div>
      </div>

      <div class="cm-center">
        <div class="cm-orb" id="cm-orb">🔮</div>
      </div>

      <div class="cm-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="cm-player-zone" data-player-id="${p.id}" id="cm-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="cm-player-header">
              <span class="cm-avatar">${p.avatar}</span>
              <span class="cm-name">${p.name}</span>
              <span class="cm-streak" id="cm-streak-${p.id}">Streak: 0</span>
            </div>
            <div class="cm-buttons-strip">
              ${COLOR_TILES.map(
                (c, idx) => `
                <button class="cm-color-btn" data-index="${idx}" style="background-color: ${c.hex}" type="button"></button>
              `
              ).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.centralOrbEl = this.container.querySelector('#cm-orb')!;
    this.statusEl = this.container.querySelector('#cm-status')!;
    this.stageEl = this.container.querySelector('#cm-stage-tag')!;

    // Input handlers
    this.container.querySelectorAll('.cm-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.querySelectorAll('.cm-color-btn').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
          this.handleInput(pId, 'TAP_COLOR', idx);
        });
      });
    });
  }

  protected onStart(): void {
    this.startStage();
  }

  private startStage(): void {
    if (!this.isRunning || this.isFinished) return;

    this.isShowingSequence = true;
    this.statusEl.textContent = 'Watch the sequence carefully... 🌈';
    this.statusEl.className = 'cm-status status-watch';

    if (this.stageEl) {
      this.stageEl.textContent = `Stage ${this.currentStage} / ${this.maxStages}`;
    }

    // Add a new random color to sequence
    this.sequence.push(Math.floor(Math.random() * COLOR_TILES.length));

    // Reset player inputs for this stage
    this.context.players.forEach(p => {
      if (!this.eliminatedPlayers.has(p.id)) {
        this.playerInputs.set(p.id, []);
      }
    });

    // Playback sequence
    let delay = 500;
    this.sequence.forEach((colIdx, idx) => {
      setTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.flashColor(colIdx);
        if (idx === this.sequence.length - 1) {
          setTimeout(() => {
            if (!this.isRunning || this.isFinished) return;
            this.isShowingSequence = false;
            this.statusEl.textContent = 'YOUR TURN! REPEAT THE SEQUENCE!';
            this.statusEl.className = 'cm-status status-repeat';
          }, 400);
        }
      }, delay);
      delay += 550;
    });
  }

  private flashColor(index: number): void {
    const tile = COLOR_TILES[index];
    if (this.centralOrbEl) {
      this.centralOrbEl.style.backgroundColor = tile.hex;
      this.centralOrbEl.classList.add('flash');
      setTimeout(() => this.centralOrbEl.classList.remove('flash'), 300);
    }
    this.context.audio.playTone(tile.freq, 0.2, 'triangle');
    this.context.haptics.light();
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'TAP_COLOR' || this.isShowingSequence || !this.isRunning || this.isFinished) return;
    if (this.eliminatedPlayers.has(playerId)) return;

    const colIndex = data as number;
    const tile = COLOR_TILES[colIndex];
    this.context.audio.playTone(tile.freq, 0.1, 'sine');

    const inputs = this.playerInputs.get(playerId) || [];
    const expected = this.sequence[inputs.length];

    if (colIndex === expected) {
      // Correct!
      inputs.push(colIndex);
      this.playerInputs.set(playerId, inputs);
      this.playerStreaks.set(playerId, (this.playerStreaks.get(playerId) || 0) + 1);

      const streakEl = this.container.querySelector(`#cm-streak-${playerId}`);
      if (streakEl) streakEl.textContent = `Streak: ${this.playerStreaks.get(playerId)}`;

      // Check if finished stage
      if (inputs.length === this.sequence.length) {
        this.context.audio.playSuccess();
        this.context.haptics.light();
        this.checkStageProgression();
      }
    } else {
      // MISTAKE -> ELIMINATED!
      this.eliminatedPlayers.add(playerId);
      this.context.audio.playError();
      this.context.haptics.error();

      const zone = this.container.querySelector(`#cm-zone-${playerId}`);
      if (zone) zone.classList.add('zone-eliminated');

      this.checkStageProgression();
    }
  }

  private checkStageProgression(): void {
    const activePlayers = this.context.players;
    const allEliminated = activePlayers.every(p => this.eliminatedPlayers.has(p.id));

    const remaining = activePlayers.filter(p => !this.eliminatedPlayers.has(p.id));
    const allFinishedStage = remaining.every(
      p => (this.playerInputs.get(p.id) || []).length === this.sequence.length
    );

    if (allEliminated || this.currentStage >= this.maxStages) {
      this.finishGame();
      return;
    }

    if (allFinishedStage && remaining.length > 0) {
      this.currentStage++;
      setTimeout(() => {
        if (!this.isRunning || this.isFinished) return;
        this.startStage();
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
      scores[p.id] = streak * 15;
      rawStats[p.id] = `${streak} colors memorized`;
    });

    const activePlayers = this.context.players;
    const sorted = [...activePlayers].sort(
      (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
    );

    const winnerId =
      sorted.length > 1 && scores[sorted[0].id] === scores[sorted[1].id]
        ? 'TIE'
        : sorted[0].id;

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1000);
  }
}
