import { IHapticManager } from '../types/index.ts';

export class HapticManager implements IHapticManager {
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if restricted by browser policy
    }
  }

  light(): void {
    this.vibrate(15);
  }

  medium(): void {
    this.vibrate(30);
  }

  heavy(): void {
    this.vibrate(50);
  }

  success(): void {
    this.vibrate([20, 50, 40]);
  }

  error(): void {
    this.vibrate([40, 40, 60]);
  }
}
