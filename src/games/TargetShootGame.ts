import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface TargetItem {
  id: number;
  playerId: PlayerId;
  type: 'NORMAL' | 'GOLDEN' | 'BOMB';
  x: number; // percentage within player zone (15% to 85%)
  y: number; // percentage within player zone (20% to 80%)
  points: number;
  icon: string;
  lifetime: number;
  element?: HTMLElement;
}

export class TargetShootGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'target-shoot')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private targets: TargetItem[] = [];
  private nextTargetId = 1;
  private duration = 18.0;
  private spawnInterval = 0.8;
  private spawnTimer = 0;

  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';
    this.duration = diff === 'EASY' ? 20.0 : diff === 'HARD' ? 15.0 : 18.0;
    this.spawnInterval = diff === 'EASY' ? 1.0 : diff === 'HARD' ? 0.5 : 0.75;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.targets = [];

    this.container.className = 'game-screen target-shoot-game';
    this.container.innerHTML = `
      <div class="ts-hud">
        <div class="ts-timer" id="ts-timer">${this.duration.toFixed(1)}s</div>
        <div class="ts-legend">🎯 +1 | ⭐ +3 | 💣 -2</div>
      </div>

      <div class="ts-zones player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="ts-player-zone" data-player-id="${p.id}" id="ts-zone-${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="ts-player-header">
              <span class="ts-avatar">${p.avatar}</span>
              <span class="ts-name">${p.name}</span>
              <span class="ts-score" id="ts-score-${p.id}">0 pts</span>
            </div>
            <div class="ts-target-field" id="ts-field-${p.id}"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#ts-timer')!;
  }

  protected onStart(): void {
    // Spawn initial target for every player
    this.context.players.forEach(p => this.spawnTargetForPlayer(p.id));
  }

  private spawnTargetForPlayer(playerId: PlayerId): void {
    const field = this.container.querySelector(`#ts-field-${playerId}`) as HTMLElement;
    if (!field) return;

    const rand = Math.random();
    let type: 'NORMAL' | 'GOLDEN' | 'BOMB' = 'NORMAL';
    let pts = 1;
    let icon = '🎯';

    if (rand < 0.22) {
      type = 'BOMB';
      pts = -2;
      icon = '💣';
    } else if (rand < 0.45) {
      type = 'GOLDEN';
      pts = 3;
      icon = '⭐';
    }

    const diff = this.context.difficulty || 'NORMAL';
    const lifetime = diff === 'EASY' ? 2.2 : diff === 'HARD' ? 1.2 : 1.6;

    const x = 15 + Math.random() * 70;
    const y = 20 + Math.random() * 60;

    const item: TargetItem = {
      id: this.nextTargetId++,
      playerId,
      type,
      x,
      y,
      points: pts,
      icon,
      lifetime
    };

    const targetEl = document.createElement('div');
    targetEl.className = `ts-target target-${type.toLowerCase()}`;
    targetEl.style.left = `${x}%`;
    targetEl.style.top = `${y}%`;
    targetEl.textContent = icon;

    targetEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleInput(playerId, 'HIT', item.id);
    });

    field.appendChild(targetEl);
    item.element = targetEl;
    this.targets.push(item);
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.duration -= deltaTime;
    if (this.timerEl) {
      this.timerEl.textContent = `${Math.max(0, this.duration).toFixed(1)}s`;
    }

    if (this.duration <= 0) {
      this.finishGame();
      return;
    }

    // Spawn timer
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.context.players.forEach(p => {
        const pTargets = this.targets.filter(t => t.playerId === p.id);
        if (pTargets.length < 3) {
          this.spawnTargetForPlayer(p.id);
        }
      });
    }

    // Age existing targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.lifetime -= deltaTime;
      if (t.lifetime <= 0) {
        if (t.element) t.element.remove();
        this.targets.splice(i, 1);
      }
    }
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (action !== 'HIT' || !this.isRunning || this.isFinished) return;

    const targetId = data as number;
    const targetIdx = this.targets.findIndex(t => t.id === targetId && t.playerId === playerId);
    if (targetIdx === -1) return;

    const target = this.targets.splice(targetIdx, 1)[0];
    if (target.element) target.element.remove();

    if (target.type === 'BOMB') {
      this.playerScores[playerId] = Math.max(0, (this.playerScores[playerId] || 0) - 2);
      this.context.audio.playError();
      this.context.haptics.error();
    } else {
      this.playerScores[playerId] = (this.playerScores[playerId] || 0) + target.points;
      if (target.type === 'GOLDEN') {
        this.context.audio.playSuccess();
        this.context.haptics.heavy();
      } else {
        this.context.audio.playTap();
        this.context.haptics.light();
      }
    }

    const scoreEl = this.container.querySelector(`#ts-score-${playerId}`);
    if (scoreEl) {
      scoreEl.textContent = `${this.playerScores[playerId]} pts`;
    }

    // Spawn a replacement target
    this.spawnTargetForPlayer(playerId);
  }

  private finishGame(): void {
    this.isFinished = true;
    this.context.audio.playWinner();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.context.players.forEach(p => {
      scores[p.id] = this.playerScores[p.id] || 0;
      rawStats[p.id] = `${this.playerScores[p.id] || 0} pts`;
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
    this.targets.forEach(t => {
      if (t.element) t.element.remove();
    });
    this.targets = [];
  }
}
