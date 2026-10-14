import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class FastestFingerGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'fastest-finger')!;

  private state: 'WAITING' | 'TRIGGERED' | 'FINISHED' = 'WAITING';
  private triggerTimestamp = 0;
  private delayTimerId: number | null = null;
  private playerTaps: Map<PlayerId, number> = new Map();
  private falseStarts: Set<PlayerId> = new Set();

  private statusEl!: HTMLElement;
  private buzzerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.state = 'WAITING';
    this.triggerTimestamp = 0;
    this.playerTaps.clear();
    this.falseStarts.clear();

    this.container.className = 'game-screen fastest-finger-game';
    this.container.innerHTML = `
      <div class="ff-hud">
        <div class="ff-status" id="ff-status">Wait for the Buzzer... DON'T TAP! ⏳</div>
      </div>

      <div class="ff-center">
        <div class="ff-buzzer" id="ff-buzzer">
          <span class="ff-buzzer-icon">⚡</span>
          <span class="ff-buzzer-text">STRIKE!</span>
        </div>
      </div>

      <div class="ff-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ff-player-zone" data-player-id="${p.id}" id="ff-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="ff-zone-content">
              <span class="ff-avatar">${p.avatar}</span>
              <span class="ff-name">${p.name}</span>
              <div class="ff-time-badge" id="ff-time-${p.id}">READY</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.statusEl = this.container.querySelector('#ff-status')!;
    this.buzzerEl = this.container.querySelector('#ff-buzzer')!;

    // Input handlers
    this.container.querySelectorAll('.ff-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP');
      });
    });
  }

  protected onStart(): void {
    const diff = this.context.difficulty || 'NORMAL';
    // Unpredictable delay: 2.2s to 5.5s
    const minDelay = diff === 'EASY' ? 2000 : 2500;
    const maxVar = diff === 'HARD' ? 4500 : 3500;
    const delay = minDelay + Math.random() * maxVar;

    this.delayTimerId = window.setTimeout(() => {
      if (!this.isRunning || this.isFinished) return;
      this.triggerBuzzer();
    }, delay);
  }

  private triggerBuzzer(): void {
    this.state = 'TRIGGERED';
    this.triggerTimestamp = performance.now();

    if (this.statusEl) {
      this.statusEl.textContent = 'STRIKE NOW! ⚡⚡⚡';
      this.statusEl.className = 'ff-status strike';
    }

    if (this.buzzerEl) {
      this.buzzerEl.classList.add('active');
    }

    this.context.audio.playTone(1050, 0.25, 'sawtooth');
    this.context.haptics.heavy();
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'TAP' || this.isFinished) return;

    const timeBadge = this.container.querySelector(`#ff-time-${playerId}`);

    // False start penalty
    if (this.state === 'WAITING') {
      if (!this.falseStarts.has(playerId)) {
        this.falseStarts.add(playerId);
        this.context.audio.playError();
        this.context.haptics.error();
        if (timeBadge) {
          timeBadge.textContent = 'FALSE START! ❌';
          timeBadge.className = 'ff-time-badge error';
        }
      }
      return;
    }

    // Triggered strike
    if (this.state === 'TRIGGERED' && !this.playerTaps.has(playerId) && !this.falseStarts.has(playerId)) {
      const reactionTime = Math.round(performance.now() - this.triggerTimestamp);
      this.playerTaps.set(playerId, reactionTime);

      const isFirst = this.playerTaps.size === 1;
      if (isFirst) {
        this.context.audio.playSuccess();
        this.context.haptics.heavy();
        if (timeBadge) {
          timeBadge.textContent = `1st! ${reactionTime} ms 🏆`;
          timeBadge.className = 'ff-time-badge gold';
        }
      } else {
        this.context.audio.playTap();
        this.context.haptics.medium();
        if (timeBadge) {
          timeBadge.textContent = `${reactionTime} ms`;
          timeBadge.className = 'ff-time-badge';
        }
      }

      // Check if all players tapped or false started
      if (this.playerTaps.size + this.falseStarts.size >= this.context.players.length) {
        this.finishGame();
      }
    }
  }

  private finishGame(): void {
    this.state = 'FINISHED';
    this.isFinished = true;

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    const validTaps: { id: PlayerId; time: number }[] = [];
    this.context.players.forEach(p => {
      if (this.playerTaps.has(p.id)) {
        const time = this.playerTaps.get(p.id)!;
        validTaps.push({ id: p.id, time });
        rawStats[p.id] = `${time}ms`;
      } else if (this.falseStarts.has(p.id)) {
        rawStats[p.id] = 'False Start (-20)';
        scores[p.id] = 0;
      } else {
        rawStats[p.id] = 'Missed';
        scores[p.id] = 0;
      }
    });

    validTaps.sort((a, b) => a.time - b.time);
    validTaps.forEach((entry, idx) => {
      scores[entry.id] = Math.max(10, 100 - idx * 25);
    });

    const winnerId = validTaps.length > 0 ? validTaps[0].id : null;

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1200);
  }

  protected onDestroy(): void {
    if (this.delayTimerId !== null) {
      clearTimeout(this.delayTimerId);
      this.delayTimerId = null;
    }
  }
}
