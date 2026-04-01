-- Oracle Boxing Training App - Initial Schema
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── drills ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drills (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             text NOT NULL,
  slug             text UNIQUE NOT NULL,
  description      text,
  category         text,
  grade            text,
  difficulty       int,
  cues             text[],
  common_mistakes  text[],
  video_url        text,
  duration_default int,
  rep_based        boolean DEFAULT false,
  tags             text[],
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── workout_templates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_templates (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   text NOT NULL,
  description            text,
  grade                  text,
  difficulty             int,
  duration_minutes       int,
  round_count            int,
  round_duration_seconds int,
  rest_duration_seconds  int,
  drill_sequence         jsonb,
  lesson_link            text,
  tags                   text[],
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ─── user_profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text,
  avatar_url     text,
  grade          text,
  xp             int DEFAULT 0,
  level          int DEFAULT 1,
  streak_current int DEFAULT 0,
  streak_best    int DEFAULT 0,
  total_rounds   int DEFAULT 0,
  total_minutes  int DEFAULT 0,
  badges         jsonb DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── workout_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_logs (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  workout_template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  custom_name         text,
  drill_log           jsonb,
  total_rounds        int,
  total_minutes       int,
  xp_earned           int DEFAULT 0,
  completed_at        timestamptz DEFAULT now()
);

-- ─── feed_posts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_posts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  workout_log_id  uuid REFERENCES workout_logs(id) ON DELETE SET NULL,
  content         text,
  post_type       text,
  likes_count     int DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── feed_likes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_likes (
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

-- ─── badges ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id          text PRIMARY KEY,
  name        text,
  description text,
  icon        text,
  xp_reward   int DEFAULT 0,
  condition   jsonb
);

-- ─── Row Level Security ────────────────────────────────────────────────────────

-- drills and workout_templates: publicly readable
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drills_public_read" ON drills FOR SELECT USING (true);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_templates_public_read" ON workout_templates FOR SELECT USING (true);

-- user_profiles: users can only read/write their own
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- workout_logs: users can only access their own
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_logs_own" ON workout_logs USING (auth.uid() = user_id);
CREATE POLICY "workout_logs_insert_own" ON workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- feed_posts: readable by all, writable by owner
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_posts_public_read" ON feed_posts FOR SELECT USING (true);
CREATE POLICY "feed_posts_insert_own" ON feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feed_posts_delete_own" ON feed_posts FOR DELETE USING (auth.uid() = user_id);

-- feed_likes: readable by all, manage own
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_likes_public_read" ON feed_likes FOR SELECT USING (true);
CREATE POLICY "feed_likes_manage_own" ON feed_likes USING (auth.uid() = user_id);

-- badges: publicly readable
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_public_read" ON badges FOR SELECT USING (true);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS drills_slug_idx ON drills (slug);
CREATE INDEX IF NOT EXISTS drills_category_idx ON drills (category);
CREATE INDEX IF NOT EXISTS drills_grade_idx ON drills (grade);
CREATE INDEX IF NOT EXISTS feed_posts_user_id_idx ON feed_posts (user_id);
CREATE INDEX IF NOT EXISTS feed_posts_created_at_idx ON feed_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS workout_logs_user_id_idx ON workout_logs (user_id);
