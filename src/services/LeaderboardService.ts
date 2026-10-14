import { StorageService } from './StorageService.ts';
import { PlayerId } from '../types/index.ts';

export type LeaderboardPeriod = 'ALL' | 'WEEK' | 'MONTH';

export interface LeaderboardRecord {
  id: string;
  date: number;
  playerId: PlayerId;
  playerName: string;
  totalPoints: number;
  rank: number;
  mode: string;
  tournamentCup?: string;
  wins: number;
}

export class LeaderboardService {
  private static STORAGE_KEY = 'leaderboard_v1';
  private static MAX = 200;

  private records: LeaderboardRecord[] = [];

  constructor() {
    const raw = StorageService.getItem<LeaderboardRecord[]>(LeaderboardService.STORAGE_KEY, []);
    this.records = Array.isArray(raw) ? raw : [];
  }

  private save(): void {
    StorageService.setItem(LeaderboardService.STORAGE_KEY, this.records.slice(0, LeaderboardService.MAX));
  }

  recordSession(params: { date: number; leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[]; wins: Record<PlayerId, number>; playerNames: Record<PlayerId, string>; mode: string; tournamentCup?: string; }): void {
    const { date, leaderboard, wins, playerNames, mode, tournamentCup } = params;
    for (const e of leaderboard) {
      this.records.unshift({
        id: `${date}-${e.playerId}-${Math.random().toString(36).slice(2,5)}`,
        date,
        playerId: e.playerId,
        playerName: playerNames[e.playerId] ?? `Player ${e.playerId}`,
        totalPoints: e.totalPoints,
        rank: e.rank,
        mode,
        tournamentCup,
        wins: wins[e.playerId] ?? 0,
      });
    }
    if (this.records.length > LeaderboardService.MAX) this.records = this.records.slice(0, LeaderboardService.MAX);
    this.save();
  }

  private periodCutoff(p: LeaderboardPeriod): number {
    if (p==='ALL') return 0;
    const now = Date.now();
    if (p==='WEEK') return now - 7*24*60*60*1000;
    return now - 30*24*60*60*1000;
  }

  /** Aggregated leaderboard filtered by period */
  getAggregated(period: LeaderboardPeriod = 'ALL'): { playerId: PlayerId; playerName: string; totalPoints: number; wins: number; sessions: number; bestRank: number; avgPoints: number }[] {
    const cutoff = this.periodCutoff(period);
    const filtered = this.records.filter(r => r.date >= cutoff);
    // aggregate by playerId+playerName? key by playerId (1..4) — names may change so keep latest name
    const map = new Map<PlayerId, { playerName: string; totalPoints:number; wins:number; sessions:number; bestRank:number }>();
    const latestName = new Map<PlayerId, string>();
    // walk newest to oldest to get latest name
    for (const r of filtered) if (!latestName.has(r.playerId)) latestName.set(r.playerId, r.playerName);
    for (const r of filtered) {
      const cur = map.get(r.playerId);
      if (!cur) map.set(r.playerId, { playerName: latestName.get(r.playerId)!, totalPoints: r.totalPoints, wins: r.wins, sessions: 1, bestRank: r.rank });
      else {
        cur.totalPoints += r.totalPoints;
        cur.wins += r.wins;
        cur.sessions += 1;
        cur.bestRank = Math.min(cur.bestRank, r.rank);
      }
    }
    const arr = [...map.entries()].map(([playerId, v]) => ({
      playerId, playerName: v.playerName, totalPoints: v.totalPoints, wins: v.wins, sessions: v.sessions, bestRank: v.bestRank, avgPoints: v.sessions? Math.round((v.totalPoints / v.sessions)*10)/10 : 0
    }));
    arr.sort((a,b)=> b.totalPoints - a.totalPoints || a.bestRank - b.bestRank);
    return arr;
  }

  getRecent(limit=10, period: LeaderboardPeriod='ALL'): LeaderboardRecord[] {
    const cutoff = this.periodCutoff(period);
    return this.records.filter(r=>r.date>=cutoff).slice(0, limit);
  }

  getAll(): LeaderboardRecord[] { return [...this.records]; }

  clear(): void { this.records=[]; this.save(); }
}
