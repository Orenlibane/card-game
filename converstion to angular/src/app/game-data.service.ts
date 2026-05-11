import { Injectable, inject, signal } from '@angular/core';
import { GameApiService } from './game-api.service';
import { GameData } from './models';

@Injectable({ providedIn: 'root' })
export class GameDataService {
  readonly data = signal<GameData | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly api = inject(GameApiService);

  async load(): Promise<void> {
    try {
      this.loading.set(true);
      this.data.set(await this.loadGameData());
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'טעינת הדאטה נכשלה');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadGameData(): Promise<GameData> {
    try {
      return (await this.api.bootstrap()).catalog;
    } catch {
      this.api.markUnavailable();
      const response = await fetch('/assets/season-1/game-data.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load game data: ${response.status}`);
      }

      return (await response.json()) as GameData;
    }
  }
}
