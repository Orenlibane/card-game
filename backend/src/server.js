import 'dotenv/config';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameDataCandidates = [
  process.env.CATALOG_PATH,
  resolve(__dirname, '../data/game-data.json'),
  resolve(__dirname, '../../assets/season-1/game-data.json'),
].filter(Boolean);

async function loadGameData() {
  const errors = [];
  for (const path of gameDataCandidates) {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      errors.push(`${path}: ${error.code ?? error.message}`);
    }
  }

  throw new Error(`Could not load game catalog. Tried: ${errors.join(', ')}`);
}

const gameData = await loadGameData();

const port = Number(process.env.PORT || 8080);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceRoleKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseServiceRoleKey.includes('your-service-role')
);

const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: frontendOrigin === '*' ? true : frontendOrigin }));

const packsById = new Map(gameData.packs.map((pack) => [pack.pack_id, pack]));
const cardsById = new Map(gameData.packs.flatMap((pack) => pack.cards.map((card) => [card.card_id, { ...card, pack_id: pack.pack_id }])));
const rules = gameData.mvp_rules;

const createPlayerSchema = z.object({
  displayName: z.string().trim().min(1).max(32).optional(),
});

const openPackSchema = z.object({
  packId: z.string().trim().min(1),
});

const quizAttemptSchema = z.object({
  cardId: z.string().trim().min(1),
  score: z.number().int().min(0),
  total: z.number().int().positive(),
});

const memory = {
  profiles: new Map(),
  cards: new Map(),
  openings: [],
  attempts: [],
};

function cardKey(profileId, cardId) {
  return `${profileId}:${cardId}`;
}

function publicCard(card, extra = {}) {
  return {
    cardId: card.card_id,
    packId: card.pack_id,
    title: card.title_he,
    assetPath: card.asset_path,
    rarity: card.rarity,
    ...extra,
  };
}

function shuffle(items) {
  return [...items].sort(() => crypto.randomInt(0, 1_000_000) - 500_000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function createProfile(displayName = 'שחקן') {
  if (!supabase) {
    const id = crypto.randomUUID();
    const profile = { id, display_name: displayName, coins: rules.starter_coins, created_at: new Date().toISOString() };
    memory.profiles.set(id, profile);
    return profile;
  }

  const { data, error } = await supabase
    .from('player_profiles')
    .insert({ display_name: displayName, coins: rules.starter_coins })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getProfile(profileId) {
  if (!supabase) return memory.profiles.get(profileId) ?? null;

  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateProfileCoins(profileId, coins) {
  if (!supabase) {
    const profile = memory.profiles.get(profileId);
    if (!profile) return null;
    profile.coins = coins;
    profile.updated_at = new Date().toISOString();
    return profile;
  }

  const { data, error } = await supabase
    .from('player_profiles')
    .update({ coins })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getPlayerCards(profileId) {
  if (!supabase) {
    return [...memory.cards.values()].filter((card) => card.profile_id === profileId);
  }

  const { data, error } = await supabase
    .from('player_cards')
    .select('*')
    .eq('profile_id', profileId);

  if (error) throw error;
  return data ?? [];
}

async function upsertPlayerCards(rows) {
  if (!rows.length) return [];

  if (!supabase) {
    for (const row of rows) {
      const key = cardKey(row.profile_id, row.card_id);
      const existing = memory.cards.get(key) ?? {};
      memory.cards.set(key, {
        ...existing,
        ...row,
        created_at: existing.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return rows;
  }

  const { data, error } = await supabase
    .from('player_cards')
    .upsert(rows, { onConflict: 'profile_id,card_id' })
    .select('*');

  if (error) throw error;
  return data ?? [];
}

async function insertOpening(row) {
  if (!supabase) {
    const opening = { id: crypto.randomUUID(), ...row, created_at: new Date().toISOString() };
    memory.openings.push(opening);
    return opening;
  }

  const { data, error } = await supabase
    .from('pack_openings')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function insertQuizAttempt(row) {
  if (!supabase) {
    const attempt = { id: crypto.randomUUID(), ...row, created_at: new Date().toISOString() };
    memory.attempts.push(attempt);
    return attempt;
  }

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

function buildPlayerState(profile, cards) {
  const byPack = Object.fromEntries(gameData.packs.map((pack) => [pack.pack_id, { discovered: [], owned: [] }]));
  const cooldownUntil = {};

  for (const card of cards) {
    if (!byPack[card.pack_id]) byPack[card.pack_id] = { discovered: [], owned: [] };
    if (card.discovered) byPack[card.pack_id].discovered.push(card.card_id);
    if (card.owned) byPack[card.pack_id].owned.push(card.card_id);
    if (card.cooldown_until) cooldownUntil[card.card_id] = card.cooldown_until;
  }

  return {
    player: {
      id: profile.id,
      displayName: profile.display_name,
      coins: profile.coins,
    },
    packs: byPack,
    cooldownUntil,
  };
}

async function requireProfile(req, res) {
  const profile = await getProfile(req.params.playerId);
  if (!profile) {
    res.status(404).json({ error: 'player_not_found' });
    return null;
  }
  return profile;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/health', (_req, res) => {
  const fullQuestionCards = gameData.packs.reduce(
    (sum, pack) => sum + pack.cards.filter((card) => (card.mvp_questions ?? []).length === rules.quiz_questions_per_card).length,
    0
  );

  res.json({
    ok: true,
    service: 'fact-collectors-backend',
    supabaseConfigured,
    catalog: {
      packs: gameData.packs.length,
      cards: gameData.packs.reduce((sum, pack) => sum + pack.cards.length, 0),
      fullQuestionCards,
    },
  });
});

app.get('/api/catalog', (_req, res) => {
  res.json(gameData);
});

app.post('/api/players', asyncRoute(async (req, res) => {
  const input = createPlayerSchema.parse(req.body ?? {});
  const profile = await createProfile(input.displayName || 'שחקן');
  res.status(201).json({
    player: {
      id: profile.id,
      displayName: profile.display_name,
      coins: profile.coins,
    },
    supabaseConfigured,
  });
}));

app.get('/api/players/:playerId/state', asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const cards = await getPlayerCards(profile.id);
  res.json(buildPlayerState(profile, cards));
}));

app.get('/api/players/:playerId/cards', asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const cards = await getPlayerCards(profile.id);
  const packId = typeof req.query.packId === 'string' ? req.query.packId : null;
  const filtered = packId ? cards.filter((card) => card.pack_id === packId) : cards;

  res.json({
    cards: filtered.map((card) => {
      const catalogCard = cardsById.get(card.card_id);
      return publicCard(catalogCard ?? { card_id: card.card_id, pack_id: card.pack_id, title_he: card.card_id, asset_path: '', rarity: 'common' }, {
        discovered: card.discovered,
        owned: card.owned,
        cooldownUntil: card.cooldown_until,
      });
    }),
  });
}));

app.post('/api/players/:playerId/open-pack', asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const input = openPackSchema.parse(req.body ?? {});
  const pack = packsById.get(input.packId);
  if (!pack) return res.status(404).json({ error: 'pack_not_found' });
  if (profile.coins < rules.pack_cost) return res.status(409).json({ error: 'not_enough_coins', coins: profile.coins });

  const existingCards = await getPlayerCards(profile.id);
  const discovered = new Set(existingCards.filter((card) => card.discovered).map((card) => card.card_id));
  const existingByCard = new Map(existingCards.map((card) => [card.card_id, card]));
  const drawn = shuffle(pack.cards).slice(0, Math.min(rules.pack_size, pack.cards.length));
  const openedCards = drawn.map((card) => ({
    cardId: card.card_id,
    duplicate: discovered.has(card.card_id),
  }));

  const duplicateCount = openedCards.filter((card) => card.duplicate).length;
  const duplicateCoins = duplicateCount * rules.duplicate_reward_coins;
  const nextCoins = profile.coins - rules.pack_cost + duplicateCoins;

  await upsertPlayerCards(drawn.map((card) => {
    const existing = existingByCard.get(card.card_id);
    return {
      profile_id: profile.id,
      card_id: card.card_id,
      pack_id: pack.pack_id,
      discovered: true,
      owned: existing?.owned ?? false,
      cooldown_until: existing?.cooldown_until ?? null,
    };
  }));

  const updatedProfile = await updateProfileCoins(profile.id, nextCoins);
  const opening = await insertOpening({
    profile_id: profile.id,
    pack_id: pack.pack_id,
    opened_cards: openedCards,
    duplicate_count: duplicateCount,
    duplicate_coins: duplicateCoins,
  });
  const nextCards = await getPlayerCards(profile.id);

  res.json({
    opening: {
      id: opening.id,
      packId: pack.pack_id,
      cards: openedCards.map((opened) => publicCard(cardsById.get(opened.cardId), { duplicate: opened.duplicate })),
      duplicateCount,
      duplicateCoins,
    },
    state: buildPlayerState(updatedProfile, nextCards),
  });
}));

app.post('/api/players/:playerId/quiz-attempts', asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const input = quizAttemptSchema.parse(req.body ?? {});
  const catalogCard = cardsById.get(input.cardId);
  if (!catalogCard) return res.status(404).json({ error: 'card_not_found' });

  const playerCards = await getPlayerCards(profile.id);
  const playerCard = playerCards.find((card) => card.card_id === input.cardId);
  if (!playerCard?.discovered) return res.status(409).json({ error: 'card_not_discovered' });

  const passed = input.score >= rules.pass_score;
  const cooldownUntil = passed ? null : addHours(new Date(), rules.retry_cooldown_hours);
  const nextCoins = passed && !playerCard.owned ? profile.coins + rules.quiz_reward_brain_coins : profile.coins;

  await upsertPlayerCards([{
    profile_id: profile.id,
    card_id: input.cardId,
    pack_id: catalogCard.pack_id,
    discovered: true,
    owned: passed || playerCard.owned,
    cooldown_until: cooldownUntil,
  }]);

  const updatedProfile = await updateProfileCoins(profile.id, nextCoins);
  const attempt = await insertQuizAttempt({
    profile_id: profile.id,
    card_id: input.cardId,
    pack_id: catalogCard.pack_id,
    score: input.score,
    total: input.total,
    passed,
  });
  const nextCards = await getPlayerCards(profile.id);

  res.status(201).json({
    attempt: {
      id: attempt.id,
      passed,
      score: input.score,
      total: input.total,
      rewardCoins: passed && !playerCard.owned ? rules.quiz_reward_brain_coins : 0,
      cooldownUntil,
    },
    state: buildPlayerState(updatedProfile, nextCards),
  });
}));

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'validation_error', details: error.issues });
  }

  console.error(error);
  res.status(500).json({
    error: 'internal_server_error',
    message: process.env.NODE_ENV === 'production' ? undefined : error.message,
  });
});

app.listen(port, () => {
  console.log(`Fact Collectors backend listening on :${port}`);
  console.log(`Supabase configured: ${supabaseConfigured ? 'yes' : 'no - using in-memory fallback'}`);
});
