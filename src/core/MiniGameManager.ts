import { IMiniGame, GameMetadata, MiniGameContext, MiniGameResult } from '../types/index.ts';
import { GAME_CATALOG } from '../catalog/gameCatalog.ts';
import { QuickTapGame } from '../games/QuickTapGame.ts';
import { RapidTapGame } from '../games/RapidTapGame.ts';
import { TugOfWarGame } from '../games/TugOfWarGame.ts';
import { PatternMemoryGame } from '../games/PatternMemoryGame.ts';
import { CoinRushGame } from '../games/CoinRushGame.ts';
import { ColorClashGame } from '../games/ColorClashGame.ts';
import { BombPassGame } from '../games/BombPassGame.ts';
import { MemoryMatchGame } from '../games/MemoryMatchGame.ts';
import { PerfectTimingGame } from '../games/PerfectTimingGame.ts';
import { DodgeArenaGame } from '../games/DodgeArenaGame.ts';
import { QuickMathGame } from '../games/QuickMathGame.ts';
import { TargetShootGame } from '../games/TargetShootGame.ts';
import { ColorMemoryGame } from '../games/ColorMemoryGame.ts';
import { BalanceGame } from '../games/BalanceGame.ts';
import { FastestFingerGame } from '../games/FastestFingerGame.ts';

type GameFactory = () => IMiniGame;

export class MiniGameManager {
  private gameFactories: Map<string, GameFactory> = new Map();
  private currentGame: IMiniGame | null = null;
  private playedGameIds: Set<string> = new Set();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.registerGame('quick-tap', () => new QuickTapGame());
    this.registerGame('rapid-tap', () => new RapidTapGame());
    this.registerGame('tug-of-war', () => new TugOfWarGame());
    this.registerGame('pattern-memory', () => new PatternMemoryGame());
    this.registerGame('coin-rush', () => new CoinRushGame());
    this.registerGame('color-clash', () => new ColorClashGame());
    this.registerGame('bomb-pass', () => new BombPassGame());
    this.registerGame('memory-match', () => new MemoryMatchGame());
    this.registerGame('perfect-timing', () => new PerfectTimingGame());
    this.registerGame('dodge-arena', () => new DodgeArenaGame());
    this.registerGame('quick-math', () => new QuickMathGame());
    this.registerGame('target-shoot', () => new TargetShootGame());
    this.registerGame('color-memory', () => new ColorMemoryGame());
    this.registerGame('balance', () => new BalanceGame());
    this.registerGame('fastest-finger', () => new FastestFingerGame());
  }

  registerGame(id: string, factory: GameFactory): void {
    this.gameFactories.set(id, factory);
  }

  getImplementedGames(): GameMetadata[] {
    return GAME_CATALOG.filter(g => this.gameFactories.has(g.id) && g.implemented);
  }

  getAllCatalogGames(): GameMetadata[] {
    return [...GAME_CATALOG];
  }

  getMetadata(id: string): GameMetadata | undefined {
    return GAME_CATALOG.find(g => g.id === id);
  }

  resetPlayedHistory(): void {
    this.playedGameIds.clear();
  }

  pickNextGame(playerCount = 2, filterCategories?: string[], specificGameId?: string): GameMetadata {
    if (specificGameId && this.gameFactories.has(specificGameId)) {
      const meta = this.getMetadata(specificGameId);
      if (meta) return meta;
    }

    let available = this.getImplementedGames();
    // Filter games by player count compatibility
    const compatible = available.filter(
      g => !g.supportedPlayers || g.supportedPlayers.includes(playerCount)
    );
    if (compatible.length > 0) {
      available = compatible;
    }

    if (filterCategories && filterCategories.length > 0) {
      const filtered = available.filter(g => filterCategories.includes(g.category));
      if (filtered.length > 0) available = filtered;
    }

    // Filter out already played games to avoid repetition
    let unplayed = available.filter(g => !this.playedGameIds.has(g.id));
    if (unplayed.length === 0) {
      // All played: reset cycle
      this.playedGameIds.clear();
      unplayed = available;
    }

    const picked = unplayed[Math.floor(Math.random() * unplayed.length)];
    this.playedGameIds.add(picked.id);
    return picked;
  }

  loadGame(gameId: string, context: MiniGameContext): IMiniGame {
    if (this.currentGame) {
      this.currentGame.destroy();
      this.currentGame = null;
    }

    const factory = this.gameFactories.get(gameId);
    if (!factory) {
      throw new Error(`Game with id "${gameId}" is not implemented yet.`);
    }

    this.currentGame = factory();
    this.currentGame.initialize(context);
    return this.currentGame;
  }

  getCurrentGame(): IMiniGame | null {
    return this.currentGame;
  }

  destroyCurrentGame(): void {
    if (this.currentGame) {
      this.currentGame.destroy();
      this.currentGame = null;
    }
  }
}
