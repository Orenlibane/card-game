import 'dotenv/config';
import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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
const stateFilePath = process.env.STATE_FILE_PATH;
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
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
const allowedOrigins = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://fact-collectors-web-production.up.railway.app',
  ...frontendOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigin === '*' || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('cors_origin_denied'));
  },
}));

const packsById = new Map(gameData.packs.map((pack) => [pack.pack_id, pack]));
const cardsById = new Map(gameData.packs.flatMap((pack) => pack.cards.map((card) => [card.card_id, { ...card, pack_id: pack.pack_id }])));
const rules = gameData.mvp_rules;

const createPlayerSchema = z.object({
  displayName: z.string().trim().min(1).max(32).optional(),
});

const openPackSchema = z.object({
  packId: z.string().trim().min(1),
});

const sellDuplicateSchema = z.object({
  cardId: z.string().trim().min(1).optional(),
  amount: z.number().int().positive().optional(),
  all: z.boolean().optional(),
});

const quizAttemptSchema = z.object({
  cardId: z.string().trim().min(1),
  score: z.number().int().min(0),
  total: z.number().int().positive(),
});

const memory = {
  profiles: new Map(),
  cards: new Map(),
  duplicateCards: new Map(),
  dailyDealPurchases: new Map(),
  openings: [],
  attempts: [],
};
const profileLocks = new Map();
const writeRateLimit = new Map();
let memorySaveQueue = Promise.resolve();

function persistenceMode() {
  if (supabase) return 'supabase';
  if (stateFilePath) return 'file';
  return 'memory';
}

async function loadMemoryState() {
  if (!stateFilePath || supabase) return;

  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const saved = JSON.parse(raw);
    memory.profiles = new Map((saved.profiles ?? []).map((profile) => [profile.id, profile]));
    memory.cards = new Map((saved.cards ?? []).map((card) => [cardKey(card.profile_id, card.card_id), card]));
    memory.duplicateCards = new Map((saved.duplicateCards ?? []).map((card) => [cardKey(card.profile_id, card.card_id), card]));
    memory.dailyDealPurchases = new Map((saved.dailyDealPurchases ?? []).map((purchase) => [dailyDealKey(purchase.profile_id, purchase.day_key), purchase]));
    memory.openings = saved.openings ?? [];
    memory.attempts = saved.attempts ?? [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await saveMemoryState();
      return;
    }
    throw error;
  }
}

async function saveMemoryState() {
  if (!stateFilePath || supabase) return;

  memorySaveQueue = memorySaveQueue.catch(() => {}).then(async () => {
    await mkdir(dirname(stateFilePath), { recursive: true });
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      profiles: [...memory.profiles.values()],
      cards: [...memory.cards.values()],
      duplicateCards: [...memory.duplicateCards.values()],
      dailyDealPurchases: [...memory.dailyDealPurchases.values()],
      openings: memory.openings,
      attempts: memory.attempts,
    };
    const temporaryPath = `${stateFilePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(payload), 'utf8');
    await rename(temporaryPath, stateFilePath);
  });

  return memorySaveQueue;
}

async function withProfileLock(profileId, action) {
  const previous = profileLocks.get(profileId) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => {}).then(() => current);
  profileLocks.set(profileId, queued);

  await previous.catch(() => {});
  try {
    return await action();
  } finally {
    release();
    if (profileLocks.get(profileId) === queued) profileLocks.delete(profileId);
  }
}

function cardKey(profileId, cardId) {
  return `${profileId}:${cardId}`;
}

function dailyDealKey(profileId, dayKey) {
  return `${profileId}:${dayKey}`;
}

function dailyDeal() {
  const packs = gameData.packs;
  if (!packs.length) return null;
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const pack = packs[seed % packs.length];
  return {
    packId: pack.pack_id,
    price: 10,
    regularPrice: rules.pack_cost,
    dayKey,
  };
}

async function dailyDealForProfile(profileId) {
  const deal = dailyDeal();
  if (!deal || !profileId) return deal;
  const used = await getDailyDealPurchase(profileId, deal.dayKey);
  return {
    ...deal,
    used: Boolean(used),
    available: !used,
  };
}

async function costForPack(profileId, packId) {
  const deal = await dailyDealForProfile(profileId);
  return deal?.packId === packId && deal.available ? deal.price : rules.pack_cost;
}

async function getDailyDealPurchase(profileId, dayKey) {
  if (!supabase) return memory.dailyDealPurchases.get(dailyDealKey(profileId, dayKey)) ?? null;

  const { data, error } = await supabase
    .from('daily_deal_purchases')
    .select('*')
    .eq('profile_id', profileId)
    .eq('day_key', dayKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markDailyDealPurchased(profileId, deal, openingId = null) {
  if (!deal?.available) return;

  if (!supabase) {
    const purchase = {
      profile_id: profileId,
      day_key: deal.dayKey,
      pack_id: deal.packId,
      price: deal.price,
      opening_id: openingId,
      created_at: new Date().toISOString(),
    };
    memory.dailyDealPurchases.set(dailyDealKey(profileId, deal.dayKey), purchase);
    await saveMemoryState();
    return;
  }

  const { error } = await supabase
    .from('daily_deal_purchases')
    .upsert({
      profile_id: profileId,
      day_key: deal.dayKey,
      pack_id: deal.packId,
      price: deal.price,
      opening_id: openingId,
    }, { onConflict: 'profile_id,day_key' });
  if (error) throw error;
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

function quizRewardCoins() {
  return Math.min(rules.quiz_reward_brain_coins, Math.max(1, rules.pack_cost - 1));
}

function writeLimiter(req, res, next) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 90;
  const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const entry = writeRateLimit.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  writeRateLimit.set(key, entry);
  if (entry.count > maxRequests) {
    return res.status(429).json({ error: 'rate_limited', retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) });
  }
  return next();
}

async function createProfile(displayName = 'שחקן') {
  if (!supabase) {
    const id = crypto.randomUUID();
    const profile = { id, display_name: displayName, coins: rules.starter_coins, created_at: new Date().toISOString() };
    memory.profiles.set(id, profile);
    await saveMemoryState();
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
    await saveMemoryState();
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

async function getPlayerDuplicateCards(profileId) {
  if (!supabase) {
    return [...memory.duplicateCards.values()].filter((card) => card.profile_id === profileId && card.quantity > 0);
  }

  const { data, error } = await supabase
    .from('player_duplicate_cards')
    .select('*')
    .eq('profile_id', profileId)
    .gt('quantity', 0);

  if (error) throw error;
  return data ?? [];
}

async function setDuplicateQuantity(profileId, cardId, packId, quantity) {
  const key = cardKey(profileId, cardId);
  if (!supabase) {
    if (quantity > 0) {
      const existing = memory.duplicateCards.get(key) ?? {};
      memory.duplicateCards.set(key, {
        ...existing,
        profile_id: profileId,
        card_id: cardId,
        pack_id: packId,
        quantity,
        created_at: existing.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      memory.duplicateCards.delete(key);
    }
    await saveMemoryState();
    return;
  }

  if (quantity > 0) {
    const { error } = await supabase
      .from('player_duplicate_cards')
      .upsert({ profile_id: profileId, card_id: cardId, pack_id: packId, quantity }, { onConflict: 'profile_id,card_id' });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('player_duplicate_cards')
    .delete()
    .eq('profile_id', profileId)
    .eq('card_id', cardId);
  if (error) throw error;
}

async function addDuplicateCards(profileId, cardIds) {
  if (!cardIds.length) return;
  const existingRows = await getPlayerDuplicateCards(profileId);
  const byCard = new Map(existingRows.map((row) => [row.card_id, row]));
  const counts = new Map();
  for (const cardId of cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);

  for (const [cardId, count] of counts) {
    const catalogCard = cardsById.get(cardId);
    if (!catalogCard) continue;
    const existing = byCard.get(cardId);
    await setDuplicateQuantity(profileId, cardId, catalogCard.pack_id, (existing?.quantity ?? 0) + count);
  }
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
    await saveMemoryState();
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
    await saveMemoryState();
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
    await saveMemoryState();
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

async function buildPlayerState(profile, cards) {
  const byPack = Object.fromEntries(gameData.packs.map((pack) => [pack.pack_id, { discovered: [], owned: [] }]));
  const cooldownUntil = {};
  const duplicateInventory = {};

  for (const card of cards) {
    if (!byPack[card.pack_id]) byPack[card.pack_id] = { discovered: [], owned: [] };
    if (card.discovered) byPack[card.pack_id].discovered.push(card.card_id);
    if (card.owned) byPack[card.pack_id].owned.push(card.card_id);
    if (card.cooldown_until) cooldownUntil[card.card_id] = card.cooldown_until;
  }

  for (const duplicate of await getPlayerDuplicateCards(profile.id)) {
    duplicateInventory[duplicate.card_id] = duplicate.quantity;
  }

  return {
    player: {
      id: profile.id,
      displayName: profile.display_name,
      coins: profile.coins,
    },
    packs: byPack,
    cooldownUntil,
    duplicateInventory,
    dailyDeal: await dailyDealForProfile(profile.id),
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
    persistence: {
      mode: persistenceMode(),
      durable: Boolean(supabase || stateFilePath),
    },
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

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    catalog: gameData,
    dailyDeal: dailyDeal(),
    supabaseConfigured,
    persistence: {
      mode: persistenceMode(),
      durable: Boolean(supabase || stateFilePath),
    },
  });
});

app.post('/api/players', writeLimiter, asyncRoute(async (req, res) => {
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
  res.json(await buildPlayerState(profile, cards));
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

app.post('/api/players/:playerId/open-pack', writeLimiter, asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const input = openPackSchema.parse(req.body ?? {});
  const pack = packsById.get(input.packId);
  if (!pack) return res.status(404).json({ error: 'pack_not_found' });

  await withProfileLock(profile.id, async () => {
    const lockedProfile = await getProfile(profile.id);
    if (!lockedProfile) return res.status(404).json({ error: 'player_not_found' });

    const deal = await dailyDealForProfile(lockedProfile.id);
    const usesDailyDeal = deal?.packId === pack.pack_id && deal.available;
    const packCost = usesDailyDeal ? deal.price : rules.pack_cost;
    if (lockedProfile.coins < packCost) {
      return res.status(409).json({ error: 'not_enough_coins', coins: lockedProfile.coins, cost: packCost });
    }

    const existingCards = await getPlayerCards(lockedProfile.id);
    const discovered = new Set(existingCards.filter((card) => card.discovered).map((card) => card.card_id));
    const existingByCard = new Map(existingCards.map((card) => [card.card_id, card]));
    const drawn = shuffle(pack.cards).slice(0, Math.min(rules.pack_size, pack.cards.length));
    const openedCards = drawn.map((card) => ({
      cardId: card.card_id,
      duplicate: discovered.has(card.card_id),
    }));

    const duplicateCount = openedCards.filter((card) => card.duplicate).length;
    const duplicateCoins = duplicateCount * rules.duplicate_reward_coins;
    const nextCoins = lockedProfile.coins - packCost;

    await upsertPlayerCards(drawn.map((card) => {
      const existing = existingByCard.get(card.card_id);
      return {
        profile_id: lockedProfile.id,
        card_id: card.card_id,
        pack_id: pack.pack_id,
        discovered: true,
        owned: existing?.owned ?? false,
        cooldown_until: existing?.cooldown_until ?? null,
      };
    }));
    await addDuplicateCards(lockedProfile.id, openedCards.filter((card) => card.duplicate).map((card) => card.cardId));

    const updatedProfile = await updateProfileCoins(lockedProfile.id, nextCoins);
    const opening = await insertOpening({
      profile_id: lockedProfile.id,
      pack_id: pack.pack_id,
      opened_cards: openedCards,
      duplicate_count: duplicateCount,
      duplicate_coins: duplicateCoins,
    });
    if (usesDailyDeal) await markDailyDealPurchased(lockedProfile.id, deal, opening.id);
    const nextCards = await getPlayerCards(lockedProfile.id);

    res.json({
      opening: {
        id: opening.id,
        packId: pack.pack_id,
        cost: packCost,
        cards: openedCards.map((opened) => publicCard(cardsById.get(opened.cardId), { duplicate: opened.duplicate })),
        duplicateCount,
        duplicateCoins,
      },
      state: await buildPlayerState(updatedProfile, nextCards),
    });
  });
}));

app.post('/api/players/:playerId/sell-duplicates', writeLimiter, asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const input = sellDuplicateSchema.parse(req.body ?? {});

  await withProfileLock(profile.id, async () => {
    const lockedProfile = await getProfile(profile.id);
    if (!lockedProfile) return res.status(404).json({ error: 'player_not_found' });

    const duplicates = await getPlayerDuplicateCards(lockedProfile.id);
    const rows = input.all
      ? duplicates
      : duplicates.filter((row) => row.card_id === input.cardId).slice(0, 1);

    if (!rows.length) return res.status(409).json({ error: 'no_duplicates_to_sell' });

    let soldCount = 0;
    for (const row of rows) {
      const amount = input.all ? row.quantity : Math.min(input.amount ?? 1, row.quantity);
      if (amount <= 0) continue;
      soldCount += amount;
      await setDuplicateQuantity(lockedProfile.id, row.card_id, row.pack_id, row.quantity - amount);
    }

    if (!soldCount) return res.status(409).json({ error: 'no_duplicates_to_sell' });

    const rewardCoins = soldCount * rules.duplicate_reward_coins;
    const updatedProfile = await updateProfileCoins(lockedProfile.id, lockedProfile.coins + rewardCoins);
    const nextCards = await getPlayerCards(lockedProfile.id);

    res.json({
      soldCount,
      rewardCoins,
      state: await buildPlayerState(updatedProfile, nextCards),
    });
  });
}));

app.post('/api/players/:playerId/quiz-attempts', writeLimiter, asyncRoute(async (req, res) => {
  const profile = await requireProfile(req, res);
  if (!profile) return;

  const input = quizAttemptSchema.parse(req.body ?? {});
  const catalogCard = cardsById.get(input.cardId);
  if (!catalogCard) return res.status(404).json({ error: 'card_not_found' });

  await withProfileLock(profile.id, async () => {
    const lockedProfile = await getProfile(profile.id);
    if (!lockedProfile) return res.status(404).json({ error: 'player_not_found' });

    const playerCards = await getPlayerCards(lockedProfile.id);
    const playerCard = playerCards.find((card) => card.card_id === input.cardId);
    if (!playerCard?.discovered) return res.status(409).json({ error: 'card_not_discovered' });

    const passed = input.score >= rules.pass_score;
    const cooldownUntil = passed ? null : addHours(new Date(), rules.retry_cooldown_hours);
    const rewardCoins = passed && !playerCard.owned ? quizRewardCoins() : 0;
    const nextCoins = lockedProfile.coins + rewardCoins;

    await upsertPlayerCards([{
      profile_id: lockedProfile.id,
      card_id: input.cardId,
      pack_id: catalogCard.pack_id,
      discovered: true,
      owned: passed || playerCard.owned,
      cooldown_until: cooldownUntil,
    }]);

    const updatedProfile = await updateProfileCoins(lockedProfile.id, nextCoins);
    const attempt = await insertQuizAttempt({
      profile_id: lockedProfile.id,
      card_id: input.cardId,
      pack_id: catalogCard.pack_id,
      score: input.score,
      total: input.total,
      passed,
    });
    const nextCards = await getPlayerCards(lockedProfile.id);

    res.status(201).json({
      attempt: {
        id: attempt.id,
        passed,
        score: input.score,
        total: input.total,
        rewardCoins,
        cooldownUntil,
      },
      state: await buildPlayerState(updatedProfile, nextCards),
    });
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

await loadMemoryState();

app.listen(port, () => {
  console.log(`Fact Collectors backend listening on :${port}`);
  console.log(`Supabase configured: ${supabaseConfigured ? 'yes' : 'no - using in-memory fallback'}`);
  console.log(`Persistence mode: ${persistenceMode()}`);
});
