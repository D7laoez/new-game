import { PlayerId, RoundResult, GameMetadata } from '../types/index.ts';
import { PlayerManager } from './PlayerManager.ts';

export class ScoreManager {
  private cumulativeScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private roundHistory: RoundResult[] = [];

  constructor(private playerManager: PlayerManager) {
    this.reset();
  }

  reset(): void {
    this.cumulativeScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.roundHistory = [];
    this.playerManager.resetScores();
  }

  // Points distribution templates based on active player count
  static getRankPoints(playerCount: number): number[] {
    switch (playerCount) {
      case 1:
        return [10];
      case 2:
        return [10, 3];
      case 3:
        return [10, 5, 2];
      case 4:
      default:
        return [10, 6, 3, 1];
    }
  }

  recordRound(
    roundNumber: number,
    totalRounds: number,
    game: GameMetadata,
    rawRoundScores: Record<PlayerId, number>
  ): RoundResult {
    const activePlayers = this.playerManager.getActivePlayers();
    const count = activePlayers.length;
    const rankPointsTable = ScoreManager.getRankPoints(count);

    // Sort players by rawRoundScores descending
    const sorted = [...activePlayers].sort(
      (a, b) => (rawRoundScores[b.id] ?? 0) - (rawRoundScores[a.id] ?? 0)
    );

    const roundPointsAwarded: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Assign points with tie support
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];
      if (i > 0 && rawRoundScores[player.id] === rawRoundScores[sorted[i - 1].id]) {
        // Tie with previous
        roundPointsAwarded[player.id] = roundPointsAwarded[sorted[i - 1].id];
      } else {
        roundPointsAwarded[player.id] = rankPointsTable[i] ?? 1;
        currentRank = i + 1;
      }
      this.cumulativeScores[player.id] += roundPointsAwarded[player.id];
      player.totalScore = this.cumulativeScores[player.id];
    }

    const ranks = sorted.map((p, idx) => ({
      playerId: p.id,
      roundPoints: roundPointsAwarded[p.id],
      totalPoints: this.cumulativeScores[p.id],
      rank: idx + 1
    }));

    const result: RoundResult = {
      roundNumber,
      totalRounds,
      game,
      roundScores: roundPointsAwarded,
      totalScores: { ...this.cumulativeScores },
      ranks,
      isFinalRound: roundNumber >= totalRounds
    };

    this.roundHistory.push(result);
    return result;
  }

  getCumulativeScores(): Record<PlayerId, number> {
    return { ...this.cumulativeScores };
  }

  getLeaderboard(): { playerId: PlayerId; totalPoints: number; rank: number }[] {
    const activePlayers = this.playerManager.getActivePlayers();
    const sorted = [...activePlayers].sort(
      (a, b) => (this.cumulativeScores[b.id] ?? 0) - (this.cumulativeScores[a.id] ?? 0)
    );

    return sorted.map((p, index) => ({
      playerId: p.id,
      totalPoints: this.cumulativeScores[p.id] ?? 0,
      rank: index + 1
    }));
  }

  getWinner(): PlayerId | 'TIE' {
    const leaderboard = this.getLeaderboard();
    if (leaderboard.length === 0) return 1;
    if (leaderboard.length > 1 && leaderboard[0].totalPoints === leaderboard[1].totalPoints) {
      return 'TIE';
    }
    return leaderboard[0].playerId;
  }
}
