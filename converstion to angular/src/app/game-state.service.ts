import { Injectable, computed, signal } from '@angular/core';
import { AnswerOption, AppView, CardData, CardStatus, GameData, GameStoreState, PackData, RuntimeQuestion } from './models';

const STORAGE_KEY = 'factCollectorsAngularLocalStateV2';

@Injectable({ providedIn: 'root' })
export class GameStateService {
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

  init(data: GameData): void {
    this.data.set(data);
    const saved = this.readSavedState();
    const firstPack = data.packs[0];
    const firstCard = firstPack?.cards[0];
    this.state.set({
      view: saved?.view ?? 'pack',
      selectedPackId: saved?.selectedPackId || firstPack?.pack_id || '',
      selectedCardId: saved?.selectedCardId || firstCard?.card_id || '',
      coins: typeof saved?.coins === 'number' ? saved.coins : data.mvp_rules.starter_coins,
      discovered: saved?.discovered ?? {},
      owned: saved?.owned ?? {},
      cooldownUntil: saved?.cooldownUntil ?? {},
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

  openPack(): void {
    const state = this.state();
    const pack = this.selectedPack();
    const rules = this.rules();
    if (!state || !pack || !rules) return;

    if (state.coins < rules.pack_cost) {
      this.notify('אין מספיק מטבעות מוח לפתיחת החבילה.');
      return;
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

    this.patch({
      coins: state.coins - rules.pack_cost + duplicateCoins,
      discovered,
      selectedCardId: firstNewCard,
      lastPackOpen: {
        packId: pack.pack_id,
        openedAt: Date.now(),
        cards: openedCards,
        duplicateCoins,
      },
      view: 'album',
      quiz: null,
    });
    const newCount = openedCards.length - duplicateCount;
    const newText = newCount === 1 ? 'חדש אחד' : `${newCount} חדשים`;
    const duplicateText = duplicateCount === 1 ? 'כפול אחד' : `${duplicateCount} כפולים`;
    this.notify(`נפתחו ${openedCards.length} קלפים: ${newText}, ${duplicateText} (+${duplicateCoins}★).`);
  }

  startQuiz(): void {
    const card = this.selectedCard();
    const pack = this.selectedPack();
    if (!card || !pack) return;
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

  nextQuestion(): void {
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
    const owned = { ...current.owned };
    const cooldownUntil = { ...current.cooldownUntil };
    let coins = current.coins;

    if (passed) {
      owned[quiz.cardId] = true;
      delete cooldownUntil[quiz.cardId];
      coins += rules.quiz_reward_brain_coins;
    } else {
      cooldownUntil[quiz.cardId] = Date.now() + rules.retry_cooldown_hours * 60 * 60 * 1000;
    }

    this.patch({ owned, cooldownUntil, coins, quiz: null, view: 'album' });
    this.notify(passed ? 'מעולה! הקלף נכנס לאוסף שלך.' : 'לא עברת 80%. אפשר לנסות שוב מחר.');
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
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

  private cardById(cardId: string): CardData | null {
    return this.packs().flatMap((pack) => pack.cards).find((card) => card.card_id === cardId) ?? null;
  }

  private packForCard(cardId: string): PackData | null {
    return this.packs().find((pack) => pack.cards.some((card) => card.card_id === cardId)) ?? null;
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

    const facts = card.facts_he.length ? card.facts_he : ['זהו קלף מתוך אוספים עובדות.'];
    const falseFacts = ['העובדה הזו לא מופיעה בקלף.', 'זהו נושא מחבילה אחרת.', 'אי אפשר להסיק את זה מהקלף.'];
    const wrongTitles = pack.cards.filter((item) => item.card_id !== card.card_id).map((item) => item.title_he);

    return [
      this.makeQuestion('איזה קלף בחרת מהחבילה?', card.title_he, wrongTitles, 'זיהית את הקלף שנבחר.'),
      this.makeQuestion(`מה נכון לגבי ${card.title_he}?`, facts[0], falseFacts, facts[0]),
      this.makeQuestion(`איזו עובדה הופיעה על ${card.title_he}?`, facts[1] || facts[0], falseFacts, facts[1] || facts[0]),
      this.makeQuestion(`איזה פרט מתאים לקלף ${card.title_he}?`, facts[2] || facts[0], falseFacts, facts[2] || facts[0]),
      this.makeQuestion(`לאיזו חבילה שייך ${card.title_he}?`, pack.pack_title_he, this.packs().filter((item) => item.pack_id !== pack.pack_id).map((item) => item.pack_title_he), `הקלף שייך לחבילת ${pack.pack_title_he}.`),
      this.makeQuestion('כמה שאלות יש בבוחן של כל קלף?', '10 שאלות', ['3 שאלות', 'שאלה אחת', '20 שאלות'], 'כל קלף עומד בפני עצמו עם בוחן של 10 שאלות.'),
      this.makeQuestion('כמה תשובות נכונות צריך כדי לקבל את הקלף?', 'לפחות 8 מתוך 10', ['לפחות 5 מתוך 10', 'מספיק לענות על שאלה אחת'], '80% הצלחה פותחת בעלות על הקלף.'),
      this.makeQuestion('מה קורה אם לא מגיעים ל-80%?', 'אפשר לנסות שוב מחר', ['הקלף נעלם לתמיד', 'מקבלים אותו בכל מקרה'], 'כישלון לא מוחק את הקלף. הוא מחכה לניסיון נוסף מחר.'),
      this.makeQuestion(`מה צריך לזכור מהקלף ${card.title_he}?`, facts[0], falseFacts, facts[0]),
      this.makeQuestion(`מה סוג האתגר של ${card.title_he}?`, 'בוחן על עובדות הקלף', ['משחק מזל בלבד', 'קרב בין קלפים'], 'המטרה היא ללמוד ולאסוף.'),
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
