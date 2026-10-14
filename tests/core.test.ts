import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from '../src/services/PlayerManager.ts';
import { ScoreManager } from '../src/services/ScoreManager.ts';
import { MiniGameManager } from '../src/core/MiniGameManager.ts';
import { StorageService } from '../src/services/StorageService.ts';
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

describe('Party Game Framework Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('StorageService', () => {
    it('saves and retrieves values with prefix', () => {
      StorageService.setItem('test_key', { hello: 'world' });
      const retrieved = StorageService.getItem('test_key', { hello: 'default' });
      expect(retrieved.hello).toBe('world');
    });

    it('returns default value when key does not exist', () => {
      const val = StorageService.getItem('non_existent', 42);
      expect(val).toBe(42);
    });
  });

  describe('PlayerManager', () => {
    it('initializes 4 players with default avatars and colors', () => {
      const pm = new PlayerManager();
      const all = pm.getAllPlayers();
      expect(all.length).toBe(4);
      expect(all[0].name).toBe('Player 1');
      expect(all[0].avatar).toBe('🦊');
      expect(all[1].avatar).toBe('🐬');
      expect(all[2].avatar).toBe('🐯');
      expect(all[3].avatar).toBe('🐸');
    });

    it('allows setting active player count from 1 to 4', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(3);
      expect(pm.getActiveCount()).toBe(3);
      expect(pm.getActivePlayers().length).toBe(3);

      pm.setActiveCount(10); // Clamp to 4
      expect(pm.getActiveCount()).toBe(4);
    });

    it('updates player name and avatar properly', () => {
      const pm = new PlayerManager();
      pm.updatePlayer(1, 'Champion', '👑');
      const p1 = pm.getPlayer(1);
      expect(p1?.name).toBe('Champion');
      expect(p1?.avatar).toBe('👑');
    });
  });

  describe('ScoreManager', () => {
    it('distributes rank points accurately for 4 players', () => {
      const pm = new PlayerManager();
      pm.setActiveCount(4);
      const sm = new ScoreManager(pm);

      const round = sm.recordRound(1, 3, GAME_CATALOG[0], {
        1: 50,  // 2nd -> 6 pts
        2: 100, // 1st -> 10 pts
        3: 20,  // 3rd -> 3 pts
        4: 10   // 4th -> 1 pt
      });

      expect(round.roundScores[2]).toBe(10);
      expect(round.roundScores[1]).toBe(6);
      expect(round.roundScores[3]).toBe(3);
      expect(round.roundScores[4]).toBe(1);

      const winner = sm.getWinner();
      expect(winner).toBe(2);
    });

    it('handles ties between players gracefully', () => {
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
  });

  describe('MiniGameManager & Catalog', () => {
    it('contains all 55 game concepts in the catalog', () => {
      expect(GAME_CATALOG.length).toBeGreaterThanOrEqual(55);
    });

    it('has the 5 phase-1 games implemented', () => {
      const mgm = new MiniGameManager();
      const implemented = mgm.getImplementedGames();
      expect(implemented.length).toBe(5);

      const ids = implemented.map(g => g.id);
      expect(ids).toContain('quick-tap');
      expect(ids).toContain('rapid-tap');
      expect(ids).toContain('tug-of-war');
      expect(ids).toContain('pattern-memory');
      expect(ids).toContain('coin-rush');
    });

    it('picks random games without immediate repetition', () => {
      const mgm = new MiniGameManager();
      const picked1 = mgm.pickNextGame();
      const picked2 = mgm.pickNextGame();
      expect(picked1.id).not.toBe(picked2.id);
    });
  });
});
