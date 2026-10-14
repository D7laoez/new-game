import { StorageService } from './StorageService.ts';
import { PlayerId } from '../types/index.ts';

export type BracketRound = 'QF' | 'SF' | 'F';
export interface BracketMatch { id: string; round: BracketRound; p1: PlayerId; p2: PlayerId; winner: PlayerId | null; loser: PlayerId | null; byBye?: boolean; }
export interface TournamentBracketState {
  id: string;
  createdAt: number;
  playerCount: number;
  activeIds: PlayerId[];
  matches: BracketMatch[];
  champion: PlayerId | null;
  currentMatchIndex: number;
}

function buildBracket(ids: PlayerId[]): BracketMatch[] {
  if (ids.length <= 2) {
    return [{ id: 'F1', round: 'F', p1: ids[0], p2: ids[1] ?? ids[0], winner: null, loser: null, byBye: ids.length===1 }];
  }
  if (ids.length === 3) {
    // SF: p1 vs p2, winner vs p3 in final
    return [
      { id: 'SF1', round: 'SF', p1: ids[0], p2: ids[1], winner: null, loser: null },
      { id: 'F1', round: 'F', p1: ids[2], p2: ids[2], winner: null, loser: null, byBye: true }, // placeholder, p2 filled after SF
    ];
  }
  // 4 players: 2 semis + final
  return [
    { id: 'SF1', round: 'SF', p1: ids[0], p2: ids[1], winner: null, loser: null },
    { id: 'SF2', round: 'SF', p1: ids[2], p2: ids[3], winner: null, loser: null },
    { id: 'F1', round: 'F', p1: ids[0], p2: ids[0], winner: null, loser: null, byBye: true },
  ];
}

export class BracketService {
  private static STORAGE_KEY = 'bracket_v1';
  private state: TournamentBracketState | null;

  constructor() {
    this.state = StorageService.getItem<TournamentBracketState | null>(BracketService.STORAGE_KEY, null);
    if (this.state && !Array.isArray(this.state.matches)) this.state=null;
  }
  private save(): void { StorageService.setItem(BracketService.STORAGE_KEY, this.state); }

  create(playerIds: PlayerId[]): TournamentBracketState {
    const st: TournamentBracketState = {
      id: `br-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      createdAt: Date.now(),
      playerCount: playerIds.length,
      activeIds: [...playerIds],
      matches: buildBracket(playerIds),
      champion: null,
      currentMatchIndex: 0,
    };
    this.state = st; this.save(); return this.getState()!;
  }

  getState(): TournamentBracketState | null { return this.state ? JSON.parse(JSON.stringify(this.state)) : null; }

  getCurrentMatch(): BracketMatch | null {
    if (!this.state) return null;
    return this.state.matches[this.state.currentMatchIndex] ?? null;
  }

  reportWinner(winnerId: PlayerId): boolean {
    if (!this.state) return false;
    const m = this.state.matches[this.state.currentMatchIndex];
    if (!m) return false;
    const loser = m.p1===winnerId ? m.p2 : m.p1;
    m.winner = winnerId; m.loser = loser;
    // propagate to final if needed
    if (this.state.playerCount===3 && this.state.currentMatchIndex===0) {
      const fin = this.state.matches[1];
      // keep p1 as ids[2], p2 = winner
      fin.p2 = winnerId;
      fin.byBye = false;
    }
    if (this.state.playerCount===4) {
      if (this.state.currentMatchIndex===0) {
        this.state.matches[2].p1 = winnerId;
      } else if (this.state.currentMatchIndex===1) {
        this.state.matches[2].p2 = winnerId;
        this.state.matches[2].byBye=false;
      }
    }
    const isLast = this.state.currentMatchIndex === this.state.matches.length-1;
    if (isLast) {
      this.state.champion = winnerId;
    } else {
      this.state.currentMatchIndex += 1;
    }
    this.save();
    return true;
  }

  clear(): void { this.state=null; this.save(); }

  isFinished(): boolean { return !!this.state?.champion; }
}
