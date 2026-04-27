-- Migration: 006_training_items_parallel_path.sql
-- Purpose: keep the existing boxing drill path intact while adding a parallel,
-- generic training-item path for strength and conditioning plus running.

create extension if not exists pgcrypto;

-- ─── workouts / workout_items additive metadata ─────────────────────────────
alter table workouts
  add column if not exists discipline text,
  add column if not exists updated_at timestamptz not null default now();

alter table workouts
  drop constraint if exists workouts_discipline_check;

alter table workouts
  add constraint workouts_discipline_check
    check (discipline in ('boxing', 'strength_conditioning', 'running', 'hybrid') or discipline is null);

create index if not exists workouts_discipline_idx on workouts (discipline);

alter table workout_items
  add column if not exists item_type text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table workout_items
  drop constraint if exists workout_items_item_type_check;

alter table workout_items
  add constraint workout_items_item_type_check
    check (
      item_type in ('warmup', 'skill', 'strength', 'conditioning', 'running', 'cooldown', 'recovery')
      or item_type is null
    );

create index if not exists workout_items_item_type_idx on workout_items (item_type);

-- ─── training_items ─────────────────────────────────────────────────────────
create table if not exists training_items (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  slug text not null unique,

  discipline text not null
    check (discipline in ('strength_conditioning', 'running')),
  item_type text not null
    check (item_type in ('exercise', 'interval')),
  category text,

  summary text not null,
  description text,

  instructions_json jsonb not null default '[]'::jsonb,
  coaching_cues_json jsonb not null default '[]'::jsonb,
  common_mistakes_json jsonb not null default '[]'::jsonb,
  equipment_tags text[] not null default '{}',

  difficulty text
    check (difficulty in ('beginner', 'intermediate', 'advanced') or difficulty is null),

  structure_json jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,
  is_curated boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_items_discipline_idx on training_items (discipline);
create index if not exists training_items_item_type_idx on training_items (item_type);
create index if not exists training_items_category_idx on training_items (category);
create index if not exists training_items_is_active_idx on training_items (is_active);

-- ─── workout_item_training_items ────────────────────────────────────────────
create table if not exists workout_item_training_items (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references workout_items(id) on delete cascade,
  training_item_id uuid not null references training_items(id) on delete cascade,
  order_index integer not null default 0,
  prescription_json jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_item_training_items_unique_order
    unique (workout_item_id, order_index, training_item_id)
);

create index if not exists workout_item_training_items_workout_item_idx
  on workout_item_training_items (workout_item_id, order_index);
create index if not exists workout_item_training_items_training_item_idx
  on workout_item_training_items (training_item_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table training_items enable row level security;
alter table workout_item_training_items enable row level security;

drop policy if exists "training_items_public_read" on training_items;
create policy "training_items_public_read"
  on training_items for select using (true);

drop policy if exists "workout_item_training_items_public_read" on workout_item_training_items;
create policy "workout_item_training_items_public_read"
  on workout_item_training_items for select using (true);

-- writes are expected through service role for now
