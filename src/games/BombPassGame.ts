import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class BombPassGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'bomb-pass')!;

  private currentHolderIndex = 0;
  private fuseTime = 14.0;
  private maxFuseTime = 14.0;
  private passCount = 0;
  private tickInterval = 1.0;
  private tickTimer = 0;
  private exploded = false;

  private bombIconEl!: HTMLElement;
  private holderTagEl!: HTMLElement;
  private fuseProgressEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    const diff = this.context.difficulty || 'NORMAL';

    // Fuse duration randomized based on difficulty
    const base = diff === 'EASY' ? 15 : diff === 'HARD' ? 9 : 12;
    this.fuseTime = base + Math.random() * 6;
    this.maxFuseTime = this.fuseTime;
    this.currentHolderIndex = Math.floor(Math.random() * players.length);
    this.passCount = 0;
    this.exploded = false;
    this.tickInterval = 1.0;
    this.tickTimer = 0;

    this.container.className = 'game-screen bomb-pass-game';
    this.container.innerHTML = `
      <div class="bp-hud">
        <div class="bp-title">PASS THE TICKING BOMB! 💣</div>
        <div class="bp-fuse-bar">
          <div class="bp-fuse-fill" id="bp-fuse-fill" style="width: 100%"></div>
        </div>
        <div class="bp-holder-tag" id="bp-holder-tag">Holder: ...</div>
      </div>

      <div class="bp-center">
        <div class="bp-bomb" id="bp-bomb">
          <span class="bp-bomb-icon">💣</span>
          <span class="bp-spark">🔥</span>
        </div>
      </div>

      <div class="bp-zones player-grid-${players.length}">
        ${players
          .map(
            (p, idx) => `
          <div class="bp-player-zone ${idx === this.currentHolderIndex ? 'has-bomb' : ''}" 
               data-player-id="${p.id}" 
               id="bp-zone-${p.id}"
               style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
            <div class="bp-zone-info">
              <span class="bp-avatar">${p.avatar}</span>
              <span class="bp-name">${p.name}</span>
            </div>
            <button class="bp-pass-btn" id="bp-pass-btn-${p.id}" type="button">
              ${idx === this.currentHolderIndex ? 'PASS BOMB! 💣' : 'WAIT...'}
            </button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.bombIconEl = this.container.querySelector('#bp-bomb')!;
    this.holderTagEl = this.container.querySelector('#bp-holder-tag')!;
    this.fuseProgressEl = this.container.querySelector('#bp-fuse-fill')!;

    // Input handlers
    this.container.querySelectorAll('.bp-player-zone').forEach(zone => {
      const pId = parseInt(zone.getAttribute('data-player-id') || '1', 10) as PlayerId;
      zone.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'PASS');
      });
    });

    this.updateHolderUI();
  }

  protected onStart(): void {
    this.updateHolderUI();
  }

  private updateHolderUI(): void {
    const players = this.context.players;
    const holder = players[this.currentHolderIndex];

    if (this.holderTagEl && holder) {
      this.holderTagEl.textContent = `Bomb with: ${holder.avatar} ${holder.name}`;
      this.holderTagEl.style.color = holder.color;
    }

    players.forEach((p, idx) => {
      const zone = this.container.querySelector(`#bp-zone-${p.id}`);
      const btn = this.container.querySelector(`#bp-pass-btn-${p.id}`);
      const isHolder = idx === this.currentHolderIndex;

      if (zone) {
        if (isHolder) {
          zone.classList.add('has-bomb');
        } else {
          zone.classList.remove('has-bomb');
        }
      }

      if (btn) {
        btn.textContent = isHolder ? 'TAP TO PASS! 💣' : 'WAIT...';
        btn.className = `bp-pass-btn ${isHolder ? 'active-holder' : ''}`;
      }
    });

    if (this.bombIconEl && holder) {
      this.bombIconEl.style.boxShadow = `0 0 30px ${holder.color}`;
    }
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished || this.exploded) return;

    this.fuseTime -= deltaTime;
    this.tickTimer += deltaTime;

    // Accelerated ticking sound as fuse burns
    const progress = Math.max(0, this.fuseTime / this.maxFuseTime);
    if (this.fuseProgressEl) {
      this.fuseProgressEl.style.width = `${progress * 100}%`;
    }

    const currentInterval = Math.max(0.12, progress * 0.8);
    if (this.tickTimer >= currentInterval) {
      this.tickTimer = 0;
      this.context.audio.playTone(600 + (1 - progress) * 400, 0.05, 'triangle');
      this.context.haptics.light();

      // Shake animation on bomb
      if (this.bombIconEl) {
        this.bombIconEl.classList.remove('shake');
        void this.bombIconEl.offsetWidth;
        this.bombIconEl.classList.add('shake');
      }
    }

    if (this.fuseTime <= 0) {
      this.detonateBomb();
    }
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'PASS' || !this.isRunning || this.isFinished || this.exploded) return;

    const players = this.context.players;
    const currentHolder = players[this.currentHolderIndex];

    if (currentHolder.id !== playerId) return; // Only current holder can pass

    // Pass to next player
    this.passCount++;
    this.currentHolderIndex = (this.currentHolderIndex + 1) % players.length;

    this.context.audio.playTugPull();
    this.context.haptics.medium();

    this.updateHolderUI();
  }

  private detonateBomb(): void {
    this.exploded = true;
    this.isFinished = true;

    const players = this.context.players;
    const loser = players[this.currentHolderIndex];

    // Explosion effects
    this.context.audio.playError();
    this.context.haptics.heavy();

    if (this.bombIconEl) {
      this.bombIconEl.innerHTML = `<span class="bp-boom">💥 BOOM!</span>`;
      this.bombIconEl.classList.add('exploded');
    }

    if (this.holderTagEl) {
      this.holderTagEl.textContent = `💥 EXPLODED ON ${loser.name}!`;
      this.holderTagEl.style.color = '#FF4757';
    }

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    players.forEach(p => {
      if (p.id === loser.id) {
        scores[p.id] = 0;
        rawStats[p.id] = 'Exploded 💥';
      } else {
        scores[p.id] = 50 + this.passCount * 5;
        rawStats[p.id] = `Survived! (${this.passCount} passes)`;
      }
    });

    // Pick a winner among the survivors (highest score or first survivor)
    const survivors = players.filter(p => p.id !== loser.id);
    const winnerId = survivors.length > 0 ? survivors[0].id : null;

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1500);
  }
}
