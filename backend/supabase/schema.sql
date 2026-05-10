create extension if not exists "pgcrypto";

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'שחקן',
  coins integer not null default 120 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_cards (
  profile_id uuid not null references public.player_profiles(id) on delete cascade,
  card_id text not null,
  pack_id text not null,
  discovered boolean not null default true,
  owned boolean not null default false,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, card_id)
);

create table if not exists public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles(id) on delete cascade,
  pack_id text not null,
  opened_cards jsonb not null default '[]'::jsonb,
  duplicate_count integer not null default 0,
  duplicate_coins integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles(id) on delete cascade,
  card_id text not null,
  pack_id text not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  passed boolean not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_player_profiles_updated_at on public.player_profiles;
create trigger set_player_profiles_updated_at
before update on public.player_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_player_cards_updated_at on public.player_cards;
create trigger set_player_cards_updated_at
before update on public.player_cards
for each row execute function public.set_updated_at();

alter table public.player_profiles enable row level security;
alter table public.player_cards enable row level security;
alter table public.pack_openings enable row level security;
alter table public.quiz_attempts enable row level security;

-- The MVP backend uses a Supabase service role key, which bypasses RLS.
-- Do not add public browser policies until real Supabase Auth is introduced.
