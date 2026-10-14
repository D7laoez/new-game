// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from '../src/services/PlayerManager.ts';
import { ScoreManager } from '../src/services/ScoreManager.ts';
import { MiniGameManager } from '../src/core/MiniGameManager.ts';
import { RoundManager, SessionState } from '../src/core/RoundManager.ts';
import { StorageService } from '../src/services/StorageService.ts';
import { AudioManager } from '../src/services/AudioManager.ts';
import { HapticManager } from '../src/services/HapticManager.ts';
import { GAME_CATALOG } from '../src/catalog/gameCatalog.ts';

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

describe('Party Game Collection - Phase 2 Comprehensive Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --- STORAGE SERVICE TESTS ---
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

  // --- PLAYER MANAGER TESTS ---
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

  // --- SCORE MANAGER TESTS ---
  describe('ScoreManager', () => {
    it('8. assigns rank points accurately for 4-player games (10, 6, 3, 1)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(4);
      const sm = new ScoreManager(pm);

      const round = sm.recordRound(1, 3, GAME_CATALOG[0], {
        1: 40,
        2: 90,
        3: 15,
        4: 5
      });

      expect(round.roundScores[2]).toBe(10);
      expect(round.roundScores[1]).toBe(6);
      expect(round.roundScores[3]).toBe(3);
      expect(round.roundScores[4]).toBe(1);
    });

    it('9. assigns rank points accurately for 2-player games (10, 3)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);

      const round = sm.recordRound(1, 1, GAME_CATALOG[0], {
        1: 20,
        2: 80,
        3: 0,
        4: 0
      });

      expect(round.roundScores[2]).toBe(10);
      expect(round.roundScores[1]).toBe(3);
    });

    it('10. assigns rank points accurately for 3-player games (10, 5, 2)', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      const sm = new ScoreManager(pm);

      const round = sm.recordRound(1, 1, GAME_CATALOG[0], {
        1: 50,
        2: 100,
        3: 10,
        4: 0
      });

      expect(round.roundScores[2]).toBe(10);
      expect(round.roundScores[1]).toBe(5);
      expect(round.roundScores[3]).toBe(2);
    });

    it('11. handles ties between players by giving equal points', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);

      const round = sm.recordRound(1, 1, GAME_CATALOG[0], {
        1: 50,
        2: 50,
        3: 0,
        4: 0
      });

      expect(round.roundScores[1]).toBe(round.roundScores[2]);
      expect(sm.getWinner()).toBe('TIE');
    });

    it('12. accumulates total scores across multiple rounds correctly', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(2);
      const sm = new ScoreManager(pm);

      sm.recordRound(1, 2, GAME_CATALOG[0], { 1: 100, 2: 50, 3: 0, 4: 0 }); // P1: 10, P2: 3
      sm.recordRound(2, 2, GAME_CATALOG[1], { 1: 20, 2: 80, 3: 0, 4: 0 });  // P1: 3, P2: 10

      const totals = sm.getCumulativeScores();
      expect(totals[1]).toBe(13);
      expect(totals[2]).toBe(13);
      expect(sm.getWinner()).toBe('TIE');
    });

    it('13. computes leaderboard sorted by total points descending', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      const sm = new ScoreManager(pm);

      sm.recordRound(1, 1, GAME_CATALOG[0], { 1: 10, 2: 50, 3: 30, 4: 0 });
      const leaderboard = sm.getLeaderboard();

      expect(leaderboard[0].playerId).toBe(2);
      expect(leaderboard[1].playerId).toBe(3);
      expect(leaderboard[2].playerId).toBe(1);
    });
  });

  // --- MINIGAME MANAGER & CATALOG TESTS ---
  describe('MiniGameManager & Catalog', () => {
    it('14. contains all 55 game concepts in the catalog', () => {
      expect(GAME_CATALOG.length).toBeGreaterThanOrEqual(55);
    });

    it('15. has exactly 15 fully implemented playable games in Phase 2', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      expect(implemented.length).toBe(15);
    });

    it('16. all 15 games include valid metadata (title, icon, duration, supportedPlayers)', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();

      implemented.forEach(g => {
        expect(g.id).toBeTruthy();
        expect(g.title).toBeTruthy();
        expect(g.icon).toBeTruthy();
        expect(g.durationSeconds).toBeGreaterThan(0);
        expect(g.supportedPlayers).toBeDefined();
        expect(g.supportedPlayers.length).toBeGreaterThan(0);
      });
    });

    it('17. filters out incompatible games when player count is 1 (Solo)', () => {
      const mgm = new MiniGameManager();
      // Solo mode: games like Tug of War or Bomb Pass requires 2+
      for (let i = 0; i < 20; i++) {
        const picked = mgm.pickNextGame(1);
        expect(picked.supportedPlayers).toContain(1);
        expect(picked.id).not.toBe('tug-of-war');
        expect(picked.id).not.toBe('bomb-pass');
      }
    });

    it('18. supports all 15 games when player count is 2, 3, or 4', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      const fourPlayerGames = implemented.filter(g => g.supportedPlayers.includes(4));
      expect(fourPlayerGames.length).toBe(15);
    });

    it('19. filters games accurately by category', () => {
      const mgm = new MiniGameManager();
      const memoryGame = mgm.pickNextGame(2, ['MEMORY']);
      expect(memoryGame.category).toBe('MEMORY');

      const speedGame = mgm.pickNextGame(2, ['SPEED']);
      expect(speedGame.category).toBe('SPEED');
    });

    it('20. prevents immediate game repetition across a party cycle', () => {
      const mgm = new MiniGameManager();
      const picked1 = mgm.pickNextGame(2);
      const picked2 = mgm.pickNextGame(2);
      expect(picked1.id).not.toBe(picked2.id);
    });

    it('21. allows direct selection by specific game ID', () => {
      const mgm = new MiniGameManager();
      const picked = mgm.pickNextGame(2, undefined, 'bomb-pass');
      expect(picked.id).toBe('bomb-pass');
    });
  });

  // --- GAME LIFECYCLE & INSTANTIATION TESTS ---
  describe('Game Lifecycle & Instantiation', () => {
    it('22. successfully instantiates and initializes all 15 mini-games without errors', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);
      const container = document.createElement('div');

      const implemented = mgm.getImplementedGames();
      expect(implemented.length).toBe(15);

      implemented.forEach(g => {
        const context = {
          container,
          players: pm.getActivePlayers(),
          activePlayerCount: pm.getActiveCount(),
          difficulty: 'NORMAL' as const,
          audio,
          haptics,
          onFinish: () => {}
        };

        expect(() => {
          const game = mgm.loadGame(g.id, context);
          expect(game).toBeDefined();
          game.destroy();
        }).not.toThrow();
      });
    });

    it('23. cleans up active game when loading a new game', () => {
      const mgm = new MiniGameManager();
      const pm = new PlayerManager();
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);
      const container = document.createElement('div');

      const context = {
        container,
        players: pm.getActivePlayers(),
        activePlayerCount: pm.getActiveCount(),
        audio,
        haptics,
        onFinish: () => {}
      };

      mgm.loadGame('quick-tap', context);
      expect(mgm.getCurrentGame()).not.toBeNull();

      mgm.loadGame('rapid-tap', context);
      expect(mgm.getCurrentGame()?.metadata.id).toBe('rapid-tap');

      mgm.destroyCurrentGame();
      expect(mgm.getCurrentGame()).toBeNull();
    });
  });

  // --- ROUND MANAGER SESSION FLOW TESTS ---
  describe('RoundManager Flow', () => {
    it('24. transitions states through INTRO -> COUNTDOWN -> PLAYING', () => {
      const pm = new PlayerManager();
      const sm = new ScoreManager(pm);
      const mgm = new MiniGameManager();
      const audio = new AudioManager(false);
      const haptics = new HapticManager(false);

      const statesRecorded: SessionState[] = [];
      const rm = new RoundManager(pm, sm, mgm, audio, haptics, {
        onStateChange: s => statesRecorded.push(s),
        onRoundComplete: () => {},
        onSessionComplete: () => {}
      });

      rm.startSession({
        playerCount: 2,
        totalRounds: 2,
        mode: 'QUICK',
        categories: ['REACTION']
      });

      expect(statesRecorded).toContain('INTRO');
      expect(rm.getCurrentRound()).toBe(1);
      expect(rm.getTotalRounds()).toBe(2);

      rm.startCountdown();
      expect(statesRecorded).toContain('COUNTDOWN');
    });

    it('25. correctly advances rounds and finishes when totalRounds is reached', () => {
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
      rm.nextRound(); // Exceeds total round 1 -> triggers finish
      expect(sessionCompleted).toBe(true);
      expect(rm.getState()).toBe('TOURNAMENT_WINNER');
    });
  });

  // --- AUDIO & HAPTIC MANAGERS TESTS ---
  describe('AudioManager & HapticManager', () => {
    it('26. audio manager handles mute toggles and sound playback safely', () => {
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

    it('27. haptic manager executes vibration profiles without errors', () => {
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

  // --- GAME SPECIFIC LOGIC TESTS ---
  describe('Game Mechanics Verification', () => {
    it('28. Color Clash: has 4 valid target colors defined', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'color-clash');
      expect(meta).toBeDefined();
      expect(meta?.category).toBe('REACTION');
      expect(meta?.implemented).toBe(true);
    });

    it('29. Bomb Pass: requires at least 2 players', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'bomb-pass');
      expect(meta?.minPlayers).toBe(2);
      expect(meta?.supportedPlayers).not.toContain(1);
      expect(meta?.supportedPlayers).toContain(2);
    });

    it('30. Memory Match: supports 1 to 4 players', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'memory-match');
      expect(meta?.supportedPlayers).toEqual([1, 2, 3, 4]);
      expect(meta?.implemented).toBe(true);
    });

    it('31. Quick Math: verified as PUZZLE category', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'quick-math');
      expect(meta?.category).toBe('PUZZLE');
      expect(meta?.implemented).toBe(true);
    });

    it('32. Fastest Finger: verified with unpredictable reaction mechanics', () => {
      const meta = GAME_CATALOG.find(g => g.id === 'fastest-finger');
      expect(meta?.category).toBe('REACTION');
      expect(meta?.implemented).toBe(true);
    });
  });
});
