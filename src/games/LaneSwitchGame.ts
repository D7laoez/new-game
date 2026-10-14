import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface LaneObstacle {
  id: number;
  lane: number; // 0, 1, 2
  y: number; // 0% to 100%
  speed: number;
  icon: string;
}

export class LaneSwitchGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'lane-switch')!;

  private playerLanes: Map<PlayerId, number> = new Map();
  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerCrashed: Map<PlayerId, boolean> = new Map();
  private obstacles: LaneObstacle[] = [];
  private nextObstacleId = 1;
  private spawnTimer = 0;
  private gameTime = 0;
  private maxDuration = 20.0;
  private timerIntervalId: number | null = null;

  protected onInit(): void {
    const players = this.context.players;
    this.playerLanes.clear();
    this.playerCrashed.clear();
    this.obstacles = [];
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.gameTime = 0;

    players.forEach(p => {
      this.playerLanes.set(p.id, 1); // Middle lane (0, 1, 2)
      this.playerCrashed.set(p.id, false);
      this.playerScores[p.id] = 0;
    });

    this.container.className = 'game-screen lane-switch-game';
    this.container.innerHTML = `
      <div class="ls-hud">
        <div class="ls-timer" id="ls-timer">20.0s</div>
        <div class="ls-title">LANE SWITCH 🏎️</div>
      </div>
      <div class="ls-arena-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ls-player-track" id="ls-track-${p.id}" style="--p-col: ${p.color}">
            <div class="ls-track-header">
              <span>${p.avatar} ${p.name}</span>
              <span class="ls-score" id="ls-score-${p.id}">0 pts</span>
            </div>
            <div class="ls-highway">
              <div class="ls-lane" data-lane="0"></div>
              <div class="ls-lane" data-lane="1"></div>
              <div class="ls-lane" data-lane="2"></div>
              <div class="ls-racer lane-pos-1" id="ls-racer-${p.id}">${p.avatar}</div>
              <div class="ls-obstacles-container" id="ls-obs-${p.id}"></div>
            </div>
            <div class="ls-controls">
              <button class="ls-btn ls-left-btn" data-player="${p.id}" data-dir="LEFT">◀</button>
              <button class="ls-btn ls-right-btn" data-player="${p.id}" data-dir="RIGHT">▶</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Bind touch / click controls
    this.container.querySelectorAll('.ls-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const dir = btn.getAttribute('data-dir') as 'LEFT' | 'RIGHT';
      const handler = (e: Event) => {
        e.preventDefault();
        this.handleInput(pId, dir);
      };
      btn.addEventListener('pointerdown', handler);
    });
  }

  protected onStart(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.gameTime += 0.1;
      const timeLeft = Math.max(0, this.maxDuration - this.gameTime);
      const timerEl = this.container.querySelector('#ls-timer');
      if (timerEl) timerEl.textContent = `${timeLeft.toFixed(1)}s`;

      if (timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    // Spawn obstacles
    this.spawnTimer += deltaTime;
    if (this.spawnTimer > 1.1) {
      this.spawnTimer = 0;
      const lane = Math.floor(Math.random() * 3);
      const icons = ['🚧', '🛢️', '🧱', '🪵'];
      const icon = icons[Math.floor(Math.random() * icons.length)];
      this.obstacles.push({
        id: this.nextObstacleId++,
        lane,
        y: -10,
        speed: 45 + Math.min(25, this.gameTime * 1.5),
        icon
      });
    }

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.y += obs.speed * deltaTime;

      // Check collision with each player at y between 75% and 90%
      if (obs.y >= 75 && obs.y <= 92) {
        this.context.players.forEach(p => {
          if (!this.playerCrashed.get(p.id)) {
            const pLane = this.playerLanes.get(p.id);
            if (pLane === obs.lane) {
              // Crash!
              this.playerCrashed.set(p.id, true);
              this.context.audio.playExplosion();
              this.context.haptics.heavy();
              const racer = this.container.querySelector(`#ls-racer-${p.id}`);
              if (racer) {
                racer.textContent = '💥';
                racer.classList.add('crashed');
              }
              // Check if all players crashed
              const anyAlive = this.context.players.some(pl => !this.playerCrashed.get(pl.id));
              if (!anyAlive) {
                setTimeout(() => this.concludeGame(), 600);
              }
            }
          }
        });
      }

      // Passed screen safely
      if (obs.y > 105) {
        this.obstacles.splice(i, 1);
        // Award points to alive players
        this.context.players.forEach(p => {
          if (!this.playerCrashed.get(p.id)) {
            this.playerScores[p.id] = (this.playerScores[p.id] || 0) + 2;
            const scoreEl = this.container.querySelector(`#ls-score-${p.id}`);
            if (scoreEl) scoreEl.textContent = `${this.playerScores[p.id]} pts`;
          }
        });
      }
    }

    this.renderObstacles();
  }

  private renderObstacles(): void {
    this.context.players.forEach(p => {
      const container = this.container.querySelector(`#ls-obs-${p.id}`);
      if (!container) return;
      container.innerHTML = this.obstacles
        .map(
          obs => `
        <div class="ls-obstacle lane-obs-${obs.lane}" style="top: ${obs.y}%">${obs.icon}</div>
      `
        )
        .join('');
    });
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (!this.isRunning || this.isFinished) return;
    if (this.playerCrashed.get(playerId)) return;

    let curLane = this.playerLanes.get(playerId) ?? 1;
    if (action === 'LEFT' && curLane > 0) {
      curLane--;
      this.context.audio.playWhoosh();
      this.context.haptics.light();
    } else if (action === 'RIGHT' && curLane < 2) {
      curLane++;
      this.context.audio.playWhoosh();
      this.context.haptics.light();
    }

    this.playerLanes.set(playerId, curLane);
    const racer = this.container.querySelector(`#ls-racer-${playerId}`);
    if (racer) {
      racer.className = `ls-racer lane-pos-${curLane}`;
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
