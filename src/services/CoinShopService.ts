import { StorageService } from './StorageService.ts';

export interface ShopItem {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  price: number;
  kind: 'SKIN' | 'THEME' | 'EFFECT';
  preview?: string;
  owned?: boolean;
}

export interface CoinState {
  coins: number;
  ownedIds: string[];
  activeSkinId: string | null;
  activeThemeId: string | null;
}

const SHOP_CATALOG: ShopItem[] = [
  { id: 'skin_neon', name: 'Neon Glow', nameAr: 'توهج نيون', icon: '✨', price: 120, kind: 'SKIN' },
  { id: 'skin_gold', name: 'Golden Crown', nameAr: 'تاج ذهبي', icon: '👑', price: 200, kind: 'SKIN' },
  { id: 'skin_fire', name: 'Fire Trail', nameAr: 'أثر ناري', icon: '🔥', price: 150, kind: 'SKIN' },
  { id: 'skin_ice', name: 'Ice Crystal', nameAr: 'بلورة ثلجية', icon: '❄️', price: 150, kind: 'SKIN' },
  { id: 'skin_galaxy', name: 'Galaxy', nameAr: 'مجرة', icon: '🌌', price: 250, kind: 'SKIN' },
  { id: 'theme_midnight', name: 'Midnight Theme', nameAr: 'ثيم منتصف الليل', icon: '🌙', price: 100, kind: 'THEME' },
  { id: 'theme_sunset', name: 'Sunset Theme', nameAr: 'ثيم الغروب', icon: '🌅', price: 100, kind: 'THEME' },
  { id: 'theme_ocean', name: 'Ocean Theme', nameAr: 'ثيم المحيط', icon: '🌊', price: 100, kind: 'THEME' },
  { id: 'effect_confetti', name: 'Mega Confetti', nameAr: 'كونفيتي ضخم', icon: '🎊', price: 80, kind: 'EFFECT' },
  { id: 'effect_stars', name: 'Star Burst', nameAr: 'انفجار نجوم', icon: '🌟', price: 80, kind: 'EFFECT' },
];

export class CoinShopService {
  private static STORAGE_KEY = 'coin_shop_v1';
  private state: CoinState;
  private listeners: ((s: CoinState)=>void)[] = [];

  constructor() {
    const def: CoinState = { coins: 250, ownedIds: [], activeSkinId: null, activeThemeId: null };
    const raw = StorageService.getItem<Partial<CoinState>>(CoinShopService.STORAGE_KEY, def);
    this.state = {
      coins: typeof raw.coins==='number' ? raw.coins : def.coins,
      ownedIds: Array.isArray(raw.ownedIds) ? raw.ownedIds as string[] : [],
      activeSkinId: (raw.activeSkinId as string) ?? null,
      activeThemeId: (raw.activeThemeId as string) ?? null,
    };
  }

  private save(): void { StorageService.setItem(CoinShopService.STORAGE_KEY, this.state); this.listeners.forEach(fn=>fn(this.getState())); }
  onChange(fn:(s:CoinState)=>void): void { this.listeners.push(fn); }
  getState(): CoinState { return JSON.parse(JSON.stringify(this.state)); }
  getCatalog(): ShopItem[] { return SHOP_CATALOG.map(i=>({ ...i, owned: this.state.ownedIds.includes(i.id)})); }
  getCatalogByKind(kind: ShopItem['kind']): ShopItem[] { return this.getCatalog().filter(i=>i.kind===kind); }
  getCoins(): number { return this.state.coins; }

  addCoins(n: number): void { if(n<=0) return; this.state.coins += Math.floor(n); this.save(); }
  spendCoins(n: number): boolean { if(this.state.coins < n) return false; this.state.coins -= n; this.save(); return true; }

  buy(id: string): { ok: boolean; reason?: string } {
    const item = SHOP_CATALOG.find(x=>x.id===id);
    if (!item) return { ok:false, reason:'not_found' };
    if (this.state.ownedIds.includes(id)) return { ok:false, reason:'already_owned' };
    if (this.state.coins < item.price) return { ok:false, reason:'not_enough_coins' };
    this.state.coins -= item.price;
    this.state.ownedIds.push(id);
    this.save();
    return { ok:true };
  }

  equipSkin(id: string | null): boolean {
    if (id && !this.state.ownedIds.includes(id)) return false;
    this.state.activeSkinId = id;
    this.save(); return true;
  }
  equipTheme(id: string | null): boolean {
    if (id && !this.state.ownedIds.includes(id)) return false;
    this.state.activeThemeId = id;
    if (id) document.documentElement.setAttribute('data-shop-theme', id);
    else document.documentElement.removeAttribute('data-shop-theme');
    this.save(); return true;
  }
  applyTheme(): void {
    if (this.state.activeThemeId) document.documentElement.setAttribute('data-shop-theme', this.state.activeThemeId);
  }
  getOwnedIds(): string[] { return [...this.state.ownedIds]; }
}
