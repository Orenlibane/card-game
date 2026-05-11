import { Injectable, signal } from '@angular/core';
import { GameData } from './models';

const PLAYER_ID_KEY = 'factCollectorsPlayerIdV1';
const API_BASE_OVERRIDE_KEY = 'factCollectorsApiBase';
const PRODUCTION_API_BASE = 'https://fact-collectors-backend-production.up.railway.app';

export interface ApiPlayerState {
  player: {
    id: string;
    displayName: string;
    coins: number;
  };
  packs: Record<string, {
    discovered: string[];
    owned: string[];
  }>;
  cooldownUntil: Record<string, string | number>;
  duplicateInventory: Record<string, number>;
  dailyDeal?: {
    packId: string;
    price: number;
    regularPrice: number;
    dayKey: string;
    used?: boolean;
    available?: boolean;
  } | null;
}

export interface ApiBootstrap {
  catalog: GameData;
  dailyDeal: ApiPlayerState['dailyDeal'];
  supabaseConfigured: boolean;
}

export interface ApiOpenPackResponse {
  opening: {
    id: string;
    packId: string;
    cost: number;
    cards: Array<{
      cardId: string;
      duplicate: boolean;
    }>;
    duplicateCount: number;
    duplicateCoins: number;
  };
  state: ApiPlayerState;
}

export interface ApiSellDuplicatesResponse {
  soldCount: number;
  rewardCoins: number;
  state: ApiPlayerState;
}

export interface ApiQuizAttemptResponse {
  attempt: {
    id: string;
    passed: boolean;
    score: number;
    total: number;
    rewardCoins: number;
    cooldownUntil: string | null;
  };
  state: ApiPlayerState;
}

@Injectable({ providedIn: 'root' })
export class GameApiService {
  readonly available = signal(false);
  readonly playerId = signal<string | null>(this.readPlayerId());

  get baseUrl(): string {
    const override = localStorage.getItem(API_BASE_OVERRIDE_KEY)?.trim();
    if (override) return override.replace(/\/+$/u, '');

    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }

    return PRODUCTION_API_BASE;
  }

  async bootstrap(): Promise<ApiBootstrap> {
    const data = await this.request<ApiBootstrap>('/api/bootstrap');
    this.available.set(true);
    return data;
  }

  async loadPlayerState(): Promise<ApiPlayerState | null> {
    if (!this.available()) return null;

    let playerId = this.readPlayerId();
    if (playerId) {
      try {
        const state = await this.request<ApiPlayerState>(`/api/players/${encodeURIComponent(playerId)}/state`);
        this.playerId.set(playerId);
        return state;
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 404) throw error;
        this.clearPlayerId();
      }
    }

    const created = await this.request<{ player: { id: string } }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'שחקן' }),
    });
    playerId = created.player.id;
    this.storePlayerId(playerId);
    return this.request<ApiPlayerState>(`/api/players/${encodeURIComponent(playerId)}/state`);
  }

  async openPack(packId: string): Promise<ApiOpenPackResponse> {
    const playerId = this.playerId();
    if (!playerId) throw new Error('missing_player_id');

    return this.request<ApiOpenPackResponse>(`/api/players/${encodeURIComponent(playerId)}/open-pack`, {
      method: 'POST',
      body: JSON.stringify({ packId }),
    });
  }

  async sellDuplicate(cardId: string, amount = 1): Promise<ApiSellDuplicatesResponse> {
    const playerId = this.playerId();
    if (!playerId) throw new Error('missing_player_id');

    return this.request<ApiSellDuplicatesResponse>(`/api/players/${encodeURIComponent(playerId)}/sell-duplicates`, {
      method: 'POST',
      body: JSON.stringify({ cardId, amount }),
    });
  }

  async sellAllDuplicates(): Promise<ApiSellDuplicatesResponse> {
    const playerId = this.playerId();
    if (!playerId) throw new Error('missing_player_id');

    return this.request<ApiSellDuplicatesResponse>(`/api/players/${encodeURIComponent(playerId)}/sell-duplicates`, {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    });
  }

  async submitQuizAttempt(cardId: string, score: number, total: number): Promise<ApiQuizAttemptResponse> {
    const playerId = this.playerId();
    if (!playerId) throw new Error('missing_player_id');

    return this.request<ApiQuizAttemptResponse>(`/api/players/${encodeURIComponent(playerId)}/quiz-attempts`, {
      method: 'POST',
      body: JSON.stringify({ cardId, score, total }),
    });
  }

  markUnavailable(): void {
    this.available.set(false);
  }

  clearSession(): void {
    this.clearPlayerId();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new ApiRequestError(response.status, body);
    return body as T;
  }

  private readPlayerId(): string | null {
    return localStorage.getItem(PLAYER_ID_KEY);
  }

  private storePlayerId(playerId: string): void {
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    this.playerId.set(playerId);
  }

  private clearPlayerId(): void {
    localStorage.removeItem(PLAYER_ID_KEY);
    this.playerId.set(null);
  }
}

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`api_request_failed_${status}`);
  }
}
