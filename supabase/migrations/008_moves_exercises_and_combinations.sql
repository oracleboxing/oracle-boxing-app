-- Migration: 008_moves_exercises_and_combinations.sql
-- Purpose: rename canonical `drills` to `moves`, rename `training_items` to
-- `exercises`, and add structured combinations made from ordered moves.

begin;

-- ─── Rename canonical movement tables ───────────────────────────────────────
alter table if exists drills rename to moves;
alter table if exists training_items rename to exercises;
alter table if exists workout_template_training_items rename to workout_template_exercises;
alter table if exists workout_item_training_items rename to workout_item_exercises;

-- Rename columns where PostgreSQL lacks IF EXISTS for RENAME COLUMN.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'raw_drill_candidates'
      and column_name = 'canonical_drill_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'raw_drill_candidates'
      and column_name = 'canonical_move_id'
  ) then
    alter table raw_drill_candidates rename column canonical_drill_id to canonical_move_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'raw_drill_candidates'
      and column_name = 'ai_proposed_canonical_drill_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'raw_drill_candidates'
      and column_name = 'ai_proposed_canonical_move_id'
  ) then
    alter table raw_drill_candidates rename column ai_proposed_canonical_drill_id to ai_proposed_canonical_move_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_template_exercises'
      and column_name = 'training_item_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_template_exercises'
      and column_name = 'exercise_id'
  ) then
    alter table workout_template_exercises rename column training_item_id to exercise_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_item_exercises'
      and column_name = 'training_item_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_item_exercises'
      and column_name = 'exercise_id'
  ) then
    alter table workout_item_exercises rename column training_item_id to exercise_id;
  end if;
end $$;

-- ─── Keep category constraints current after rename ─────────────────────────
alter table if exists moves
  drop constraint if exists drills_category_check;

alter table if exists moves
  drop constraint if exists moves_category_check;

alter table if exists moves
  add constraint moves_category_check
    check (
      category in ('stance', 'punching', 'footwork', 'defence', 'combination', 'warmup', 'feint')
      or category is null
    );

-- ─── combinations ───────────────────────────────────────────────────────────
create table if not exists combinations (
  id uuid primary key default gen_random_uuid(),

  title text not null unique,
  slug text not null unique,

  summary text,
  description text,

  difficulty text
    check (difficulty in ('beginner', 'intermediate', 'advanced') or difficulty is null),

  category text
    check (
      category in ('basic_attack', 'attack_defence', 'feint_entry', 'body_head', 'footwork_entry', 'exit', 'counter')
      or category is null
    ),

  goal_tags text[] not null default '{}',

  is_active boolean not null default true,
  is_curated boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists combination_items (
  id uuid primary key default gen_random_uuid(),

  combination_id uuid not null references combinations(id) on delete cascade,
  move_id uuid not null references moves(id) on delete restrict,

  order_index integer not null,
  role text
    check (role in ('attack', 'defence', 'feint', 'footwork', 'position') or role is null),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint combination_items_unique_order
    unique (combination_id, order_index)
);

create index if not exists combinations_slug_idx on combinations (slug);
create index if not exists combinations_category_idx on combinations (category);
create index if not exists combinations_is_active_idx on combinations (is_active);

create index if not exists combination_items_combination_idx
  on combination_items (combination_id, order_index);

create index if not exists combination_items_move_idx
  on combination_items (move_id);

-- ─── RLS read policies ──────────────────────────────────────────────────────
alter table if exists moves enable row level security;
alter table if exists exercises enable row level security;
alter table combinations enable row level security;
alter table combination_items enable row level security;

drop policy if exists "drills_public_read" on moves;
drop policy if exists "moves_public_read" on moves;
create policy "moves_public_read"
  on moves for select using (true);

drop policy if exists "training_items_public_read" on exercises;
drop policy if exists "exercises_public_read" on exercises;
create policy "exercises_public_read"
  on exercises for select using (true);

drop policy if exists "combinations_public_read" on combinations;
create policy "combinations_public_read"
  on combinations for select using (true);

drop policy if exists "combination_items_public_read" on combination_items;
create policy "combination_items_public_read"
  on combination_items for select using (true);

commit;
