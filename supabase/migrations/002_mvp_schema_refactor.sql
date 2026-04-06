-- Migration: 002_mvp_schema_refactor.sql
-- Based on MVP Data Contracts (oracle-boxing-app-mvp-modules-data-contracts.md)

-- ─── Clean up Legacy Prototypes ────────────────────────────────────────────────
DROP TABLE IF EXISTS feed_likes;
DROP TABLE IF EXISTS feed_posts;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS workout_logs;

-- ─── Refactor member_profiles (formerly user_profiles) ─────────────────────────
ALTER TABLE user_profiles RENAME TO member_profiles;

ALTER TABLE member_profiles
  DROP COLUMN IF EXISTS xp,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS streak_current,
  DROP COLUMN IF EXISTS streak_best,
  DROP COLUMN IF EXISTS total_rounds,
  DROP COLUMN IF EXISTS total_minutes,
  DROP COLUMN IF EXISTS badges;

ALTER TABLE member_profiles
  RENAME COLUMN grade TO current_grade;

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS linked_skool_member_id text,
  ADD COLUMN IF NOT EXISTS preferred_session_minutes int,
  ADD COLUMN IF NOT EXISTS preferences_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Recreate RLS policies for member_profiles
DROP POLICY IF EXISTS "profiles_read_own" ON member_profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON member_profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON member_profiles;

CREATE POLICY "member_profiles_read_own" ON member_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "member_profiles_update_own" ON member_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "member_profiles_insert_own" ON member_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── Refactor drills ───────────────────────────────────────────────────────────
ALTER TABLE drills
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ─── Refactor workout_templates ────────────────────────────────────────────────
ALTER TABLE workout_templates
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS round_count,
  DROP COLUMN IF EXISTS round_duration_seconds,
  DROP COLUMN IF EXISTS rest_duration_seconds,
  DROP COLUMN IF EXISTS drill_sequence,
  DROP COLUMN IF EXISTS lesson_link;

ALTER TABLE workout_templates
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Untitled Workout',
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS categories text[],
  ADD COLUMN IF NOT EXISTS equipment text[],
  ADD COLUMN IF NOT EXISTS blocks_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ─── saved_routines ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_routines (
  id                         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id                  uuid REFERENCES member_profiles(id) ON DELETE CASCADE,
  title                      text NOT NULL,
  summary                    text,
  categories                 text[],
  estimated_duration_minutes int,
  blocks_json                jsonb DEFAULT '[]'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_routines_manage_own" ON saved_routines USING (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS saved_routines_member_id_idx ON saved_routines (member_id);

-- ─── workout_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_sessions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           uuid REFERENCES member_profiles(id) ON DELETE CASCADE,
  template_id         uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  saved_routine_id    uuid REFERENCES saved_routines(id) ON DELETE SET NULL,
  source              text NOT NULL, -- 'grade', 'custom', 'recent', 'coach_assigned'
  title_snapshot      text NOT NULL,
  status              text NOT NULL, -- 'planned', 'in_progress', 'completed', 'abandoned'
  blocks_json         jsonb DEFAULT '[]'::jsonb,
  current_block_index int DEFAULT 0,
  elapsed_seconds     int DEFAULT 0,
  notes               text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_sessions_manage_own" ON workout_sessions USING (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS workout_sessions_member_id_idx ON workout_sessions (member_id);
CREATE INDEX IF NOT EXISTS workout_sessions_status_idx ON workout_sessions (status);

-- ─── community_activity_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_activity_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        text NOT NULL, -- e.g., 'skool', 'system'
  external_id   text UNIQUE,
  member_name   text NOT NULL,
  avatar_url    text,
  activity_text text NOT NULL,
  context_label text,
  external_url  text,
  occurred_at   timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_activity_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_activity_public_read" ON community_activity_items FOR SELECT USING (true);
-- Write operations will likely be server-side (service role)

CREATE INDEX IF NOT EXISTS community_activity_occurred_at_idx ON community_activity_items (occurred_at DESC);
