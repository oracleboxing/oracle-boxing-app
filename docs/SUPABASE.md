# Supabase Structure

This file documents the current Oracle Boxing app data structure for the Skool training companion rebuild.

It is written for handoff and collaboration, especially for Sha-Lyn.

---

## Current rebuild principle

The rebuild is centred on:
- curated boxing moves and combinations
- reusable S&C / running exercises
- workout composition for today's training and Start Workout flows
- simple, reusable training blocks
- additive schema changes instead of binning working content

Not on:
- gamification
- feeds
- social features
- bloated product hierarchy

---

## Current data layers

### Layer 1: raw content intake
Table:
- `raw_drill_candidates`

Purpose:
- preserve extracted drill candidates from transcripts and grade videos
- review and dedupe them
- avoid losing source material

Important: this table name is still exact and live. Do not rename it in docs or SQL unless a future migration actually changes it.

### Layer 2: curated boxing content
Tables:
- `moves`
- `combinations`
- `combination_items`

Purpose:
- hold the approved boxing move library used by the app
- model combinations as ordered sequences of canonical moves
- avoid turning every punch sequence into a duplicated one-off move row

### Layer 3: reusable non-boxing content
Table:
- `exercises`

Purpose:
- hold reusable S&C exercises and running interval blocks
- avoid forcing squats and treadmill work into boxing-first tables

### Layer 4: workout composition
Tables:
- `workouts`
- `workout_items`
- `workout_item_exercises`

Purpose:
- build reusable sessions from curated moves, combinations, and exercises
- store workout-specific prescriptions on the workout item or join row, not the reusable library item

---

## Why raw candidates and canonical content are separate

Because raw AI extraction and finished Oracle-authored app content are not the same thing.

If we dump everything directly into `moves`, we get:
- duplicates
- weird names
- overlapping concepts
- inconsistent categories
- messy app UX

So:
- `raw_drill_candidates` is the intake pile
- `moves` is the clean Oracle-authored canonical boxing movement library
- `combinations` is the clean canonical sequence library
- `exercises` is the clean non-boxing training library

That separation is intentional.

---

## Current migrations

Main historical migration file:
- `supabase/migrations/003_drill_candidates_and_curated_drills.sql`

Forward rename/source-of-truth migration:
- `supabase/migrations/008_moves_exercises_and_combinations.sql`

Migration `008` renames the canonical schema from:
- `drills` to `moves`
- `training_items` to `exercises`
- `canonical_drill_id` to `canonical_move_id`

It also adds:
- `combinations`
- `combination_items`

Do not rename historical migrations just to tidy old wording. Add forward migrations instead.

---

## Table summary

### `raw_drill_candidates`
Source preservation + review queue.

Main ideas:
- one row per extracted candidate
- may include duplicates
- may include noisy or partial entries
- linked to a canonical move later if merged

Important review fields:
- `review_status`
- `review_notes`
- `canonical_move_id`
- `ai_proposed_canonical_move_id`

### `moves`
Canonical reusable boxing movement library, manually curated by Oracle.

Main ideas:
- one row per approved reusable move
- stable naming
- stable categories
- stable difficulty
- can cite multiple raw candidates via `raw_candidate_ids`

Typical examples:
- Jab
- Cross
- Box Step
- Step Pivot
- Slip
- Roll
- Feint

### `combinations`
Canonical reusable boxing sequence library.

Main ideas:
- one row per named combination
- stores sequence-level summary, difficulty, category, and goal tags
- does not duplicate the move instructions itself

Typical examples:
- 1-2
- 1-2-3
- Jab to Body, Cross to Head
- Jab, Slip, Cross

### `combination_items`
Ordered move links inside a combination.

Main ideas:
- one row per move inside the combination
- references `combination_id`
- references `move_id`
- stores `order_index`, `role`, and optional notes

This lets the app know exactly which moves make up a combination and in what order.

### `exercises`
Reusable non-boxing training units.

Examples:
- Goblet Squat
- Copenhagen Plank
- Treadmill Build + Sprint Finisher

Lean shared fields:
- `title`
- `slug`
- `discipline`
- `item_type`
- `category`
- `summary`
- `description`
- `instructions_json`
- `coaching_cues_json`
- `common_mistakes_json`
- `equipment_tags`
- `difficulty`
- `structure_json`

Important principle:
- sport-specific detail lives in `structure_json`
- do not build 40 columns before the app proves it needs them

---

## Planned workout structure

### `workouts`
Represents a full session.

Examples:
- Grade 1 Session A
- Jab Development Session
- Beginner Shadowboxing Session

### `workout_items`
Represents ordered blocks inside a workout.

Examples:
- Warm-up block
- Technical block
- Combination block
- Round block
- S&C finisher

Each item should have:
- a parent workout
- an order index
- a title / label
- optional duration / notes

### `workout_item_exercises`
Represents ordered reusable exercises inside a workout item.

This table should store:
- `workout_item_id`
- `exercise_id`
- `order_index`
- `prescription_json`
- `notes`

Why:
- the same exercise may be reused with different prescriptions in different workouts
- workout-specific settings belong on the join row, not the library item

### Boxing workout references
Boxing workout composition should reference curated content only:
- `moves`
- `combinations`

Not raw candidates.
Ever.

If the app needs a dedicated join table for moves or combinations inside workout items, add it as a forward migration rather than reusing `raw_drill_candidates`.

---

## Review and collaboration model

### Agent role
- extract raw candidates
- prepare documentation
- help propose canonical merges and drafts

### Sha-Lyn role
- inspect raw candidates
- approve / reject / merge
- help shape clean app content
- use Supabase as the review surface or via a simple app UI

### Jordan role
- final content judgment
- taxonomy direction
- approve the overall model and progression

---

## What should go to GitHub now

Good to include in the repo now:
- migration SQL
- schema docs
- boxing move docs
- schema visual route (`/schema`)
- starter review workflow notes

That gives collaborators enough context to contribute without guessing.

---

## What should happen next

### Immediate next
- continue grade video extraction
- curate the first canonical moves and combinations
- expose a simple review list for pending raw candidates

### Then
- build the app-facing boxing library UI on `moves`, `combinations`, and `combination_items`
- build the review/moderation UI on `raw_drill_candidates`

### After the boxing layer is stable
expand into:
- S&C exercises via `exercises`
- running interval blocks via `exercises`
- themes
- templates

That is a later phase.
The boxing layer comes first, but the new path now exists in parallel so we do not have to contort future training content into boxing-first tables.

---

## Blunt version

If the source model is messy, everything built on top of it becomes messy too.

So the right sequence is:
1. raw intake
2. curation
3. canonical moves
4. canonical combinations
5. workouts
6. broader training architecture

That is the rebuild path.
