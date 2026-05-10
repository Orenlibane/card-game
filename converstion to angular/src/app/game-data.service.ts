import { Injectable, signal } from '@angular/core';
import { GameData } from './models';

@Injectable({ providedIn: 'root' })
export class GameDataService {
  readonly data = signal<GameData | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  async load(): Promise<void> {
    try {
      this.loading.set(true);
      const response = await fetch('/assets/season-1/game-data.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load game data: ${response.status}`);
      }

      this.data.set((await response.json()) as GameData);
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'טעינת הדאטה נכשלה');
    } finally {
      this.loading.set(false);
    }
  }
}
