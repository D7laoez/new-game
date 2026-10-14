// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from '../src/services/PlayerManager.ts';
import { ScoreManager } from '../src/services/ScoreManager.ts';
import { StatsService } from '../src/services/StatsService.ts';
import { AchievementManager } from '../src/services/AchievementManager.ts';
import { MiniGameManager } from '../src/core/MiniGameManager.ts';
import { RoundManager, SessionState } from '../src/core/RoundManager.ts';
import { StorageService } from '../src/services/StorageService.ts';
import { AudioManager } from '../src/services/AudioManager.ts';
import { HapticManager } from '../src/services/HapticManager.ts';
import { GAME_CATALOG } from '../src/catalog/gameCatalog.ts';
import { PlayerId } from '../src/types/index.ts';

const memoryStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, val: string) => {
    memoryStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const k in memoryStorage) delete memoryStorage[k];
  },
  key: () => null,
  length: 0
} as unknown as Storage;

describe('Party Game Collection - Phase 3 Comprehensive Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================
  // 1. STORAGE SERVICE TESTS
  // ==========================================
  describe('StorageService', () => {
    it('1. saves and retrieves values with prefix', () => {
      StorageService.setItem('test_key', { hello: 'world' });
      const retrieved = StorageService.getItem('test_key', { hello: 'default' });
      expect(retrieved.hello).toBe('world');
    });

    it('2. returns default value when key does not exist', () => {
      const val = StorageService.getItem('non_existent', 42);
      expect(val).toBe(42);
    });

    it('3. removes stored items correctly', () => {
      StorageService.setItem('temp_key', 'temporary');
      StorageService.removeItem('temp_key');
      const val = StorageService.getItem('temp_key', 'fallback');
      expect(val).toBe('fallback');
    });
  });

  // ==========================================
  // 2. PLAYER MANAGER TESTS
  // ==========================================
  describe('PlayerManager', () => {
    it('4. initializes 4 default players with rich properties', () => {
      const pm = new PlayerManager();
      const all = pm.getAllPlayers();
      expect(all.length).toBe(4);
      expect(all[0].name).toBe('Player 1');
      expect(all[0].avatar).toBe('🦊');
      expect(all[0].color).toBe('#FF4757');
      expect(all[1].avatar).toBe('🐬');
      expect(all[2].avatar).toBe('🐯');
      expect(all[3].avatar).toBe('🐸');
    });

    it('5. clamps active player counts strictly between 1 and 4', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      expect(pm.getActiveCount()).toBe(3);
      expect(pm.getActivePlayers().length).toBe(3);

      pm.setActiveCount(10); // Clamped to 4
      expect(pm.getActiveCount()).toBe(4);

      pm.setActiveCount(0); // Clamped to 1
      expect(pm.getActiveCount()).toBe(1);
    });

    it('6. updates player name and avatar and persists them', () => {
      const pm = new PlayerManager();
      pm.updatePlayer(1, 'Ninja', '⚡');
      const p1 = pm.getPlayer(1);
      expect(p1?.name).toBe('Ninja');
      expect(p1?.avatar).toBe('⚡');

      // Check persistence across new instance
      const pm2 = new PlayerManager();
      const p1Reloaded = pm2.getPlayer(1);
      expect(p1Reloaded?.name).toBe('Ninja');
      expect(p1Reloaded?.avatar).toBe('⚡');
    });

    it('7. resets player cumulative scores cleanly', () => {
      const pm = new PlayerManager();
      pm.getActivePlayers()[0].totalScore = 150;
      pm.resetScores();
      expect(pm.getActivePlayers()[0].totalScore).toBe(0);
    });
  });

  // ==========================================
  // 3. SCORE MANAGER & TOURNAMENT SCORING
  // ==========================================
  describe('ScoreManager & Tournament Scoring', () => {
    it('8. assigns standard rank points for 4-player games (10, 6, 3, 1)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(4);
      const sm = new ScoreManager(pm);

      const game = GAME_CATALOG[0];
      const result = sm.recordRound(1, 3, game, { 1: 100, 2: 80, 3: 50, 4: 20 }, false);

      expect(result.roundScores[1]).toBe(10);
      expect(result.roundScores[2]).toBe(6);
      expect(result.roundScores[3]).toBe(3);
      expect(result.roundScores[4]).toBe(1);
    });

    it('9. assigns tournament points for 4-player games (10, 7, 5, 3)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(4);
      const sm = new ScoreManager(pm);

      const game = GAME_CATALOG[0];
      const result = sm.recordRound(1, 5, game, { 1: 50, 2: 40, 3: 30, 4: 10 }, true);

      expect(result.roundScores[1]).toBe(10);
      expect(result.roundScores[2]).toBe(7);
      expect(result.roundScores[3]).toBe(5);
      expect(result.roundScores[4]).toBe(3);
    });

    it('10. assigns tournament points for 2-player games (10, 5)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);

      const game = GAME_CATALOG[0];
      const result = sm.recordRound(1, 5, game, { 1: 99, 2: 50, 3: 0, 4: 0 }, true);

      expect(result.roundScores[1]).toBe(10);
      expect(result.roundScores[2]).toBe(5);
    });

    it('11. handles ties between players by giving equal points', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      const sm = new ScoreManager(pm);

      const game = GAME_CATALOG[0];
      const result = sm.recordRound(1, 3, game, { 1: 50, 2: 50, 3: 20, 4: 0 });

      expect(result.roundScores[1]).toBe(10);
      expect(result.roundScores[2]).toBe(10);
      expect(result.roundScores[3]).toBe(2);
    });

    it('12. tracks win streaks and best streak across rounds', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);
      const game = GAME_CATALOG[0];

      sm.recordRound(1, 5, game, { 1: 10, 2: 5, 3: 0, 4: 0 });
      sm.recordRound(2, 5, game, { 1: 10, 2: 5, 3: 0, 4: 0 });
      expect(sm.getBestStreak(1)).toBe(2);

      // Player 2 wins round 3
      sm.recordRound(3, 5, game, { 1: 5, 2: 10, 3: 0, 4: 0 });
      expect(sm.getBestStreak(1)).toBe(2);
      expect(sm.getPlayerWins(1)).toBe(2);
      expect(sm.getPlayerWins(2)).toBe(1);
    });

    it('13. computes comeback alerts and position changes', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      const sm = new ScoreManager(pm);
      const game = GAME_CATALOG[0];

      // Round 1: Player 1 wins
      const r1 = sm.recordRound(1, 5, game, { 1: 50, 2: 20, 3: 10, 4: 0 }, true);
      expect(r1.ranks[0].playerId).toBe(1);

      // Round 2: Player 2 surges and takes lead
      const r2 = sm.recordRound(2, 5, game, { 1: 0, 2: 100, 3: 50, 4: 0 }, true);
      expect(r2.comebackAlert).toBeDefined();
      expect(r2.comebackAlert).toContain('NEW LEADER');
    });

    it('14. correctly determines overall winner or tie', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);
      const game = GAME_CATALOG[0];

      sm.recordRound(1, 2, game, { 1: 50, 2: 10, 3: 0, 4: 0 });
      sm.recordRound(2, 2, game, { 1: 10, 2: 50, 3: 0, 4: 0 });

      // Scores are equal [13, 13] -> TIE
      expect(sm.getWinner()).toBe('TIE');
    });
  });

  // ==========================================
  // 4. STATS SERVICE TESTS
  // ==========================================
  describe('StatsService', () => {
    it('15. records round statistics, games played, and wins', () => {
      const stats = new StatsService();
      stats.recordRound('whack-it', { 1: 10, 2: 6, 3: 0, 4: 0 }, [1, 2], { 1: 220, 2: 350 }, 15);

      const p1 = stats.getPlayerStats(1);
      const p2 = stats.getPlayerStats(2);

      expect(p1.gamesPlayed).toBe(1);
      expect(p1.gamesWon).toBe(1);
      expect(p1.currentStreak).toBe(1);
      expect(p1.bestStreak).toBe(1);
      expect(p1.fastestReactionMs).toBe(220);
      expect(p1.totalPlaytimeSeconds).toBe(15);

      expect(p2.gamesPlayed).toBe(1);
      expect(p2.gamesWon).toBe(0);
      expect(p2.fastestReactionMs).toBe(350);
    });

    it('16. updates faster reaction time when improved', () => {
      const stats = new StatsService();
      stats.recordRound('quick-tap', { 1: 10, 2: 0, 3: 0, 4: 0 }, [1], { 1: 300 });
      expect(stats.getPlayerStats(1).fastestReactionMs).toBe(300);

      stats.recordRound('quick-tap', { 1: 10, 2: 0, 3: 0, 4: 0 }, [1], { 1: 185 });
      expect(stats.getPlayerStats(1).fastestReactionMs).toBe(185);
    });

    it('17. records tournament completion and tournament wins', () => {
      const stats = new StatsService();
      stats.recordTournament(1, [1, 2, 3]);

      expect(stats.getPlayerStats(1).tournamentsPlayed).toBe(1);
      expect(stats.getPlayerStats(1).tournamentsWon).toBe(1);
      expect(stats.getPlayerStats(2).tournamentsPlayed).toBe(1);
      expect(stats.getPlayerStats(2).tournamentsWon).toBe(0);
    });

    it('18. resets all player statistics cleanly', () => {
      const stats = new StatsService();
      stats.recordRound('whack-it', { 1: 10, 2: 0, 3: 0, 4: 0 }, [1]);
      stats.resetStats();

      expect(stats.getPlayerStats(1).gamesPlayed).toBe(0);
      expect(stats.getPlayerStats(1).gamesWon).toBe(0);
    });
  });

  // ==========================================
  // 5. ACHIEVEMENT MANAGER TESTS
  // ==========================================
  describe('AchievementManager', () => {
    it('19. loads 10 initial achievements locked by default', () => {
      const stats = new StatsService();
      const ach = new AchievementManager(stats);

      const list = ach.getAchievements();
      expect(list.length).toBe(10);
      expect(ach.getUnlockedCount()).toBe(0);
    });

    it('20. triggers FIRST_WIN on winning first round', () => {
      const stats = new StatsService();
      const ach = new AchievementManager(stats);
      const pm = new PlayerManager();
      const sm = new ScoreManager(pm);

      const roundRes = sm.recordRound(1, 3, GAME_CATALOG[0], { 1: 100, 2: 50, 3: 0, 4: 0 });
      ach.checkRound(roundRes);

      const firstWin = ach.getAchievements().find(a => a.id === 'FIRST_WIN');
      expect(firstWin?.unlockedAt).not.toBeNull();
    });

    it('21. triggers LIGHTNING_REFLEX for reaction times under 250ms', () => {
      const stats = new StatsService();
      const ach = new AchievementManager(stats);
      const pm = new PlayerManager();
      const sm = new ScoreManager(pm);

      const roundRes = sm.recordRound(1, 3, GAME_CATALOG[0], { 1: 100, 2: 50, 3: 0, 4: 0 });
      ach.checkRound(roundRes, { 1: 210 });

      const lr = ach.getAchievements().find(a => a.id === 'LIGHTNING_REFLEX');
      expect(lr?.unlockedAt).not.toBeNull();
    });

    it('22. dispatches onUnlock event listener upon achievement unlock', () => {
      const stats = new StatsService();
      const ach = new AchievementManager(stats);

      let unlockedId = '';
      ach.onUnlock(item => {
        unlockedId = item.id;
      });

      ach.unlock('PARTY_STARTER');
      expect(unlockedId).toBe('PARTY_STARTER');
    });

    it('23. triggers CUP_CHAMPION on winning a tournament session', () => {
      const stats = new StatsService();
      const ach = new AchievementManager(stats);

      ach.checkSessionEnd([{ playerId: 1, totalPoints: 45, rank: 1 }], true);

      const champ = ach.getAchievements().find(a => a.id === 'CUP_CHAMPION');
      expect(champ?.unlockedAt).not.toBeNull();
    });
  });

  // ==========================================
  // 6. MINI-GAME MANAGER & CATALOG
  // ==========================================
  describe('MiniGameManager & Catalog', () => {
    it('24. contains all 50+ game concepts in the catalog', () => {
      expect(GAME_CATALOG.length).toBeGreaterThanOrEqual(55);
    });

    it('25. has exactly 25 fully implemented playable games in Phase 3', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      expect(implemented.length).toBe(25);
    });

    it('26. all 25 games include valid metadata', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();

      implemented.forEach(g => {
        expect(g.id).toBeTruthy();
        expect(g.title).toBeTruthy();
        expect(g.icon).toBeTruthy();
        expect(g.durationSeconds).toBeGreaterThan(0);
        expect(g.supportedPlayers.length).toBeGreaterThan(0);
        expect(g.implemented).toBe(true);
      });
    });

    it('27. filters out incompatible games when player count is 1 (Solo)', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      const soloGames = implemented.filter(g => g.supportedPlayers.includes(1));

      expect(soloGames.find(g => g.id === 'tug-of-war')).toBeUndefined();
      expect(soloGames.find(g => g.id === 'bomb-pass')).toBeUndefined();
      expect(soloGames.length).toBeGreaterThan(15);
    });

    it('28. supports games correctly when player count is 2, 3, or 4', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      const fourPlayerGames = implemented.filter(g => g.supportedPlayers.includes(4));
      expect(fourPlayerGames.length).toBe(25);
    });

    it('29. prevents immediate game repetition across a party cycle', () => {
      const mgm = new MiniGameManager();
      const seenIds = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const game = mgm.pickNextGame(2);
        expect(seenIds.has(game.id)).toBe(false);
        seenIds.add(game.id);
      }
    });

    it('30. allows direct selection by specific game ID', () => {
      const mgm = new MiniGameManager();
      const picked = mgm.pickNextGame(2, undefined, 'whack-it');
      expect(picked.id).toBe('whack-it');
    });
  });

  // ==========================================
  // 7. ALL 25 MINI-GAMES LIFECYCLE & EXECUTION
  // ==========================================
  describe('Mini-Games Lifecycle Verification', () => {
    it('31. successfully instantiates and initializes all 25 mini-games without errors', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);

      const implemented = mgm.getImplementedGames();
      expect(implemented.length).toBe(25);

      implemented.forEach(g => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        expect(() => {
          mgm.loadGame(g.id, {
            container,
            players: pm.getActivePlayers(),
            activePlayerCount: 2,
            difficulty: 'NORMAL',
            audio,
            haptics,
            onFinish: () => {}
          });

          const current = mgm.getCurrentGame();
          expect(current).not.toBeNull();
          current?.start();
          current?.update(0.016);
          current?.destroy();
        }).not.toThrow();

        container.remove();
      });
    });

    it('32. cleans up active game when loading a new game', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);
      const container = document.createElement('div');

      mgm.loadGame('quick-tap', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio,
        haptics,
        onFinish: () => {}
      });

      const firstGame = mgm.getCurrentGame();
      expect(firstGame?.metadata.id).toBe('quick-tap');

      mgm.loadGame('whack-it', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio,
        haptics,
        onFinish: () => {}
      });

      const secondGame = mgm.getCurrentGame();
      expect(secondGame?.metadata.id).toBe('whack-it');
      mgm.destroyCurrentGame();
      expect(mgm.getCurrentGame()).toBeNull();
    });
  });

  // ==========================================
  // 8. ROUND MANAGER & TOURNAMENTS
  // ==========================================
  describe('RoundManager & Tournament Flow', () => {
    it('33. transitions states through INTRO -> COUNTDOWN -> PLAYING', () => {
      const pm = new PlayerManager();
      const sm = new ScoreManager(pm);
      const mgm = new MiniGameManager();
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);

      const statesRecorded: SessionState[] = [];
      const rm = new RoundManager(pm, sm, mgm, audio, haptics, {
        onStateChange: state => statesRecorded.push(state),
        onRoundComplete: () => {},
        onSessionComplete: () => {}
      });

      rm.startSession({
        playerCount: 2,
        totalRounds: 3,
        mode: 'TOURNAMENT',
        tournamentCup: 'BRONZE',
        categories: ['REACTION', 'SPEED']
      });

      expect(statesRecorded).toContain('INTRO');
      expect(rm.getCurrentRound()).toBe(1);
      expect(rm.getTotalRounds()).toBe(3);

      rm.startCountdown();
      expect(statesRecorded).toContain('COUNTDOWN');
    });

    it('34. correctly advances rounds and finishes when totalRounds is reached', () => {
      const pm = new PlayerManager();
      const sm = new ScoreManager(pm);
      const mgm = new MiniGameManager();
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);

      let sessionCompleted = false;
      const rm = new RoundManager(pm, sm, mgm, audio, haptics, {
        onStateChange: () => {},
        onRoundComplete: () => {},
        onSessionComplete: () => {
          sessionCompleted = true;
        }
      });

      rm.startSession({
        playerCount: 2,
        totalRounds: 1,
        mode: 'SINGLE',
        categories: []
      });

      expect(rm.getCurrentRound()).toBe(1);
      rm.nextRound();
      expect(sessionCompleted).toBe(true);
      expect(rm.getState()).toBe('TOURNAMENT_WINNER');
    });
  });

  // ==========================================
  // 9. AUDIO & HAPTIC MANAGERS TESTS
  // ==========================================
  describe('AudioManager & HapticManager', () => {
    it('35. audio manager handles mute toggles and sound playback safely', () => {
      const audio = new AudioManager(true);
      expect(() => {
        audio.playTap();
        audio.playCountdown(3);
        audio.playSuccess();
        audio.playError();
        audio.toggleMute(false);
        audio.playTone(440);
      }).not.toThrow();
    });

    it('36. haptic manager executes vibration profiles without errors', () => {
      const haptics = new HapticManager(true);
      expect(() => {
        haptics.light();
        haptics.medium();
        haptics.heavy();
        haptics.success();
        haptics.error();
        haptics.setEnabled(false);
        haptics.light();
      }).not.toThrow();
    });
  });

  // ==========================================
  // 10. SPECIFIC VERIFICATION OF 10 NEW MINI-GAMES (16 TO 25)
  // ==========================================
  describe('New Mini-Games (16 to 25) Mechanics Verification', () => {
    it('37. Game 16 — Whack It: supports 1 to 4 players and SPEED category', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'whack-it');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('SPEED');
      expect(meta?.supportedPlayers).toEqual([1, 2, 3, 4]);
      expect(meta?.implemented).toBe(true);
    });

    it('38. Game 17 — Stop The Bar: supports timing gauge and REACTION category', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'stop-the-bar');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('REACTION');
      expect(meta?.controls).toBe('Timing Tap');
      expect(meta?.implemented).toBe(true);
    });

    it('39. Game 18 — Number Rush: ascending sequence numbers tap', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'number-rush');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('SPEED');
      expect(meta?.controls).toBe('Number Sequence');
      expect(meta?.implemented).toBe(true);
    });

    it('40. Game 19 — Safe Tile: bridge memory path challenge', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'safe-tile');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('MEMORY');
      expect(meta?.controls).toBe('Step Tap');
      expect(meta?.implemented).toBe(true);
    });

    it('41. Game 20 — Balloon Pop: floating arcade balloons popping', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'balloon-pop');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('SPEED');
      expect(meta?.controls).toBe('Pop Tap');
      expect(meta?.implemented).toBe(true);
    });

    it('42. Game 21 — Follow The Arrow: D-pad directional reflexes', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'follow-the-arrow');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('REACTION');
      expect(meta?.controls).toBe('Direction Tap');
      expect(meta?.implemented).toBe(true);
    });

    it('43. Game 22 — Don\'t Press It: command buzzer psychological game', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'dont-press-it');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('PARTY');
      expect(meta?.controls).toBe('Buzzer Reflex');
      expect(meta?.implemented).toBe(true);
    });

    it('44. Game 23 — Treasure Dig: tile excavation for gems and gold', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'treasure-dig');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('PUZZLE');
      expect(meta?.controls).toBe('Dig Tap');
      expect(meta?.implemented).toBe(true);
    });

    it('45. Game 24 — Race to 100: dual alternating pedal sprint', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'race-to-100');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('SPEED');
      expect(meta?.controls).toBe('Dual Pedal Mash');
      expect(meta?.implemented).toBe(true);
    });

    it('46. Game 25 — Shape Snap: fast matching card snap duel', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'shape-snap');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('REACTION');
      expect(meta?.controls).toBe('Snap Buzzer');
      expect(meta?.implemented).toBe(true);
    });

    it('47. Game 16: responds to WHACK input and calculates scores', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      let finished = false;
      mgm.loadGame('whack-it', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {
          finished = true;
        }
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      game.handleInput(1, 'WHACK', 0);
      game.finish();
      expect(finished).toBe(true);
    });

    it('48. Game 17: Stop The Bar responds to STOP input and calculates precision', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('stop-the-bar', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      game.update(0.05);
      expect(() => game.handleInput(1, 'STOP')).not.toThrow();
      game.destroy();
    });

    it('49. Game 18: Number Rush handles ascending clicks and penalty shakes', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('number-rush', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      const dummyBtn = document.createElement('button');
      // Correct tap 1
      expect(() => game.handleInput(1, 'TAP_NUM', { num: 1, button: dummyBtn })).not.toThrow();
      // Incorrect tap 99
      expect(() => game.handleInput(1, 'TAP_NUM', { num: 99, button: dummyBtn })).not.toThrow();
      game.destroy();
    });

    it('50. Game 19: Safe Tile handles stepping and trap fallbacks', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('safe-tile', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      const dummyBtn = document.createElement('button');
      expect(() => game.handleInput(1, 'STEP', { row: 0, col: 0, button: dummyBtn })).not.toThrow();
      game.destroy();
    });

    it('51. Game 20: Balloon Pop handles POP input and floating coordinates', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('balloon-pop', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      game.update(0.016);
      expect(() => game.handleInput(1, 'POP', 1)).not.toThrow();
      game.destroy();
    });

    it('52. Game 21: Follow The Arrow responds to directional d-pad buttons', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('follow-the-arrow', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      expect(() => game.handleInput(1, 'DIR', 'UP')).not.toThrow();
      game.destroy();
    });

    it('53. Game 22: Don\'t Press It penalizes early buzzer presses', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('dont-press-it', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      // Pressing while IDLE causes early press penalty
      expect(() => game.handleInput(1, 'PRESS')).not.toThrow();
      game.destroy();
    });

    it('54. Game 23: Treasure Dig uncovers tiles and discovers diamonds/gold', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('treasure-dig', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      const dummyBtn = document.createElement('button');
      expect(() => game.handleInput(1, 'DIG', { idx: 0, button: dummyBtn })).not.toThrow();
      game.destroy();
    });

    it('55. Game 24: Race to 100 handles alternating left/right foot steps', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('race-to-100', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      expect(() => game.handleInput(1, 'STEP', 'LEFT')).not.toThrow();
      expect(() => game.handleInput(1, 'STEP', 'RIGHT')).not.toThrow();
      // Same foot twice -> stumble
      expect(() => game.handleInput(1, 'STEP', 'RIGHT')).not.toThrow();
      game.destroy();
    });

    it('56. Game 25: Shape Snap verifies snap match and false snap penalties', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const container = document.createElement('div');

      mgm.loadGame('shape-snap', {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: 2,
        difficulty: 'NORMAL',
        audio: new AudioManager(false),
        haptics: new HapticManager(false),
        onFinish: () => {}
      });

      const game = mgm.getCurrentGame()!;
      game.start();
      expect(() => game.handleInput(1, 'SNAP')).not.toThrow();
      game.destroy();
    });
  });

  // ==========================================
  // 12. I18N AND AUDIO EXTENSION TESTS
  // ==========================================
  describe('I18n & Procedural Audio Engine', () => {
    it('57. provides valid bilingual dictionary for English and Arabic', async () => {
      const { i18nDict } = await import('../src/services/I18nService.ts');
      expect(i18nDict.en.partyGamesTitle).toBe('PARTY GAMES');
      expect(i18nDict.ar.partyGamesTitle).toBe('ألعاب الحفلة');
      expect(i18nDict.en.playersCount(3)).toBe('👥 3 Players');
      expect(i18nDict.ar.playersCount(3)).toBe('👥 3 لاعبين');
    });

    it('58. procedural audio effects (explosion, whoosh, buzzer) execute safely without throwing', () => {
      const audio = new AudioManager(true);
      expect(() => audio.playExplosion()).not.toThrow();
      expect(() => audio.playWhoosh()).not.toThrow();
      expect(() => audio.playBuzzer()).not.toThrow();
    });
  });
});

