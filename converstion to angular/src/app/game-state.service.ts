import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiOpenPackResponse, ApiPlayerState, ApiQuizAttemptResponse, ApiRequestError, ApiSellDuplicatesResponse, GameApiService } from './game-api.service';
import { AnswerOption, AppView, CardData, CardStatus, DailyDealState, GameData, GameStoreState, PackData, RuntimeQuestion } from './models';

const STORAGE_KEY = 'factCollectorsAngularLocalStateV2';
const INITIAL_VIEW: AppView = 'pack';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly api = inject(GameApiService);
  readonly data = signal<GameData | null>(null);
  readonly state = signal<GameStoreState | null>(null);
  readonly toast = signal('');

  readonly packs = computed(() => this.data()?.packs ?? []);
  readonly rules = computed(() => this.data()?.mvp_rules ?? null);

  readonly selectedPack = computed(() => {
    const packs = this.packs();
    const state = this.state();
    return packs.find((pack) => pack.pack_id === state?.selectedPackId) ?? packs[0] ?? null;
  });

  readonly selectedCard = computed(() => {
    const pack = this.selectedPack();
    const state = this.state();
    if (!pack) return null;
    return pack.cards.find((card) => card.card_id === state?.selectedCardId) ?? pack.cards[0] ?? null;
  });

  readonly dailyDeal = computed(() => {
    const stateDeal = this.state()?.dailyDeal;
    if (stateDeal) {
      const pack = this.packs().find((item) => item.pack_id === stateDeal.packId);
      if (pack) {
        return {
          pack,
          price: stateDeal.price,
          regularPrice: stateDeal.regularPrice,
          dayKey: stateDeal.dayKey,
          used: Boolean(stateDeal.used),
          available: stateDeal.available !== false && !stateDeal.used,
        };
      }
    }

    const packs = this.packs();
    if (!packs.length) return null;
    const dayKey = new Date().toISOString().slice(0, 10);
    const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const pack = packs[seed % packs.length];
    return {
      pack,
      price: 10,
      regularPrice: this.rules()?.pack_cost ?? 20,
      dayKey,
      used: false,
      available: true,
    };
  });

  readonly selectedPackCost = computed(() => {
    const pack = this.selectedPack();
    return pack ? this.costForPack(pack.pack_id) : (this.rules()?.pack_cost ?? 0);
  });

  readonly duplicateTotalCount = computed(() => {
    const inventory = this.state()?.duplicateInventory ?? {};
    return Object.values(inventory).reduce((sum, count) => sum + Math.max(0, count), 0);
  });

  readonly duplicateTotalValue = computed(() => this.duplicateTotalCount() * (this.rules()?.duplicate_reward_coins ?? 0));

  readonly duplicateRows = computed(() => {
    const inventory = this.state()?.duplicateInventory ?? {};
    const cards = this.packs().flatMap((pack) => pack.cards.map((card) => ({ card, pack })));
    return cards
      .map(({ card, pack }) => ({
        card,
        pack,
        count: inventory[card.card_id] ?? 0,
        value: (inventory[card.card_id] ?? 0) * (this.rules()?.duplicate_reward_coins ?? 0),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.card.title_he.localeCompare(b.card.title_he, 'he'));
  });

  readonly discoveredCards = computed(() => {
    const pack = this.selectedPack();
    if (!pack) return [];
    const discovered = this.discoveredSet(pack.pack_id);
    return pack.cards.filter((card) => discovered.has(card.card_id));
  });

  readonly ownedCount = computed(() => {
    const pack = this.selectedPack();
    const state = this.state();
    if (!pack || !state) return 0;
    return pack.cards.filter((card) => state.owned[card.card_id]).length;
  });

  init(data: GameData, serverState: ApiPlayerState | null = null): void {
    this.data.set(data);
    const saved = this.readSavedState();
    const firstPack = data.packs[0];
    const firstCard = firstPack?.cards[0];
    if (serverState) {
      this.state.set(this.stateFromServer(data, serverState, saved));
      return;
    }

    this.state.set({
      view: INITIAL_VIEW,
      selectedPackId: saved?.selectedPackId || firstPack?.pack_id || '',
      selectedCardId: saved?.selectedCardId || firstCard?.card_id || '',
      coins: typeof saved?.coins === 'number' ? saved.coins : data.mvp_rules.starter_coins,
      discovered: saved?.discovered ?? {},
      owned: saved?.owned ?? {},
      duplicateInventory: saved?.duplicateInventory ?? {},
      cooldownUntil: saved?.cooldownUntil ?? {},
      dailyDeal: this.localDailyDealState(data),
      lastPackOpen: saved?.lastPackOpen ?? null,
      quiz: null,
    });
  }

  setView(view: AppView): void {
    this.patch({ view });
  }

  selectPack(packId: string): void {
    const pack = this.packs().find((item) => item.pack_id === packId);
    if (!pack) return;
    const discovered = this.discoveredSet(packId);
    const selectedCard = pack.cards.find((card) => discovered.has(card.card_id)) ?? pack.cards[0];
    this.patch({ selectedPackId: packId, selectedCardId: selectedCard.card_id, quiz: null, view: 'pack' });
  }

  selectCard(cardId: string): void {
    const card = this.cardById(cardId);
    if (!card) return;
    const pack = this.packForCard(cardId);
    if (!pack || !this.discoveredSet(pack.pack_id).has(cardId)) {
      this.notify('הקלף עוד לא נחשף מתוך חבילה.');
      return;
    }
    this.patch({ selectedPackId: pack.pack_id, selectedCardId: cardId, view: 'album', quiz: null });
  }

  previewCard(cardId: string): void {
    const card = this.cardById(cardId);
    const pack = this.packForCard(cardId);
    if (!card || !pack) return;
    this.patch({ selectedPackId: pack.pack_id, selectedCardId: cardId, view: 'album', quiz: null });
  }

  async openPack(): Promise<void> {
    const state = this.state();
    const pack = this.selectedPack();
    const rules = this.rules();
    if (!state || !pack || !rules) return;

    const packCost = this.costForPack(pack.pack_id);
    if (state.coins < packCost) {
      this.notify('אין מספיק מטבעות מוח לפתיחת החבילה.');
      return;
    }

    if (this.api.available() && this.api.playerId()) {
      try {
        const result = await this.api.openPack(pack.pack_id);
        this.applyOpenPackResponse(result);
        return;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 409) {
          this.notify('אין מספיק מטבעות מוח לפתיחת החבילה.');
          return;
        }

        this.notify('השרת לא הצליח לפתוח חבילה כרגע. נסה שוב בעוד רגע.');
        return;
      }
    }

    const currentDiscovered = this.discoveredSet(pack.pack_id);
    const drawnCards = this.shuffle(pack.cards).slice(0, Math.min(rules.pack_size, pack.cards.length));
    const nextPackCards = new Set(currentDiscovered);
    const openedCards = drawnCards.map((card) => {
      const duplicate = nextPackCards.has(card.card_id);
      if (!duplicate) nextPackCards.add(card.card_id);
      return { cardId: card.card_id, duplicate };
    });
    const duplicateCount = openedCards.filter((card) => card.duplicate).length;
    const duplicateCoins = duplicateCount * rules.duplicate_reward_coins;
    const firstNewCard = openedCards.find((card) => !card.duplicate)?.cardId ?? openedCards[0]?.cardId ?? pack.cards[0].card_id;
    const discovered = { ...state.discovered, [pack.pack_id]: [...nextPackCards] };
    const duplicateInventory = { ...(state.duplicateInventory ?? {}) };
    for (const opened of openedCards) {
      if (opened.duplicate) duplicateInventory[opened.cardId] = (duplicateInventory[opened.cardId] ?? 0) + 1;
    }

    this.patch({
      coins: state.coins - packCost,
      discovered,
      duplicateInventory,
      dailyDeal: state.dailyDeal?.packId === pack.pack_id && state.dailyDeal.available
        ? { ...state.dailyDeal, used: true, available: false }
        : state.dailyDeal,
      selectedCardId: firstNewCard,
      lastPackOpen: {
        packId: pack.pack_id,
        openedAt: Date.now(),
        cost: packCost,
        cards: openedCards,
        duplicateCoins,
      },
      view: 'album',
      quiz: null,
    });
    const newCount = openedCards.length - duplicateCount;
    const newText = newCount === 1 ? 'חדש אחד' : `${newCount} חדשים`;
    const duplicateText = duplicateCount === 1 ? 'כפול אחד' : `${duplicateCount} כפולים`;
    this.notify(`נפתחו ${openedCards.length} קלפים: ${newText}, ${duplicateText}. כפולים נשמרו למכירה בשווי ${duplicateCoins}★.`);
  }

  costForPack(packId: string): number {
    const deal = this.dailyDeal();
    if (deal?.pack.pack_id === packId && deal.available) return deal.price;
    return this.rules()?.pack_cost ?? 0;
  }

  isDailyDeal(packId: string): boolean {
    const deal = this.dailyDeal();
    return deal?.pack.pack_id === packId && deal.available;
  }

  async sellDuplicate(cardId: string, amount = 1): Promise<void> {
    const state = this.state();
    const rules = this.rules();
    if (!state || !rules) return;
    const currentCount = state.duplicateInventory?.[cardId] ?? 0;
    const sellCount = Math.min(Math.max(1, amount), currentCount);
    if (!sellCount) {
      this.notify('אין עותק כפול למכירה.');
      return;
    }

    if (this.api.available() && this.api.playerId()) {
      try {
        const result = await this.api.sellDuplicate(cardId, sellCount);
        this.applySellDuplicatesResponse(result, cardId);
        return;
      } catch {
        this.notify('השרת לא הצליח למכור את הכפול כרגע.');
        return;
      }
    }

    const duplicateInventory = { ...(state.duplicateInventory ?? {}) };
    const nextCount = currentCount - sellCount;
    if (nextCount > 0) duplicateInventory[cardId] = nextCount;
    else delete duplicateInventory[cardId];
    this.patch({
      duplicateInventory,
      coins: state.coins + sellCount * rules.duplicate_reward_coins,
    });
    const card = this.cardById(cardId);
    this.notify(`נמכר ${card?.title_he ?? 'קלף כפול'} · +${sellCount * rules.duplicate_reward_coins}★.`);
  }

  async sellAllDuplicates(): Promise<void> {
    const state = this.state();
    const value = this.duplicateTotalValue();
    if (!state || value <= 0) {
      this.notify('אין כפולים למכירה כרגע.');
      return;
    }

    if (this.api.available() && this.api.playerId()) {
      try {
        const result = await this.api.sellAllDuplicates();
        this.applySellDuplicatesResponse(result);
        return;
      } catch {
        this.notify('השרת לא הצליח למכור את הכפולים כרגע.');
        return;
      }
    }

    this.patch({ duplicateInventory: {}, coins: state.coins + value });
    this.notify(`כל הכפולים נמכרו · +${value}★.`);
  }

  dropRatesFor(pack: PackData): Array<{ rarity: string; label: string; count: number; singleChance: number; packChance: number }> {
    const rules = this.rules();
    const packSize = Math.min(rules?.pack_size ?? 3, pack.cards.length);
    const labels: Record<string, string> = {
      common: 'רגיל',
      rare: 'נדיר',
      epic: 'אפי',
      legendary: 'אגדי',
    };
    const order = ['common', 'rare', 'epic', 'legendary'];
    return order
      .map((rarity) => {
        const count = pack.cards.filter((card) => card.rarity === rarity).length;
        return {
          rarity,
          label: labels[rarity] ?? rarity,
          count,
          singleChance: pack.cards.length ? Math.round((count / pack.cards.length) * 100) : 0,
          packChance: this.atLeastOneChance(pack.cards.length, count, packSize),
        };
      })
      .filter((row) => row.count > 0);
  }

  startQuiz(): void {
    const card = this.selectedCard();
    const pack = this.selectedPack();
    if (!card || !pack) return;
    if (!this.discoveredSet(pack.pack_id).has(card.card_id)) {
      this.notify('הקלף הזה עוד לא התגלה. פתח חבילה כדי לחשוף אותו.');
      return;
    }
    if (this.isOwned(card.card_id)) {
      this.notify('הקלף כבר נמצא באוסף.');
      return;
    }
    if (this.cooldownActive(card.card_id)) {
      this.notify('אפשר לנסות שוב מחר.');
      return;
    }

    this.patch({
      view: 'quiz',
      quiz: {
        cardId: card.card_id,
        questions: this.buildQuiz(card, pack),
        index: 0,
        score: 0,
        answered: false,
        selectedOptionIndex: null,
      },
    });
  }

  answerQuestion(index: number): void {
    const current = this.state();
    const quiz = current?.quiz;
    if (!current || !quiz || quiz.answered) return;
    const question = quiz.questions[quiz.index];
    const selected = question.options[index];
    const nextQuiz = {
      ...quiz,
      answered: true,
      selectedOptionIndex: index,
      score: quiz.score + (selected?.correct ? 1 : 0),
    };
    this.patch({ quiz: nextQuiz });
  }

  async nextQuestion(): Promise<void> {
    const current = this.state();
    const quiz = current?.quiz;
    const rules = this.rules();
    if (!current || !quiz || !rules || !quiz.answered) return;

    if (quiz.index < quiz.questions.length - 1) {
      this.patch({
        quiz: {
          ...quiz,
          index: quiz.index + 1,
          answered: false,
          selectedOptionIndex: null,
        },
      });
      return;
    }

    const passed = quiz.score >= rules.pass_score;

    if (this.api.available() && this.api.playerId()) {
      try {
        const result = await this.api.submitQuizAttempt(quiz.cardId, quiz.score, quiz.questions.length);
        this.applyQuizAttemptResponse(result);
        return;
      } catch {
        this.notify('השרת לא הצליח לסיים את הבוחן כרגע. נסה שוב בעוד רגע.');
        return;
      }
    }

    const owned = { ...current.owned };
    const cooldownUntil = { ...current.cooldownUntil };
    let coins = current.coins;

    if (passed) {
      owned[quiz.cardId] = true;
      delete cooldownUntil[quiz.cardId];
      coins += this.quizRewardCoins();
    } else {
      cooldownUntil[quiz.cardId] = Date.now() + rules.retry_cooldown_hours * 60 * 60 * 1000;
    }

    this.patch({ owned, cooldownUntil, coins, quiz: null, view: 'album' });
    this.notify(passed ? 'מעולה! הקלף נכנס לאוסף שלך.' : 'לא עברת 80%. אפשר לנסות שוב מחר.');
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.api.clearSession();
    const data = this.data();
    if (data) this.init(data);
    this.notify('המשחק אופס מקומית.');
  }

  statusFor(card: CardData): CardStatus {
    if (this.isOwned(card.card_id)) return { text: 'נאסף', className: 'owned' };
    if (this.cooldownActive(card.card_id)) return { text: 'ניסיון מחר', className: 'cooldown' };
    const pack = this.packForCard(card.card_id);
    if (pack && this.discoveredSet(pack.pack_id).has(card.card_id)) return { text: 'מועמד', className: 'candidate' };
    return { text: 'לא נחשף', className: 'locked' };
  }

  isOwned(cardId: string): boolean {
    return Boolean(this.state()?.owned[cardId]);
  }

  cooldownActive(cardId: string): boolean {
    const until = this.state()?.cooldownUntil[cardId] ?? 0;
    return until > Date.now();
  }

  discoveredSet(packId: string): Set<string> {
    return new Set(this.state()?.discovered[packId] ?? []);
  }

  assetUrl(path: string): string {
    return `/${path}`;
  }

  private patch(partial: Partial<GameStoreState>): void {
    const current = this.state();
    if (!current) return;
    const next = { ...current, ...partial };
    this.state.set(next);
    this.saveState(next);
  }

  private notify(text: string): void {
    this.toast.set(text);
    window.setTimeout(() => {
      if (this.toast() === text) this.toast.set('');
    }, 2400);
  }

  private readSavedState(): Partial<GameStoreState> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<GameStoreState>) : null;
    } catch {
      return null;
    }
  }

  private saveState(state: GameStoreState): void {
    const { quiz: _quiz, ...serializable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }

  private stateFromServer(data: GameData, serverState: ApiPlayerState, saved: Partial<GameStoreState> | null): GameStoreState {
    const firstPack = data.packs[0];
    const selectedPackId = saved?.selectedPackId && data.packs.some((pack) => pack.pack_id === saved.selectedPackId)
      ? saved.selectedPackId
      : firstPack?.pack_id ?? '';
    const selectedPack = data.packs.find((pack) => pack.pack_id === selectedPackId) ?? firstPack;
    const discovered = Object.fromEntries(
      Object.entries(serverState.packs ?? {}).map(([packId, packState]) => [packId, packState.discovered ?? []])
    );
    const owned: Record<string, boolean> = {};
    for (const packState of Object.values(serverState.packs ?? {})) {
      for (const cardId of packState.owned ?? []) owned[cardId] = true;
    }
    const selectedCardId = saved?.selectedCardId && selectedPack?.cards.some((card) => card.card_id === saved.selectedCardId)
      ? saved.selectedCardId
      : selectedPack?.cards.find((card) => discovered[selectedPackId]?.includes(card.card_id))?.card_id ?? selectedPack?.cards[0]?.card_id ?? '';
    const cooldownUntil = Object.fromEntries(
      Object.entries(serverState.cooldownUntil ?? {}).map(([cardId, value]) => [
        cardId,
        typeof value === 'number' ? value : new Date(value).getTime(),
      ])
    );

    return {
      view: INITIAL_VIEW,
      selectedPackId,
      selectedCardId,
      coins: serverState.player.coins,
      discovered,
      owned,
      duplicateInventory: serverState.duplicateInventory ?? {},
      cooldownUntil,
      dailyDeal: serverState.dailyDeal ? {
        packId: serverState.dailyDeal.packId,
        price: serverState.dailyDeal.price,
        regularPrice: serverState.dailyDeal.regularPrice,
        dayKey: serverState.dailyDeal.dayKey,
        used: Boolean(serverState.dailyDeal.used),
        available: serverState.dailyDeal.available !== false && !serverState.dailyDeal.used,
      } : this.localDailyDealState(data),
      lastPackOpen: null,
      quiz: null,
    };
  }

  private localDailyDealState(data: GameData): DailyDealState | null {
    if (!data.packs.length) return null;
    const dayKey = new Date().toISOString().slice(0, 10);
    const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const pack = data.packs[seed % data.packs.length];
    return {
      packId: pack.pack_id,
      price: 10,
      regularPrice: data.mvp_rules.pack_cost,
      dayKey,
      used: false,
      available: true,
    };
  }

  private applyOpenPackResponse(result: ApiOpenPackResponse): void {
    const data = this.data();
    if (!data) return;
    const next = this.stateFromServer(data, result.state, this.state());
    const firstNewCard = result.opening.cards.find((card) => !card.duplicate)?.cardId ?? result.opening.cards[0]?.cardId ?? next.selectedCardId;
    const duplicateCount = result.opening.duplicateCount;
    this.state.set({
      ...next,
      selectedPackId: result.opening.packId,
      selectedCardId: firstNewCard,
      lastPackOpen: {
        packId: result.opening.packId,
        openedAt: Date.now(),
        cost: result.opening.cost,
        cards: result.opening.cards.map((card) => ({ cardId: card.cardId, duplicate: card.duplicate })),
        duplicateCoins: result.opening.duplicateCoins,
      },
      view: 'album',
      quiz: null,
    });
    this.saveState(this.state()!);
    const newCount = result.opening.cards.length - duplicateCount;
    const newText = newCount === 1 ? 'חדש אחד' : `${newCount} חדשים`;
    const duplicateText = duplicateCount === 1 ? 'כפול אחד' : `${duplicateCount} כפולים`;
    this.notify(`נפתחו ${result.opening.cards.length} קלפים: ${newText}, ${duplicateText}. כפולים נשמרו למכירה בשווי ${result.opening.duplicateCoins}★.`);
  }

  private applySellDuplicatesResponse(result: ApiSellDuplicatesResponse, cardId?: string): void {
    const data = this.data();
    if (!data) return;
    const next = this.stateFromServer(data, result.state, this.state());
    this.state.set(next);
    this.saveState(next);
    const card = cardId ? this.cardById(cardId) : null;
    const label = card ? card.title_he : `${result.soldCount} כפולים`;
    this.notify(`נמכר ${label} · +${result.rewardCoins}★.`);
  }

  private applyQuizAttemptResponse(result: ApiQuizAttemptResponse): void {
    const data = this.data();
    if (!data) return;
    const next = this.stateFromServer(data, result.state, this.state());
    this.state.set({ ...next, view: 'album', quiz: null });
    this.saveState(this.state()!);
    this.notify(result.attempt.passed
      ? `מעולה! הקלף נכנס לאוסף שלך · +${result.attempt.rewardCoins}★.`
      : 'לא עברת 80%. אפשר לנסות שוב מחר.');
  }

  private quizRewardCoins(): number {
    const rules = this.rules();
    if (!rules) return 0;
    return Math.min(rules.quiz_reward_brain_coins, Math.max(1, rules.pack_cost - 1));
  }

  private cardById(cardId: string): CardData | null {
    return this.packs().flatMap((pack) => pack.cards).find((card) => card.card_id === cardId) ?? null;
  }

  private packForCard(cardId: string): PackData | null {
    return this.packs().find((pack) => pack.cards.some((card) => card.card_id === cardId)) ?? null;
  }

  private atLeastOneChance(total: number, matching: number, draws: number): number {
    if (!total || !matching || !draws) return 0;
    if (matching >= total || draws >= total - matching + 1) return 100;
    const missChance = this.combinations(total - matching, draws) / this.combinations(total, draws);
    return Math.round((1 - missChance) * 100);
  }

  private combinations(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    const size = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= size; i++) {
      result = (result * (n - size + i)) / i;
    }
    return result;
  }

  private buildQuiz(card: CardData, pack: PackData): RuntimeQuestion[] {
    const needed = this.rules()?.quiz_questions_per_card ?? 10;
    const custom = (card.mvp_questions ?? [])
      .filter((item) => item.question && item.options?.length >= 3 && Number.isInteger(item.correct_index))
      .slice(0, needed)
      .map((item) => ({
        prompt: item.question,
        options: item.options.map((text, optionIndex) => ({ text, correct: optionIndex === item.correct_index })),
        note: item.options[item.correct_index],
      }));

    if (custom.length === needed) return custom;

    const title = card.title_he;
    const facts = card.facts_he.length ? card.facts_he : [`זהו קלף על ${title} מתוך אוספים עובדות.`];
    const tags = card.tags_he.length ? card.tags_he : [pack.domain_he || pack.pack_title_he];
    const clean = (text: string): string => text.trim().replace(/[.?!]+$/u, '');
    const about = (text: string): string => `על ${title}: ${clean(text)}.`;
    const falseFacts = [
      about(`אין צורך בעובדות כדי להבין את ${title}`),
      about(`כל טענה על ${title} נכונה גם כשהיא סותרת את הקלף`),
      about(`הקלף לא נותן שום פרט שעוזר להבין את ${title}`),
    ];

    return [
      this.makeQuestion(`מה נכון לפי הקלף על ${title}?`, about(facts[0]), falseFacts, facts[0]),
      this.makeQuestion(`איזו עובדה הופיעה על ${title}?`, about(facts[1] || facts[0]), falseFacts, facts[1] || facts[0]),
      this.makeQuestion(`איזה פרט מתאים לקלף ${title}?`, about(facts[2] || facts[0]), falseFacts, facts[2] || facts[0]),
      this.makeQuestion(`איזו מסקנה זהירה אפשר להסיק על ${title}?`, about(`העובדות עוזרות להבין את ${tags[0]}`), falseFacts, `הקלף מחבר בין ${title} לבין ${tags[0]}.`),
      this.makeQuestion(`מה צריך לזכור כשמסבירים את ${title}?`, about(facts[0]), falseFacts, facts[0]),
      this.makeQuestion(`איזה קשר כדאי לבדוק אחרי שלומדים את ${title}?`, `הקשר בין ${title} לבין ${tags[0]}.`, falseFacts, `כדאי להעמיק בקשר בין ${title} לבין ${tags[0]}.`),
      this.makeQuestion(`מה הופך תשובה על ${title} למדויקת?`, about('היא נשענת על עובדות הקלף ולא על ניחוש'), falseFacts, 'תשובה טובה נשענת על עובדות הקלף.'),
      this.makeQuestion(`מה חשוב לא לעשות כשעונים על ${title}?`, about(`לא להחליף את ${title} בנושא אחר`), falseFacts, 'התשובה צריכה להישאר באותו נושא.'),
      this.makeQuestion(`מה תהיה שאלת המשך טובה על ${title}?`, `איך ${title} קשור ל${tags[0]} לפי עובדות הקלף?`, falseFacts, `שאלת המשך טובה נשארת בנושא ${title}.`),
      this.makeQuestion(`מה סוג האתגר של ${title}?`, about('בוחן על עובדות הקלף עצמו'), falseFacts, 'המטרה היא ללמוד את הקלף ולא לנחש לפי קלפים אחרים.'),
    ].slice(0, needed);
  }

  private makeQuestion(prompt: string, correct: string, wrong: string[], note: string): RuntimeQuestion {
    const options = this.shuffle([correct, ...this.shuffle(wrong).slice(0, 2)]).map((text): AnswerOption => ({ text, correct: text === correct }));
    return { prompt, options, note };
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }
}
