export class StorageService {
  private static prefix = 'party_game_';
  private static memoryFallback: Record<string, string> = {};
  private static VERSION = 'v2';
  private static MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB soft cap hint

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

  /** Validates key is safe (alphanumeric + _ - only) */
  private static sanitizeKey(key: string): string {
    const clean = String(key).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    return clean || 'default';
  }

  static getItem<T>(key: string, defaultValue: T): T {
    const fullKey = this.prefix + this.sanitizeKey(key);
    try {
      let data: string | null = null;
      if (this.isLocalStorageAvailable()) {
        data = localStorage.getItem(fullKey);
      } else {
        data = this.memoryFallback[fullKey] ?? null;
      }
      if (data === null) return defaultValue;
      // Guard: reject suspiciously large payloads
      if (data.length > this.MAX_SIZE_BYTES) {
        console.warn(`Storage: oversized value for ${key} (${data.length} bytes) - returning default`);
        return defaultValue;
      }
      const parsed = JSON.parse(data);
      // Unwrap versioned envelope if present
      if (parsed && typeof parsed === 'object' && '__v' in parsed && '__data' in parsed) {
        return parsed.__data as T;
      }
      return parsed as T;
    } catch {
      return defaultValue;
    }
  }

  static setItem<T>(key: string, value: T): void {
    const fullKey = this.prefix + this.sanitizeKey(key);
    // Envelope with version so future migrations can evolve safely
    const envelope = { __v: this.VERSION, __data: value };
    const serialized = JSON.stringify(envelope);
    // Hard guard: prevent exceeding quota with single huge write
    if (serialized.length > this.MAX_SIZE_BYTES) {
      console.warn(`Storage: refused to save ${key} - payload too large (${serialized.length} bytes)`);
      return;
    }
    try {
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(fullKey, serialized);
      } else {
        this.memoryFallback[fullKey] = serialized;
      }
    } catch (e: unknown) {
      // QuotaExceededError -> try fallback & notify
      const errName = e instanceof DOMException ? e.name : String(e);
      if (errName === 'QuotaExceededError' || String(e).includes('QuotaExceeded')) {
        console.warn(`Storage quota exceeded for ${key} - using memory fallback`);
      } else {
        console.warn('Storage save failed:', e);
      }
      try { this.memoryFallback[fullKey] = serialized; } catch {}
    }
  }

  static removeItem(key: string): void {
    const fullKey = this.prefix + this.sanitizeKey(key);
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

  /** Returns approx total bytes used by this app in localStorage (for diagnostics) */
  static getUsageBytes(): number {
    let total = 0;
    try {
      if (this.isLocalStorageAvailable()) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            const v = localStorage.getItem(k) ?? '';
            total += k.length * 2 + v.length * 2; // UTF-16 approx
          }
        }
      } else {
        for (const [k, v] of Object.entries(this.memoryFallback)) {
          if (k.startsWith(this.prefix)) total += k.length * 2 + v.length * 2;
        }
      }
    } catch {}
    return total;
  }
}
