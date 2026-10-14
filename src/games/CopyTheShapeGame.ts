import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

interface ShapePattern {
  name: string;
  icon: string;
  // indices 0..8 in 3x3 grid that must be active
  indices: number[];
}

const SHAPE_PATTERNS: ShapePattern[] = [
  { name: 'Plus Cross', icon: '✚', indices: [1, 3, 4, 5, 7] },
  { name: 'Square Box', icon: '⏹️', indices: [0, 1, 2, 3, 5, 6, 7, 8] },
  { name: 'X-Shape', icon: '✖️', indices: [0, 2, 4, 6, 8] },
  { name: 'Diamond', icon: '💠', indices: [1, 3, 5, 7] },
  { name: 'Triangle', icon: '🔺', indices: [1, 3, 5, 6, 7, 8] },
  { name: 'Corner L', icon: '📐', indices: [0, 3, 6, 7, 8] }
];

export class CopyTheShapeGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'copy-the-shape')!;

  private playerScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private playerPatterns: Map<PlayerId, ShapePattern> = new Map();
  private playerGrids: Map<PlayerId, Set<number>> = new Map();
  private playerCompletedCount: Map<PlayerId, number> = new Map();
  private timeLeft = 20;
  private readonly targetShapes = 3;
  private timerEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.playerScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.playerPatterns.clear();
    this.playerGrids.clear();
    this.playerCompletedCount.clear();
    this.timeLeft = 20;

    players.forEach(p => {
      this.playerScores[p.id] = 0;
      this.playerCompletedCount.set(p.id, 0);
      this.playerGrids.set(p.id, new Set());
      this.assignNextShape(p.id);
    });

    this.container.className = 'game-screen copy-the-shape-game';
    this.container.innerHTML = `
      <div class="cts-hud">
        <div class="hud-timer" id="cts-timer">20.0s</div>
        <div class="hud-tip">Toggle dots on the 3x3 grid to match the target pattern! 📐</div>
      </div>
      <div class="cts-arena player-grid-${players.length}">
        ${players
          .map(
            p => `
          <div class="cts-player-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="cts-zone-header">
              <span class="cts-avatar">${p.avatar}</span>
              <span class="cts-name">${p.name}</span>
              <span class="cts-prog" id="cts-prog-${p.id}">0 / ${this.targetShapes}</span>
            </div>
            <div class="cts-target-preview" id="cts-target-${p.id}"></div>
            <div class="cts-grid" id="cts-grid-${p.id}"></div>
            <div class="cts-actions">
              <button class="cts-btn clear-btn" id="cts-clear-${p.id}">Clear 🔄</button>
              <button class="cts-btn submit-btn" id="cts-submit-${p.id}">Submit 🚀</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.timerEl = this.container.querySelector('#cts-timer')!;

    players.forEach(p => {
      this.renderTargetPreview(p.id);
      this.renderPlayerGrid(p.id);

      const clearBtn = this.container.querySelector(`#cts-clear-${p.id}`);
      const submitBtn = this.container.querySelector(`#cts-submit-${p.id}`);

      if (clearBtn) {
        clearBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'CLEAR');
        });
      }
      if (submitBtn) {
        submitBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          this.handleInput(p.id, 'SUBMIT');
        });
      }
    });
  }

  private assignNextShape(playerId: PlayerId): void {
    const curPattern = this.playerPatterns.get(playerId);
    let next: ShapePattern;
    do {
      next = SHAPE_PATTERNS[Math.floor(Math.random() * SHAPE_PATTERNS.length)];
    } while (curPattern && next.name === curPattern.name && SHAPE_PATTERNS.length > 1);

    this.playerPatterns.set(playerId, next);
    this.playerGrids.set(playerId, new Set());
  }

  private renderTargetPreview(playerId: PlayerId): void {
    const previewEl = this.container.querySelector(`#cts-target-${playerId}`);
    const pattern = this.playerPatterns.get(playerId);
    if (!previewEl || !pattern) return;

    let cellsHtml = '';
    for (let i = 0; i < 9; i++) {
      const active = pattern.indices.includes(i);
      cellsHtml += `<div class="cts-mini-cell ${active ? 'active' : ''}"></div>`;
    }

    previewEl.innerHTML = `
      <div class="cts-target-info">
        <span class="cts-target-icon">${pattern.icon}</span>
        <span class="cts-target-title">${pattern.name}</span>
      </div>
      <div class="cts-mini-grid">${cellsHtml}</div>
    `;
  }

  private renderPlayerGrid(playerId: PlayerId): void {
    const gridEl = this.container.querySelector(`#cts-grid-${playerId}`);
    const activeSet = this.playerGrids.get(playerId);
    if (!gridEl || !activeSet) return;

    let html = '';
    for (let i = 0; i < 9; i++) {
      const active = activeSet.has(i);
      html += `
        <button class="cts-cell ${active ? 'active' : ''}" data-idx="${i}" aria-label="Cell ${i + 1}">
          <span class="cts-cell-dot"></span>
        </button>
      `;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.cts-cell').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        this.handleInput(playerId, 'TOGGLE_CELL', { index: idx });
      });
    });
  }

  protected onStart(): void {
    this.setGameInterval(() => {
      this.timeLeft -= 0.1;
      if (this.timerEl) {
        this.timerEl.textContent = `${Math.max(0, this.timeLeft).toFixed(1)}s`;
      }

      if (this.timeLeft <= 0) {
        this.concludeGame();
      }
    }, 100);
  }

  handleInput(playerId: PlayerId, action: string, data?: unknown): void {
    if (!this.isRunning || this.isFinished) return;
    const completed = this.playerCompletedCount.get(playerId) || 0;
    if (completed >= this.targetShapes) return;

    const activeSet = this.playerGrids.get(playerId);
    if (!activeSet) return;

    if (action === 'TOGGLE_CELL') {
      const { index } = (data as { index: number }) || { index: -1 };
      if (index < 0 || index >= 9) return;

      if (activeSet.has(index)) {
        activeSet.delete(index);
      } else {
        activeSet.add(index);
      }

      this.context.audio.playPop();
      this.context.haptics.light();
      this.renderPlayerGrid(playerId);
    } else if (action === 'CLEAR') {
      activeSet.clear();
      this.context.audio.playWhoosh();
      this.renderPlayerGrid(playerId);
    } else if (action === 'SUBMIT') {
      const pattern = this.playerPatterns.get(playerId);
      if (!pattern) return;

      const isMatch =
        pattern.indices.length === activeSet.size &&
        pattern.indices.every(idx => activeSet.has(idx));

      const gridEl = this.container.querySelector(`#cts-grid-${playerId}`);

      if (isMatch) {
        // Correct shape!
        this.playerScores[playerId] += 15;
        const newCount = completed + 1;
        this.playerCompletedCount.set(playerId, newCount);

        this.context.audio.playSuccess();
        this.context.haptics.heavy();

        const progEl = this.container.querySelector(`#cts-prog-${playerId}`);
        if (progEl) progEl.textContent = `${newCount} / ${this.targetShapes} (${this.playerScores[playerId]} pts)`;

        if (gridEl) {
          gridEl.classList.add('flash-success');
          this.setGameTimeout(() => gridEl.classList.remove('flash-success'), 300);
        }

        if (newCount >= this.targetShapes) {
          const allDone = this.context.players.every(p => (this.playerCompletedCount.get(p.id) || 0) >= this.targetShapes);
          if (allDone) {
            this.setGameTimeout(() => this.concludeGame(), 400);
          }
        } else {
          this.assignNextShape(playerId);
          this.renderTargetPreview(playerId);
          this.renderPlayerGrid(playerId);
        }
      } else {
        // Mismatch
        this.context.audio.playError();
        this.context.haptics.error();
        if (gridEl) {
          gridEl.classList.add('flash-error');
          this.setGameTimeout(() => gridEl.classList.remove('flash-error'), 300);
        }
      }
    }
  }

  private concludeGame(): void {
    if (this.isFinished) return;

    const players = this.context.players;
    const sorted = [...players].sort((a, b) => (this.playerScores[b.id] ?? 0) - (this.playerScores[a.id] ?? 0));
    let winnerId: PlayerId | 'TIE' = sorted[0].id;
    if (sorted.length > 1 && this.playerScores[sorted[0].id] === this.playerScores[sorted[1].id]) {
      winnerId = 'TIE';
    }

    const rawStats: Partial<Record<PlayerId, number | string>> = {};
    players.forEach(p => {
      rawStats[p.id] = `${this.playerCompletedCount.get(p.id) || 0} shapes matched (${this.playerScores[p.id]} pts)`;
    });

    this.finishWithResult({
      scores: this.playerScores,
      winnerId,
      rawStats
    });
  }

  protected onDestroy(): void {}
}
