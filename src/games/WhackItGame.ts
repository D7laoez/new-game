import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface HoleState {
  type: 'MOLE' | 'BOMB' | 'EMPTY';
  timerId: number | null;
}

export class WhackItGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'whack-it')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerHoles: Map<PlayerId, HoleState[]> = new Map();
  private spawnIntervalId: number | null = null;
  private gameTimerId: number | null = null;
  private timeLeft = 15;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.timeLeft = 15;
    this.playerHoles.clear();

    this.container.className = 'game-screen whack-it-game';
    this.container.innerHTML = `
      <div class="game-hud">
        <div class="hud-timer" id="whack-timer">⏱️ 15s</div>
        <div class="hud-tip">Whack 🐹 (+2) • Avoid 💣 (-2)</div>
      </div>
      <div class="whack-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="whack-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="whack-zone-header">
              <span class="whack-avatar">${p.avatar}</span>
              <span class="whack-name">${p.name}</span>
              <span class="whack-score" id="whack-score-${p.id}">0 pts</span>
            </div>
            <div class="whack-grid" data-grid-player="${p.id}">
              ${[0, 1, 2, 3]
                .map(
                  hIdx => `
                <div class="whack-hole" data-hole-idx="${hIdx}">
                  <div class="whack-target empty" id="target-${p.id}-${hIdx}"></div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#whack-timer')!;

    // Initialize holes for each player
    players.forEach(p => {
      this.playerHoles.set(p.id, [
        { type: 'EMPTY', timerId: null },
        { type: 'EMPTY', timerId: null },
        { type: 'EMPTY', timerId: null },
        { type: 'EMPTY', timerId: null }
      ]);
    });

    // Event listeners
    this.container.querySelectorAll('.whack-hole').forEach(holeEl => {
      holeEl.addEventListener('pointerdown', e => {
        e.preventDefault();
        const zone = holeEl.closest('.whack-player-zone');
        if (!zone) return;
        const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
        const holeIdx = parseInt(holeEl.getAttribute('data-hole-idx') || '0', 10);
        this.handleInput(pId, 'WHACK', holeIdx);
      });
    });
  }

  protected onStart(): void {
    // Game countdown timer
    this.gameTimerId = window.setInterval(() => {
      this.timeLeft--;
      if (this.timerEl) this.timerEl.textContent = `⏱️ ${this.timeLeft}s`;

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 1000);

    // Moles spawner loop
    this.spawnIntervalId = window.setInterval(() => {
      this.spawnEntities();
    }, 700);

    // Initial immediate spawn
    this.spawnEntities();
  }

  private spawnEntities(): void {
    if (!this.isRunning || this.isFinished) return;

    for (const player of this.context.players) {
      const holes = this.playerHoles.get(player.id);
      if (!holes) continue;

      // Find empty holes
      const emptyIndices = holes
        .map((h, idx) => (h.type === 'EMPTY' ? idx : -1))
        .filter(idx => idx !== -1);

      if (emptyIndices.length > 0 && Math.random() < 0.75) {
        const chosenHoleIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const isBomb = Math.random() < 0.25;
        const targetType: 'MOLE' | 'BOMB' = isBomb ? 'BOMB' : 'MOLE';

        holes[chosenHoleIdx].type = targetType;
        const el = this.container.querySelector(`#target-${player.id}-${chosenHoleIdx}`);
        if (el) {
          el.className = `whack-target active ${isBomb ? 'bomb' : 'mole'}`;
          el.textContent = isBomb ? '💣' : '🐹';
        }

        // Auto hide after 900ms
        const stayDuration = Math.max(550, 900 - (15 - this.timeLeft) * 20);
        holes[chosenHoleIdx].timerId = window.setTimeout(() => {
          if (holes[chosenHoleIdx] && holes[chosenHoleIdx].type === targetType) {
            holes[chosenHoleIdx].type = 'EMPTY';
            if (el) {
              el.className = 'whack-target empty';
              el.textContent = '';
            }
          }
        }, stayDuration);
      }
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'WHACK') return;
    const holeIdx = data as number;
    const holes = this.playerHoles.get(playerId);
    if (!holes || !holes[holeIdx]) return;

    const currentHole = holes[holeIdx];
    const el = this.container.querySelector(`#target-${playerId}-${holeIdx}`);

    if (currentHole.type === 'MOLE') {
      currentHole.type = 'EMPTY';
      if (currentHole.timerId) clearTimeout(currentHole.timerId);
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + 2;
      this.context.audio.playPop();
      this.context.haptics.light();

      if (el) {
        el.className = 'whack-target whacked mole';
        el.textContent = '💥';
        setTimeout(() => {
          if (el.classList.contains('whacked')) {
            el.className = 'whack-target empty';
            el.textContent = '';
          }
        }, 200);
      }
    } else if (currentHole.type === 'BOMB') {
      currentHole.type = 'EMPTY';
      if (currentHole.timerId) clearTimeout(currentHole.timerId);
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 2);
      this.context.audio.playError();
      this.context.haptics.heavy();

      if (el) {
        el.className = 'whack-target whacked bomb';
        el.textContent = '🔥';
        setTimeout(() => {
          if (el.classList.contains('whacked')) {
            el.className = 'whack-target empty';
            el.textContent = '';
          }
        }, 200);
      }
    } else {
      // Missed tap
      return;
    }

    const scoreBadge = this.container.querySelector(`#whack-score-${playerId}`);
    if (scoreBadge) {
      scoreBadge.textContent = `${this.playerScores[playerId]} pts`;
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;
    this.cleanTimers();

    const players = this.context.players;
    const sorted = [...players].sort(
      (a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0)
    );

    let winnerId: PlayerId | 'TIE' | null = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats: this.playerScores
    });
  }

  finish(): void {
    this.concludeGame();
  }

  private cleanTimers(): void {
    if (this.gameTimerId) {
      clearInterval(this.gameTimerId);
      this.gameTimerId = null;
    }
    if (this.spawnIntervalId) {
      clearInterval(this.spawnIntervalId);
      this.spawnIntervalId = null;
    }
    this.playerHoles.forEach(holes => {
      holes.forEach(h => {
        if (h.timerId) clearTimeout(h.timerId);
      });
    });
  }

  protected onDestroy(): void {
    this.cleanTimers();
  }
}
