import { Player, PlayerId } from '../types/index.ts';
import { StorageService } from './StorageService.ts';
import { sanitizeName, validateAvatar, clampInt } from '../utils/sanitize.ts';

export interface PlayerColorOption {
  color: string;
  darkColor: string;
  lightColor: string;
  name: string;
}

export class PlayerManager {
  private static STORAGE_KEY = 'player_profiles';
  private static COUNT_KEY = 'active_player_count';

  public static readonly AVAILABLE_COLORS: PlayerColorOption[] = [
    { color: '#FF4757', darkColor: '#D63031', lightColor: '#FF6B81', name: 'Red' },
    { color: '#00D2D3', darkColor: '#01A3A4', lightColor: '#48DBFB', name: 'Cyan' },
    { color: '#FFA502', darkColor: '#E67E22', lightColor: '#FFC048', name: 'Orange' },
    { color: '#2ED573', darkColor: '#10AC84', lightColor: '#7BED9F', name: 'Green' },
    { color: '#7B68EE', darkColor: '#5F4AC9', lightColor: '#A99CFF', name: 'Purple' },
    { color: '#FF6B9D', darkColor: '#E84393', lightColor: '#FF9FCC', name: 'Pink' },
    { color: '#1E90FF', darkColor: '#0066CC', lightColor: '#5EB0FF', name: 'Blue' },
    { color: '#FFD93D', darkColor: '#CCAA00', lightColor: '#FFE87A', name: 'Yellow' },
    { color: '#00CED1', darkColor: '#00999C', lightColor: '#5DE8EB', name: 'Teal' },
    { color: '#FF8C42', darkColor: '#CC6A1A', lightColor: '#FFB07A', name: 'Tangerine' },
    { color: '#A55EEA', darkColor: '#8854D0', lightColor: '#C39CFF', name: 'Violet' },
    { color: '#26DE81', darkColor: '#1BAF65', lightColor: '#6EF0A8', name: 'Mint' },
  ];

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

  private activeCount: number = 2;

  public static readonly AVAILABLE_AVATARS = [
    '🦊', '🐬', '🐯', '🐸', '🐼', '🦁', '🐙', '🦖', '🦄', '🚀', '⚡', '👑'
  ];

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    const saved = StorageService.getItem<Partial<Player>[]>(PlayerManager.STORAGE_KEY, []);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      this.players = this.players.map(def => {
        const custom = saved.find(s => s && s.id === def.id);
        if (custom) {
          const av = validateAvatar(custom.avatar, PlayerManager.AVAILABLE_AVATARS as unknown as string[], def.avatar);
          const nm = typeof custom.name === 'string' && custom.name.trim()
            ? sanitizeName(custom.name, 14, def.name)
            : def.name;
          const allowedColors = new Set(PlayerManager.AVAILABLE_COLORS.map(c => c.color));
          const col = typeof custom.color === 'string' && allowedColors.has(custom.color) ? custom.color : def.color;
          return {
            ...def,
            name: nm,
            avatar: av,
            color: col,
            darkColor: custom.darkColor || def.darkColor,
            lightColor: custom.lightColor || def.lightColor,
          };
        }
        return def;
      });
    }

    const savedCount = StorageService.getItem<number>(PlayerManager.COUNT_KEY, 2);
    this.activeCount = clampInt(savedCount, 1, 4, 2);
  }

  saveState(): void {
    StorageService.setItem(
      PlayerManager.STORAGE_KEY,
      this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, darkColor: p.darkColor, lightColor: p.lightColor }))
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
    this.activeCount = clampInt(count, 1, 4, 2);
    this.saveState();
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  updatePlayer(id: PlayerId, name: string, avatar: string): void {
    const p = this.players.find(pl => pl.id === id);
    if (p) {
      p.name = sanitizeName(name, 14, `Player ${id}`);
      p.avatar = validateAvatar(avatar, PlayerManager.AVAILABLE_AVATARS as unknown as string[], p.avatar);
      this.saveState();
    }
  }

  updatePlayerColor(id: PlayerId, colorOpt: PlayerColorOption): void {
    const p = this.players.find(pl => pl.id === id);
    if (p) {
      p.color = colorOpt.color;
      p.darkColor = colorOpt.darkColor;
      p.lightColor = colorOpt.lightColor;
      this.saveState();
    }
  }

  isColorTaken(color: string, excludeId?: PlayerId): boolean {
    return this.players.some(p => p.color === color && p.id !== excludeId);
  }

  resetScores(): void {
    this.players.forEach(p => (p.totalScore = 0));
  }
}
