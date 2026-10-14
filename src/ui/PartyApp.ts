import { PlayerManager } from '../services/PlayerManager.ts';
import { ScoreManager } from '../services/ScoreManager.ts';
import { AudioManager } from '../services/AudioManager.ts';
import { HapticManager } from '../services/HapticManager.ts';
import { StatsService } from '../services/StatsService.ts';
import { AchievementManager } from '../services/AchievementManager.ts';
import { MiniGameManager } from '../core/MiniGameManager.ts';
import { RoundManager, SessionState } from '../core/RoundManager.ts';
import { ModalsManager } from './Modals.ts';
import { StorageService } from '../services/StorageService.ts';
import { Language, i18nDict, Translations } from '../services/I18nService.ts';
import { PartyConfig, GameMetadata, RoundResult, PlayerId } from '../types/index.ts';

export class PartyApp {
  private playerManager: PlayerManager;
  private scoreManager: ScoreManager;
  private audioManager: AudioManager;
  private hapticManager: HapticManager;
  private statsService: StatsService;
  private achievementManager: AchievementManager;
  private miniGameManager: MiniGameManager;
  private roundManager: RoundManager;
  private modals: ModalsManager;

  private appRoot: HTMLElement;
  private menuView!: HTMLElement;
  private gameArenaView!: HTMLElement;
  private introOverlay!: HTMLElement;

  private currentLang: Language = 'en';

  constructor(root: HTMLElement) {
    this.appRoot = root;
    this.currentLang = StorageService.getItem<Language>('app_lang', 'en');
    this.applyLanguage(this.currentLang, false);

    this.playerManager = new PlayerManager();
    this.scoreManager = new ScoreManager(this.playerManager);
    this.audioManager = new AudioManager(true);
    this.hapticManager = new HapticManager(true);
    this.statsService = new StatsService();
    this.achievementManager = new AchievementManager(this.statsService);
    this.miniGameManager = new MiniGameManager();

    this.modals = new ModalsManager(
      this.appRoot,
      this.playerManager,
      this.miniGameManager,
      this.audioManager,
      this.hapticManager,
      this.scoreManager,
      this.statsService,
      this.achievementManager
    );

    // Achievement unlock listener
    this.achievementManager.onUnlock(ach => {
      this.modals.showAchievementToast(ach);
    });

    this.roundManager = new RoundManager(
      this.playerManager,
      this.scoreManager,
      this.miniGameManager,
      this.audioManager,
      this.hapticManager,
      {
        onStateChange: (state, data) => this.handleSessionState(state, data),
        onRoundComplete: res => this.handleRoundComplete(res),
        onSessionComplete: lb => this.handleSessionComplete(lb)
      },
      this.statsService,
      this.achievementManager
    );

    this.renderBaseLayout();
  }

  public get t(): Translations {
    return i18nDict[this.currentLang];
  }

  public applyLanguage(lang: Language, reRender = true): void {
    this.currentLang = lang;
    StorageService.setItem('app_lang', lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    if (reRender && this.menuView) {
      this.renderBaseLayout();
    }
  }

  public toggleLanguage(): void {
    const nextLang: Language = this.currentLang === 'en' ? 'ar' : 'en';
    this.applyLanguage(nextLang, true);
    this.audioManager.playTap();
  }

  private renderBaseLayout(): void {
    const t = this.t;
    const isAr = this.currentLang === 'ar';

    this.appRoot.innerHTML = `
      <div class="app-container">
        <!-- MAIN MENU -->
        <div class="view-menu" id="view-menu">
          <header class="app-top-bar">
            <div class="app-brand">
              <span class="brand-badge">${t.miniGamesBadge}</span>
              <h1 class="brand-title">${t.partyGamesTitle}</h1>
            </div>
            <div class="top-bar-actions">
              <button class="icon-btn btn-lang" id="btn-lang-toggle" title="Switch Language">
                <span>${isAr ? '🇬🇧 English' : '🇸🇦 العربية'}</span>
              </button>
              <button class="icon-btn" id="btn-player-pill" title="Configure Players">
                <span id="player-count-label">👥 2 Players</span>
              </button>
              <button class="icon-btn" id="btn-stats" title="${t.statistics}">📊</button>
              <button class="icon-btn" id="btn-achievements" title="${t.achievements}">🏅</button>
              <button class="icon-btn" id="btn-audio-toggle" title="Toggle Sound">🔊</button>
              <button class="icon-btn" id="btn-settings" title="${t.settings}">⚙️</button>
            </div>
          </header>

          <main class="menu-content">
            <!-- HERO QUICK PLAY -->
            <div class="hero-card" id="btn-quick-play">
              <div class="hero-badge">${t.instantFun}</div>
              <h2>${t.quickParty}</h2>
              <p>${t.quickPartyDesc}</p>
              <button class="btn btn-primary btn-glow">${t.playNow}</button>
            </div>

            <!-- MODE TILES -->
            <div class="menu-grid">
              <div class="menu-tile tile-tournament" id="btn-mode-tournament">
                <div class="tile-icon">🏆</div>
                <div class="tile-body">
                  <h3>${t.tournament}</h3>
                  <p>${t.tournamentDesc}</p>
                </div>
              </div>

              <div class="menu-tile tile-custom" id="btn-mode-custom">
                <div class="tile-icon">🎯</div>
                <div class="tile-body">
                  <h3>${t.customParty}</h3>
                  <p>${t.customPartyDesc}</p>
                </div>
              </div>

              <div class="menu-tile tile-library" id="btn-mode-library">
                <div class="tile-icon">📚</div>
                <div class="tile-body">
                  <h3>${t.gameLibrary}</h3>
                  <p>${t.gameLibraryDesc}</p>
                </div>
              </div>

              <div class="menu-tile tile-players" id="btn-mode-players">
                <div class="tile-icon">👥</div>
                <div class="tile-body">
                  <h3>${t.playersAndAvatars}</h3>
                  <p>${t.playersDesc}</p>
                </div>
              </div>
            </div>

            <!-- ACTIVE PLAYERS PREVIEW STRIP -->
            <div class="players-strip" id="active-players-strip"></div>
          </main>
        </div>

        <!-- GAME ARENA VIEW -->
        <div class="view-arena hidden" id="view-arena">
          <div class="arena-top-nav">
            <button class="icon-btn" id="btn-abort-game" title="Quit to Menu">✕</button>
            <div class="arena-round-indicator" id="arena-round-tag">Round 1 / 3</div>
            <div class="arena-empty-slot"></div>
          </div>

          <div class="game-viewport" id="game-viewport"></div>

          <!-- INTRO & COUNTDOWN OVERLAY -->
          <div class="game-intro-overlay hidden" id="game-intro-overlay"></div>
        </div>
      </div>
    `;

    this.menuView = this.appRoot.querySelector('#view-menu')!;
    this.gameArenaView = this.appRoot.querySelector('#view-arena')!;
    this.introOverlay = this.appRoot.querySelector('#game-intro-overlay')!;

    this.bindMenuEvents();
    this.updatePlayersStrip();
  }

  private bindMenuEvents(): void {
    // Language Toggle
    this.appRoot.querySelector('#btn-lang-toggle')?.addEventListener('click', () => {
      this.toggleLanguage();
    });

    // Quick Play
    this.appRoot.querySelector('#btn-quick-play')?.addEventListener('click', () => {
      this.audioManager.playStart();
      this.startParty({
        playerCount: this.playerManager.getActiveCount(),
        totalRounds: 3,
        mode: 'QUICK',
        categories: ['REACTION', 'SPEED', 'COMPETITION', 'MEMORY']
      });
    });

    // Tournament
    this.appRoot.querySelector('#btn-mode-tournament')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showTournamentSelect(config => this.startParty(config));
    });

    // Stats
    this.appRoot.querySelector('#btn-stats')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showStatistics();
    });

    // Achievements
    this.appRoot.querySelector('#btn-achievements')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showAchievements();
    });

    // Custom Party
    this.appRoot.querySelector('#btn-mode-custom')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showPartySetup('CUSTOM', config => this.startParty(config));
    });

    // Game Library
    this.appRoot.querySelector('#btn-mode-library')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showGameLibrary(gameId => {
        this.startParty({
          playerCount: this.playerManager.getActiveCount(),
          totalRounds: 1,
          mode: 'SINGLE',
          categories: [],
          specificGameId: gameId
        });
      });
    });

    // Players Modal
    const openPlayers = () => {
      this.audioManager.playTap();
      this.modals.showPlayerSetup(() => {
        this.updatePlayersStrip();
      });
    };
    this.appRoot.querySelector('#btn-player-pill')?.addEventListener('click', openPlayers);
    this.appRoot.querySelector('#btn-mode-players')?.addEventListener('click', openPlayers);

    // Audio toggle
    let isMuted = false;
    const audioBtn = this.appRoot.querySelector('#btn-audio-toggle') as HTMLElement;
    audioBtn?.addEventListener('click', () => {
      isMuted = !isMuted;
      this.audioManager.toggleMute(!isMuted);
      audioBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Settings
    this.appRoot.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showSettings(isMuted, muted => {
        isMuted = muted;
        this.audioManager.toggleMute(!isMuted);
        if (audioBtn) audioBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    });

    // Abort game
    this.appRoot.querySelector('#btn-abort-game')?.addEventListener('click', () => {
      if (confirm(this.t.quitConfirm)) {
        this.roundManager.endSession();
        this.showMenu();
      }
    });
  }

  private updatePlayersStrip(): void {
    const strip = this.appRoot.querySelector('#active-players-strip');
    const label = this.appRoot.querySelector('#player-count-label');
    const players = this.playerManager.getActivePlayers();

    if (label) {
      label.textContent = this.t.playersCount(players.length);
    }

    if (strip) {
      strip.innerHTML = players
        .map(
          p => `
        <div class="player-chip-badge" style="--p-color: ${p.color}">
          <span class="chip-avatar">${p.avatar}</span>
          <span class="chip-name">${p.name}</span>
        </div>
      `
        )
        .join('');
    }
  }

  private lastPartyConfig: PartyConfig = {
    playerCount: 2,
    totalRounds: 3,
    mode: 'QUICK',
    categories: ['REACTION', 'SPEED', 'COMPETITION', 'MEMORY']
  };

  private startParty(config: PartyConfig): void {
    this.lastPartyConfig = config;
    this.menuView.classList.add('hidden');
    this.gameArenaView.classList.remove('hidden');
    this.roundManager.startSession(config);
  }

  private handleSessionState(state: SessionState, data?: unknown): void {
    const roundTag = this.appRoot.querySelector('#arena-round-tag');
    if (roundTag) {
      roundTag.textContent = this.t.roundIndicator(
        this.roundManager.getCurrentRound(),
        this.roundManager.getTotalRounds()
      );
    }

    if (state === 'INTRO') {
      const introData = data as { roundNumber: number; totalRounds: number; game: GameMetadata };
      this.showIntroOverlay(introData.game);
    } else if (state === 'PLAYING') {
      this.introOverlay.classList.add('hidden');
    }
  }

  private showIntroOverlay(game: GameMetadata): void {
    this.introOverlay.classList.remove('hidden');
    const isAr = this.currentLang === 'ar';

    this.introOverlay.innerHTML = `
      <div class="intro-card">
        <div class="intro-category-badge">${game.category}</div>
        <div class="intro-icon">${game.icon}</div>
        <h2 class="intro-title">${isAr && game.titleAr ? game.titleAr : game.title}</h2>
        <h3 class="intro-title-ar">${isAr ? game.title : game.titleAr}</h3>
        <p class="intro-desc">${game.instructions}</p>

        <div class="countdown-circle" id="countdown-circle">
          <span id="countdown-num">${this.t.getReady}</span>
        </div>
      </div>
    `;

    const countdownNum = this.introOverlay.querySelector('#countdown-num')!;
    let count = 3;

    // 3, 2, 1, GO!
    const timer = setInterval(() => {
      if (count > 0) {
        countdownNum.textContent = count.toString();
        this.audioManager.playCountdown(count);
        this.hapticManager.medium();
        count--;
      } else {
        clearInterval(timer);
        countdownNum.textContent = 'GO!';
        countdownNum.classList.add('go');
        this.audioManager.playCountdown(0);
        this.hapticManager.heavy();

        setTimeout(() => {
          this.introOverlay.classList.add('hidden');
          const viewport = this.appRoot.querySelector('#game-viewport') as HTMLElement;
          this.roundManager.launchGame(viewport);
        }, 500);
      }
    }, 900);
  }

  private handleRoundComplete(result: RoundResult): void {
    this.modals.showRoundResults(result, () => {
      this.roundManager.nextRound();
    });
  }

  private handleSessionComplete(leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[]): void {
    this.modals.showGrandWinner(leaderboard, action => {
      if (action === 'PLAY_AGAIN') {
        this.startParty(this.lastPartyConfig);
      } else if (action === 'NEW_PARTY') {
        this.showMenu();
        this.modals.showPartySetup('CUSTOM', cfg => this.startParty(cfg));
      } else if (action === 'GAME_LIBRARY') {
        this.showMenu();
        this.modals.showGameLibrary(gId => {
          this.startParty({
            playerCount: this.playerManager.getActiveCount(),
            totalRounds: 1,
            mode: 'SINGLE',
            categories: [],
            specificGameId: gId
          });
        });
      } else {
        this.showMenu();
      }
    });
  }

  private showMenu(): void {
    this.gameArenaView.classList.add('hidden');
    this.menuView.classList.remove('hidden');
    this.updatePlayersStrip();
  }
}
