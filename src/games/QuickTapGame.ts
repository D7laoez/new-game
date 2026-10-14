import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class QuickTapGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'quick-tap')!;

  private state: 'WAITING' | 'READY' | 'TRIGGERED' | 'FINISHED' = 'WAITING';
  private triggerTimestamp = 0;
  private timerId: number | null = null;
  private playerTimes: Map<PlayerId, number> = new Map();
  private falseStarts: Set<PlayerId> = new Set();
  private signalEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private playerZonesEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;

    this.container.className = 'game-screen quick-tap-game';
    this.container.innerHTML = `
      <div class="qt-header">
        <div class="qt-status" id="qt-status">Wait for GREEN...</div>
        <div class="qt-signal" id="qt-signal">
          <div class="qt-signal-light red active"></div>
          <div class="qt-signal-light yellow"></div>
          <div class="qt-signal-light green"></div>
        </div>
      </div>
      <div class="qt-zones player-grid-${players.length}" id="qt-zones">
        ${players
          .map(
            p => `
          <div class="qt-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="qt-zone-content">
              <span class="qt-avatar">${p.avatar}</span>
              <span class="qt-name">${p.name}</span>
              <div class="qt-time-badge" id="qt-time-${p.id}">READY</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.signalEl = this.container.querySelector('#qt-signal')!;
    this.statusEl = this.container.querySelector('#qt-status')!;
    this.playerZonesEl = this.container.querySelector('#qt-zones')!;

    // Touch & pointer handlers for all players
    this.playerZonesEl.querySelectorAll('.qt-player-zone').forEach(el => {
      const pId = parseInt(el.getAttribute('data-player-id') || '1', 10) as PlayerId;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'TAP');
      });
    });
  }

  protected onStart(): void {
    this.state = 'WAITING';
    this.statusEl.textContent = 'Wait for GREEN... Do NOT tap yet!';
    this.statusEl.className = 'qt-status text-waiting';

    // Random trigger delay between 2.2 and 5.5 seconds
    const delay = 2200 + Math.random() * 3300;

    this.timerId = window.setTimeout(() => {
      if (!this.isRunning) return;
      this.triggerSignal();
    }, delay);
  }

  private triggerSignal(): void {
    this.state = 'TRIGGERED';
    this.triggerTimestamp = performance.now();

    this.statusEl.textContent = 'TAP NOW!';
    this.statusEl.className = 'qt-status text-tap-now';

    const redLight = this.signalEl.querySelector('.red');
    const greenLight = this.signalEl.querySelector('.green');
    if (redLight && greenLight) {
      redLight.classList.remove('active');
      greenLight.classList.add('active');
    }

    this.context.audio.playTone(880, 0.2, 'square');
    this.context.haptics.heavy();
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'TAP') return;
    if (this.isFinished) return;

    const timeBadge = this.container.querySelector(`#qt-time-${playerId}`);

    // If player taps before trigger: FALSE START!
    if (this.state === 'WAITING' || this.state === 'READY') {
      if (!this.falseStarts.has(playerId)) {
        this.falseStarts.add(playerId);
        this.context.audio.playError();
        this.context.haptics.error();
        if (timeBadge) {
          timeBadge.textContent = 'FALSE START! (-5)';
          timeBadge.className = 'qt-time-badge error';
        }
      }
      return;
    }

    // Triggered state: record reaction time!
    if (this.state === 'TRIGGERED' && !this.playerTimes.has(playerId) && !this.falseStarts.has(playerId)) {
      const reactionTime = Math.round(performance.now() - this.triggerTimestamp);
      this.playerTimes.set(playerId, reactionTime);

      this.context.audio.playSuccess();
      this.context.haptics.light();

      if (timeBadge) {
        timeBadge.textContent = `${reactionTime} ms`;
        timeBadge.className = 'qt-time-badge success';
      }

      // Check if all players have tapped or false started
      const totalPlayers = this.context.players.length;
      if (this.playerTimes.size + this.falseStarts.size >= totalPlayers) {
        this.finishRound();
      }
    }
  }

  private finishRound(): void {
    this.state = 'FINISHED';

    // Calculate rank: lowest reaction time gets highest score
    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    const validTaps: { id: PlayerId; time: number }[] = [];
    this.context.players.forEach(p => {
      if (this.playerTimes.has(p.id)) {
        const time = this.playerTimes.get(p.id)!;
        validTaps.push({ id: p.id, time });
        rawStats[p.id] = `${time}ms`;
      } else if (this.falseStarts.has(p.id)) {
        rawStats[p.id] = 'False Start';
      } else {
        rawStats[p.id] = 'No Tap';
      }
    });

    validTaps.sort((a, b) => a.time - b.time);

    // Points distribution
    validTaps.forEach((entry, idx) => {
      // 1st gets 1000 - time/2, 2nd gets less
      scores[entry.id] = Math.max(1, 100 - idx * 25);
    });

    // Penalize false starts
    this.falseStarts.forEach(pId => {
      scores[pId] = 0;
    });

    const winnerId = validTaps.length > 0 ? validTaps[0].id : null;

    setTimeout(() => {
      const result: MiniGameResult = {
        scores,
        winnerId,
        rawStats
      };
      this.finishWithResult(result);
    }, 1200);
  }

  protected onDestroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
