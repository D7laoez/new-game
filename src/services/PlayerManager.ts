import { Player, PlayerId } from '../types/index.ts';
import { StorageService } from './StorageService.ts';

export class PlayerManager {
  private static STORAGE_KEY = 'player_profiles';
  private static COUNT_KEY = 'active_player_count';

  private players: Player[] = [
    {
      id: 1,
      name: 'Player 1',
      avatar: '🦊',
      color: '#FF4757',
      darkColor: '#D63031',
      lightColor: '#FF6B81',
      totalScore: 0
    },
    {
      id: 2,
      name: 'Player 2',
      avatar: '🐬',
      color: '#00D2D3',
      darkColor: '#01A3A4',
      lightColor: '#48DBFB',
      totalScore: 0
    },
    {
      id: 3,
      name: 'Player 3',
      avatar: '🐯',
      color: '#FFA502',
      darkColor: '#E67E22',
      lightColor: '#FFC048',
      totalScore: 0
    },
    {
      id: 4,
      name: 'Player 4',
      avatar: '🐸',
      color: '#2ED573',
      darkColor: '#10AC84',
      lightColor: '#7BED9F',
      totalScore: 0
    }
  ];

  private activeCount: number = 2; // Default 2 players for quick party

  public static readonly AVAILABLE_AVATARS = [
    '🦊', '🐬', '🐯', '🐸', '🐼', '🦁', '🐙', '🦖', '🦄', '🚀', '⚡', '👑'
  ];

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    const saved = StorageService.getItem<Partial<Player>[]>(PlayerManager.STORAGE_KEY, []);
    if (saved && saved.length > 0) {
      this.players = this.players.map(def => {
        const custom = saved.find(s => s.id === def.id);
        if (custom) {
          return {
            ...def,
            name: custom.name || def.name,
            avatar: custom.avatar || def.avatar
          };
        }
        return def;
      });
    }

    const savedCount = StorageService.getItem<number>(PlayerManager.COUNT_KEY, 2);
    if (savedCount >= 1 && savedCount <= 4) {
      this.activeCount = savedCount;
    }
  }

  saveState(): void {
    StorageService.setItem(
      PlayerManager.STORAGE_KEY,
      this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }))
    );
    StorageService.setItem(PlayerManager.COUNT_KEY, this.activeCount);
  }

  getActivePlayers(): Player[] {
    return this.players.slice(0, this.activeCount);
  }

  getAllPlayers(): Player[] {
    return [...this.players];
  }

  getPlayer(id: PlayerId): Player | undefined {
    return this.players.find(p => p.id === id);
  }

  setActiveCount(count: number): void {
    this.activeCount = Math.max(1, Math.min(4, count));
    this.saveState();
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  updatePlayer(id: PlayerId, name: string, avatar: string): void {
    const p = this.players.find(pl => pl.id === id);
    if (p) {
      p.name = name.trim() || `Player ${id}`;
      p.avatar = avatar;
      this.saveState();
    }
  }

  resetScores(): void {
    this.players.forEach(p => (p.totalScore = 0));
  }
}
