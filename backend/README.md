# Fact Collectors Backend

Node/Express backend scaffold for the `אוספים עובדות` MVP.

## What It Owns

- Player profile and coin balance
- Pack opening economy: 3 cards per pack, 20 coin base cost, one daily 10 coin deal
- Duplicate inventory and explicit duplicate selling at 5 coins per duplicate
- Discovered/owned cards per player
- Quiz attempt results, pass/fail, ownership reward, retry cooldown
- Catalog serving from the existing local `assets/season-1/game-data.json`

## Local Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Without Supabase env vars the service runs with an in-memory fallback so endpoints can be tested locally.

For a durable fallback without Supabase, set `STATE_FILE_PATH` to a writable persistent path:

```bash
STATE_FILE_PATH=/data/fact-collectors-state.json
```

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `backend/supabase/schema.sql`.
4. Copy your project URL and service role/secret key into backend environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

The service role key is server-only. Do not place it in Angular or any browser bundle.

## API

- `GET /health`
- `GET /api/catalog`
- `POST /api/players`
- `GET /api/players/:playerId/state`
- `GET /api/players/:playerId/cards?packId=animals`
- `POST /api/players/:playerId/open-pack`
- `POST /api/players/:playerId/sell-duplicates`
- `POST /api/players/:playerId/quiz-attempts`

## Railway

This folder has `railway.json` with:

- Node/Railpack build
- `npm start`
- `/health` healthcheck

Deploy this folder as the Railway service root or run:

```bash
railway up --path backend --path-as-root
```

Required Railway variables:

```bash
NODE_ENV=production
FRONTEND_ORIGIN=https://your-frontend-domain
STATE_FILE_PATH=/data/fact-collectors-state.json
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

If Supabase is not configured, mount a Railway Volume at `/data` so `STATE_FILE_PATH` survives deploys and restarts.
