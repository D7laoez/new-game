import { PlayerId, RoundResult, GameMetadata, LeaderboardEntry } from '../types/index.ts';
import { PlayerManager } from './PlayerManager.ts';

export class ScoreManager {
  private cumulativeScores: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private roundHistory: RoundResult[] = [];
  private playerWins: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private currentStreaks: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private bestStreaks: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private gameWinRecords: Record<PlayerId, Record<string, number>> = { 1: {}, 2: {}, 3: {}, 4: {} };
  private previousLeader: PlayerId | null = null;
  private previousRanks: Map<PlayerId, number> = new Map();

  constructor(private playerManager: PlayerManager) {
    this.reset();
  }

  reset(): void {
    this.cumulativeScores = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.roundHistory = [];
    this.playerWins = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.currentStreaks = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.bestStreaks = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.gameWinRecords = { 1: {}, 2: {}, 3: {}, 4: {} };
    this.previousLeader = null;
    this.previousRanks.clear();
    this.playerManager.resetScores();
  }

  // Regular points table
  static getRankPoints(playerCount: number, isTournament = false): number[] {
    if (isTournament) {
      switch (playerCount) {
        case 1:
          return [10];
        case 2:
          return [10, 5];
        case 3:
          return [10, 7, 4];
        case 4:
        default:
          return [10, 7, 5, 3];
      }
    }

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
    rawRoundScores: Record<PlayerId, number>,
    isTournament = false
  ): RoundResult {
    const activePlayers = this.playerManager.getActivePlayers();
    const count = activePlayers.length;
    const rankPointsTable = ScoreManager.getRankPoints(count, isTournament);

    // Capture previous rankings before this round
    if (this.roundHistory.length > 0) {
      const prevLeaderboard = this.getLeaderboard();
      this.previousLeader = prevLeaderboard[0]?.playerId ?? null;
      this.previousRanks.clear();
      prevLeaderboard.forEach(entry => {
        this.previousRanks.set(entry.playerId, entry.rank);
      });
    }

    // Sort players by raw round scores descending
    const sorted = [...activePlayers].sort(
      (a, b) => (rawRoundScores[b.id] ?? 0) - (rawRoundScores[a.id] ?? 0)
    );

    const roundPointsAwarded: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Assign points with tie support
    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];
      if (i > 0 && rawRoundScores[player.id] === rawRoundScores[sorted[i - 1].id]) {
        // Tie with previous
        roundPointsAwarded[player.id] = roundPointsAwarded[sorted[i - 1].id];
      } else {
        roundPointsAwarded[player.id] = rankPointsTable[i] ?? 1;
      }
      this.cumulativeScores[player.id] += roundPointsAwarded[player.id];
      player.totalScore = this.cumulativeScores[player.id];
    }

    // Determine round winner & update streaks
    const highestRoundPts = Math.max(...activePlayers.map(p => roundPointsAwarded[p.id]));
    const roundWinners = activePlayers.filter(p => roundPointsAwarded[p.id] === highestRoundPts);

    activePlayers.forEach(p => {
      if (roundWinners.some(w => w.id === p.id)) {
        this.playerWins[p.id] = (this.playerWins[p.id] || 0) + 1;
        this.currentStreaks[p.id] = (this.currentStreaks[p.id] || 0) + 1;
        if (this.currentStreaks[p.id] > this.bestStreaks[p.id]) {
          this.bestStreaks[p.id] = this.currentStreaks[p.id];
        }
        if (!this.gameWinRecords[p.id]) this.gameWinRecords[p.id] = {};
        this.gameWinRecords[p.id][game.id] = (this.gameWinRecords[p.id][game.id] || 0) + 1;
      } else {
        this.currentStreaks[p.id] = 0;
      }
    });

    // Compute updated total rankings
    const currentLeaderboard = this.getLeaderboard();
    const leaderScore = currentLeaderboard[0]?.totalPoints || 0;
    const newLeader = currentLeaderboard[0]?.playerId ?? null;

    const ranks: LeaderboardEntry[] = currentLeaderboard.map(entry => {
      const prevRank = this.previousRanks.get(entry.playerId) ?? entry.rank;
      const rankChange = prevRank - entry.rank; // >0 means climbed, <0 means dropped
      return {
        playerId: entry.playerId,
        roundPoints: roundPointsAwarded[entry.playerId] ?? 0,
        totalPoints: entry.totalPoints,
        rank: entry.rank,
        previousRank: prevRank,
        rankChange,
        diffToLeader: leaderScore - entry.totalPoints
      };
    });

    // Determine comeback alerts
    let comebackAlert: string | undefined;
    let isNewLeader = false;

    if (roundNumber > 1 && this.previousLeader && newLeader && newLeader !== this.previousLeader) {
      comebackAlert = 'NEW LEADER! 👑';
      isNewLeader = true;
    } else if (
      ranks.length > 1 &&
      ranks[0].totalPoints === ranks[1].totalPoints &&
      ranks[0].totalPoints > 0
    ) {
      comebackAlert = 'TIE AT THE TOP! ⚖️';
    } else if (ranks.length > 1 && ranks[1].diffToLeader !== undefined && ranks[1].diffToLeader > 0 && ranks[1].diffToLeader <= 4) {
      comebackAlert = `Only ${ranks[1].diffToLeader} points behind! 🔥`;
    }

    const result: RoundResult = {
      roundNumber,
      totalRounds,
      game,
      roundScores: roundPointsAwarded,
      totalScores: { ...this.cumulativeScores },
      ranks,
      isFinalRound: roundNumber >= totalRounds,
      comebackAlert,
      isNewLeader
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

  getPlayerWins(playerId: PlayerId): number {
    return this.playerWins[playerId] ?? 0;
  }

  getBestStreak(playerId: PlayerId): number {
    return this.bestStreaks[playerId] ?? 0;
  }

  getFavoriteGame(playerId: PlayerId): string {
    const records = this.gameWinRecords[playerId] || {};
    let bestGame = '';
    let maxWins = -1;
    for (const [gId, count] of Object.entries(records)) {
      if (count > maxWins) {
        maxWins = count;
        bestGame = gId;
      }
    }
    return bestGame;
  }

  getRoundHistory(): RoundResult[] {
    return [...this.roundHistory];
  }
}
