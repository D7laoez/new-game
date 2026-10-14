import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface LightRacer {
  playerId: PlayerId;
  x: number; // 0 to 29
  y: number; // 0 to 29
  dir: Direction;
  alive: boolean;
  color: string;
}

export class LightTrailDuelGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'light-trail-duel')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private racers: LightRacer[] = [];
  private gridWidth = 30;
  private gridHeight = 30;
  private arenaGrid: number[][] = []; // 0 = empty, playerId = occupied by trail
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private stepTimer = 0;
  private stepInterval = 0.12; // Move every 120ms
  private survivalOrder: PlayerId[] = [];

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.racers = [];
    this.survivalOrder = [];

    // Clear grid
    this.arenaGrid = Array.from({ length: this.gridHeight }, () => Array(this.gridWidth).fill(0));

    // Spawn racers in 4 corners
    const spawnPoints = [
      { x: 3, y: 3, dir: 'RIGHT' as Direction },
      { x: 26, y: 26, dir: 'LEFT' as Direction },
      { x: 26, y: 3, dir: 'DOWN' as Direction },
      { x: 3, y: 26, dir: 'UP' as Direction }
    ];

    players.forEach((p, idx) => {
      this.playerScores[p.id] = 0;
      const sp = spawnPoints[idx % spawnPoints.length];
      this.racers.push({
        playerId: p.id,
        x: sp.x,
        y: sp.y,
        dir: sp.dir,
        alive: true,
        color: p.color
      });
      this.arenaGrid[sp.y][sp.x] = p.id;
    });

    this.container.className = 'game-screen light-trail-game';
    this.container.innerHTML = `
      <div class="ltd-hud">
        <div class="ltd-title">LIGHT TRAIL DUEL ⚡</div>
        <div class="ltd-score-list">
          ${players
            .map(
              p => `
            <div class="ltd-score-chip" style="--p-col: ${p.color}">
              <span>${p.avatar} ${p.name}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="ltd-canvas-wrapper" id="ltd-wrapper">
        <canvas id="ltd-canvas"></canvas>
      </div>
      <div class="ltd-controls-grid player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ltd-dpad" id="ltd-dpad-${p.id}" style="--p-col: ${p.color}">
            <button class="ltd-btn" data-player="${p.id}" data-dir="UP">▲</button>
            <div class="ltd-dpad-row">
              <button class="ltd-btn" data-player="${p.id}" data-dir="LEFT">◀</button>
              <button class="ltd-btn" data-player="${p.id}" data-dir="DOWN">▼</button>
              <button class="ltd-btn" data-player="${p.id}" data-dir="RIGHT">▶</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.canvas = this.container.querySelector('#ltd-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    // Bind d-pad controls
    this.container.querySelectorAll('.ltd-btn').forEach(btn => {
      const pId = parseInt(btn.getAttribute('data-player') || '1', 10) as PlayerId;
      const dir = btn.getAttribute('data-dir') as Direction;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'STEER', dir);
      });
    });
  }

  private handleResize = (): void => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    const wrapper = this.container.querySelector('#ltd-wrapper');
    if (!wrapper || !this.canvas) return;
    const rect = wrapper.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    this.canvas.width = size * (window.devicePixelRatio || 1);
    this.canvas.height = size * (window.devicePixelRatio || 1);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }

  protected onStart(): void {
    this.stepTimer = 0;
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.stepTimer += deltaTime;
    if (this.stepTimer >= this.stepInterval) {
      this.stepTimer = 0;
      this.stepSimulation();
    }

    this.render();
  }

  private stepSimulation(): void {
    const aliveRacers = this.racers.filter(r => r.alive);
    if (aliveRacers.length <= 1 && this.context.players.length > 1) {
      this.concludeGame();
      return;
    }

    const nextPositions: { racer: LightRacer; nx: number; ny: number }[] = [];

    // Calculate intended next positions
    aliveRacers.forEach(r => {
      let nx = r.x;
      let ny = r.y;

      if (r.dir === 'UP') ny--;
      else if (r.dir === 'DOWN') ny++;
      else if (r.dir === 'LEFT') nx--;
      else if (r.dir === 'RIGHT') nx++;

      nextPositions.push({ racer: r, nx, ny });
    });

    // Check collisions
    nextPositions.forEach(({ racer, nx, ny }) => {
      let crashed = false;

      // Wall crash
      if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) {
        crashed = true;
      }
      // Trail crash
      else if (this.arenaGrid[ny][nx] !== 0) {
        crashed = true;
      }

      if (crashed) {
        racer.alive = false;
        this.survivalOrder.push(racer.playerId);
        this.context.audio.playExplosion();
        this.context.haptics.heavy();
      } else {
        racer.x = nx;
        racer.y = ny;
        this.arenaGrid[ny][nx] = racer.playerId;
      }
    });

    // Award points based on survival
    const stillAlive = this.racers.filter(r => r.alive);
    if (stillAlive.length === 1 && this.context.players.length > 1) {
      const winner = stillAlive[0];
      this.playerScores[winner.playerId] = 10;
      this.survivalOrder.forEach((pId, idx) => {
        this.playerScores[pId] = idx + 2;
      });
      this.setGameTimeout(() => this.concludeGame(), 500);
    } else if (stillAlive.length === 0) {
      // Tie crash
      this.survivalOrder.forEach((pId, idx) => {
        this.playerScores[pId] = idx + 2;
      });
      this.setGameTimeout(() => this.concludeGame(), 500);
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished || action !== 'STEER') return;
    const racer = this.racers.find(r => r.playerId === playerId);
    if (!racer || !racer.alive) return;

    const newDir = data as Direction;

    // Prevent direct 180 reverse
    if (
      (racer.dir === 'UP' && newDir === 'DOWN') ||
      (racer.dir === 'DOWN' && newDir === 'UP') ||
      (racer.dir === 'LEFT' && newDir === 'RIGHT') ||
      (racer.dir === 'RIGHT' && newDir === 'LEFT')
    ) {
      return;
    }

    racer.dir = newDir;
    this.context.audio.playWhoosh();
  }

  private render(): void {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cellW = w / this.gridWidth;
    const cellH = h / this.gridHeight;

    this.ctx.fillStyle = '#0a0c16';
    this.ctx.fillRect(0, 0, w, h);

    // Grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= this.gridWidth; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * cellW, 0);
      this.ctx.lineTo(x * cellW, h);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.gridHeight; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * cellH);
      this.ctx.lineTo(w, y * cellH);
      this.ctx.stroke();
    }

    // Draw trails
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const occupier = this.arenaGrid[y][x];
        if (occupier !== 0) {
          const racer = this.racers.find(r => r.playerId === occupier);
          this.ctx.fillStyle = racer?.color || '#3b82f6';
          this.ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
        }
      }
    }

    // Draw racer heads
    this.racers.forEach(r => {
      if (r.alive) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(r.x * cellW, r.y * cellH, cellW, cellH);
      }
    });
  }

  private concludeGame(): void {
    if (this.isFinished) return;

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
    window.removeEventListener('resize', this.handleResize);
  }
}
