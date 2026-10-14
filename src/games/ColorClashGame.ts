import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface ColorChoice {
  name: string;
  nameAr: string;
  hex: string;
  icon: string;
}

const COLORS: ColorChoice[] = [
  { name: 'RED', nameAr: 'أحمر', hex: '#FF4757', icon: '🔴' },
  { name: 'CYAN', nameAr: 'سماوي', hex: '#00D2D3', icon: '🔷' },
  { name: 'YELLOW', nameAr: 'أصفر', hex: '#FFA502', icon: '🟡' },
  { name: 'GREEN', nameAr: 'أخضر', hex: '#2ED573', icon: '🟢' }
];

export class ColorClashGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'color-clash')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private roundCount = 0;
  private maxRounds = 5;
  private currentColor!: ColorChoice;
  private roundStartTime = 0;
  private firstScorerThisRound: PlayerId | null = null;
  private roundTimeoutId: number | null = null;
  private promptTimerId: number | null = null;
  private playersAnsweredThisRound: Set<PlayerId> = new Set();

  private targetDisplayEl!: HTMLElement;
  private roundTagEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxRounds = diff === 'EASY' ? 4 : diff === 'HARD' ? 7 : 5;
    this.roundCount = 0;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playersAnsweredThisRound.clear();

    this.container.className = 'game-screen color-clash-game';
    this.container.innerHTML = `
      <div class="cc-hud">
        <div class="cc-round-tag" id="cc-round-tag">Round 1 / ${this.maxRounds}</div>
        <div class="cc-target-card" id="cc-target-card">
          <span class="cc-target-icon" id="cc-target-icon">🎨</span>
          <h2 class="cc-target-name" id="cc-target-name">Get Ready...</h2>
        </div>
      </div>

      <div class="cc-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="cc-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="cc-player-header">
              <span class="cc-avatar">${p.avatar}</span>
              <span class="cc-name">${p.name}</span>
              <span class="cc-score-badge" id="cc-score-${p.id}">0 pts</span>
            </div>
            <div class="cc-color-grid">
              ${COLORS.map(
                c => `
                <button class="cc-color-btn" data-color="${c.name}" style="background-color: ${c.hex};" type="button">
                  ${c.icon}
                </button>
              `
              ).join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.targetDisplayEl = this.container.querySelector('#cc-target-card')!;
    this.roundTagEl = this.container.querySelector('#cc-round-tag')!;

    // Touch & pointer handlers
    this.container.querySelectorAll('.cc-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.querySelectorAll('.cc-color-btn').forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          const colorName = btn.getAttribute('data-color') || '';
          this.handleInput(pId, 'COLOR', colorName);
        });
      });
    });
  }

  protected onStart(): void {
    this.nextTargetPrompt();
  }

  private nextTargetPrompt(): void {
    if (!this.isRunning || this.isFinished) return;

    if (this.roundCount >= this.maxRounds) {
      this.finishGame();
      return;
    }

    this.roundCount++;
    this.playersAnsweredThisRound.clear();
    this.firstScorerThisRound = null;

    if (this.roundTagEl) {
      this.roundTagEl.textContent = `Round ${this.roundCount} / ${this.maxRounds}`;
    }

    // Pick random target color
    this.currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const iconEl = this.targetDisplayEl.querySelector('#cc-target-icon')!;
    const nameEl = this.targetDisplayEl.querySelector('#cc-target-name')!;

    iconEl.textContent = this.currentColor.icon;
    nameEl.textContent = `TAP ${this.currentColor.name}!`;
    nameEl.className = 'cc-target-name';
    this.targetDisplayEl.style.borderColor = this.currentColor.hex;
    this.targetDisplayEl.style.boxShadow = `0 0 25px ${this.currentColor.hex}44`;

    this.context.audio.playTone(550, 0.15, 'square');
    this.context.haptics.light();
    this.roundStartTime = performance.now();

    // Round duration scales with difficulty
    const diff = this.context.difficulty || 'NORMAL';
    const roundTime = diff === 'EASY' ? 3000 : diff === 'HARD' ? 1800 : 2400;

    this.roundTimeoutId = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      this.nextTargetPrompt();
    }, roundTime);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'COLOR' || !this.isRunning || this.isFinished) return;
    if (this.playersAnsweredThisRound.has(playerId)) return; // One tap per player per target

    this.playersAnsweredThisRound.add(playerId);
    const selectedColor = data as string;

    const scoreBadge = this.container.querySelector(`#cc-score-${playerId}`);

    if (selectedColor === this.currentColor.name) {
      // Correct!
      let points = 10;
      if (!this.firstScorerThisRound) {
        this.firstScorerThisRound = playerId;
        points += 15; // Speed bonus for first to tap
        this.context.audio.playSuccess();
        this.context.haptics.medium();
      } else {
        this.context.audio.playTap();
        this.context.haptics.light();
      }

      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + points;
      if (scoreBadge) {
        scoreBadge.textContent = `${this.playerScores[playerId]} pts`;
        scoreBadge.classList.add('pop-green');
        setTimeout(() => scoreBadge.classList.remove('pop-green'), 300);
      }
    } else {
      // Wrong! Small penalty
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 5);
      this.context.audio.playError();
      this.context.haptics.error();

      if (scoreBadge) {
        scoreBadge.textContent = `${this.playerScores[playerId]} pts`;
        scoreBadge.classList.add('pop-red');
        setTimeout(() => scoreBadge.classList.remove('pop-red'), 300);
      }
    }

    // If all active players answered, advance immediately without waiting for timeout
    if (this.playersAnsweredThisRound.size >= this.context.players.length) {
      if (this.roundTimeoutId !== null) {
        clearTimeout(this.roundTimeoutId);
        this.roundTimeoutId = null;
      }
      this.promptTimerId = window.setTimeout(() => {
        this.nextTargetPrompt();
      }, 400);
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
      rawStats[p.id] = `${this.playerScores[p.id]} pts`;
    });

    setTimeout(() => {
      this.finishWithResult({
        scores: { ...this.playerScores },
        winnerId,
        rawStats
      });
    }, 1000);
  }

  protected onDestroy(): void {
    if (this.roundTimeoutId !== null) {
      clearTimeout(this.roundTimeoutId);
      this.roundTimeoutId = null;
    }
    if (this.promptTimerId !== null) {
      clearTimeout(this.promptTimerId);
      this.promptTimerId = null;
    }
  }
}
