import { BaseMiniGame } from '../core/MiniGame.ts';
import { GameMetadata, MiniGameResult, PlayerId } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

export class TugOfWarGame extends BaseMiniGame {
  readonly metadata: GameMetadata = GAME_CATALOG.find(g => g.id === 'tug-of-war')!;

  // Rope position: -100 (Player 1 wins) to +100 (Player 2 wins)
  private ropePosition = 0;
  private ropeVelocity = 0;
  private duration = 18.0;
  private teamLeft: PlayerId[] = [];
  private teamRight: PlayerId[] = [];
  private pullCounts: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  private ropeBandanaEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private leftPullersEl!: HTMLElement;
  private rightPullersEl!: HTMLElement;

  protected onInit(): void {
    const players = this.context.players;
    this.ropePosition = 0;
    this.ropeVelocity = 0;
    this.duration = 18.0;
    this.pullCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Divide players into Left & Right teams
    if (players.length === 2) {
      this.teamLeft = [players[0].id];
      this.teamRight = [players[1].id];
    } else if (players.length === 3) {
      this.teamLeft = [players[0].id];
      this.teamRight = [players[1].id, players[2].id];
    } else {
      // 4 players: P1 & P3 vs P2 & P4
      this.teamLeft = [players[0].id, players[2].id];
      this.teamRight = [players[1].id, players[3].id];
    }

    const leftPlayers = players.filter(p => this.teamLeft.includes(p.id));
    const rightPlayers = players.filter(p => this.teamRight.includes(p.id));

    this.container.className = 'game-screen tug-of-war-game';
    this.container.innerHTML = `
      <div class="tow-hud">
        <div class="tow-title">PULL! SHRED THE ROPE!</div>
        <div class="tow-timer" id="tow-timer">18.0s</div>
      </div>

      <div class="tow-arena">
        <div class="tow-pit pit-left">
          <div class="tow-pit-hazard">MUD PIT</div>
        </div>

        <div class="tow-rope-track">
          <div class="tow-rope-line"></div>
          <div class="tow-bandana" id="tow-bandana" style="left: 50%">
            <span class="tow-knot">🎀</span>
          </div>
        </div>

        <div class="tow-pit pit-right">
          <div class="tow-pit-hazard">MUD PIT</div>
        </div>
      </div>

      <div class="tow-controllers">
        <div class="tow-side left-side">
          ${leftPlayers
            .map(
              p => `
            <div class="tow-button-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
              <span class="tow-avatar">${p.avatar}</span>
              <span class="tow-name">${p.name}</span>
              <button class="tow-mash-btn" type="button">PULL! 🪢</button>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="tow-side right-side">
          ${rightPlayers
            .map(
              p => `
            <div class="tow-button-zone" data-player-id="${p.id}" style="--p-color: ${p.color}; --p-dark: ${p.darkColor}">
              <span class="tow-avatar">${p.avatar}</span>
              <span class="tow-name">${p.name}</span>
              <button class="tow-mash-btn" type="button">PULL! 🪢</button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    this.ropeBandanaEl = this.container.querySelector('#tow-bandana')!;
    this.timerEl = this.container.querySelector('#tow-timer')!;

    // Input handlers
    this.container.querySelectorAll('.tow-button-zone').forEach(el => {
      const pId = parseInt(el.getAttribute('data-player-id') || '1', 10) as PlayerId;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.handleInput(pId, 'PULL');
      });
    });
  }

  protected onStart(): void {
    this.ropePosition = 0;
  }

  update(deltaTime: number): void {
    if (!this.isRunning || this.isFinished) return;

    this.duration -= deltaTime;
    if (this.duration <= 0) {
      this.duration = 0;
      this.timerEl.textContent = '0.0s';
      this.checkWinner(true);
      return;
    }
    this.timerEl.textContent = `${this.duration.toFixed(1)}s`;

    // Apply friction to rope velocity
    this.ropeVelocity *= 0.92;
    this.ropePosition += this.ropeVelocity * deltaTime;

    // Boundary constraints: -100 to +100
    if (this.ropePosition <= -85) {
      this.ropePosition = -85;
      this.checkWinner(true);
      return;
    } else if (this.ropePosition >= 85) {
      this.ropePosition = 85;
      this.checkWinner(true);
      return;
    }

    // Update Bandana UI: map -85..+85 to 10%..90%
    const normalizedPercent = 50 + (this.ropePosition / 85) * 40;
    this.ropeBandanaEl.style.left = `${normalizedPercent}%`;
  }

  handleInput(playerId: PlayerId, action: string): void {
    if (action !== 'PULL' || !this.isRunning || this.isFinished) return;

    this.pullCounts[playerId] = (this.pullCounts[playerId] || 0) + 1;
    this.context.audio.playTugPull();
    this.context.haptics.light();

    const isLeft = this.teamLeft.includes(playerId);
    // Weight handicap for 3-player mode (1 vs 2)
    const pullPower = isLeft && this.teamLeft.length < this.teamRight.length ? 15 : 10;

    if (isLeft) {
      this.ropeVelocity -= pullPower;
    } else {
      this.ropeVelocity += pullPower;
    }

    // Button tactile feedback
    const btnZone = this.container.querySelector(`[data-player-id="${playerId}"]`);
    if (btnZone) {
      btnZone.classList.remove('active-pull');
      void (btnZone as HTMLElement).offsetWidth;
      btnZone.classList.add('active-pull');
    }
  }

  private checkWinner(forceEnd = false): void {
    if (this.isFinished) return;

    let winningSide: 'LEFT' | 'RIGHT' | 'TIE' | null = null;

    if (this.ropePosition <= -80) {
      winningSide = 'LEFT';
    } else if (this.ropePosition >= 80) {
      winningSide = 'RIGHT';
    } else if (forceEnd) {
      if (Math.abs(this.ropePosition) < 5) {
        winningSide = 'TIE';
      } else {
        winningSide = this.ropePosition < 0 ? 'LEFT' : 'RIGHT';
      }
    }

    if (winningSide) {
      this.finishGame(winningSide);
    }
  }

  private finishGame(winningSide: 'LEFT' | 'RIGHT' | 'TIE'): void {
    this.isFinished = true;
    this.context.audio.playSuccess();
    this.context.haptics.heavy();

    const scores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const rawStats: Partial<Record<PlayerId, number | string>> = {};

    this.context.players.forEach(p => {
      const isLeft = this.teamLeft.includes(p.id);
      let pScore = this.pullCounts[p.id] || 0;

      if (winningSide === 'LEFT' && isLeft) {
        pScore += 100;
      } else if (winningSide === 'RIGHT' && !isLeft) {
        pScore += 100;
      } else if (winningSide === 'TIE') {
        pScore += 50;
      }
      scores[p.id] = pScore;
      rawStats[p.id] = `${this.pullCounts[p.id]} pulls`;
    });

    let winnerId: PlayerId | 'TIE' = 'TIE';
    if (winningSide === 'LEFT') {
      winnerId = this.teamLeft[0];
    } else if (winningSide === 'RIGHT') {
      winnerId = this.teamRight[0];
    }

    setTimeout(() => {
      this.finishWithResult({
        scores,
        winnerId,
        rawStats
      });
    }, 1200);
  }
}
