import { PlayerManager } from '../services/PlayerManager.ts';
import { MiniGameManager } from '../core/MiniGameManager.ts';
import { IAudioManager, IHapticManager, PartyConfig, PlayerId, RoundResult, GameCategory } from '../types/index.ts';
import confetti from 'canvas-confetti';

export class ModalsManager {
  constructor(
    private root: HTMLElement,
    private playerManager: PlayerManager,
    private miniGameManager: MiniGameManager,
    private audio: IAudioManager,
    private haptics: IHapticManager
  ) {}

  // --- PLAYER SETUP MODAL ---
  showPlayerSetup(onSave: (count: number) => void): void {
    const activeCount = this.playerManager.getActiveCount();
    const allPlayers = this.playerManager.getAllPlayers();

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>👥 Players Setup</h2>
          <button class="modal-close-btn" id="m-close">&times;</button>
        </div>

        <div class="player-count-selector">
          <label>How many players?</label>
          <div class="count-pill-group">
            ${[1, 2, 3, 4]
              .map(
                num => `
              <button class="count-pill ${num === activeCount ? 'active' : ''}" data-count="${num}">
                ${num} ${num === 1 ? 'Solo' : 'Players'}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="player-edit-list" id="player-edit-list">
          ${allPlayers
            .slice(0, activeCount)
            .map(
              p => `
            <div class="player-edit-row" style="--p-color: ${p.color}">
              <div class="player-avatar-badge">${p.avatar}</div>
              <input type="text" class="player-name-input" data-id="${p.id}" value="${p.name}" maxlength="14" />
              <div class="avatar-picker-dropdown" data-id="${p.id}">
                ${PlayerManager.AVAILABLE_AVATARS.map(
                  av => `<button type="button" class="av-btn ${av === p.avatar ? 'sel' : ''}">${av}</button>`
                ).join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary btn-large" id="m-save-players">Confirm Players 🚀</button>
        </div>
      </div>
    `;

    this.root.appendChild(overlay);

    const updateRows = (newCount: number) => {
      this.playerManager.setActiveCount(newCount);
      const list = overlay.querySelector('#player-edit-list')!;
      list.innerHTML = this.playerManager
        .getActivePlayers()
        .map(
          p => `
        <div class="player-edit-row" style="--p-color: ${p.color}">
          <div class="player-avatar-badge">${p.avatar}</div>
          <input type="text" class="player-name-input" data-id="${p.id}" value="${p.name}" maxlength="14" />
          <div class="avatar-picker-dropdown" data-id="${p.id}">
            ${PlayerManager.AVAILABLE_AVATARS.map(
              av => `<button type="button" class="av-btn ${av === p.avatar ? 'sel' : ''}">${av}</button>`
            ).join('')}
          </div>
        </div>
      `
        )
        .join('');
      attachAvatarListeners();
    };

    const attachAvatarListeners = () => {
      overlay.querySelectorAll('.avatar-picker-dropdown .av-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const parent = (e.target as HTMLElement).closest('.avatar-picker-dropdown');
          if (!parent) return;
          const pId = parseInt(parent.getAttribute('data-id') || '1', 10) as PlayerId;
          const newAv = (e.target as HTMLElement).textContent || '🦊';
          const p = this.playerManager.getPlayer(pId);
          if (p) {
            this.playerManager.updatePlayer(pId, p.name, newAv);
            this.audio.playTap();
            updateRows(this.playerManager.getActiveCount());
          }
        });
      });
    };

    overlay.querySelectorAll('.count-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.count-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const count = parseInt(btn.getAttribute('data-count') || '2', 10);
        this.audio.playTap();
        updateRows(count);
      });
    });

    attachAvatarListeners();

    overlay.querySelector('#m-close')?.addEventListener('click', () => {
      this.audio.playTap();
      overlay.remove();
    });

    overlay.querySelector('#m-save-players')?.addEventListener('click', () => {
      overlay.querySelectorAll('.player-name-input').forEach(input => {
        const id = parseInt(input.getAttribute('data-id') || '1', 10) as PlayerId;
        const name = (input as HTMLInputElement).value;
        const p = this.playerManager.getPlayer(id);
        if (p) this.playerManager.updatePlayer(id, name, p.avatar);
      });
      this.audio.playStart();
      this.haptics.success();
      overlay.remove();
      onSave(this.playerManager.getActiveCount());
    });
  }

  // --- ROUNDS & PARTY SETUP MODAL ---
  showPartySetup(defaultMode: 'QUICK' | 'CUSTOM' | 'TOURNAMENT', onStart: (config: PartyConfig) => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';

    const rounds = defaultMode === 'QUICK' ? 3 : defaultMode === 'TOURNAMENT' ? 7 : 5;

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>🎉 Configure ${defaultMode === 'TOURNAMENT' ? 'Tournament' : 'Party'}</h2>
          <button class="modal-close-btn" id="m-party-close">&times;</button>
        </div>

        <div class="setup-group">
          <label>Number of Rounds</label>
          <div class="count-pill-group" id="round-pills">
            ${[1, 2, 3, 5, 7, 10]
              .map(
                r => `
              <button class="count-pill ${r === rounds ? 'active' : ''}" data-rounds="${r}">
                ${r} ${r === 1 ? 'Round' : 'Rounds'}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="setup-group">
          <label>Game Categories Included</label>
          <div class="cat-chip-group" id="cat-chips">
            ${['REACTION', 'SPEED', 'COMPETITION', 'MEMORY', 'PUZZLE', 'PARTY', 'DRAWING']
              .map(
                c => `
              <button class="cat-chip active" data-cat="${c}">${c}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary btn-large" id="m-launch-party">Start Competition! 🔥</button>
        </div>
      </div>
    `;

    this.root.appendChild(overlay);

    let selectedRounds = rounds;
    overlay.querySelectorAll('#round-pills .count-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('#round-pills .count-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRounds = parseInt(btn.getAttribute('data-rounds') || '3', 10);
        this.audio.playTap();
      });
    });

    overlay.querySelectorAll('#cat-chips .cat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        this.audio.playTap();
      });
    });

    overlay.querySelector('#m-party-close')?.addEventListener('click', () => {
      this.audio.playTap();
      overlay.remove();
    });

    overlay.querySelector('#m-launch-party')?.addEventListener('click', () => {
      const activeCats: GameCategory[] = [];
      overlay.querySelectorAll('#cat-chips .cat-chip.active').forEach(b => {
        activeCats.push(b.getAttribute('data-cat') as GameCategory);
      });

      this.audio.playStart();
      this.haptics.success();
      overlay.remove();

      onStart({
        playerCount: this.playerManager.getActiveCount(),
        totalRounds: selectedRounds,
        mode: defaultMode,
        categories: activeCats.length > 0 ? activeCats : ['REACTION', 'SPEED', 'COMPETITION', 'MEMORY']
      });
    });
  }

  // --- GAME LIBRARY MODAL ---
  showGameLibrary(onPlayGame: (gameId: string) => void): void {
    const allGames = this.miniGameManager.getAllCatalogGames();
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';

    overlay.innerHTML = `
      <div class="modal-card modal-library">
        <div class="modal-header">
          <h2>📚 Game Library (${allGames.length} Mini-Games)</h2>
          <button class="modal-close-btn" id="m-lib-close">&times;</button>
        </div>

        <div class="library-search-bar">
          <input type="text" id="lib-search" placeholder="Search mini-games..." />
        </div>

        <div class="library-categories" id="lib-cat-filters">
          <button class="lib-cat-pill active" data-category="ALL">ALL</button>
          <button class="lib-cat-pill" data-category="REACTION">REACTION (10)</button>
          <button class="lib-cat-pill" data-category="SPEED">SPEED (7)</button>
          <button class="lib-cat-pill" data-category="COMPETITION">COMPETITION (8)</button>
          <button class="lib-cat-pill" data-category="MEMORY">MEMORY (8)</button>
          <button class="lib-cat-pill" data-category="PUZZLE">PUZZLE (7)</button>
          <button class="lib-cat-pill" data-category="PARTY">PARTY (10)</button>
          <button class="lib-cat-pill" data-category="DRAWING">DRAWING (5)</button>
        </div>

        <div class="library-grid" id="lib-grid"></div>
      </div>
    `;

    this.root.appendChild(overlay);

    const renderGrid = (query = '', cat = 'ALL') => {
      const grid = overlay.querySelector('#lib-grid')!;
      const filtered = allGames.filter(g => {
        const matchesQuery =
          g.title.toLowerCase().includes(query.toLowerCase()) ||
          g.titleAr.includes(query) ||
          g.description.toLowerCase().includes(query.toLowerCase());
        const matchesCat = cat === 'ALL' || g.category === cat;
        return matchesQuery && matchesCat;
      });

      grid.innerHTML = filtered
        .map(
          g => `
        <div class="game-catalog-card ${g.implemented ? 'playable' : 'coming-soon'}">
          <div class="card-icon">${g.icon}</div>
          <div class="card-body">
            <div class="card-title-row">
              <h3>${g.title}</h3>
              <span class="card-badge ${g.implemented ? 'badge-live' : 'badge-soon'}">
                ${g.implemented ? '▶ PLAY' : 'NEXT BATCH'}
              </span>
            </div>
            <div class="card-title-ar">${g.titleAr}</div>
            <p class="card-desc">${g.description}</p>
            <div class="card-meta">
              <span>👥 ${g.minPlayers}-${g.maxPlayers}P</span>
              <span>⏱️ ${g.durationSeconds}s</span>
              <span class="difficulty-${g.difficulty.toLowerCase()}">${g.difficulty}</span>
            </div>
          </div>
          ${
            g.implemented
              ? `<button class="btn btn-primary play-single-btn" data-id="${g.id}">Play Now</button>`
              : ''
          }
        </div>
      `
        )
        .join('');

      grid.querySelectorAll('.play-single-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const gId = btn.getAttribute('data-id')!;
          this.audio.playStart();
          overlay.remove();
          onPlayGame(gId);
        });
      });
    };

    renderGrid();

    overlay.querySelector('#lib-search')?.addEventListener('input', e => {
      const q = (e.target as HTMLInputElement).value;
      const activeCat = overlay.querySelector('.lib-cat-pill.active')?.getAttribute('data-category') || 'ALL';
      renderGrid(q, activeCat);
    });

    overlay.querySelectorAll('.lib-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.lib-cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.audio.playTap();
        const cat = btn.getAttribute('data-category') || 'ALL';
        const q = (overlay.querySelector('#lib-search') as HTMLInputElement).value;
        renderGrid(q, cat);
      });
    });

    overlay.querySelector('#m-lib-close')?.addEventListener('click', () => {
      this.audio.playTap();
      overlay.remove();
    });
  }

  // --- SETTINGS MODAL ---
  showSettings(audioMuted: boolean, onToggleAudio: (muted: boolean) => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>⚙️ Game Settings</h2>
          <button class="modal-close-btn" id="m-set-close">&times;</button>
        </div>

        <div class="settings-list">
          <div class="settings-row">
            <span>Sound Effects & Audio Synth</span>
            <button class="toggle-switch ${!audioMuted ? 'on' : ''}" id="toggle-audio">
              ${!audioMuted ? 'ON 🔊' : 'MUTED 🔇'}
            </button>
          </div>
          <div class="settings-row">
            <span>Haptic Feedback Vibration</span>
            <button class="toggle-switch on" id="toggle-haptic">ON 📳</button>
          </div>
          <div class="settings-row">
            <span>Display Orientation</span>
            <span class="settings-val">Landscape & Portrait Adaptive</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" id="m-set-done">Done</button>
        </div>
      </div>
    `;

    this.root.appendChild(overlay);

    let muted = audioMuted;
    overlay.querySelector('#toggle-audio')?.addEventListener('click', e => {
      muted = !muted;
      const btn = e.target as HTMLElement;
      btn.className = `toggle-switch ${!muted ? 'on' : ''}`;
      btn.textContent = !muted ? 'ON 🔊' : 'MUTED 🔇';
      onToggleAudio(muted);
    });

    overlay.querySelector('#m-set-close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#m-set-done')?.addEventListener('click', () => overlay.remove());
  }

  // --- ROUND RESULTS OVERLAY ---
  showRoundResults(result: RoundResult, onNext: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'results-overlay';

    overlay.innerHTML = `
      <div class="results-card">
        <div class="results-badge">Round ${result.roundNumber} / ${result.totalRounds} Complete</div>
        <h2 class="results-game-title">${result.game.icon} ${result.game.title}</h2>
        
        <div class="leaderboard-table">
          ${result.ranks
            .map(entry => {
              const p = this.playerManager.getPlayer(entry.playerId)!;
              return `
              <div class="leaderboard-row rank-${entry.rank}" style="--p-color: ${p.color}">
                <div class="row-rank">#${entry.rank}</div>
                <div class="row-player">
                  <span class="row-avatar">${p.avatar}</span>
                  <span class="row-name">${p.name}</span>
                </div>
                <div class="row-round-pts">+${entry.roundPoints} pts</div>
                <div class="row-total-pts">${entry.totalPoints} total</div>
              </div>
            `;
            })
            .join('')}
        </div>

        <div class="results-actions">
          <button class="btn btn-primary btn-large" id="btn-next-round">
            ${result.isFinalRound ? 'View Final Winner! 🏆' : 'Next Round ➡️'}
          </button>
        </div>
      </div>
    `;

    this.root.appendChild(overlay);
    this.audio.playSuccess();
    this.haptics.success();

    overlay.querySelector('#btn-next-round')?.addEventListener('click', () => {
      this.audio.playTap();
      overlay.remove();
      onNext();
    });
  }

  // --- GRAND WINNER TOURNAMENT SCREEN ---
  showGrandWinner(leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[], onReturnHome: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';

    const winner = this.playerManager.getPlayer(leaderboard[0].playerId)!;
    const isTie = leaderboard.length > 1 && leaderboard[0].totalPoints === leaderboard[1].totalPoints;

    overlay.innerHTML = `
      <div class="winner-card">
        <div class="winner-trophy">🏆</div>
        <h1 class="winner-title">${isTie ? "IT'S A TIE!" : `${winner.name} WINS!`}</h1>
        <div class="winner-avatar" style="--p-color: ${winner.color}">${winner.avatar}</div>
        <div class="winner-points">${leaderboard[0].totalPoints} TOTAL POINTS</div>

        <div class="podium-display">
          ${leaderboard
            .map(entry => {
              const p = this.playerManager.getPlayer(entry.playerId)!;
              return `
              <div class="podium-step step-${entry.rank}" style="--p-color: ${p.color}">
                <div class="podium-avatar">${p.avatar}</div>
                <div class="podium-name">${p.name}</div>
                <div class="podium-block">#${entry.rank}</div>
                <div class="podium-score">${entry.totalPoints} pts</div>
              </div>
            `;
            })
            .join('')}
        </div>

        <div class="winner-actions">
          <button class="btn btn-primary btn-large" id="btn-winner-home">Back to Main Menu 🏠</button>
        </div>
      </div>
    `;

    this.root.appendChild(overlay);
    this.audio.playWinner();
    this.haptics.heavy();

    // Trigger celebratory confetti explosions!
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 60,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 60,
          origin: { x: 1 }
        });
      }, 400);
    } catch {}

    overlay.querySelector('#btn-winner-home')?.addEventListener('click', () => {
      this.audio.playTap();
      overlay.remove();
      onReturnHome();
    });
  }
}
