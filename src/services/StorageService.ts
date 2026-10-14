export class StorageService {
  private static prefix = 'party_game_';
  private static memoryFallback: Record<string, string> = {};

  private static isLocalStorageAvailable(): boolean {
    try {
      const k = '__pg_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  static getItem<T>(key: string, defaultValue: T): T {
    const fullKey = this.prefix + key;
    try {
      let data: string | null = null;
      if (this.isLocalStorageAvailable()) {
        data = localStorage.getItem(fullKey);
      } else {
        data = this.memoryFallback[fullKey] ?? null;
      }
      if (data === null) return defaultValue;
      return JSON.parse(data) as T;
    } catch {
      return defaultValue;
    }
  }

  static setItem<T>(key: string, value: T): void {
    const fullKey = this.prefix + key;
    const serialized = JSON.stringify(value);
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(fullKey, serialized);
      } else {
        this.memoryFallback[fullKey] = serialized;
      }
    } catch (e) {
      // QuotaExceeded or private mode -> fallback
      try { this.memoryFallback[fullKey] = serialized; } catch {}
      console.warn('Storage save failed:', e);
    }
  }

  static removeItem(key: string): void {
    const fullKey = this.prefix + key;
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.removeItem(fullKey);
      }
      delete this.memoryFallback[fullKey];
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
  }

  static clearAll(): void {
    try {
      if (this.isLocalStorageAvailable()) {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(this.prefix)) localStorage.removeItem(k);
        });
      }
      Object.keys(this.memoryFallback).forEach(k => {
        if (k.startsWith(this.prefix)) delete this.memoryFallback[k];
      });
    } catch {}
  }
}
