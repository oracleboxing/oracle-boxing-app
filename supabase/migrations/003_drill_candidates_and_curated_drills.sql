-- Migration: 003_drill_candidates_and_curated_drills.sql
-- Purpose: create the drill ingestion + curated drill library model
-- Handles both fresh databases and legacy prototype databases.

create extension if not exists pgcrypto;

-- ─── raw_drill_candidates ────────────────────────────────────────────────────
create table if not exists raw_drill_candidates (
  id uuid primary key default gen_random_uuid(),

  raw_title text not null,
  cleaned_title text not null,
  slug_candidate text not null,
  dedupe_key text,

  summary text,
  description text,

  category text not null check (category in ('stance', 'punching', 'footwork', 'defence', 'combination', 'warmup')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  grade_level text check (grade_level in ('grade_1', 'grade_2', 'grade_3')),

  format_tags text[] not null default '{}',
  skill_tags text[] not null default '{}',
  tags text[] not null default '{}',

  steps_json jsonb not null default '[]'::jsonb,
  focus_points_json jsonb not null default '[]'::jsonb,
  common_mistakes_json jsonb not null default '[]'::jsonb,

  what_it_trains text,
  when_to_assign text,
  coach_demo_quote text,
  estimated_duration_seconds integer,

  source_type text not null check (source_type in ('boxing_clinic', 'one_on_one', 'graduation', 'other')),
  source_file text,

  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'merged')),
  review_notes text,
  canonical_drill_id uuid,

  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raw_drill_candidates_slug_candidate_idx on raw_drill_candidates (slug_candidate);
create index if not exists raw_drill_candidates_dedupe_key_idx on raw_drill_candidates (dedupe_key);
create index if not exists raw_drill_candidates_review_status_idx on raw_drill_candidates (review_status);
create index if not exists raw_drill_candidates_category_idx on raw_drill_candidates (category);
create index if not exists raw_drill_candidates_source_type_idx on raw_drill_candidates (source_type);

-- ─── drills: create fresh if missing ────────────────────────────────────────
create table if not exists drills (
  id uuid primary key default gen_random_uuid(),
  title text,
  slug text unique,
  summary text,
  description text,
  category text,
  difficulty text,
  grade_level text,
  format_tags text[] not null default '{}',
  skill_tags text[] not null default '{}',
  tags text[] not null default '{}',
  steps_json jsonb not null default '[]'::jsonb,
  focus_points_json jsonb not null default '[]'::jsonb,
  common_mistakes_json jsonb not null default '[]'::jsonb,
  what_it_trains text,
  when_to_assign text,
  coach_demo_quote text,
  demo_video_url text,
  animation_key text,
  source_type text,
  source_file text,
  raw_candidate_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  is_curated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── drills: upgrade legacy shape if needed ─────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'drills' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'drills' and column_name = 'title'
  ) then
    alter table drills rename column name to title;
  end if;
end $$;

alter table drills
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists grade_level text,
  add column if not exists format_tags text[] not null default '{}',
  add column if not exists skill_tags text[] not null default '{}',
  add column if not exists steps_json jsonb not null default '[]'::jsonb,
  add column if not exists focus_points_json jsonb not null default '[]'::jsonb,
  add column if not exists common_mistakes_json jsonb not null default '[]'::jsonb,
  add column if not exists what_it_trains text,
  add column if not exists when_to_assign text,
  add column if not exists coach_demo_quote text,
  add column if not exists demo_video_url text,
  add column if not exists animation_key text,
  add column if not exists source_type text,
  add column if not exists source_file text,
  add column if not exists raw_candidate_ids uuid[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_curated boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update drills
set title = coalesce(title, slug, 'untitled-drill')
where title is null;

update drills
set summary = coalesce(summary, description, title, 'Untitled drill')
where summary is null;

update drills
set category = lower(category)
where category is not null;

-- Convert legacy integer difficulty safely into text difficulty.
do $$
declare
  difficulty_type text;
begin
  select data_type into difficulty_type
  from information_schema.columns
  where table_name = 'drills' and column_name = 'difficulty';

  if difficulty_type = 'integer' then
    alter table drills alter column difficulty drop default;

    alter table drills alter column difficulty type text using (
      case
        when difficulty is null then 'beginner'
        when difficulty <= 1 then 'beginner'
        when difficulty = 2 then 'intermediate'
        else 'advanced'
      end
    );
  end if;
end $$;

update drills
set difficulty = case
  when difficulty is null then 'beginner'
  when difficulty not in ('beginner', 'intermediate', 'advanced') then 'beginner'
  else difficulty
end;

-- legacy optional columns cleanup
alter table drills drop column if exists grade;
alter table drills drop column if exists cues;
alter table drills drop column if exists common_mistakes;
alter table drills drop column if exists video_url;
alter table drills drop column if exists duration_default;
alter table drills drop column if exists rep_based;

alter table drills
  alter column difficulty set default 'beginner',
  alter column title set not null,
  alter column slug set not null,
  alter column summary set not null;

alter table drills
  drop constraint if exists drills_category_check,
  drop constraint if exists drills_difficulty_check,
  drop constraint if exists drills_grade_level_check,
  drop constraint if exists drills_source_type_check;

alter table drills
  add constraint drills_category_check
    check (category in ('stance', 'punching', 'footwork', 'defence', 'combination', 'warmup') or category is null),
  add constraint drills_difficulty_check
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  add constraint drills_grade_level_check
    check (grade_level in ('grade_1', 'grade_2', 'grade_3') or grade_level is null),
  add constraint drills_source_type_check
    check (source_type in ('boxing_clinic', 'one_on_one', 'graduation', 'other') or source_type is null);

create index if not exists drills_title_idx on drills (title);
create index if not exists drills_category_idx on drills (category);
create index if not exists drills_difficulty_idx on drills (difficulty);
create index if not exists drills_grade_level_idx on drills (grade_level);
create index if not exists drills_is_active_idx on drills (is_active);

-- ─── link raw candidates to canonical drills ────────────────────────────────
alter table raw_drill_candidates drop constraint if exists raw_drill_candidates_canonical_drill_fk;
alter table raw_drill_candidates
  add constraint raw_drill_candidates_canonical_drill_fk
  foreign key (canonical_drill_id) references drills(id) on delete set null;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table raw_drill_candidates enable row level security;
alter table drills enable row level security;

drop policy if exists "raw_drill_candidates_public_read" on raw_drill_candidates;
create policy "raw_drill_candidates_public_read"
  on raw_drill_candidates for select using (true);

drop policy if exists "drills_public_read" on drills;
create policy "drills_public_read"
  on drills for select using (true);

-- writes are expected through service role for now
