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
import { WhackItGame } from '../games/WhackItGame.ts';
import { StopTheBarGame } from '../games/StopTheBarGame.ts';
import { NumberRushGame } from '../games/NumberRushGame.ts';
import { SafeTileGame } from '../games/SafeTileGame.ts';
import { BalloonPopGame } from '../games/BalloonPopGame.ts';
import { FollowTheArrowGame } from '../games/FollowTheArrowGame.ts';
import { DontPressItGame } from '../games/DontPressItGame.ts';
import { TreasureDigGame } from '../games/TreasureDigGame.ts';
import { RaceTo100Game } from '../games/RaceTo100Game.ts';
import { ShapeSnapGame } from '../games/ShapeSnapGame.ts';
import { LaneSwitchGame } from '../games/LaneSwitchGame.ts';
import { ColorConveyorGame } from '../games/ColorConveyorGame.ts';
import { TinyBowlingGame } from '../games/TinyBowlingGame.ts';
import { MemorySequenceDuelGame } from '../games/MemorySequenceDuelGame.ts';
import { ReactionGridGame } from '../games/ReactionGridGame.ts';
import { TinyGolfGame } from '../games/TinyGolfGame.ts';
import { WordScrambleGame } from '../games/WordScrambleGame.ts';
import { CatchTheFruitGame } from '../games/CatchTheFruitGame.ts';
import { SumSprintGame } from '../games/SumSprintGame.ts';
import { PerfectLandingGame } from '../games/PerfectLandingGame.ts';
import { MazeEscapeGame } from '../games/MazeEscapeGame.ts';
import { PaperPlaneFlightGame } from '../games/PaperPlaneFlightGame.ts';
import { ShapeSortFactoryGame } from '../games/ShapeSortFactoryGame.ts';
import { IceSlideGame } from '../games/IceSlideGame.ts';
import { MiniCurlingGame } from '../games/MiniCurlingGame.ts';
import { WordChainGame } from '../games/WordChainGame.ts';
import { SafecrackerGame } from '../games/SafecrackerGame.ts';
import { FishingFrenzyGame } from '../games/FishingFrenzyGame.ts';
import { BridgeBuilderGame } from '../games/BridgeBuilderGame.ts';
import { LightTrailDuelGame } from '../games/LightTrailDuelGame.ts';
import { FindTheOddOneGame } from '../games/FindTheOddOneGame.ts';
import { TerritoryBattleGame } from '../games/TerritoryBattleGame.ts';
import { BalloonPumpGame } from '../games/BalloonPumpGame.ts';
import { HigherOrLowerGame } from '../games/HigherOrLowerGame.ts';
import { FindTheChangeGame } from '../games/FindTheChangeGame.ts';
import { ConnectTheDotsGame } from '../games/ConnectTheDotsGame.ts';
import { CopyTheShapeGame } from '../games/CopyTheShapeGame.ts';
import { DiceBattleGame } from '../games/DiceBattleGame.ts';
import { NumberPuzzleGame } from '../games/NumberPuzzleGame.ts';
import { ColorLogicGame } from '../games/ColorLogicGame.ts';

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
    this.registerGame('whack-it', () => new WhackItGame());
    this.registerGame('stop-the-bar', () => new StopTheBarGame());
    this.registerGame('number-rush', () => new NumberRushGame());
    this.registerGame('safe-tile', () => new SafeTileGame());
    this.registerGame('balloon-pop', () => new BalloonPopGame());
    this.registerGame('follow-the-arrow', () => new FollowTheArrowGame());
    this.registerGame('dont-press-it', () => new DontPressItGame());
    this.registerGame('treasure-dig', () => new TreasureDigGame());
    this.registerGame('race-to-100', () => new RaceTo100Game());
    this.registerGame('shape-snap', () => new ShapeSnapGame());
    this.registerGame('lane-switch', () => new LaneSwitchGame());
    this.registerGame('color-conveyor', () => new ColorConveyorGame());
    this.registerGame('tiny-bowling', () => new TinyBowlingGame());
    this.registerGame('memory-sequence-duel', () => new MemorySequenceDuelGame());
    this.registerGame('reaction-grid', () => new ReactionGridGame());
    this.registerGame('tiny-golf', () => new TinyGolfGame());
    this.registerGame('word-scramble', () => new WordScrambleGame());
    this.registerGame('catch-the-fruit', () => new CatchTheFruitGame());
    this.registerGame('sum-sprint', () => new SumSprintGame());
    this.registerGame('perfect-landing', () => new PerfectLandingGame());
    this.registerGame('maze-escape', () => new MazeEscapeGame());
    this.registerGame('paper-plane-flight', () => new PaperPlaneFlightGame());
    this.registerGame('shape-sort-factory', () => new ShapeSortFactoryGame());
    this.registerGame('ice-slide', () => new IceSlideGame());
    this.registerGame('mini-curling', () => new MiniCurlingGame());
    this.registerGame('word-chain', () => new WordChainGame());
    this.registerGame('safecracker', () => new SafecrackerGame());
    this.registerGame('fishing-frenzy', () => new FishingFrenzyGame());
    this.registerGame('bridge-builder', () => new BridgeBuilderGame());
    this.registerGame('light-trail-duel', () => new LightTrailDuelGame());
    this.registerGame('find-the-odd-one', () => new FindTheOddOneGame());
    this.registerGame('territory-battle', () => new TerritoryBattleGame());
    this.registerGame('balloon-pump', () => new BalloonPumpGame());
    this.registerGame('higher-or-lower', () => new HigherOrLowerGame());
    this.registerGame('find-the-change', () => new FindTheChangeGame());
    this.registerGame('connect-the-dots', () => new ConnectTheDotsGame());
    this.registerGame('copy-the-shape', () => new CopyTheShapeGame());
    this.registerGame('dice-battle', () => new DiceBattleGame());
    this.registerGame('number-puzzle', () => new NumberPuzzleGame());
    this.registerGame('color-logic', () => new ColorLogicGame());
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
