export type AppView = 'pack' | 'album' | 'quiz' | 'shop';

export interface MvpRules {
  pack_size: number;
  quiz_questions_per_card: number;
  pass_score: number;
  retry_cooldown_hours: number;
  starter_coins: number;
  pack_cost: number;
  duplicate_reward_coins: number;
  quiz_reward_brain_coins: number;
}

export interface CardQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

export interface CardData {
  card_id: string;
  index: number;
  title_he: string;
  asset_path: string;
  facts_he: string[];
  tags_he: string[];
  rarity: string;
  mvp_questions?: CardQuestion[];
}

export interface PackData {
  pack_id: string;
  pack_title_he: string;
  domain_he: string;
  age_group_he: string;
  pack_asset_path: string;
  card_count: number;
  cards: CardData[];
}

export interface GameData {
  schema_version: number;
  product_name_he: string;
  language: string;
  text_direction: string;
  season: number;
  mvp_rules: MvpRules;
  packs: PackData[];
  excluded_packs: unknown[];
}

export interface AnswerOption {
  text: string;
  correct: boolean;
}

export interface RuntimeQuestion {
  prompt: string;
  options: AnswerOption[];
  note: string;
}

export interface QuizState {
  cardId: string;
  questions: RuntimeQuestion[];
  index: number;
  score: number;
  answered: boolean;
  selectedOptionIndex: number | null;
}

export interface GameStoreState {
  view: AppView;
  selectedPackId: string;
  selectedCardId: string;
  coins: number;
  discovered: Record<string, string[]>;
  owned: Record<string, boolean>;
  cooldownUntil: Record<string, number>;
  lastPackOpen: PackOpenResult | null;
  quiz: QuizState | null;
}

export interface CardStatus {
  text: string;
  className: 'owned' | 'cooldown' | 'candidate' | 'locked';
}

export interface PackOpenResult {
  packId: string;
  openedAt: number;
  cards: Array<{
    cardId: string;
    duplicate: boolean;
  }>;
  duplicateCoins: number;
}
