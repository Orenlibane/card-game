import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { GameDataService } from './game-data.service';
import { GameStateService } from './game-state.service';
import { CardData } from './models';
import { ThreePackSceneComponent } from './three-pack-scene.component';

@Component({
  selector: 'app-root',
  imports: [ThreePackSceneComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly dataService = inject(GameDataService);
  protected readonly game = inject(GameStateService);
  protected readonly openingPhase = signal<'idle' | 'charging' | 'revealing'>('idle');
  protected readonly openingPackPath = signal('');

  protected readonly quiz = computed(() => this.game.state()?.quiz ?? null);
  protected readonly currentQuestion = computed(() => {
    const quiz = this.quiz();
    return quiz ? quiz.questions[quiz.index] : null;
  });
  protected readonly quizProgress = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return 0;
    return Math.round(((quiz.index + 1) / quiz.questions.length) * 100);
  });
  protected readonly packOpened = computed(() => {
    const pack = this.game.selectedPack();
    const state = this.game.state();
    return Boolean(pack && state?.lastPackOpen?.packId === pack.pack_id);
  });
  protected readonly lastOpenedCards = computed(() => {
    const state = this.game.state();
    const pack = this.game.selectedPack();
    if (!state?.lastPackOpen || !pack || state.lastPackOpen.packId !== pack.pack_id) return [];
    return state.lastPackOpen.cards
      .map((opened) => ({
        ...opened,
        card: pack.cards.find((card) => card.card_id === opened.cardId) ?? null,
      }))
      .filter((opened) => opened.card);
  });
  protected readonly lastDuplicateCount = computed(() => this.lastOpenedCards().filter((opened) => opened.duplicate).length);
  protected readonly promoPack = computed(() => this.game.packs().find((pack) => pack.pack_id === 'world-wonders') ?? null);
  private readonly openingTimers: Array<ReturnType<typeof window.setTimeout>> = [];

  async ngOnInit(): Promise<void> {
    await this.dataService.load();
    const data = this.dataService.data();
    if (data) this.game.init(data);

    window.setInterval(() => {
      const current = this.game.state();
      if (current) this.game.state.set({ ...current });
    }, 30000);

    (window as unknown as { render_game_to_text: () => string }).render_game_to_text = () => this.renderGameToText();
    (window as unknown as { advanceTime: (ms: number) => void }).advanceTime = () => undefined;
  }

  ngOnDestroy(): void {
    this.clearOpeningTimers();
  }

  protected assetUrl(path?: string): string {
    return path ? this.game.assetUrl(path) : '';
  }

  protected isDiscovered(card: CardData): boolean {
    const pack = this.game.selectedPack();
    return Boolean(pack && this.game.discoveredSet(pack.pack_id).has(card.card_id));
  }

  protected isSelectedCardDiscovered(): boolean {
    const card = this.game.selectedCard();
    return card ? this.isDiscovered(card) : false;
  }

  protected previewAlbumCard(cardId: string): void {
    this.game.previewCard(cardId);
  }

  protected answerLetter(index: number): string {
    return ['א', 'ב', 'ג', 'ד'][index] ?? String(index + 1);
  }

  protected selectAdjacentCard(direction: -1 | 1): void {
    const cards = this.game.selectedPack()?.cards ?? [];
    const currentId = this.game.state()?.selectedCardId;
    if (!cards.length || !currentId) return;
    const currentIndex = Math.max(0, cards.findIndex((card) => card.card_id === currentId));
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    this.previewAlbumCard(cards[nextIndex].card_id);
  }

  protected selectAlbumPack(packId: string): void {
    this.game.selectPack(packId);
    this.game.setView('album');
  }

  protected playPackOpening(): void {
    if (this.openingPhase() !== 'idle') return;

    const state = this.game.state();
    const rules = this.game.rules();
    const pack = this.game.selectedPack();
    if (!state || !rules || !pack) return;

    if (state.coins < rules.pack_cost) {
      this.game.openPack();
      return;
    }

    this.clearOpeningTimers();
    this.openingPackPath.set(pack.pack_asset_path);
    this.openingPhase.set('charging');

    this.openingTimers.push(window.setTimeout(() => {
      this.game.openPack();
      this.openingPhase.set('revealing');
    }, 1500));

    this.openingTimers.push(window.setTimeout(() => {
      this.openingPhase.set('idle');
    }, 6200));
  }

  protected buyPromoPack(): void {
    const pack = this.promoPack();
    if (!pack || this.openingPhase() !== 'idle') return;

    this.game.selectPack(pack.pack_id);
    window.setTimeout(() => this.playPackOpening(), 0);
  }

  protected inspectOpenedCard(cardId: string): void {
    if (this.openingPhase() !== 'revealing') return;
    this.clearOpeningTimers();
    this.openingPhase.set('idle');
    this.game.selectCard(cardId);
  }

  private clearOpeningTimers(): void {
    this.openingTimers.forEach((timer) => window.clearTimeout(timer));
    this.openingTimers.length = 0;
  }

  private renderGameToText(): string {
    const state = this.game.state();
    const pack = this.game.selectedPack();
    const card = this.game.selectedCard();
    const quiz = state?.quiz;
    return JSON.stringify({
      screen: state?.view ?? 'loading',
      coins: state?.coins ?? 0,
      selectedPack: pack?.pack_title_he ?? null,
      selectedCard: card?.title_he ?? null,
      discoveredInPack: pack ? this.game.discoveredSet(pack.pack_id).size : 0,
      ownedInPack: this.game.ownedCount(),
      openingPhase: this.openingPhase(),
      lastPackOpen: state?.lastPackOpen
        ? {
            packId: state.lastPackOpen.packId,
            cards: state.lastPackOpen.cards.length,
            duplicates: state.lastPackOpen.cards.filter((card) => card.duplicate).length,
            duplicateCoins: state.lastPackOpen.duplicateCoins,
          }
        : null,
      quiz: quiz
        ? {
            cardId: quiz.cardId,
            question: quiz.index + 1,
            total: quiz.questions.length,
            score: quiz.score,
            answered: quiz.answered,
            prompt: quiz.questions[quiz.index]?.prompt,
          }
        : null,
    });
  }
}
