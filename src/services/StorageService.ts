export class StorageService {
  private static prefix = 'party_game_';

  static getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(this.prefix + key);
      if (data === null) return defaultValue;
      return JSON.parse(data) as T;
    } catch {
      return defaultValue;
    }
  }

  static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }
  }
}
