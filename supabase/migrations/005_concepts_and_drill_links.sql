-- Migration: 005_concepts_and_drill_links.sql
-- Purpose: add a dedicated concepts library plus concept/slot linkage on drills.

create extension if not exists pgcrypto;

-- ─── concepts ───────────────────────────────────────────────────────────────
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  description text,
  category text,
  difficulty text,

  skill_tags text[] not null default '{}',
  tags text[] not null default '{}',

  steps_json jsonb not null default '[]'::jsonb,
  focus_points_json jsonb not null default '[]'::jsonb,
  common_mistakes_json jsonb not null default '[]'::jsonb,

  what_it_trains text,
  when_to_assign text,
  related_drill_slugs text[] not null default '{}',

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint concepts_category_check
    check (category in ('mechanics', 'strategy', 'positioning', 'defence', 'offense', 'fundamental') or category is null),
  constraint concepts_difficulty_check
    check (difficulty in ('beginner', 'intermediate', 'advanced') or difficulty is null)
);

create index if not exists concepts_title_idx on concepts (title);
create index if not exists concepts_category_idx on concepts (category);
create index if not exists concepts_difficulty_idx on concepts (difficulty);
create index if not exists concepts_is_active_idx on concepts (is_active);

-- ─── drills: concept links + slot tags ──────────────────────────────────────
alter table drills
  add column if not exists stance_slots_json jsonb not null default '[]'::jsonb,
  add column if not exists concept_links_json jsonb not null default '[]'::jsonb;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table concepts enable row level security;

drop policy if exists "concepts_public_read" on concepts;
create policy "concepts_public_read"
  on concepts for select using (true);

-- writes are expected through service role for now
