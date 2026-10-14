import {
  PartyConfig,
  RoundResult,
  GameMetadata,
  MiniGameResult,
  PlayerId
} from '../types/index.ts';
import { PlayerManager } from '../services/PlayerManager.ts';
import { ScoreManager } from '../services/ScoreManager.ts';
import { MiniGameManager } from './MiniGameManager.ts';
import { IAudioManager, IHapticManager } from '../types/index.ts';

import { StatsService } from '../services/StatsService.ts';
import { AchievementManager } from '../services/AchievementManager.ts';

export type SessionState =
  | 'IDLE'
  | 'INTRO'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'ROUND_RESULTS'
  | 'TOURNAMENT_WINNER';

export interface RoundManagerCallbacks {
  onStateChange: (state: SessionState, data?: unknown) => void;
  onRoundComplete: (result: RoundResult) => void;
  onSessionComplete: (leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[]) => void;
}

export class RoundManager {
  private currentRound = 0;
  private config!: PartyConfig;
  private currentGameMeta: GameMetadata | null = null;
  private state: SessionState = 'IDLE';
  private isHandlingFinish = false;

  constructor(
    private playerManager: PlayerManager,
    private scoreManager: ScoreManager,
    private miniGameManager: MiniGameManager,
    private audio: IAudioManager,
    private haptics: IHapticManager,
    private callbacks: RoundManagerCallbacks,
    private statsService?: StatsService,
    private achievementManager?: AchievementManager
  ) {}

  startSession(config: PartyConfig): void {
    this.config = config;
    this.currentRound = 0;
    this.playerManager.setActiveCount(config.playerCount);
    this.scoreManager.reset();
    this.miniGameManager.resetPlayedHistory();

    this.nextRound();
  }

  nextRound(): void {
    this.isHandlingFinish = false;
    if (this.currentRound >= this.config.totalRounds) {
      this.finishSession();
      return;
    }

    this.currentRound++;
    this.currentGameMeta = this.miniGameManager.pickNextGame(
      this.config.playerCount,
      this.config.categories,
      this.config.specificGameId
    );

    this.setState('INTRO', {
      roundNumber: this.currentRound,
      totalRounds: this.config.totalRounds,
      game: this.currentGameMeta
    });
  }

  startCountdown(): void {
    this.setState('COUNTDOWN', {
      game: this.currentGameMeta,
      roundNumber: this.currentRound,
      totalRounds: this.config.totalRounds
    });
  }

  launchGame(container: HTMLElement): void {
    if (!this.currentGameMeta) return;
    if (!container) return;

    this.setState('PLAYING');

    this.miniGameManager.loadGame(this.currentGameMeta.id, {
      container,
      players: this.playerManager.getActivePlayers(),
      activePlayerCount: this.playerManager.getActiveCount(),
      difficulty: this.config.difficulty || 'NORMAL',
      audio: this.audio,
      haptics: this.haptics,
      onFinish: (result: MiniGameResult) => {
        try { this.handleGameFinished(result); } catch (e) { console.error('handleGameFinished failed', e); }
      }
    });

    const activeGame = this.miniGameManager.getCurrentGame();
    if (activeGame) {
      try { activeGame.start(); } catch (e) {
        console.error('activeGame.start failed', e);
        this.handleGameFinished({ scores: { 1:0,2:0,3:0,4:0 } as never, winnerId: null });
      }
    }
  }

  private handleGameFinished(result: MiniGameResult): void {
    if (this.isHandlingFinish) return;
    if (!this.currentGameMeta) return;
    this.isHandlingFinish = true;
    // Reset guard on next tick so next round can finish again

    const isTournament = this.config.mode === 'TOURNAMENT';
    const roundResult = this.scoreManager.recordRound(
      this.currentRound,
      this.config.totalRounds,
      this.currentGameMeta,
      result.scores,
      isTournament
    );

    const activePlayerIds = this.playerManager.getActivePlayers().map(p => p.id);
    if (this.statsService) {
      this.statsService.recordRound(
        this.currentGameMeta.id,
        roundResult.roundScores,
        activePlayerIds,
        result.rawStats,
        this.currentGameMeta.durationSeconds
      );
    }

    if (this.achievementManager) {
      this.achievementManager.checkRound(roundResult, result.rawStats);
    }

    this.setState('ROUND_RESULTS', roundResult);
    this.callbacks.onRoundComplete(roundResult);
  }

  private finishSession(): void {
    const leaderboard = this.scoreManager.getLeaderboard();
    const winner = this.scoreManager.getWinner();
    const activePlayerIds = this.playerManager.getActivePlayers().map(p => p.id);

    if (this.statsService) {
      this.statsService.recordTournament(winner, activePlayerIds);
    }

    if (this.achievementManager) {
      this.achievementManager.checkSessionEnd(leaderboard, this.config.mode === 'TOURNAMENT');
    }

    this.setState('TOURNAMENT_WINNER', {
      leaderboard,
      totalRounds: this.config.totalRounds
    });
    this.callbacks.onSessionComplete(leaderboard);
  }

  endSession(): void {
    this.isHandlingFinish = false;
    this.miniGameManager.destroyCurrentGame();
    this.setState('IDLE');
  }

  private setState(state: SessionState, data?: unknown): void {
    this.state = state;
    this.callbacks.onStateChange(state, data);
  }

  getState(): SessionState {
    return this.state;
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getTotalRounds(): number {
    return this.config ? this.config.totalRounds : 0;
  }

  getCurrentGame(): GameMetadata | null {
    return this.currentGameMeta;
  }
}
