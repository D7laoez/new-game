import { StorageService } from './StorageService.ts';

export interface DailyChallenge {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  rewardCoins: number;
  gameCategory?: string;
  gameId?: string;
  completed: boolean;
  claimed: boolean;
}

export interface DailyChallengeState {
  date: string; // YYYY-MM-DD
  challenges: DailyChallenge[];
  streak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
}

const CHALLENGE_POOL: Omit<DailyChallenge, 'progress' | 'completed' | 'claimed'>[] = [
  { id: 'play_3', title: 'Party Starter', titleAr: 'بداية الحفلة', description: 'Play 3 mini-games', icon: '🎮', target: 3, rewardCoins: 50 },
  { id: 'win_2', title: 'Double Victory', titleAr: 'انتصاران', description: 'Win 2 rounds', icon: '🏆', target: 2, rewardCoins: 80 },
  { id: 'play_5', title: 'Marathon', titleAr: 'ماراثون', description: 'Play 5 mini-games', icon: '🔥', target: 5, rewardCoins: 100 },
  { id: 'win_3_streak', title: 'On Fire', titleAr: 'سلسلة نارية', description: 'Win 3 rounds in a row', icon: '⚡', target: 3, rewardCoins: 120 },
  { id: 'reaction_master', title: 'Reflex Master', titleAr: 'سيد رد الفعل', description: 'Play 2 REACTION games', icon: '👁️', target: 2, rewardCoins: 60, gameCategory: 'REACTION' },
  { id: 'memory_guru', title: 'Memory Guru', titleAr: 'خبير الذاكرة', description: 'Win a MEMORY game', icon: '🧠', target: 1, rewardCoins: 70, gameCategory: 'MEMORY' },
  { id: 'speed_demon', title: 'Speed Demon', titleAr: 'شيطان السرعة', description: 'Play 2 SPEED games', icon: '💨', target: 2, rewardCoins: 60, gameCategory: 'SPEED' },
  { id: 'puzzle_solver', title: 'Puzzle Solver', titleAr: 'حلال الألغاز', description: 'Win a PUZZLE game', icon: '🧩', target: 1, rewardCoins: 70, gameCategory: 'PUZZLE' },
  { id: 'party_king', title: 'Party King', titleAr: 'ملك الحفلة', description: 'Play 3 PARTY games', icon: '🎉', target: 3, rewardCoins: 90, gameCategory: 'PARTY' },
  { id: 'first_win_daily', title: 'First Blood', titleAr: 'أول فوز', description: 'Win your first game today', icon: '🥇', target: 1, rewardCoins: 40 },
  { id: 'tournament_try', title: 'Challenger', titleAr: 'المتحدي', description: 'Complete a Tournament (3+ rounds)', icon: '🏅', target: 1, rewardCoins: 100 },
  { id: 'perfect_score', title: 'Perfectionist', titleAr: 'المثالي', description: 'Win a round with 10 points', icon: '💯', target: 1, rewardCoins: 80 },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function hashDate(s: string): number {
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickDaily(pool: typeof CHALLENGE_POOL, dateKey: string, count = 3): typeof CHALLENGE_POOL {
  const seed = hashDate(dateKey);
  // deterministic shuffle via seed
  const arr = [...pool];
  for (let i=arr.length-1;i>0;i--) {
    const j = (seed + i * 2654435761) % (i+1);
    // ensure positive modulo
    const jj = ((j % (i+1)) + (i+1)) % (i+1);
    [arr[i], arr[jj]] = [arr[jj], arr[i]];
  }
  return arr.slice(0, count);
}

export class DailyChallengeService {
  private static STORAGE_KEY = 'daily_challenges_v1';
  private state: DailyChallengeState;
  private listeners: ((s: DailyChallengeState) => void)[] = [];

  constructor() {
    this.state = this.load();
    this.ensureToday();
  }

  private load(): DailyChallengeState {
    const def: DailyChallengeState = { date: todayKey(), challenges: [], streak: 0, lastCompletedDate: null, totalCompleted: 0 };
    const raw = StorageService.getItem<Partial<DailyChallengeState>>(DailyChallengeService.STORAGE_KEY, def);
    if (!raw || !raw.date || !Array.isArray(raw.challenges) || raw.challenges.length === 0) return def;
    return {
      date: typeof raw.date === 'string' ? raw.date : def.date,
      challenges: raw.challenges as DailyChallenge[],
      streak: typeof raw.streak === 'number' ? raw.streak : 0,
      lastCompletedDate: (raw.lastCompletedDate as string) ?? null,
      totalCompleted: typeof raw.totalCompleted === 'number' ? raw.totalCompleted : 0,
    };
  }

  private save(): void {
    StorageService.setItem(DailyChallengeService.STORAGE_KEY, this.state);
    this.listeners.forEach(fn => fn(this.getState()));
  }

  onChange(fn: (s: DailyChallengeState) => void): void { this.listeners.push(fn); }

  private ensureToday(): void {
    const tk = todayKey();
    if (this.state.date !== tk) {
      // roll streak: if yesterday was completed, keep; else reset handled via claim logic; but date change resets daily board
      const picked = pickDaily(CHALLENGE_POOL, tk, 3);
      this.state = {
        date: tk,
        challenges: picked.map(p => ({ ...p, progress: 0, completed: false, claimed: false })),
        streak: this.state.streak,
        lastCompletedDate: this.state.lastCompletedDate,
        totalCompleted: this.state.totalCompleted,
      };
      this.save();
    } else if (this.state.challenges.length === 0) {
      const picked = pickDaily(CHALLENGE_POOL, tk, 3);
      this.state.challenges = picked.map(p => ({ ...p, progress: 0, completed: false, claimed: false }));
      this.save();
    }
  }

  getState(): DailyChallengeState {
    this.ensureToday();
    return JSON.parse(JSON.stringify(this.state));
  }

  getProgressPercent(): number {
    const c = this.state.challenges;
    if (c.length===0) return 0;
    return Math.round((c.filter(x=>x.completed).length / c.length)*100);
  }

  /** Call after each round/session */
  recordEvent(evt: { type: 'round_played' | 'round_won' | 'category_played' | 'category_won' | 'tournament_done' | 'perfect_win'; category?: string; streakWins?: number }): number {
    this.ensureToday();
    let coinsEarned = 0;
    let changed = false;
    for (const ch of this.state.challenges) {
      if (ch.completed) continue;
      let inc = 0;
      switch (ch.id) {
        case 'play_3': if (evt.type==='round_played') inc=1; break;
        case 'play_5': if (evt.type==='round_played') inc=1; break;
        case 'win_2': if (evt.type==='round_won') inc=1; break;
        case 'win_3_streak': if (evt.type==='round_won' && (evt.streakWins ?? 0) >= 1) { ch.progress = Math.max(ch.progress, evt.streakWins!); if (ch.progress >= ch.target) { ch.completed=true; changed=true; } continue; } break;
        case 'first_win_daily': if (evt.type==='round_won') inc=1; break;
        case 'perfect_score': if (evt.type==='perfect_win') inc=1; break;
        case 'tournament_try': if (evt.type==='tournament_done') inc=1; break;
        default: {
          // category based
          if (ch.gameCategory) {
            if (evt.type==='category_played' && evt.category===ch.gameCategory) inc=1;
            else if (evt.type==='category_won' && evt.category===ch.gameCategory) inc=1;
          }
          break;
        }
      }
      if (inc) {
        ch.progress = Math.min(ch.target, ch.progress + inc);
        if (ch.progress >= ch.target) ch.completed = true;
        changed = true;
      }
    }
    if (changed) this.save();
    return coinsEarned;
  }

  claim(id: string): number {
    const ch = this.state.challenges.find(c=>c.id===id);
    if (!ch || !ch.completed || ch.claimed) return 0;
    ch.claimed = true;
    ch.rewardCoins; // for caller
    // check if all claimed -> bump streak
    const allDone = this.state.challenges.every(c=>c.completed && c.claimed);
    if (allDone) {
      const tk = todayKey();
      // if lastCompletedDate is yesterday, continue streak else reset to 1
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      if (this.state.lastCompletedDate === yKey) this.state.streak += 1;
      else if (this.state.lastCompletedDate !== tk) this.state.streak = 1;
      this.state.lastCompletedDate = tk;
      this.state.totalCompleted += 1;
    }
    this.save();
    return ch.rewardCoins;
  }

  claimAll(): number {
    let total = 0;
    for (const ch of this.state.challenges) if (ch.completed && !ch.claimed) total += this.claim(ch.id);
    return total;
  }

  reroll(): void {
    // dev / shop reroll: pick new set
    const tk = todayKey() + '-' + Date.now();
    const picked = pickDaily(CHALLENGE_POOL, tk, 3);
    this.state.challenges = picked.map(p => ({ ...p, progress: 0, completed: false, claimed: false }));
    this.save();
  }
}
