import { GameHistoryEntry, PlayerId, RoundResult, PartyConfig } from '../types/index.ts';
import { StorageService } from './StorageService.ts';

/**
 * Keeps last N completed sessions so players can review & share results.
 * Stored in localStorage, capped to avoid quota issues.
 */
export class GameHistoryService {
  private static STORAGE_KEY = 'game_history_v1';
  private static MAX_ENTRIES = 20;

  private entries: GameHistoryEntry[] = [];

  constructor() {
    this.entries = StorageService.getItem<GameHistoryEntry[]>(GameHistoryService.STORAGE_KEY, []);
    if (!Array.isArray(this.entries)) this.entries = [];
  }

  private save(): void {
    StorageService.setItem(GameHistoryService.STORAGE_KEY, this.entries.slice(0, GameHistoryService.MAX_ENTRIES));
  }

  recordSession(config: PartyConfig, rounds: RoundResult[], finalLeaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[], winnerId: PlayerId | 'TIE'): GameHistoryEntry {
    const entry: GameHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: Date.now(),
      mode: config.mode,
      tournamentCup: config.tournamentCup,
      playerCount: config.playerCount,
      totalRounds: config.totalRounds,
      rounds: rounds.map(r => ({
        gameId: r.game.id,
        title: r.game.title,
        icon: r.game.icon,
        winnerIds: r.ranks.filter(e => e.rank === 1).map(e => e.playerId),
        scores: { ...r.roundScores }
      })),
      finalLeaderboard: finalLeaderboard.map(e => ({ ...e })),
      winnerId
    };
    this.entries.unshift(entry);
    if (this.entries.length > GameHistoryService.MAX_ENTRIES) this.entries = this.entries.slice(0, GameHistoryService.MAX_ENTRIES);
    this.save();
    return entry;
  }

  getAll(): GameHistoryEntry[] { return [...this.entries]; }

  getById(id: string): GameHistoryEntry | undefined { return this.entries.find(e => e.id === id); }

  clear(): void { this.entries = []; this.save(); }

  /** Creates a shareable text summary (copy-to-clipboard / Web Share API) */
  toShareText(entry: GameHistoryEntry, playerNames: Record<PlayerId, string>): string {
    const dateStr = new Date(entry.date).toLocaleString();
    const winnerName = entry.winnerId === 'TIE' ? 'TIE' : (playerNames[entry.winnerId] ?? `Player ${entry.winnerId}`);
    const lines: string[] = [];
    lines.push(`🎮 Party Game Collection — ${entry.mode} ${entry.tournamentCup ? `(${entry.tournamentCup})` : ''}`);
    lines.push(`📅 ${dateStr} • ${entry.totalRounds} rounds • ${entry.playerCount} players`);
    lines.push(`🏆 Winner: ${winnerName}`);
    lines.push('');
    entry.rounds.forEach((r, i) => {
      const winners = r.winnerIds.map(id => playerNames[id] ?? `P${id}`).join(', ');
      lines.push(`R${i + 1}: ${r.icon} ${r.title} → ${winners}`);
    });
    lines.push('');
    lines.push('Final standings:');
    entry.finalLeaderboard.forEach(e => {
      lines.push(`#${e.rank} ${playerNames[e.playerId] ?? `P${e.playerId}`}: ${e.totalPoints} pts`);
    });
    return lines.join('\n');
  }
}
