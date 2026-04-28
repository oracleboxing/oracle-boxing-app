-- Migration: 009_workouts_schema.sql
-- Purpose: Create clean workouts and workout_items tables to replace the stale
-- workout_templates structure, matching the Skool training companion direction.

begin;

-- ─── 1. Clean up stale unused tables ─────────────────────────────────────────
drop table if exists workout_sessions cascade;
drop table if exists workout_template_exercises cascade;
drop table if exists workout_item_exercises cascade;
drop table if exists workout_template_training_items cascade;
drop table if exists workout_item_training_items cascade;
drop table if exists workout_logs cascade;
drop table if exists workout_templates cascade;

-- ─── 2. workouts ─────────────────────────────────────────────────────────────
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  discipline text,
  difficulty text,
  estimated_duration_minutes integer,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workouts_discipline_check
    check (discipline in ('boxing', 'strength_conditioning', 'running', 'hybrid') or discipline is null)
);

create index if not exists workouts_discipline_idx on workouts (discipline);

-- ─── 3. workout_items ────────────────────────────────────────────────────────
-- Represents a structured block inside a workout (e.g., "Round 1", "Warmup Circuit")
create table if not exists workout_items (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  title text not null,
  item_type text,
  order_index integer not null default 0,
  notes text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_items_item_type_check
    check (item_type in ('warmup', 'skill', 'strength', 'conditioning', 'running', 'cooldown', 'recovery') or item_type is null)
);

create index if not exists workout_items_workout_id_idx on workout_items (workout_id);
create index if not exists workout_items_item_type_idx on workout_items (item_type);

-- ─── 4. workout_item components ──────────────────────────────────────────────
-- Links specific curated entities (moves, combinations, exercises) into a workout item block

create table if not exists workout_item_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references workout_items(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  order_index integer not null default 0,
  prescription_json jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_item_exercises_workout_item_id_idx on workout_item_exercises (workout_item_id);

create table if not exists workout_item_moves (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references workout_items(id) on delete cascade,
  move_id uuid not null references moves(id) on delete cascade,
  order_index integer not null default 0,
  prescription_json jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_item_moves_workout_item_id_idx on workout_item_moves (workout_item_id);

create table if not exists workout_item_combinations (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references workout_items(id) on delete cascade,
  combination_id uuid not null references combinations(id) on delete cascade,
  order_index integer not null default 0,
  prescription_json jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_item_combinations_workout_item_id_idx on workout_item_combinations (workout_item_id);

-- ─── 5. RLS Policies ─────────────────────────────────────────────────────────
alter table workouts enable row level security;
alter table workout_items enable row level security;
alter table workout_item_exercises enable row level security;
alter table workout_item_moves enable row level security;
alter table workout_item_combinations enable row level security;

create policy "workouts_public_read" on workouts for select using (true);
create policy "workout_items_public_read" on workout_items for select using (true);
create policy "workout_item_exercises_public_read" on workout_item_exercises for select using (true);
create policy "workout_item_moves_public_read" on workout_item_moves for select using (true);
create policy "workout_item_combinations_public_read" on workout_item_combinations for select using (true);

commit;
