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
import { GameHistoryService } from '../services/GameHistoryService.ts';
import { DailyChallengeService } from '../services/DailyChallengeService.ts';
import { LeaderboardService } from '../services/LeaderboardService.ts';
import { CoinShopService } from '../services/CoinShopService.ts';
import { BracketService } from '../services/BracketService.ts';
import { TutorialService } from '../services/TutorialService.ts';
import { Language, i18nDict, Translations } from '../services/I18nService.ts';
import { PartyConfig, GameMetadata, RoundResult, PlayerId } from '../types/index.ts';

export class PartyApp {
  private playerManager: PlayerManager;
  private scoreManager: ScoreManager;
  private audioManager: AudioManager;
  private hapticManager: HapticManager;
  private statsService: StatsService;
  private achievementManager: AchievementManager;
  private historyService: GameHistoryService;
  private dailyService: DailyChallengeService;
  private leaderboardService: LeaderboardService;
  private coinService: CoinShopService;
  private bracketService: BracketService;
  private tutorialService: TutorialService;
  private miniGameManager: MiniGameManager;
  private roundManager: RoundManager;
  private modals: ModalsManager;

  private appRoot: HTMLElement;
  private menuView!: HTMLElement;
  private gameArenaView!: HTMLElement;
  private introOverlay!: HTMLElement;
  private introTimer: number | null = null;
  private introGoTimeoutId: number | null = null;

  private currentLang: Language = 'en';
  private pendingRounds: RoundResult[] = [];

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
    this.historyService = new GameHistoryService();
    this.dailyService = new DailyChallengeService();
    this.leaderboardService = new LeaderboardService();
    this.coinService = new CoinShopService();
    this.bracketService = new BracketService();
    this.tutorialService = new TutorialService();
    this.coinService.applyTheme();
    this.miniGameManager = new MiniGameManager();

    this.modals = new ModalsManager(
      this.appRoot,
      this.playerManager,
      this.miniGameManager,
      this.audioManager,
      this.hapticManager,
      this.scoreManager,
      this.statsService,
      this.achievementManager,
      this.historyService,
      this.dailyService,
      this.leaderboardService,
      this.coinService,
      this.bracketService,
      this.tutorialService
    );

    // Restore audio/music prefs
    try {
      const savedVol = StorageService.getItem<number>('app_volume', 80);
      this.audioManager.setVolume(savedVol/100);
      const musicOn = StorageService.getItem<boolean>('app_music_enabled', true);
      const musicVol = StorageService.getItem<number>('app_music_volume', 22);
      (this.audioManager as any).setMusicVolume?.(musicVol/100);
      (this.audioManager as any).setMusicEnabled?.(musicOn);
      if (musicOn) setTimeout(()=> (this.audioManager as any).playMusic?.(), 800);
      window.addEventListener('pointerdown', ()=> (this.audioManager as any).playMusic?.(), { once: true });
    } catch {}

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
              <button class="icon-btn" id="btn-daily" title="Daily Challenges">🎯<span class="top-badge" id="daily-badge" style="display:none"></span></button>
              <button class="icon-btn" id="btn-leaderboard" title="Leaderboard">👑</button>
              <button class="icon-btn" id="btn-shop" title="Shop & Coins">🛍️<span class="coin-pill" id="coin-pill">🪙 0</span></button>
              <button class="icon-btn" id="btn-bracket" title="Bracket Tournament">⚔️</button>
              <button class="icon-btn" id="btn-stats" title="${t.statistics}">📊</button>
              <button class="icon-btn" id="btn-history" title="History & Share">🕘</button>
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

    // Daily / Leaderboard / Shop / Bracket / Tutorial
    const refreshCoinPill = () => {
      const pill = this.appRoot.querySelector('#coin-pill') as HTMLElement;
      if (pill) pill.textContent = `🪙 ${this.coinService.getCoins()}`;
    };
    const refreshDailyBadge = () => {
      const badge = this.appRoot.querySelector('#daily-badge') as HTMLElement;
      const st = this.dailyService.getState();
      const claimable = st.challenges.filter(c=>c.completed && !c.claimed).length;
      if (badge) { badge.textContent = claimable? String(claimable): ''; badge.style.display = claimable? 'inline-flex':'none'; }
    };
    refreshCoinPill(); refreshDailyBadge();
    this.dailyService.onChange(()=> refreshDailyBadge());
    this.coinService.onChange(()=> refreshCoinPill());
    this.appRoot.querySelector('#btn-daily')?.addEventListener('click', () => { this.audioManager.playTap(); this.modals.showDailyChallenges(); });
    this.appRoot.querySelector('#btn-leaderboard')?.addEventListener('click', () => { this.audioManager.playTap(); this.modals.showLeaderboard(); });
    this.appRoot.querySelector('#btn-shop')?.addEventListener('click', () => { this.audioManager.playTap(); this.modals.showShop(); });
    this.appRoot.querySelector('#btn-bracket')?.addEventListener('click', () => { this.audioManager.playTap(); this.modals.showBracketSetup((ids)=> this.startBracketTournament(ids)); });

    // Stats

    // Achievements
    this.appRoot.querySelector('#btn-history')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showHistory();
    });
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

    // Audio toggle — persist
    let isMuted = StorageService.getItem<boolean>('app_muted', false);
    this.audioManager.toggleMute(!isMuted);
    const audioBtn = this.appRoot.querySelector('#btn-audio-toggle') as HTMLElement;
    if (audioBtn) audioBtn.textContent = isMuted ? '🔇' : '🔊';
    audioBtn?.addEventListener('click', () => {
      isMuted = !isMuted;
      this.audioManager.toggleMute(!isMuted);
      StorageService.setItem('app_muted', isMuted);
      audioBtn.textContent = isMuted ? '🔇' : '🔊';
      this.hapticManager.light();
    });

    // Settings
    this.appRoot.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.audioManager.playTap();
      this.modals.showSettings(isMuted, muted => {
        isMuted = muted;
        this.audioManager.toggleMute(!isMuted);
        StorageService.setItem('app_muted', isMuted);
        if (audioBtn) audioBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    });

    // Abort game
    this.appRoot.querySelector('#btn-abort-game')?.addEventListener('click', () => {
      if (confirm(this.t.quitConfirm)) {
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

  private startBracketTournament(ids: PlayerId[]): void {
    const st = this.bracketService.create(ids);
    const m = st.matches[st.currentMatchIndex];
    if (!m) return;
    // Bracket runs as a mini single-elim: each match is 1 round of random game
    this.lastPartyConfig = { playerCount: 2, totalRounds: 1, mode: 'QUICK', categories: ['REACTION','SPEED','COMPETITION','MEMORY','PUZZLE','PARTY'] };
    this.pendingRounds = [];
    // store bracket context for continuation after each round
    (this as any)._bracketActive = true;
    this.menuView.classList.add('hidden');
    this.gameArenaView.classList.remove('hidden');
    // temporarily limit to 2 players for this duel
    const prevCount = this.playerManager.getActiveCount();
    (this as any)._bracketPrevCount = prevCount;
    // we keep all players but scoreManager will handle 2-player duels: set active count 2 and map duel ids
    (this as any)._bracketMatch = m;
    this.playerManager.setActiveCount(2);
    this.roundManager.startSession({ playerCount: 2, totalRounds: 1, mode: 'SINGLE', categories: ['REACTION','SPEED','COMPETITION','MEMORY','PUZZLE','PARTY'] });
  }

  private startParty(config: PartyConfig): void {
    (this as any)._bracketActive = false;
    this.lastPartyConfig = config;
    this.pendingRounds = [];
    this.menuView.classList.add('hidden');
    this.gameArenaView.classList.remove('hidden');
    this.roundManager.startSession(config);
  }

  private handleSessionState(state: SessionState, data?: unknown): void {
    const roundTag = this.appRoot.querySelector('#arena-round-tag');
    if (roundTag) {
      try {
        roundTag.textContent = this.t.roundIndicator(
          this.roundManager.getCurrentRound(),
          this.roundManager.getTotalRounds()
        );
      } catch {}
    }

    if (state === 'INTRO') {
      const introData = data as { roundNumber: number; totalRounds: number; game: GameMetadata };
      if (introData?.game) this.showIntroOverlay(introData.game);
    } else if (state === 'PLAYING') {
      this.introOverlay.classList.add('hidden');
    } else if (state === 'IDLE') {
      this.clearIntroTimer();
      this.introOverlay.classList.add('hidden');
    }
  }

  private clearIntroTimer(): void {
    if (this.introTimer !== null) {
      clearInterval(this.introTimer);
      this.introTimer = null;
    }
    if (this.introGoTimeoutId !== null) {
      clearTimeout(this.introGoTimeoutId);
      this.introGoTimeoutId = null;
    }
  }

  private showIntroOverlay(game: GameMetadata): void {
    // Tutorial intercept: show once per game before countdown
    if (this.tutorialService.shouldShow(game.id)) {
      this.introOverlay.classList.add('hidden');
      this.modals.showTutorial(game.id, () => {
        this.tutorialService.markSeen(game.id);
        this.showIntroOverlay(game);
      });
      return;
    }
    this.clearIntroTimer();
    this.introOverlay.classList.remove('hidden');
    const isAr = this.currentLang === 'ar';

    this.introOverlay.innerHTML = `
      <div class="intro-card">
        <img class="intro-cover" src="${game.cover || `/covers/${game.id}.svg`}" alt="${game.title}" onerror="this.style.display='none'" />
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
    this.introTimer = window.setInterval(() => {
      if (count > 0) {
        countdownNum.textContent = count.toString();
        this.audioManager.playCountdown(count);
        this.hapticManager.medium();
        count--;
      } else {
        this.clearIntroTimer();
        countdownNum.textContent = 'GO!';
        countdownNum.classList.add('go');
        this.audioManager.playCountdown(0);
        this.hapticManager.heavy();

        this.introGoTimeoutId = window.setTimeout(() => {
          this.introGoTimeoutId = null;
          this.introOverlay.classList.add('hidden');
          const viewport = this.appRoot.querySelector('#game-viewport') as HTMLElement;
          if (viewport) this.roundManager.launchGame(viewport);
        }, 500);
      }
    }, 900);
  }

  private handleRoundComplete(result: RoundResult): void {
    this.pendingRounds.push(result);
    // Daily challenges: progress
    try {
      const maxPts = Math.max(...result.ranks.map(r=>r.roundPoints));
      const winners = result.ranks.filter(r=>r.roundPoints===maxPts).map(r=>r.playerId);
      this.dailyService.recordEvent({ type: 'round_played' });
      if (winners.length>0) {
        const curStreak = Math.max(...winners.map(id=> this.statsService.getPlayerStats(id).currentStreak));
        this.dailyService.recordEvent({ type: 'round_won', streakWins: curStreak });
        const cat = result.game.category;
        this.dailyService.recordEvent({ type: 'category_played', category: cat });
        this.dailyService.recordEvent({ type: 'category_won', category: cat });
        if (maxPts >= 10) this.dailyService.recordEvent({ type: 'perfect_win' });
      } else {
        this.dailyService.recordEvent({ type: 'category_played', category: result.game.category });
      }
      // Coins: small reward per round = 10 + top rank points
      const coinGain = 10 + maxPts;
      this.coinService.addCoins(coinGain);
      this.tutorialService.markCompleted(result.game.id);
    } catch {}
    this.modals.showRoundResults(result, () => {
      this.roundManager.nextRound();
    });
  }

  private handleSessionComplete(leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[]): void {
    try {
      const winner = leaderboard.length > 1 && leaderboard[0].totalPoints === leaderboard[1].totalPoints ? 'TIE' as const : leaderboard[0]?.playerId ?? ('TIE' as const);
      this.historyService.recordSession(this.lastPartyConfig, this.pendingRounds, leaderboard as any, winner as any);
      // Leaderboard persistent
      const wins: Record<PlayerId, number> = { 1:0,2:0,3:0,4:0 } as any;
      for (const r of this.pendingRounds) {
        const max = Math.max(...r.ranks.map(x=>x.roundPoints));
        for (const e of r.ranks) if (e.roundPoints===max) wins[e.playerId] = (wins[e.playerId]??0)+1;
      }
      const names: Record<PlayerId,string> = { 1:'',2:'',3:'',4:'' } as any;
      for (const p of this.playerManager.getAllPlayers()) names[p.id]=p.name;
      this.leaderboardService.recordSession({ date: Date.now(), leaderboard: leaderboard as any, wins, playerNames: names, mode: this.lastPartyConfig.mode, tournamentCup: this.lastPartyConfig.tournamentCup });
      if (this.lastPartyConfig.totalRounds >= 3) this.dailyService.recordEvent({ type: 'tournament_done' });
      // bonus coins for session completion
      const isTie = winner==='TIE';
      this.coinService.addCoins(isTie? 20 : 60);
    } catch {}
    // Bracket continuation: if active, report winner and advance
    const bracketActive = (this as any)._bracketActive;
    if (bracketActive) {
      const lb = leaderboard as any[];
      const w = lb.length>1 && lb[0].totalPoints===lb[1].totalPoints ? null : lb[0]?.playerId ?? null;
      if (w) this.bracketService.reportWinner(w as PlayerId);
      const st = this.bracketService.getState();
      if (st && !st.champion) {
        // next duel
        const next = st.matches[st.currentMatchIndex];
        (this as any)._bracketMatch = next;
        this.pendingRounds = [];
        this.roundManager.startSession({ playerCount: 2, totalRounds: 1, mode: 'SINGLE', categories: ['REACTION','SPEED','COMPETITION','MEMORY','PUZZLE','PARTY'] });
        return;
      } else if (st?.champion) {
        // restore player count
        const prev = (this as any)._bracketPrevCount ?? 2;
        this.playerManager.setActiveCount(prev);
        (this as any)._bracketActive = false;
        this.modals.showBracketResult(st as any, () => { this.showMenu(); this.modals.showBracketSetup((ids)=> this.startBracketTournament(ids)); }, () => this.showMenu());
        return;
      }
    }
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
    this.clearIntroTimer();
    this.introOverlay.classList.add('hidden');
    this.roundManager.endSession();
    this.gameArenaView.classList.add('hidden');
    this.menuView.classList.remove('hidden');
    this.updatePlayersStrip();
  }
}
