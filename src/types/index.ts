export type GameCategory =
  | 'REACTION'
  | 'MEMORY'
  | 'SPEED'
  | 'COMPETITION'
  | 'PUZZLE'
  | 'PARTY'
  | 'DRAWING'
  | 'REFLEX'
  | 'SKILL'
  | 'BRAIN'
  | 'TIMING';


export type PlayerId = 1 | 2 | 3 | 4;

export interface Player {
  id: PlayerId;
  name: string;
  avatar: string;
  color: string;
  darkColor: string;
  lightColor: string;
  totalScore: number;
}

export type GameDifficulty = 'EASY' | 'NORMAL' | 'MEDIUM' | 'HARD';

export interface GameMetadata {
  id: string;
  title: string;
  titleAr: string;
  category: GameCategory;
  description: string;
  instructions: string;
  minPlayers: number;
  maxPlayers: number;
  supportedPlayers: number[];
  durationSeconds: number;
  difficulty: GameDifficulty;
  icon: string;
  controls?: string;
  implemented: boolean;
}

export interface MiniGameResult {
  scores: Record<PlayerId, number>; // points awarded this round (e.g., 10 for 1st, 6 for 2nd, 3 for 3rd, 1 for 4th)
  winnerId: PlayerId | 'TIE' | null;
  rawStats?: Partial<Record<PlayerId, number | string>>; // e.g. reaction time in ms, taps count
}

export interface MiniGameContext {
  container: HTMLElement;
  players: Player[];
  activePlayerCount: number;
  difficulty?: GameDifficulty;
  audio: IAudioManager;
  haptics: IHapticManager;
  onFinish: (result: MiniGameResult) => void;
  onScoreUpdate?: (playerId: PlayerId, score: number) => void;
}

export interface IMiniGame {
  readonly metadata: GameMetadata;
  initialize(context: MiniGameContext): void;
  start(): void;
  update(deltaTime: number): void;
  handleInput(playerId: PlayerId, action: string, data?: unknown): void;
  finish(): void;
  destroy(): void;
}

export type TournamentCup = 'BRONZE' | 'SILVER' | 'GOLD' | 'ULTIMATE' | 'CUSTOM';

export interface LeaderboardEntry {
  playerId: PlayerId;
  roundPoints: number;
  totalPoints: number;
  rank: number;
  previousRank?: number;
  rankChange?: number; // positive = climbed, negative = dropped, 0 = same
  diffToLeader?: number;
}

export interface RoundResult {
  roundNumber: number;
  totalRounds: number;
  game: GameMetadata;
  roundScores: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
  ranks: LeaderboardEntry[];
  isFinalRound: boolean;
  comebackAlert?: string;
  isNewLeader?: boolean;
}

export interface PartyConfig {
  playerCount: number;
  totalRounds: number;
  mode: 'QUICK' | 'CUSTOM' | 'TOURNAMENT' | 'SINGLE';
  tournamentCup?: TournamentCup;
  categories: GameCategory[];
  difficulty?: GameDifficulty;
  specificGameId?: string;
}

export interface PlayerStats {
  playerId: PlayerId;
  gamesPlayed: number;
  gamesWon: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  currentStreak: number;
  bestStreak: number;
  fastestReactionMs: number;
  totalPlaytimeSeconds: number;
  gameWins: Record<string, number>;
  gamePlays: Record<string, number>;
}

export interface Achievement {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  icon: string;
  unlockedAt?: number | null; // timestamp or null
}

export interface GameHistoryEntry {
  id: string; // unique timestamp-based id
  date: number; // Date.now()
  mode: PartyConfig['mode'];
  tournamentCup?: TournamentCup;
  playerCount: number;
  totalRounds: number;
  rounds: { gameId: string; title: string; icon: string; winnerIds: PlayerId[]; scores: Record<PlayerId, number> }[];
  finalLeaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[];
  winnerId: PlayerId | 'TIE';
}

export interface AppSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  volume: number;
  colorBlindMode: boolean;
}

export interface IAudioManager {
  playTap(): void;
  playTick(): void;
  playCountdown(count: number): void;
  playStart(): void;
  playSuccess(): void;
  playError(): void;
  playScore(): void;
  playWinner(): void;
  playTugPull(): void;
  playPop(): void;
  playExplosion(): void;
  playWhoosh(): void;
  playBuzzer(): void;
  playCoin(): void;
  playWarning(): void;
  playTone(freq: number, duration?: number, type?: OscillatorType): void;
  toggleMute(enabled: boolean): void;
  isEnabled(): boolean;
  setVolume(vol: number): void;
  getVolume(): number;
}

export interface IHapticManager {
  light(): void;
  medium(): void;
  heavy(): void;
  success(): void;
  error(): void;
  tick(): void;
  countdown(): void;
  warning(): void;
  coin(): void;
  explosion(): void;
  selectionChanged(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}
