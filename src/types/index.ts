export type GameCategory =
  | 'REACTION'
  | 'MEMORY'
  | 'SPEED'
  | 'COMPETITION'
  | 'PUZZLE'
  | 'PARTY'
  | 'DRAWING';

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

export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameMetadata {
  id: string;
  title: string;
  titleAr: string;
  category: GameCategory;
  description: string;
  instructions: string;
  minPlayers: number;
  maxPlayers: number;
  durationSeconds: number;
  difficulty: GameDifficulty;
  icon: string;
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

export interface RoundResult {
  roundNumber: number;
  totalRounds: number;
  game: GameMetadata;
  roundScores: Record<PlayerId, number>;
  totalScores: Record<PlayerId, number>;
  ranks: { playerId: PlayerId; roundPoints: number; totalPoints: number; rank: number }[];
  isFinalRound: boolean;
}

export interface PartyConfig {
  playerCount: number;
  totalRounds: number;
  mode: 'QUICK' | 'CUSTOM' | 'TOURNAMENT' | 'SINGLE';
  categories: GameCategory[];
  specificGameId?: string;
}

export interface AppSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  volume: number;
}

export interface IAudioManager {
  playTap(): void;
  playCountdown(count: number): void;
  playStart(): void;
  playSuccess(): void;
  playError(): void;
  playScore(): void;
  playWinner(): void;
  playTugPull(): void;
  playPop(): void;
  playTone(freq: number, duration?: number, type?: OscillatorType): void;
  toggleMute(enabled: boolean): void;
}

export interface IHapticManager {
  light(): void;
  medium(): void;
  heavy(): void;
  success(): void;
  error(): void;
}
