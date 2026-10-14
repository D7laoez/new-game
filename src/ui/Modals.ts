import { PlayerManager } from '../services/PlayerManager.ts';

import { MiniGameManager } from '../core/MiniGameManager.ts';

import { StorageService } from '../services/StorageService.ts';

import { GameHistoryService } from '../services/GameHistoryService.ts';

import { escapeHtml } from '../utils/sanitize.ts';

import { ScoreManager } from '../services/ScoreManager.ts';

import { StatsService } from '../services/StatsService.ts';

import { AchievementManager } from '../services/AchievementManager.ts';

import {

  IAudioManager,

  IHapticManager,

  PartyConfig,

  PlayerId,

  RoundResult,

  GameCategory,

  GameMetadata,

  GameDifficulty,

  TournamentCup,

  Achievement

} from '../types/index.ts';

import confetti from 'canvas-confetti';
import { DailyChallengeService } from '../services/DailyChallengeService.ts';
import { LeaderboardService, LeaderboardPeriod } from '../services/LeaderboardService.ts';
import { CoinShopService } from '../services/CoinShopService.ts';
import { BracketService, TournamentBracketState } from '../services/BracketService.ts';
import { TutorialService } from '../services/TutorialService.ts';



export class ModalsManager {

  // ── Pro Max: vivid category palette (Linear × Stripe store badges) ──
  private static CAT_COLOR: Record<string,string> = {
    REACTION: '#ef4444', SPEED: '#f59e0b', COMPETITION: '#6366f1', MEMORY: '#8b5cf6',
    PUZZLE: '#06b6d4', PARTY: '#ec4899', DRAWING: '#10b981', REFLEX: '#f97316',
    SKILL: '#3b82f6', BRAIN: '#a855f7', TIMING: '#eab308',
  };
  private catColor(cat: string): string { return (ModalsManager.CAT_COLOR[cat] ?? '#6366f1'); }


  private static FAVORITES_KEY = 'favorite_game_ids';

  private static RECENT_KEY = 'recent_game_ids';



  constructor(

    private root: HTMLElement,

    private playerManager: PlayerManager,

    private miniGameManager: MiniGameManager,

    private audio: IAudioManager,

    private haptics: IHapticManager,

    private scoreManager?: ScoreManager,

    private statsService?: StatsService,

    private achievementManager?: AchievementManager,

    private historyService?: GameHistoryService,
    private dailyService?: DailyChallengeService,
    private leaderboardService?: LeaderboardService,
    private coinService?: CoinShopService,
    private bracketService?: BracketService,
    private tutorialService?: TutorialService
  ) {}



  private getFavorites(): string[] {

    return StorageService.getItem<string[]>(ModalsManager.FAVORITES_KEY, []);

  }



  private toggleFavorite(id: string): boolean {

    const favs = this.getFavorites();

    const idx = favs.indexOf(id);

    let isFav = false;

    if (idx === -1) {

      favs.push(id);

      isFav = true;

    } else {

      favs.splice(idx, 1);

      isFav = false;

    }

    StorageService.setItem(ModalsManager.FAVORITES_KEY, favs);

    return isFav;

  }



  public recordRecentlyPlayed(id: string): void {

    const recent = StorageService.getItem<string[]>(ModalsManager.RECENT_KEY, []);

    const filtered = recent.filter(gId => gId !== id);

    filtered.unshift(id);

    StorageService.setItem(ModalsManager.RECENT_KEY, filtered.slice(0, 15));

  }



  private getRecentlyPlayed(): string[] {

    return StorageService.getItem<string[]>(ModalsManager.RECENT_KEY, []);

  }



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

          <label>How many players on this device?</label>

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

          <label>Game Difficulty</label>

          <div class="count-pill-group" id="diff-pills">

            <button class="count-pill" data-diff="EASY">EASY</button>

            <button class="count-pill active" data-diff="NORMAL">NORMAL</button>

            <button class="count-pill" data-diff="HARD">HARD</button>

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

    let selectedDiff: GameDifficulty = 'NORMAL';



    overlay.querySelectorAll('#round-pills .count-pill').forEach(btn => {

      btn.addEventListener('click', () => {

        overlay.querySelectorAll('#round-pills .count-pill').forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        selectedRounds = parseInt(btn.getAttribute('data-rounds') || '3', 10);

        this.audio.playTap();

      });

    });



    overlay.querySelectorAll('#diff-pills .count-pill').forEach(btn => {

      btn.addEventListener('click', () => {

        overlay.querySelectorAll('#diff-pills .count-pill').forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        selectedDiff = (btn.getAttribute('data-diff') || 'NORMAL') as GameDifficulty;

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

        difficulty: selectedDiff,

        categories: activeCats.length > 0 ? activeCats : ['REACTION', 'SPEED', 'COMPETITION', 'MEMORY']

      });

    });

  }



  // --- GAME PREVIEW MODAL ---

  showGamePreview(game: GameMetadata, onPlay: () => void): void {

    const activePlayerCount = this.playerManager.getActiveCount();

    const isCompatible = !game.supportedPlayers || game.supportedPlayers.includes(activePlayerCount);



    const overlay = document.createElement('div');

    overlay.className = 'modal-backdrop';

    overlay.innerHTML = `

      <div class="modal-card modal-game-preview">

        <div class="modal-header">

          <span class="preview-cat-badge" style="--cat-color:${this.catColor(game.category)};background:color-mix(in srgb, ${this.catColor(game.category)} 16%, transparent);color:${this.catColor(game.category)};border:1px solid color-mix(in srgb, ${this.catColor(game.category)} 28%, transparent)">${game.category}</span>

          <button class="modal-close-btn" id="m-preview-close">&times;</button>

        </div>



        <img class="preview-cover" src="${game.cover || `/covers/${game.id}.jpg`}" alt="${game.title}" style="width:100%;height:160px;object-fit:cover;border-radius:14px;margin-bottom:12px" onerror="this.onerror=null;this.src='/covers/${game.id}.svg'" />
        <div class="preview-hero">

          <div class="preview-icon">${game.icon}</div>

          <h2 class="preview-title">${game.title}</h2>

          <h3 class="preview-title-ar">${game.titleAr}</h3>

        </div>



        <div class="preview-details-grid">

          <div class="preview-pill">

            <span class="pill-label">👥 Players</span>

            <span class="pill-val">${game.minPlayers}–${game.maxPlayers} Players</span>

          </div>

          <div class="preview-pill">

            <span class="pill-label">⏱️ Duration</span>

            <span class="pill-val">~${game.durationSeconds}s</span>

          </div>

          <div class="preview-pill">

            <span class="pill-label">⚡ Difficulty</span>

            <span class="pill-val">${game.difficulty}</span>

          </div>

          <div class="preview-pill">

            <span class="pill-label">🎮 Controls</span>

            <span class="pill-val">${game.controls || 'Tap'}</span>

          </div>

        </div>



        <div class="preview-description">

          <p><strong>Overview:</strong> ${game.description}</p>

          <p><strong>Instructions:</strong> ${game.instructions}</p>

        </div>



        ${

          !isCompatible

            ? `<div class="preview-warning">⚠️ This mini-game requires ${game.minPlayers}+ players (currently ${activePlayerCount} selected). Change player count to play.</div>`

            : ''

        }



        <div class="modal-actions">

          ${

            game.implemented && isCompatible

              ? `<button class="btn btn-primary btn-large" id="btn-preview-play">PLAY GAME 🎮</button>`

              : `<button class="btn btn-primary btn-large disabled" disabled>${

                  !game.implemented ? 'Available in Next Batch' : 'Incompatible Player Count'

                }</button>`

          }

        </div>

      </div>

    `;



    this.root.appendChild(overlay);



    overlay.querySelector('#m-preview-close')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });



    overlay.querySelector('#btn-preview-play')?.addEventListener('click', () => {

      this.recordRecentlyPlayed(game.id);

      this.audio.playStart();

      this.haptics.success();

      overlay.remove();

      onPlay();

    });

  }



  // --- GAME LIBRARY MODAL ---

  showGameLibrary(onPlayGame: (gameId: string) => void): void {

    const allGames = this.miniGameManager.getAllCatalogGames();

    const activePlayerCount = this.playerManager.getActiveCount();

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

          <button class="lib-cat-pill" data-category="FAVORITES">❤️ FAVORITES</button>

          <button class="lib-cat-pill" data-category="RECENT">⏱️ RECENT</button>

          <button class="lib-cat-pill" data-category="REACTION">REACTION</button>

          <button class="lib-cat-pill" data-category="SPEED">SPEED</button>

          <button class="lib-cat-pill" data-category="COMPETITION">COMPETITION</button>

          <button class="lib-cat-pill" data-category="MEMORY">MEMORY</button>

          <button class="lib-cat-pill" data-category="PUZZLE">PUZZLE</button>

          <button class="lib-cat-pill" data-category="PARTY">PARTY</button>

          <button class="lib-cat-pill" data-category="DRAWING">DRAWING</button>

        </div>



        <div class="library-grid" id="lib-grid"></div>

      </div>

    `;



    this.root.appendChild(overlay);



    const renderGrid = (query = '', cat = 'ALL') => {

      const grid = overlay.querySelector('#lib-grid')!;

      const favorites = this.getFavorites();

      const recentIds = this.getRecentlyPlayed();



      const filtered = allGames.filter(g => {

        const matchesQuery =

          g.title.toLowerCase().includes(query.toLowerCase()) ||

          g.titleAr.includes(query) ||

          g.description.toLowerCase().includes(query.toLowerCase());



        let matchesCat = true;

        if (cat === 'FAVORITES') {

          matchesCat = favorites.includes(g.id);

        } else if (cat === 'RECENT') {

          matchesCat = recentIds.includes(g.id);

        } else if (cat !== 'ALL') {

          matchesCat = g.category === cat;

        }



        return matchesQuery && matchesCat;

      });



      if (filtered.length === 0) {

        grid.innerHTML = `<div class="lib-empty">No games found in this category.</div>`;

        return;

      }



      grid.innerHTML = filtered

        .map(g => {

          const isFav = favorites.includes(g.id);

          const isCompatible = !g.supportedPlayers || g.supportedPlayers.includes(activePlayerCount);
          const cCol = this.catColor(g.category);



          return `

          <div class="game-catalog-card ${g.implemented ? 'playable' : 'coming-soon'} ${!isCompatible ? 'incompatible' : ''}" data-id="${g.id}">

            <img class="game-cover" src="${g.cover || `/covers/${g.id}.jpg`}" alt="${g.title}" loading="lazy" onerror="this.onerror=null;this.src='/covers/${g.id}.svg'" />
            <span class="cat-badge" style="--cat-color:${cCol}">${g.category}</span>
            <div class="card-top-row">

              <span class="card-icon">${g.icon}</span>

              <button class="card-fav-btn ${isFav ? 'is-fav' : ''}" data-id="${g.id}">

                ${isFav ? '❤️' : '🤍'}

              </button>

            </div>

            <div class="card-body">

              <div class="card-title-row">

                <h3>${g.title}</h3>

                <span class="card-badge ${g.implemented ? 'badge-live' : 'badge-soon'}">

                  ${g.implemented ? '▶ PLAY' : 'SOON'}

                </span>

              </div>

              <div class="card-title-ar">${g.titleAr}</div>

              <p class="card-desc">${g.description}</p>

              <div class="card-meta">

                <span>👥 ${g.minPlayers}-${g.maxPlayers}P</span>

                <span>⏱️ ${g.durationSeconds}s</span>

                <span class="difficulty-${g.difficulty.toLowerCase()}">${g.difficulty}</span>

              </div>

              ${

                !isCompatible

                  ? `<div class="card-compat-tag">Needs ${g.minPlayers}+ Players</div>`

                  : ''

              }

            </div>

            ${

              g.implemented && isCompatible

                ? `<button class="btn btn-primary play-single-btn" data-id="${g.id}">Preview / Play</button>`

                : ''

            }

          </div>

        `;

        })

        .join('');



      // Favorite toggle buttons

      grid.querySelectorAll('.card-fav-btn').forEach(btn => {

        btn.addEventListener('click', e => {

          e.stopPropagation();

          const gId = btn.getAttribute('data-id')!;

          this.toggleFavorite(gId);

          this.audio.playTap();

          const activeCat = overlay.querySelector('.lib-cat-pill.active')?.getAttribute('data-category') || 'ALL';

          const q = (overlay.querySelector('#lib-search') as HTMLInputElement).value;

          renderGrid(q, activeCat);

        });

      });



      // Card clicks open Preview Modal

      grid.querySelectorAll('.game-catalog-card').forEach(card => {

        card.addEventListener('click', () => {

          const gId = card.getAttribute('data-id')!;

          const gameMeta = this.miniGameManager.getMetadata(gId);

          if (gameMeta) {

            this.audio.playTap();

            this.showGamePreview(gameMeta, () => {

              overlay.remove();

              onPlayGame(gId);

            });

          }

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

            <span>Color-Blind Friendly Mode</span>

            <button class="toggle-switch" id="toggle-colorblind">OFF</button>

          </div>

          <div class="settings-row">

            <span>Reduce Motion & Animations</span>

            <button class="toggle-switch" id="toggle-reduce-motion">OFF</button>

          </div>

          <div class="settings-row">

            <span>Display Orientation</span>

            <span class="settings-val">Landscape & Portrait Adaptive</span>

          </div>

          <div class="settings-row">

            <span>Reset All Progress</span>

            <button class="btn btn-secondary" id="btn-reset-all">Reset 🗑️</button>

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



    const cbStored = StorageService.getItem<boolean>('app_colorblind', false);

    const rmStored = StorageService.getItem<boolean>('app_reduce_motion', false);

    const applyA11y = () => {

      document.documentElement.classList.toggle('color-blind', StorageService.getItem<boolean>('app_colorblind', false));

      document.documentElement.classList.toggle('reduce-motion', StorageService.getItem<boolean>('app_reduce_motion', false));

    };

    applyA11y();

    const cbBtn = overlay.querySelector('#toggle-colorblind') as HTMLElement;

    const rmBtn = overlay.querySelector('#toggle-reduce-motion') as HTMLElement;

    if (cbBtn) {

      const syncCb = () => { const on = StorageService.getItem<boolean>('app_colorblind', false); cbBtn.className = 'toggle-switch' + (on ? ' on' : ''); cbBtn.textContent = on ? 'ON' : 'OFF'; };

      syncCb();

      cbBtn.addEventListener('click', () => { const cur = StorageService.getItem<boolean>('app_colorblind', false); StorageService.setItem('app_colorblind', !cur); applyA11y(); syncCb(); });

    }

    if (rmBtn) {

      const syncRm = () => { const on = StorageService.getItem<boolean>('app_reduce_motion', false); rmBtn.className = 'toggle-switch' + (on ? ' on' : ''); rmBtn.textContent = on ? 'ON' : 'OFF'; };

      syncRm();

      rmBtn.addEventListener('click', () => { const cur = StorageService.getItem<boolean>('app_reduce_motion', false); StorageService.setItem('app_reduce_motion', !cur); applyA11y(); syncRm(); });

    }


    const musicStored = StorageService.getItem<boolean>('app_music_enabled', true);
    const musicBtn = overlay.querySelector('#toggle-music') as HTMLElement;
    const syncMusic = () => { const on = StorageService.getItem<boolean>('app_music_enabled', true); if(musicBtn){ musicBtn.className='toggle-switch'+(on?' on':''); musicBtn.textContent=on?'ON 🎵':'OFF'; } };
    syncMusic();
    musicBtn?.addEventListener('click', () => {
      const cur = StorageService.getItem<boolean>('app_music_enabled', true);
      const next = !cur;
      StorageService.setItem('app_music_enabled', next);
      (this.audio as any).setMusicEnabled?.(next);
      if(next) (this.audio as any).playMusic?.(); else (this.audio as any).stopMusic?.();
      syncMusic(); this.audio.playTap();
    });
    const volSound = overlay.querySelector('#vol-sound') as HTMLInputElement;
    const volMusic = overlay.querySelector('#vol-music') as HTMLInputElement;
    if (volSound) {
      const vs = StorageService.getItem<number>('app_volume', 80);
      volSound.value = String(vs);
      volSound.addEventListener('input', () => {
        const v = parseInt(volSound.value,10)/100;
        this.audio.setVolume(v); StorageService.setItem('app_volume', parseInt(volSound.value,10));
      });
    }
    if (volMusic) {
      const vm = StorageService.getItem<number>('app_music_volume', 22);
      volMusic.value = String(vm);
      volMusic.addEventListener('input', () => {
        const v = parseInt(volMusic.value,10)/100;
        (this.audio as any).setMusicVolume?.(v); StorageService.setItem('app_music_volume', parseInt(volMusic.value,10));
      });
    }

        overlay.querySelector('#m-set-close')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#m-set-done')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#btn-reset-all')?.addEventListener('click', () => {

      if (confirm('Reset all stats, achievements and favorites? This cannot be undone.')) {

        StorageService.clearAll();

        this.audio.playTap();

        alert('Cleared! Reloading...');

        location.reload();

      }

    });

  }



  // --- TOURNAMENT / CUP SELECTION MODAL ---

  showTournamentSelect(onStart: (config: PartyConfig) => void): void {

    const overlay = document.createElement('div');

    overlay.className = 'modal-backdrop';



    const cups = [

      { id: 'BRONZE' as TournamentCup, name: 'Bronze Cup', nameAr: 'الكأس البرونزي', icon: '🥉', rounds: 5, color: '#CD7F32', desc: '5 Fast Rounds • Quick Showdown' },

      { id: 'SILVER' as TournamentCup, name: 'Silver Cup', nameAr: 'الكأس الفضي', icon: '🥈', rounds: 7, color: '#C0C0C0', desc: '7 Classic Rounds • Competitive Championship' },

      { id: 'GOLD' as TournamentCup, name: 'Gold Cup', nameAr: 'الكأس الذهبي', icon: '🥇', rounds: 10, color: '#FFD700', desc: '10 Intense Rounds • Pro Master League' },

      { id: 'ULTIMATE' as TournamentCup, name: 'Ultimate Cup', nameAr: 'كأس الأبطال الخارق', icon: '👑', rounds: 15, color: '#9B59B6', desc: '15 Epic Rounds • The Ultimate Grand Slam' },

      { id: 'CUSTOM' as TournamentCup, name: 'Custom Cup', nameAr: 'كأس مخصص', icon: '⚙️', rounds: 5, color: '#00D2D3', desc: 'Pick your own rounds & custom rules' }

    ];



    let selectedCup: TournamentCup = 'SILVER';

    let selectedRounds = 7;

    let selectedDiff: GameDifficulty = 'NORMAL';



    overlay.innerHTML = `

      <div class="modal-card modal-tournament">

        <div class="modal-header">

          <h2>🏆 Select Tournament Championship</h2>

          <button class="modal-close-btn" id="m-tourney-close">&times;</button>

        </div>



        <div class="tourney-cups-grid">

          ${cups

            .map(

              cup => `

            <div class="cup-card ${cup.id === selectedCup ? 'selected' : ''}" data-cup="${cup.id}" data-rounds="${cup.rounds}" style="--cup-accent: ${cup.color}">

              <div class="cup-icon">${cup.icon}</div>

              <div class="cup-info">

                <h3>${cup.name}</h3>

                <span class="cup-rounds-badge">${cup.rounds} Rounds</span>

                <p class="cup-desc">${cup.desc}</p>

              </div>

            </div>

          `

            )

            .join('')}

        </div>



        <div class="tourney-custom-rounds hidden" id="tourney-custom-rounds-box">

          <label>Custom Number of Rounds:</label>

          <div class="count-pill-group">

            ${[3, 5, 7, 10, 12, 15, 20]

              .map(

                r => `

              <button class="count-pill ${r === 5 ? 'active' : ''}" data-crounds="${r}">${r} Rounds</button>

            `

              )

              .join('')}

          </div>

        </div>



        <div class="setup-group">

          <label>Tournament Difficulty</label>

          <div class="count-pill-group" id="t-diff-pills">

            <button class="count-pill" data-diff="EASY">EASY</button>

            <button class="count-pill active" data-diff="NORMAL">NORMAL</button>

            <button class="count-pill" data-diff="HARD">HARD</button>

          </div>

        </div>



        <div class="modal-actions">

          <button class="btn btn-primary btn-large" id="btn-start-cup">Enter Championship! 🏆</button>

        </div>

      </div>

    `;



    this.root.appendChild(overlay);



    const customBox = overlay.querySelector('#tourney-custom-rounds-box') as HTMLElement;



    overlay.querySelectorAll('.cup-card').forEach(card => {

      card.addEventListener('click', () => {

        overlay.querySelectorAll('.cup-card').forEach(c => c.classList.remove('selected'));

        card.classList.add('selected');

        selectedCup = card.getAttribute('data-cup') as TournamentCup;

        selectedRounds = parseInt(card.getAttribute('data-rounds') || '7', 10);

        this.audio.playTap();



        if (selectedCup === 'CUSTOM') {

          customBox.classList.remove('hidden');

        } else {

          customBox.classList.add('hidden');

        }

      });

    });



    customBox.querySelectorAll('.count-pill').forEach(btn => {

      btn.addEventListener('click', () => {

        customBox.querySelectorAll('.count-pill').forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        selectedRounds = parseInt(btn.getAttribute('data-crounds') || '5', 10);

        this.audio.playTap();

      });

    });



    overlay.querySelectorAll('#t-diff-pills .count-pill').forEach(btn => {

      btn.addEventListener('click', () => {

        overlay.querySelectorAll('#t-diff-pills .count-pill').forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        selectedDiff = (btn.getAttribute('data-diff') || 'NORMAL') as GameDifficulty;

        this.audio.playTap();

      });

    });



    overlay.querySelector('#m-tourney-close')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });



    overlay.querySelector('#btn-start-cup')?.addEventListener('click', () => {

      this.audio.playStart();

      this.haptics.heavy();

      overlay.remove();



      onStart({

        playerCount: this.playerManager.getActiveCount(),

        totalRounds: selectedRounds,

        mode: 'TOURNAMENT',

        tournamentCup: selectedCup,

        difficulty: selectedDiff,

        categories: ['REACTION', 'SPEED', 'COMPETITION', 'MEMORY', 'PUZZLE', 'PARTY']

      });

    });

  }



  // --- ROUND RESULTS OVERLAY (WITH COMEBACK ALERTS, RANK SHIFTS & LEADERBOARD) ---

  showRoundResults(result: RoundResult, onNext: () => void): void {

    const overlay = document.createElement('div');

    overlay.className = 'results-overlay';



    const leaderScore = result.ranks[0]?.totalPoints || 0;

    const isTournament = result.ranks[0]?.roundPoints === 10; // Or tournament points distribution



    overlay.innerHTML = `

      <div class="results-card">

        <div class="results-badge">Round ${result.roundNumber} / ${result.totalRounds} Complete</div>

        <h2 class="results-game-title">${result.game.icon} ${result.game.title}</h2>

        

        ${

          result.comebackAlert

            ? `<div class="comeback-banner pulse-banner">${result.comebackAlert}</div>`

            : ''

        }



        <div class="current-leader-tag">

          👑 CURRENT LEADER: ${this.playerManager.getPlayer(result.ranks[0]?.playerId)?.name || 'Player 1'} (${leaderScore} pts)

        </div>



        <div class="leaderboard-table">

          ${result.ranks

            .map(entry => {

              const p = this.playerManager.getPlayer(entry.playerId)!;

              const diffToLeader = entry.rank === 1 ? 'LEADER 👑' : `-${leaderScore - entry.totalPoints} pts`;



              let rankShiftIcon = '▬';

              let shiftClass = 'shift-neutral';

              if (entry.rankChange && entry.rankChange > 0) {

                rankShiftIcon = `▲ +${entry.rankChange}`;

                shiftClass = 'shift-up';

              } else if (entry.rankChange && entry.rankChange < 0) {

                rankShiftIcon = `▼ ${entry.rankChange}`;

                shiftClass = 'shift-down';

              }



              return `

              <div class="leaderboard-row rank-${entry.rank}" style="--p-color: ${p.color}">

                <div class="row-rank">#${entry.rank}</div>

                <div class="row-shift ${shiftClass}">${rankShiftIcon}</div>

                <div class="row-player">

                  <span class="row-avatar">${p.avatar}</span>

                  <span class="row-name">${p.name}</span>

                </div>

                <div class="row-diff">${diffToLeader}</div>

                <div class="row-round-pts">+${entry.roundPoints} pts</div>

                <div class="row-total-pts">${entry.totalPoints} total</div>

              </div>

            `;

            })

            .join('')}

        </div>



        <div class="results-actions">

          <button class="btn btn-primary btn-large" id="btn-next-round">

            ${result.isFinalRound ? 'View Grand Podium! 🏆' : 'Next Round ➡️'}

          </button>

        </div>

      </div>

    `;



    this.root.appendChild(overlay);

    this.audio.playSuccess();

    this.haptics.success();



    const proceed = () => {

      this.audio.playTap();

      overlay.remove();

      onNext();

    };



    overlay.querySelector('#btn-next-round')?.addEventListener('click', proceed);

  }



  // --- GRAND WINNER TOURNAMENT SCREEN (WITH STATS BREAKDOWN) ---

  showGrandWinner(

    leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[],

    onAction: (action: 'PLAY_AGAIN' | 'NEW_PARTY' | 'GAME_LIBRARY' | 'MAIN_MENU') => void

  ): void {

    const overlay = document.createElement('div');

    overlay.className = 'winner-overlay';



    const winner = this.playerManager.getPlayer(leaderboard[0].playerId)!;

    const isTie = leaderboard.length > 1 && leaderboard[0].totalPoints === leaderboard[1].totalPoints;



    overlay.innerHTML = `

      <div class="winner-card">

        <div class="winner-trophy">🏆</div>

        <h1 class="winner-title">${isTie ? "IT'S A TIE!" : `${winner.name} WINS!` }</h1>

        <div class="winner-avatar" style="--p-color: ${winner.color}">${winner.avatar}</div>

        <div class="winner-points">${leaderboard[0].totalPoints} TOTAL POINTS</div>



        <div class="podium-display">

          ${leaderboard

            .map(entry => {

              const p = this.playerManager.getPlayer(entry.playerId)!;

              const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '4️⃣';

              const wins = this.scoreManager ? this.scoreManager.getPlayerWins(entry.playerId) : 0;

              const streak = this.scoreManager ? this.scoreManager.getBestStreak(entry.playerId) : 0;



              return `

              <div class="podium-step step-${entry.rank}" style="--p-color: ${p.color}">

                <div class="podium-medal">${medal}</div>

                <div class="podium-avatar">${p.avatar}</div>

                <div class="podium-name">${p.name}</div>

                <div class="podium-block">#${entry.rank}</div>

                <div class="podium-score">${entry.totalPoints} pts</div>

                <div class="podium-stats">

                  <span>🏆 ${wins} Wins</span>

                  <span>🔥 ${streak} Streak</span>

                </div>

              </div>

            `;

            })

            .join('')}

        </div>



        <div class="winner-actions-grid">

          <button class="btn btn-primary" id="btn-w-play-again">🔄 Play Again</button>

          <button class="btn btn-primary" id="btn-w-new-party">🎉 New Party</button>

          <button class="btn btn-secondary" id="btn-w-library">📚 Game Library</button>

          <button class="btn btn-secondary" id="btn-w-home">🏠 Main Menu</button>

        </div>

      </div>

    `;



        overlay.querySelector('#btn-share-results')?.addEventListener('click', () => {

      try {

        const names: Record<string, string> = {};

        for (const p of this.playerManager.getAllPlayers()) names[String(p.id)] = p.name;

        const rows = overlay.querySelectorAll('.winner-row');

        let text = 'Party Game Collection - Final Results\n';

        rows.forEach((r, i) => { const rowText = (r.textContent || '').trim().replace(/\s+/g, ' '); text += '#' + (i+1) + ' ' + rowText + '\n'; });

        if (this.historyService && this.historyService.getAll().length > 0) {

          const last = this.historyService.getAll()[0];

          text = this.historyService.toShareText(last, names as any);

        }

        this.shareResult(text);

      } catch {}

    });

this.root.appendChild(overlay);

    this.audio.playWinner();

    this.haptics.heavy();



    try {

      confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 } });

      setTimeout(() => {

        confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0 } });

        confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1 } });

      }, 400);

    } catch {}



    const handleBtn = (act: 'PLAY_AGAIN' | 'NEW_PARTY' | 'GAME_LIBRARY' | 'MAIN_MENU') => {

      this.audio.playTap();

      overlay.remove();

      onAction(act);

    };



    overlay.querySelector('#btn-w-play-again')?.addEventListener('click', () => handleBtn('PLAY_AGAIN'));

    overlay.querySelector('#btn-w-new-party')?.addEventListener('click', () => handleBtn('NEW_PARTY'));

    overlay.querySelector('#btn-w-library')?.addEventListener('click', () => handleBtn('GAME_LIBRARY'));

    overlay.querySelector('#btn-w-home')?.addEventListener('click', () => handleBtn('MAIN_MENU'));

  }



  // --- STATISTICS MODAL ---

  showStatistics(): void {

    if (!this.statsService) return;



    const overlay = document.createElement('div');

    overlay.className = 'modal-backdrop';



    const allStats = this.statsService.getAllStats();

    const players = this.playerManager.getAllPlayers();



    overlay.innerHTML = `

      <div class="modal-card modal-stats">

        <div class="modal-header">

          <h2>📊 Player Progression & Statistics</h2>

          <button class="modal-close-btn" id="m-stats-close">&times;</button>

        </div>



        <div class="stats-players-grid">

          ${players

            .map(p => {

              const s = allStats[p.id];

              const winRate = s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;

              const reflex = s.fastestReactionMs > 0 ? `${s.fastestReactionMs}ms` : '--';

              const playtimeMins = Math.round(s.totalPlaytimeSeconds / 60);



              return `

              <div class="player-stat-card" style="--p-color: ${p.color}">

                <div class="stat-card-header">

                  <span class="stat-avatar">${p.avatar}</span>

                  <h3>${p.name}</h3>

                </div>

                <div class="stat-metrics">

                  <div class="stat-metric-row">

                    <span>Games Played</span>

                    <strong>${s.gamesPlayed}</strong>

                  </div>

                  <div class="stat-metric-row">

                    <span>Rounds Won</span>

                    <strong>${s.gamesWon} (${winRate}%)</strong>

                  </div>

                  <div class="stat-metric-row">

                    <span>Tournaments Won</span>

                    <strong>${s.tournamentsWon}</strong>

                  </div>

                  <div class="stat-metric-row">

                    <span>Best Win Streak</span>

                    <strong>🔥 ${s.bestStreak}</strong>

                  </div>

                  <div class="stat-metric-row">

                    <span>Fastest Reflex</span>

                    <strong>⚡ ${reflex}</strong>

                  </div>

                  <div class="stat-metric-row">

                    <span>Total Playtime</span>

                    <strong>⏱️ ${playtimeMins} mins</strong>

                  </div>

                </div>

              </div>

            `;

            })

            .join('')}

        </div>



        <div class="modal-actions modal-stats-actions">

          <button class="btn btn-secondary" id="btn-reset-stats">Reset Stats 🔄</button>

          <button class="btn btn-primary" id="btn-stats-done">Done</button>

        </div>

      </div>

    `;



    this.root.appendChild(overlay);



    overlay.querySelector('#m-stats-close')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });



    overlay.querySelector('#btn-stats-done')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });



    overlay.querySelector('#btn-reset-stats')?.addEventListener('click', () => {

      if (confirm('Reset all player statistics?')) {

        this.statsService?.resetStats();

        this.audio.playTap();

        overlay.remove();

        this.showStatistics();

      }

    });

  }



  // --- ACHIEVEMENTS MODAL ---

  showAchievements(): void {

    if (!this.achievementManager) return;



    const overlay = document.createElement('div');

    overlay.className = 'modal-backdrop';



    const achievements = this.achievementManager.getAchievements();

    const unlockedCount = this.achievementManager.getUnlockedCount();



    overlay.innerHTML = `

      <div class="modal-card modal-achievements">

        <div class="modal-header">

          <h2>🏅 Party Achievements (${unlockedCount} / ${achievements.length})</h2>

          <button class="modal-close-btn" id="m-ach-close">&times;</button>

        </div>



        <div class="achievements-progress-bar">

          <div class="ach-prog-fill" style="width: ${(unlockedCount / achievements.length) * 100}%;"></div>

        </div>



        <div class="achievements-list">

          ${achievements

            .map(ach => {

              const isUnlocked = ach.unlockedAt !== null;

              const dateStr = isUnlocked && ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : '';



              return `

              <div class="achievement-row ${isUnlocked ? 'unlocked' : 'locked'}">

                <div class="ach-icon">${isUnlocked ? ach.icon : '🔒'}</div>

                <div class="ach-info">

                  <div class="ach-title-row">

                    <h4>${ach.title}</h4>

                    <span class="ach-title-ar">${ach.titleAr}</span>

                  </div>

                  <p class="ach-desc">${ach.description}</p>

                </div>

                <div class="ach-status">

                  ${isUnlocked ? `<span class="badge-unlocked">✅ Unlocked ${dateStr}</span>` : `<span class="badge-locked">Locked</span>`}

                </div>

              </div>

            `;

            })

            .join('')}

        </div>



        <div class="modal-actions">

          <button class="btn btn-primary" id="btn-ach-done">Done</button>

        </div>

      </div>

    `;



    this.root.appendChild(overlay);



    overlay.querySelector('#m-ach-close')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });



    overlay.querySelector('#btn-ach-done')?.addEventListener('click', () => {

      this.audio.playTap();

      overlay.remove();

    });

  }



  // --- TOAST NOTIFICATION FOR ACHIEVEMENTS ---

  showAchievementToast(achievement: Achievement): void {

    const toast = document.createElement('div');

    toast.className = 'achievement-toast';

    toast.innerHTML = `

      <div class="toast-glow"></div>

      <div class="toast-icon">${achievement.icon}</div>

      <div class="toast-body">

        <span class="toast-tag">🏆 ACHIEVEMENT UNLOCKED!</span>

        <strong class="toast-title">${achievement.title}</strong>

        <p class="toast-desc">${achievement.description}</p>

      </div>

    `;



    this.root.appendChild(toast);

    this.audio.playWinner();

    this.haptics.heavy();



    setTimeout(() => {

      toast.classList.add('hide');

      setTimeout(() => toast.remove(), 400);

    }, 4000);

  }



  // --- GAME HISTORY MODAL ---

  showHistory(): void {

    const overlay = document.createElement('div');

    overlay.className = 'modal-backdrop';

    const entries = this.historyService ? this.historyService.getAll() : [];

    const playerNames: Record<string, string> = {};

    for (const p of this.playerManager.getAllPlayers()) playerNames[String(p.id)] = p.name;

    const emptyHtml = '<div class="lib-empty" style="padding:18px">No sessions yet. Play a party to see history here.</div>';

    let listHtml = '';

    if (entries.length > 0) {

      listHtml = '<div class="history-list">' + entries.map(e => {

        const d = new Date(e.date).toLocaleString();

        const winner = e.winnerId === 'TIE' ? 'TIE' : (playerNames[String(e.winnerId)] ?? ('P' + e.winnerId));

        const summary = e.rounds.map(r => r.icon + ' ' + escapeHtml(r.title)).join(' · ');

        return '<div class="history-entry" data-id="' + e.id + '">' +

          '<div class="history-head"><strong>' + escapeHtml(e.mode) + (e.tournamentCup ? ' · ' + escapeHtml(e.tournamentCup) : '') + '</strong> <span class="history-date">' + escapeHtml(d) + '</span></div>' +

          '<div class="history-meta">' + e.totalRounds + ' rounds · ' + e.playerCount + ' players · Winner: ' + escapeHtml(winner) + '</div>' +

          '<div class="history-rounds">' + summary + '</div>' +

          '<div class="history-actions"><button class="btn btn-secondary btn-small hist-share" data-id="' + e.id + '">Share / Copy</button><button class="btn btn-secondary btn-small hist-view" data-id="' + e.id + '">Details</button></div>' +

          '</div>';

      }).join('') + '</div>';

    }

    overlay.innerHTML = '<div class="modal-card modal-history"><div class="modal-header"><h2>History & Share</h2><button class="modal-close-btn" id="m-hist-close">&times;</button></div>' + (entries.length === 0 ? emptyHtml : listHtml) + '<div class="modal-actions">' + (entries.length ? '<button class="btn btn-secondary" id="hist-clear">Clear History</button>' : '') + '<button class="btn btn-primary" id="hist-done">Close</button></div></div>';

    this.root.appendChild(overlay);

    overlay.querySelector('#m-hist-close')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#hist-done')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#hist-clear')?.addEventListener('click', () => {

      if (confirm('Clear all session history?')) { this.historyService?.clear(); overlay.remove(); this.showHistory(); }

    });

    const doShare = async (id: string) => {

      const e = this.historyService?.getById(id);

      if (!e) return;

      const text = this.historyService!.toShareText(e, playerNames as unknown as Record<import('../types/index.ts').PlayerId, string>);

      try { if (navigator.share) { await navigator.share({ title: 'Party Game results', text }); this.haptics.success(); return; } } catch {}

      try { await navigator.clipboard.writeText(text); this.haptics.success(); alert('Results copied to clipboard!'); } catch { alert(text); }

    };

    overlay.querySelectorAll('.hist-share').forEach(b => b.addEventListener('click', () => { const id = b.getAttribute('data-id'); if (id) doShare(id); }));

    overlay.querySelectorAll('.hist-view').forEach(b => b.addEventListener('click', () => {

      const bid = b.getAttribute('data-id'); if (!bid) return;

      const e = this.historyService?.getById(bid);

      if (!e) return;

      const text = this.historyService!.toShareText(e, playerNames as unknown as Record<import('../types/index.ts').PlayerId, string>);

      alert(text);

    }));

  }




  // ========== DAILY CHALLENGES ==========
  showDailyChallenges(): void {
    if (!this.dailyService || !this.coinService) return;
    const svc = this.dailyService;
    const coinSvc = this.coinService;
    const state = svc.getState();
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const pct = svc.getProgressPercent();
    const cards = state.challenges.map((ch: any) => {
      const progPct = Math.round((ch.progress / ch.target) * 100);
      const action = ch.claimed ? '<span class="badge-unlocked">✅ Claimed</span>' : ch.completed ? '<button class="btn btn-primary btn-small daily-claim" data-id="'+ch.id+'">Claim +'+ch.rewardCoins+' 🪙</button>' : '<span class="badge-locked">'+ch.progress+'/'+ch.target+'</span>';
      return '<div class="achievement-row '+(ch.completed?'unlocked':'locked')+'">'
        +'<div class="ach-icon">'+ch.icon+'</div>'
        +'<div class="ach-info"><div class="ach-title-row"><h4>'+escapeHtml(ch.title)+'</h4><span class="ach-title-ar">'+escapeHtml(ch.titleAr)+'</span></div><p class="ach-desc">'+escapeHtml(ch.description)+'</p>'
        +'<div class="daily-prog"><div class="daily-prog-track"><div class="daily-prog-fill" style="width:'+progPct+'%"></div></div><span class="daily-prog-label">'+progPct+'%</span></div></div>'
        +'<div class="ach-status">'+action+'</div></div>';
    }).join('');
    overlay.innerHTML = '<div class="modal-card modal-daily"><div class="modal-header"><h2>🎯 Daily Challenges</h2><button class="modal-close-btn" id="m-daily-close">&times;</button></div>'
      +'<div class="daily-meta"><span>Streak: 🔥 '+state.streak+' days</span><span>Total completed: '+state.totalCompleted+'</span><span>Today: '+pct+'%</span></div>'
      +'<div class="achievements-progress-bar"><div class="ach-prog-fill" style="width:'+pct+'%"></div></div>'
      +'<div class="achievements-list">'+cards+'</div>'
      +'<div class="modal-actions"><button class="btn btn-secondary" id="daily-claim-all">Claim All</button><button class="btn btn-primary" id="daily-done">Done</button></div></div>';
    this.root.appendChild(overlay);
    const refresh = () => { overlay.remove(); this.showDailyChallenges(); };
    overlay.querySelector('#m-daily-close')?.addEventListener('click', ()=> { this.audio.playTap(); overlay.remove(); });
    overlay.querySelector('#daily-done')?.addEventListener('click', ()=> { this.audio.playTap(); overlay.remove(); });
    overlay.querySelector('#daily-claim-all')?.addEventListener('click', ()=> {
      const total = svc.claimAll();
      if (total>0) { coinSvc.addCoins(total); this.audio.playCoin(); this.haptics.coin(); }
      refresh();
    });
    overlay.querySelectorAll('.daily-claim').forEach(b=> b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-id')!;
      const coins = svc.claim(id);
      if (coins>0) { coinSvc.addCoins(coins); this.audio.playCoin(); this.haptics.coin(); }
      refresh();
    }));
  }

  // ========== LEADERBOARD ==========
  showLeaderboard(): void {
    if (!this.leaderboardService) return;
    const svc = this.leaderboardService;
    let period: LeaderboardPeriod = 'ALL';
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const render = () => {
      const agg = svc.getAggregated(period);
      const recent = svc.getRecent(12, period);
      overlay.innerHTML = '<div class="modal-card modal-leaderboard"><div class="modal-header"><h2>👑 Leaderboard</h2><button class="modal-close-btn" id="m-lb-close">&times;</button></div>'
        +'<div class="count-pill-group" id="lb-period">'
        +['ALL','WEEK','MONTH'].map(p=> '<button class="count-pill '+(p===period?'active':'')+'" data-period="'+p+'">'+p+'</button>').join('')
        +'</div>'
        +'<h3 style="margin-top:10px">🏆 Overall ('+period+')</h3>'
        + (agg.length? '<div class="leaderboard-table">'+agg.map((e: any,i: number)=> '<div class="leaderboard-row rank-'+(i+1)+'" style="--p-color:'+(this.playerManager.getPlayer(e.playerId)?.color||'#6366f1')+'"><div class="row-rank">#'+(i+1)+'</div><div class="row-player"><span class="row-avatar">'+(this.playerManager.getPlayer(e.playerId)?.avatar||'👤')+'</span><span class="row-name">'+escapeHtml(e.playerName)+'</span></div><div class="row-total-pts">'+e.totalPoints+' pts • '+e.sessions+' sessions • avg '+e.avgPoints+'</div><div class="row-round-pts">'+e.wins+' wins</div></div>').join('')+'</div>' : '<div class="lib-empty">No data yet for this period.</div>')
        +'<h3 style="margin-top:14px">🕘 Recent Sessions</h3>'
        + (recent.length? '<div class="history-list" style="max-height:220px;overflow:auto">'+recent.map((r: any)=> '<div class="history-entry"><div class="history-head"><strong>'+escapeHtml(r.playerName)+'</strong> <span class="history-date">'+new Date(r.date).toLocaleDateString()+'</span></div><div class="history-meta">'+r.mode+(r.tournamentCup?' · '+escapeHtml(r.tournamentCup):'')+' • #'+r.rank+' • '+r.totalPoints+' pts</div></div>').join('')+'</div>' : '<div class="lib-empty">No sessions yet.</div>')
        +'<div class="modal-actions"><button class="btn btn-secondary" id="lb-clear">Clear</button><button class="btn btn-primary" id="lb-done">Done</button></div></div>';
      overlay.querySelector('#m-lb-close')?.addEventListener('click', ()=> { this.audio.playTap(); overlay.remove(); });
      overlay.querySelector('#lb-done')?.addEventListener('click', ()=> overlay.remove());
      overlay.querySelector('#lb-clear')?.addEventListener('click', ()=> { if(confirm('Clear leaderboard?')){ svc.clear(); render(); } });
      overlay.querySelectorAll('#lb-period .count-pill').forEach(b=> b.addEventListener('click', ()=>{ period = b.getAttribute('data-period') as LeaderboardPeriod; render(); }));
    };
    this.root.appendChild(overlay);
    render();
  }

  // ========== SHOP ==========
  showShop(): void {
    if (!this.coinService) return;
    const svc = this.coinService;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const render = () => {
      const coins = svc.getCoins();
      const items = svc.getCatalog();
      const byKind = (k: string) => items.filter((i: any)=>i.kind===k);
      const st = svc.getState();
      const card = (it: any) => '<div class="game-catalog-card '+(it.owned?'playable':'coming-soon')+'" style="padding:12px"><div style="font-size:2rem">'+it.icon+'</div><h3>'+escapeHtml(it.name)+'</h3><div class="card-title-ar">'+escapeHtml(it.nameAr)+'</div><p class="card-desc">'+it.kind+' • '+it.price+' 🪙</p>'
        + (it.owned ? '<span class="badge-live">OWNED</span> '+( (it.kind==='SKIN' && st.activeSkinId===it.id) || (it.kind==='THEME' && st.activeThemeId===it.id) ? '<span class="badge-live" style="background:#6366f1">EQUIPPED</span>' : '<button class="btn btn-primary btn-small shop-equip" data-id="'+it.id+'">Equip</button>') : '<button class="btn btn-primary btn-small shop-buy" data-id="'+it.id+'">Buy</button>')
        +'</div>';
      overlay.innerHTML = '<div class="modal-card modal-shop"><div class="modal-header"><h2>🛍️ Shop — 🪙 '+coins+' Coins</h2><button class="modal-close-btn" id="m-shop-close">&times;</button></div>'
        +'<div class="shop-earn-hint">Earn coins by playing & completing dailies! Win rounds for bonus coins.</div>'
        +'<h3>✨ Skins</h3><div class="library-grid">'+byKind('SKIN').map(card).join('')+'</div>'
        +'<h3 style="margin-top:12px">🎨 Themes</h3><div class="library-grid">'+byKind('THEME').map(card).join('')+'</div>'
        +'<h3 style="margin-top:12px">🎊 Effects</h3><div class="library-grid">'+byKind('EFFECT').map(card).join('')+'</div>'
        +'<div class="modal-actions"><button class="btn btn-secondary" id="shop-unequip">Unequip Theme</button><button class="btn btn-primary" id="shop-done">Done</button></div></div>';
      overlay.querySelector('#m-shop-close')?.addEventListener('click', ()=> { this.audio.playTap(); overlay.remove(); });
      overlay.querySelector('#shop-done')?.addEventListener('click', ()=> overlay.remove());
      overlay.querySelector('#shop-unequip')?.addEventListener('click', ()=> { svc.equipTheme(null); render(); });
      overlay.querySelectorAll('.shop-buy').forEach(b=> b.addEventListener('click', ()=>{
        const id=b.getAttribute('data-id')!; const res=svc.buy(id);
        if(!res.ok && res.reason==='not_enough_coins') { this.audio.playError(); alert('Not enough coins!'); }
        else if(res.ok) { this.audio.playCoin(); this.haptics.coin(); render(); } else render();
      }));
      overlay.querySelectorAll('.shop-equip').forEach(b=> b.addEventListener('click', ()=>{
        const id=b.getAttribute('data-id')!; const item=items.find((x: any)=>x.id===id);
        if(item?.kind==='SKIN') svc.equipSkin(id); else if(item?.kind==='THEME') svc.equipTheme(id);
        this.audio.playTap(); render();
      }));
    };
    this.root.appendChild(overlay);
    render();
  }

  // ========== BRACKET ==========
  showBracketSetup(onStart: (ids: PlayerId[])=>void): void {
    const count = this.playerManager.getActiveCount();
    const players = this.playerManager.getActivePlayers();
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    const st = this.bracketService?.getState();
    overlay.innerHTML = '<div class="modal-card"><div class="modal-header"><h2>⚔️ Bracket Tournament</h2><button class="modal-close-btn" id="m-br-close">&times;</button></div>'
      + (st && !st.champion ? '<div class="preview-warning" style="margin-bottom:12px">Ongoing bracket: '+(st.matches.map((m: any)=> m.round+': P'+m.p1+' vs P'+m.p2+ (m.winner? ' → P'+m.winner : '') ).join(' · '))+'</div><div class="modal-actions"><button class="btn btn-primary" id="br-continue">Continue Bracket</button><button class="btn btn-secondary" id="br-reset">Reset Bracket</button></div>'
        : '<p style="color:var(--text-muted)">Single-elimination for '+count+' players. Each duel is 1 fast game.</p><div class="players-strip" style="margin:10px 0">'+players.map(p=>'<span class="player-chip-badge" style="--p-color:'+p.color+'">'+p.avatar+' '+escapeHtml(p.name)+'</span>').join('')+'</div>'
        + (count<2? '<div class="preview-warning">Need at least 2 players. Add players first.</div>' : '')
        +'<div class="modal-actions"><button class="btn btn-primary btn-large" id="br-start" '+(count<2?'disabled':'')+'>Start Bracket ⚔️</button></div>')
      +'<div class="modal-actions" style="margin-top:8px"><button class="btn btn-secondary" id="br-done">Close</button></div></div>';
    this.root.appendChild(overlay);
    overlay.querySelector('#m-br-close')?.addEventListener('click', ()=> overlay.remove());
    overlay.querySelector('#br-done')?.addEventListener('click', ()=> overlay.remove());
    overlay.querySelector('#br-start')?.addEventListener('click', ()=>{
      const ids = this.playerManager.getActivePlayers().map(p=>p.id) as PlayerId[];
      this.audio.playStart(); overlay.remove(); onStart(ids);
    });
    overlay.querySelector('#br-continue')?.addEventListener('click', ()=>{
      const cur = this.bracketService?.getCurrentMatch();
      if(!cur) { overlay.remove(); return; }
      this.audio.playTap(); overlay.remove();
      // resume is handled already via bracketService state; re-enter next match by starting a single game duel
      const ids = this.playerManager.getActivePlayers().map(p=>p.id) as PlayerId[];
      onStart(ids);
    });
    overlay.querySelector('#br-reset')?.addEventListener('click', ()=>{ if(confirm('Reset bracket?')){ this.bracketService?.clear(); overlay.remove(); this.showBracketSetup(onStart);} });
  }

  showBracketResult(state: TournamentBracketState, onAgain: ()=>void, onMenu: ()=>void): void {
    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';
    const champ = this.playerManager.getPlayer(state.champion as PlayerId);
    overlay.innerHTML = '<div class="winner-card"><div class="winner-trophy">🏆</div><h1 class="winner-title">'+(champ? escapeHtml(champ.name)+' IS CHAMPION!' : 'CHAMPION P'+state.champion)+'</h1>'
      +'<div class="winner-avatar" style="--p-color:'+(champ?.color||'#FFD700')+'">'+(champ?.avatar||'👑')+'</div>'
      +'<div class="podium-display">'+state.matches.map((m: any)=> '<div class="podium-step" style="--p-color:#6366f1"><div class="podium-medal">'+m.round+'</div><div class="podium-name">P'+m.p1+' vs P'+m.p2+'</div><div class="podium-score">'+(m.winner? 'Winner P'+m.winner : '—')+'</div></div>').join('')+'</div>'
      +'<div class="winner-actions-grid"><button class="btn btn-primary" id="br-again">Play Again</button><button class="btn btn-secondary" id="br-menu">Menu</button></div></div>';
    this.root.appendChild(overlay);
    try { confetti({ particleCount: 140, spread: 100, origin:{y:0.6} }); } catch {}
    this.audio.playWinner(); this.haptics.heavy();
    overlay.querySelector('#br-again')?.addEventListener('click', ()=> { overlay.remove(); onAgain(); });
    overlay.querySelector('#br-menu')?.addEventListener('click', ()=> { overlay.remove(); onMenu(); });
  }

  // ========== TUTORIAL ==========
  showTutorial(gameId: string, onDone: ()=>void): void {
    const tut = this.tutorialService?.getTutorial(gameId);
    const meta = this.miniGameManager.getMetadata(gameId);
    if (!tut || !meta) { onDone(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = '<div class="modal-card modal-tutorial"><div class="modal-header"><h2>'+tut.icon+' How to Play: '+escapeHtml(meta.title)+'</h2><button class="modal-close-btn" id="m-tut-close">&times;</button></div>'
      +'<img class="preview-cover" src="'+(meta.cover||'/covers/'+gameId+'.svg')+'" alt="" onerror="this.style.display=\'none\'" />'
      +'<ol class="tutorial-steps">'+tut.steps.map((s: any)=>'<li>'+escapeHtml(s)+'</li>').join('')+'</ol>'
      +'<div class="tutorial-tips">💡 Tips: '+tut.tips.map((t: any)=>escapeHtml(t)).join(' • ')+'</div>'
      +'<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="tut-never"/> Don\'t show tutorials again</label>'
      +'<div class="modal-actions"><button class="btn btn-secondary" id="tut-skip">Skip</button><button class="btn btn-primary btn-large" id="tut-play">Got it — Play! ▶️</button></div></div>';
    this.root.appendChild(overlay);
    const finish = () => {
      const cb = overlay.querySelector('#tut-never') as HTMLInputElement;
      if (cb?.checked) this.tutorialService?.dismissAll();
      overlay.remove(); this.audio.playTap(); onDone();
    };
    overlay.querySelector('#m-tut-close')?.addEventListener('click', finish);
    overlay.querySelector('#tut-skip')?.addEventListener('click', finish);
    overlay.querySelector('#tut-play')?.addEventListener('click', finish);
  }


  shareResult(text: string) {

    const tryShare = async () => {

      try { if (navigator.share) { await navigator.share({ title: 'Party Game results', text }); return; } } catch {}

      try { await navigator.clipboard.writeText(text); alert('Results copied to clipboard!'); } catch { alert(text); }

    };

    tryShare();

  }

}



