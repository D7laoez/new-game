import { Achievement, PlayerId, RoundResult } from '../types/index.ts';
import { StorageService } from './StorageService.ts';
import { StatsService } from './StatsService.ts';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'FIRST_WIN',
    title: 'First Victory',
    titleAr: 'النصر الأول',
    description: 'Win your first mini-game round!',
    icon: '🥇',
    unlockedAt: null
  },
  {
    id: 'PARTY_STARTER',
    title: 'Party Starter',
    titleAr: 'بداية الحفلة',
    description: 'Complete your first tournament or party session.',
    icon: '🎉',
    unlockedAt: null
  },
  {
    id: 'STREAK_3',
    title: 'On Fire',
    titleAr: 'سلسلة نارية',
    description: 'Achieve a winning streak of 3 mini-games in a row!',
    icon: '🔥',
    unlockedAt: null
  },
  {
    id: 'CUP_CHAMPION',
    title: 'Cup Champion',
    titleAr: 'بطل الكؤوس',
    description: 'Win 1st place in a Tournament Cup!',
    icon: '🏆',
    unlockedAt: null
  },
  {
    id: 'LIGHTNING_REFLEX',
    title: 'Lightning Reflex',
    titleAr: 'رد فعل صاعق',
    description: 'Register an astonishing reaction time under 250ms!',
    icon: '⚡',
    unlockedAt: null
  },
  {
    id: 'COMEBACK_KING',
    title: 'Comeback King',
    titleAr: 'ملك العودة',
    description: 'Stage a comeback and take the tournament lead!',
    icon: '👑',
    unlockedAt: null
  },
  {
    id: 'VARIETY_MASTER',
    title: 'Variety Master',
    titleAr: 'مستكشف الألعاب',
    description: 'Play at least 10 different mini-games.',
    icon: '🧭',
    unlockedAt: null
  },
  {
    id: 'TAP_TITAN',
    title: 'Tap Titan',
    titleAr: 'عملاق النقر',
    description: 'Reach 50+ rapid taps in a single tapping game.',
    icon: '👆',
    unlockedAt: null
  },
  {
    id: 'PERFECT_MIND',
    title: 'Sharp Mind',
    titleAr: 'العقل الحاد',
    description: 'Win a memory or puzzle challenge with top honors.',
    icon: '🧠',
    unlockedAt: null
  },
  {
    id: 'CENTURION',
    title: 'Party Legend',
    titleAr: 'أسطورة الحفلات',
    description: 'Play 30 total rounds across all your sessions.',
    icon: '💯',
    unlockedAt: null
  }
];

export class AchievementManager {
  private static STORAGE_KEY = 'party_achievements_v1';
  private achievements: Achievement[] = [];
  private onUnlockListeners: ((achievement: Achievement) => void)[] = [];

  constructor(private statsService: StatsService) {
    this.achievements = this.loadAchievements();
  }

  private loadAchievements(): Achievement[] {
    const saved = StorageService.getItem<Record<string, number>>(AchievementManager.STORAGE_KEY, {});
    return INITIAL_ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlockedAt: saved[ach.id] ?? null
    }));
  }

  private save(): void {
    const map: Record<string, number> = {};
    for (const ach of this.achievements) {
      if (ach.unlockedAt) map[ach.id] = ach.unlockedAt;
    }
    StorageService.setItem(AchievementManager.STORAGE_KEY, map);
  }

  public onUnlock(listener: (achievement: Achievement) => void): void {
    this.onUnlockListeners.push(listener);
  }

  public unlock(id: string): boolean {
    const ach = this.achievements.find(a => a.id === id);
    if (!ach || ach.unlockedAt) return false;

    ach.unlockedAt = Date.now();
    this.save();

    for (const listener of this.onUnlockListeners) {
      listener(ach);
    }
    return true;
  }

  public checkRound(
    result: RoundResult,
    rawStats?: Partial<Record<PlayerId, number | string>>
  ): void {
    // 1. FIRST_WIN: check if any player won
    const maxScore = Math.max(...result.ranks.map(r => r.roundPoints));
    if (maxScore > 0) {
      this.unlock('FIRST_WIN');
    }

    // 2. STREAK_3: check best streaks
    const allStats = this.statsService.getAllStats();
    for (const pId in allStats) {
      if (allStats[pId as unknown as PlayerId].currentStreak >= 3) {
        this.unlock('STREAK_3');
      }
    }

    // 3. LIGHTNING_REFLEX: check rawStats or statsService
    if (rawStats) {
      for (const pId in rawStats) {
        const val = rawStats[pId as unknown as PlayerId];
        const num = typeof val === 'number' ? val : parseFloat(val as string);
        if (!isNaN(num) && num > 0 && num <= 250) {
          this.unlock('LIGHTNING_REFLEX');
        }
      }
    }

    // 4. COMEBACK_KING: check if comeback alert triggered or rank climbed
    if (result.comebackAlert && result.comebackAlert.includes('NEW LEADER')) {
      this.unlock('COMEBACK_KING');
    }

    // 5. VARIETY_MASTER: check distinct games played
    let distinctGames = new Set<string>();
    for (const pId in allStats) {
      Object.keys(allStats[pId as unknown as PlayerId].gamePlays).forEach(g => distinctGames.add(g));
    }
    if (distinctGames.size >= 10) {
      this.unlock('VARIETY_MASTER');
    }

    // 6. TAP_TITAN: if rawStats has 50+ taps
    if (rawStats) {
      for (const pId in rawStats) {
        const val = rawStats[pId as unknown as PlayerId];
        if (typeof val === 'number' && val >= 50) {
          this.unlock('TAP_TITAN');
        }
      }
    }

    // 7. PERFECT_MIND: memory/puzzle win
    if (['MEMORY', 'PUZZLE'].includes(result.game.category) && maxScore > 0) {
      this.unlock('PERFECT_MIND');
    }

    // 8. CENTURION: 30 total rounds
    let totalRoundsPlayed = 0;
    for (const pId in allStats) {
      totalRoundsPlayed += allStats[pId as unknown as PlayerId].gamesPlayed;
    }
    if (totalRoundsPlayed >= 30) {
      this.unlock('CENTURION');
    }
  }

  public checkSessionEnd(
    leaderboard: { playerId: PlayerId; totalPoints: number; rank: number }[],
    isTournament = false
  ): void {
    this.unlock('PARTY_STARTER');

    if (isTournament && leaderboard.length > 0 && leaderboard[0].totalPoints > 0) {
      this.unlock('CUP_CHAMPION');
    }
  }

  public getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  public getUnlockedCount(): number {
    return this.achievements.filter(a => a.unlockedAt !== null).length;
  }
}
