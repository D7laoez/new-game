import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface ArenaItem {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'COIN' | 'GEM' | 'BOMB';
  points: number;
  icon: string;
  lifetime: number; // seconds
}

export class CoinRushGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'coin-rush')!;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private timeLeft = 20.0;
  private items: ArenaItem[] = [];
  private nextItemId = 1;
  private spawnTimer = 0;
  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private particles: { x: number; y: number; vx: number; vy: number; color: string; life: number }[] = [];

  protected onInit(): void {
    const players = this.context.players;
    this.timeLeft = 20.0;
    this.items = [];
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.particles = [];

    this.container.className = 'game-screen coin-rush-game';
    this.container.innerHTML = `
      <div class="cr-hud">
        <div class="cr-header-info">
          <span class="cr-timer" id="cr-timer">20.0s</span>
          <span class="cr-hint">Tap Coins 🪙 & Gems 💎! Avoid Bombs 💣!</span>
        </div>
        <div class="cr-scorebar">
          ${players
            .map(
              p => `
            <div class="cr-score-chip" style="--chip-color: ${p.color}">
              <span>${p.avatar} ${p.name}:</span>
              <strong id="cr-player-score-${p.id}">0</strong>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      <div class="cr-canvas-wrapper" id="cr-wrapper">
        <canvas id="cr-canvas"></canvas>
      </div>
    `;

    this.canvas = this.container.querySelector('#cr-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    // Multi-touch pointer events on canvas
    this.canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
  }

  private handleResize = (): void => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    const wrapper = this.container.querySelector('#cr-wrapper') as HTMLElement;
    if (!wrapper || !this.canvas) return;
    const rect = wrapper.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  protected onStart(): void {
    this.timeLeft = 20.0;
    this.spawnBatch(6);
  }

  private handleCanvasPointerDown = (e: PointerEvent): void => {
    if (!this.isRunning || this.isFinished) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clickX = (e.clientX - rect.left) * dpr;
    const clickY = (e.clientY - rect.top) * dpr;

    // Determine which player tapped based on quadrant/nearest player
    const playerId = this.determinePlayerFromCoordinates(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);

    // Hit test against items
    let hitIndex = -1;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const dist = Math.hypot(clickX - item.x, clickY - item.y);
      if (dist <= item.radius * 1.5) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      const hitItem = this.items.splice(hitIndex, 1)[0];
      this.collectItem(playerId, hitItem);
    }
  };

  private determinePlayerFromCoordinates(x: number, y: number, width: number, height: number): PlayerId {
    const activePlayers = this.context.players;
    const count = activePlayers.length;

    if (count === 1) return activePlayers[0].id;

    if (count === 2) {
      // Top half vs Bottom half (or Left vs Right depending on aspect ratio)
      if (width > height) {
        return x < width / 2 ? activePlayers[0].id : activePlayers[1].id;
      } else {
        return y < height / 2 ? activePlayers[0].id : activePlayers[1].id;
      }
    }

    if (count === 3) {
      if (y < height / 2) {
        return x < width / 2 ? activePlayers[0].id : activePlayers[1].id;
      } else {
        return activePlayers[2].id;
      }
    }

    // 4 players: 4 quadrants
    if (y < height / 2) {
      return x < width / 2 ? activePlayers[0].id : activePlayers[1].id;
    } else {
      return x < width / 2 ? activePlayers[2].id : activePlayers[3].id;
    }
  }

  private collectItem(playerId: PlayerId, item: ArenaItem): void {
    const p = this.context.players.find(pl => pl.id === playerId);
    const pColor = p ? p.color : '#FFD700';

    if (item.type === 'BOMB') {
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 20);
      this.context.audio.playError();
      this.context.haptics.error();
      this.spawnExplosion(item.x, item.y, '#FF4757');
    } else {
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + item.points;
      this.context.audio.playPop();
      this.context.haptics.light();
      this.spawnExplosion(item.x, item.y, pColor);
    }

    // Update Score chip
    const scoreEl = this.container.querySelector(`#cr-player-score-${playerId}`);
    if (scoreEl) scoreEl.textContent = this.playerScores[playerId].toString();
  }

  private spawnBatch(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnItem();
    }
  }

  private spawnItem(): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const radius = 28 * dpr;
    const padding = 40 * dpr;

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= padding * 2 || h <= padding * 2) return;

    const x = padding + Math.random() * (w - padding * 2);
    const y = padding + Math.random() * (h - padding * 2);

    const rand = Math.random();
    let type: 'COIN' | 'GEM' | 'BOMB' = 'COIN';
    let points = 10;
    let icon = '🪙';

    if (rand < 0.2) {
      type = 'BOMB';
      points = -20;
      icon = '💣';
    } else if (rand < 0.4) {
      type = 'GEM';
      points = 25;
      icon = '💎';
    }

    this.items.push({
      id: this.nextItemId++,
      x,
      y,
      radius,
      type,
      points,
      icon,
      lifetime: 5.0
    });
  }

  private spawnExplosion(x: number, y: number, color: string): void {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 100 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0.4
      });
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.timeLeft -= deltaTime;
    const timerEl = this.container.querySelector('#cr-timer');
    if (timerEl) {
      timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;
    }

    if (this.timeLeft <= 0) {
      this.finishGame();
      return;
    }

    // Spawn items periodically
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= 0.8 && this.items.length < 10) {
      this.spawnTimer = 0;
      this.spawnItem();
    }

    // Age existing items
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].lifetime -= deltaTime;
      if (this.items[i].lifetime <= 0) {
        this.items.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw quadrant division lines for clarity in multiplayer
    const players = this.context.players;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    if (players.length >= 2) {
      ctx.beginPath();
      if (players.length === 2) {
        if (w > h) {
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w / 2, h);
        } else {
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
        }
      } else {
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.stroke();
    }

    // Draw items
    const dpr = window.devicePixelRatio || 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(26 * dpr)}px sans-serif`;

    for (const item of this.items) {
      // Glow circle
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      if (item.type === 'COIN') {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      } else if (item.type === 'GEM') {
        ctx.fillStyle = 'rgba(0, 210, 211, 0.25)';
      } else {
        ctx.fillStyle = 'rgba(255, 71, 87, 0.25)';
      }
      ctx.fill();

      // Icon
      ctx.fillText(item.icon, item.x, item.y);
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  handleInput(): void {
    // Handled via canvas pointerdown
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
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    }
  }
}
