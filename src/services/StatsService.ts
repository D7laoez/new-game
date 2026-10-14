import { PlayerId, PlayerStats } from '../types/index.ts';
import { StorageService } from './StorageService.ts';

export class StatsService {
  private static STORAGE_KEY = 'player_statistics_v1';

  private stats: Record<PlayerId, PlayerStats>;

  constructor() {
    this.stats = this.loadStats();
  }

  private getDefaultStats(id: PlayerId): PlayerStats {
    return {
      playerId: id,
      gamesPlayed: 0,
      gamesWon: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      currentStreak: 0,
      bestStreak: 0,
      fastestReactionMs: 0,
      totalPlaytimeSeconds: 0,
      gameWins: {},
      gamePlays: {}
    };
  }

  private loadStats(): Record<PlayerId, PlayerStats> {
    const raw = StorageService.getItem<Record<string, Partial<PlayerStats>>>(
      StatsService.STORAGE_KEY,
      {}
    );

    const result: Record<PlayerId, PlayerStats> = {
      1: { ...this.getDefaultStats(1), ...(raw['1'] || {}) },
      2: { ...this.getDefaultStats(2), ...(raw['2'] || {}) },
      3: { ...this.getDefaultStats(3), ...(raw['3'] || {}) },
      4: { ...this.getDefaultStats(4), ...(raw['4'] || {}) }
    };

    return result;
  }

  private save(): void {
    StorageService.setItem(StatsService.STORAGE_KEY, this.stats);
  }

  public recordRound(
    gameId: string,
    roundPoints: Record<PlayerId, number>,
    activePlayerIds: PlayerId[],
    rawStats?: Partial<Record<PlayerId, number | string>>,
    durationSeconds = 15
  ): void {
    if (activePlayerIds.length === 0) return;

    // Find highest round score
    const maxScore = Math.max(...activePlayerIds.map(pId => roundPoints[pId] ?? 0));
    const winners = activePlayerIds.filter(pId => (roundPoints[pId] ?? 0) === maxScore && maxScore > 0);

    for (const pId of activePlayerIds) {
      const pStats = this.stats[pId];
      pStats.gamesPlayed++;
      pStats.totalPlaytimeSeconds += durationSeconds;

      // Track game play count
      pStats.gamePlays[gameId] = (pStats.gamePlays[gameId] || 0) + 1;

      // Check win & streaks
      if (winners.includes(pId)) {
        pStats.gamesWon++;
        pStats.currentStreak++;
        if (pStats.currentStreak > pStats.bestStreak) {
          pStats.bestStreak = pStats.currentStreak;
        }
        pStats.gameWins[gameId] = (pStats.gameWins[gameId] || 0) + 1;
      } else {
        pStats.currentStreak = 0;
      }

      // Check reaction time if reported in rawStats
      if (rawStats && rawStats[pId] !== undefined) {
        const val = rawStats[pId];
        const numVal = typeof val === 'number' ? val : parseFloat(val as string);
        if (!isNaN(numVal) && numVal > 0 && numVal < 10000) {
          // If 0 (unset) or faster
          if (pStats.fastestReactionMs === 0 || numVal < pStats.fastestReactionMs) {
            pStats.fastestReactionMs = Math.round(numVal);
          }
        }
      }
    }

    this.save();
  }

  public recordTournament(winnerId: PlayerId | 'TIE', activePlayerIds: PlayerId[]): void {
    for (const pId of activePlayerIds) {
      const pStats = this.stats[pId];
      pStats.tournamentsPlayed++;
      if (winnerId !== 'TIE' && winnerId === pId) {
        pStats.tournamentsWon++;
      }
    }
    this.save();
  }

  public getPlayerStats(id: PlayerId): PlayerStats {
    return { ...this.stats[id] };
  }

  public getAllStats(): Record<PlayerId, PlayerStats> {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      1: this.getDefaultStats(1),
      2: this.getDefaultStats(2),
      3: this.getDefaultStats(3),
      4: this.getDefaultStats(4)
    };
    this.save();
  }
}
