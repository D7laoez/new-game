import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface Character {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  avatar: string;
  color: string;
  isAlive: boolean;
  survivalTime: number;
  pointerId: number | null;
}

interface Meteor {
  x: number;
  y: number;
  radius: number;
  vy: number;
  vx: number;
  icon: string;
}

export class DodgeArenaGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'dodge-arena')!;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private characters: Map<PlayerId, Character> = new Map();
  private meteors: Meteor[] = [];
  private spawnTimer = 0;
  private gameTime = 0;
  private maxDuration = 25.0;

  private timerEl!: HTMLElement;
  private statusEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.maxDuration = diff === 'EASY' ? 20.0 : diff === 'HARD' ? 30.0 : 25.0;
    this.characters.clear();
    this.meteors = [];
    this.spawnTimer = 0;
    this.gameTime = 0;

    this.container.className = 'game-screen dodge-arena-game';
    this.container.innerHTML = `
      <div class="da-hud">
        <div class="da-timer" id="da-timer">${this.maxDuration.toFixed(1)}s</div>
        <div class="da-status" id="da-status">DRAG TO DODGE METEORS! ☄️</div>
        <div class="da-survivors">
          ${players
            .map(
              p => `
            <div class="da-chip alive" id="da-chip-${p.id}" style="--p-color: ${p.color}">
              <span>${p.avatar} ${p.name}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="da-canvas-wrapper" id="da-wrapper">
        <canvas id="da-canvas"></canvas>
      </div>
    `;

    this.canvas = this.container.querySelector('#da-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.timerEl = this.container.querySelector('#da-timer')!;
    this.statusEl = this.container.querySelector('#da-status')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    // Initialize character positions spread horizontally at bottom
    const w = this.canvas.width;
    const h = this.canvas.height;
    const count = players.length;

    players.forEach((p, idx) => {
      const x = ((idx + 1) / (count + 1)) * w;
      const y = h * 0.8;
      this.characters.set(p.id, {
        id: p.id,
        x,
        y,
        radius: 26 * (window.devicePixelRatio || 1),
        avatar: p.avatar,
        color: p.color,
        isAlive: true,
        survivalTime: 0,
        pointerId: null
      });
    });

    // Touch & pointer tracking
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handleResize = (): void => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    const wrapper = this.container.querySelector('#da-wrapper') as HTMLElement;
    if (!wrapper || !this.canvas) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  protected onStart(): void {
    // Start loop
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.isRunning || this.isFinished) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;

    // Find nearest alive character without an active pointer
    let nearestChar: Character | null = null;
    let minDist = Infinity;

    this.characters.forEach(char => {
      if (!char.isAlive) return;
      const dist = Math.hypot(px - char.x, py - char.y);
      if (dist < minDist && dist < 120 * dpr) {
        minDist = dist;
        nearestChar = char;
      }
    });

    if (nearestChar) {
      (nearestChar as Character).pointerId = e.pointerId;
      (nearestChar as Character).x = px;
      (nearestChar as Character).y = py;
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isRunning || this.isFinished) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;

    this.characters.forEach(char => {
      if (char.pointerId === e.pointerId && char.isAlive) {
        // Constrain to canvas
        char.x = Math.max(char.radius, Math.min(this.canvas.width - char.radius, px));
        char.y = Math.max(char.radius, Math.min(this.canvas.height - char.radius, py));
      }
    });
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.characters.forEach(char => {
      if (char.pointerId === e.pointerId) {
        char.pointerId = null;
      }
    });
  };

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.gameTime += deltaTime;
    const remaining = Math.max(0, this.maxDuration - this.gameTime);
    if (this.timerEl) {
      this.timerEl.textContent = `${remaining.toFixed(1)}s`;
    }

    // Update survival times
    this.characters.forEach(c => {
      if (c.isAlive) c.survivalTime = this.gameTime;
    });

    // Check if time up
    if (remaining <= 0) {
      this.finishGame();
      return;
    }

    // Spawn meteors
    const diff = this.context.difficulty || 'NORMAL';
    const spawnRate = diff === 'EASY' ? 0.35 : diff === 'HARD' ? 0.18 : 0.25;
    const speedBase = diff === 'EASY' ? 220 : diff === 'HARD' ? 380 : 300;

    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      const dpr = window.devicePixelRatio || 1;
      this.meteors.push({
        x: Math.random() * this.canvas.width,
        y: -30 * dpr,
        radius: (18 + Math.random() * 14) * dpr,
        vy: (speedBase + Math.random() * 100) * dpr,
        vx: (Math.random() * 80 - 40) * dpr,
        icon: Math.random() > 0.4 ? '☄️' : '💣'
      });
    }

    // Move meteors and check collisions
    const dpr = window.devicePixelRatio || 1;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.y += m.vy * deltaTime;
      m.x += m.vx * deltaTime;

      // Check collision with characters
      this.characters.forEach(char => {
        if (!char.isAlive) return;
        const dist = Math.hypot(char.x - m.x, char.y - m.y);
        if (dist < char.radius + m.radius * 0.7) {
          // HIT!
          char.isAlive = false;
          this.context.audio.playError();
          this.context.haptics.heavy();

          const chip = this.container.querySelector(`#da-chip-${char.id}`);
          if (chip) {
            chip.className = 'da-chip dead';
          }
        }
      });

      // Remove offscreen meteors
      if (m.y > this.canvas.height + 50 * dpr) {
        this.meteors.splice(i, 1);
      }
    }

    // Check if only 1 survivor or all dead
    const aliveChars = Array.from(this.characters.values()).filter(c => c.isAlive);
    const totalChars = this.characters.size;

    if (totalChars > 1 && aliveChars.length <= 1) {
      this.finishGame();
      return;
    } else if (totalChars === 1 && aliveChars.length === 0) {
      this.finishGame();
      return;
    }

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, w, h);

    // Draw characters
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.characters.forEach(char => {
      if (!char.isAlive) return;

      // Character halo
      ctx.beginPath();
      ctx.arc(char.x, char.y, char.radius, 0, Math.PI * 2);
      ctx.fillStyle = char.color;
      ctx.fill();
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Avatar
      ctx.font = `${Math.round(24 * dpr)}px sans-serif`;
      ctx.fillText(char.avatar, char.x, char.y);
    });

    // Draw meteors
    ctx.font = `${Math.round(28 * dpr)}px sans-serif`;
    for (const m of this.meteors) {
      ctx.fillText(m.icon, m.x, m.y);
    }
  }

  handleInput(): void {
    // Handled via canvas pointer
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.characters.forEach(c => {
      const survivalPts = Math.round(c.survivalTime * 10) + (c.isAlive ? 100 : 0);
      scores[c.id] = survivalPts;
      rawStats[c.id] = `${c.survivalTime.toFixed(1)}s survived`;
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

  protected onDestroy(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('pointermove', this.handlePointerMove);
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
      this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    }
  }
}
