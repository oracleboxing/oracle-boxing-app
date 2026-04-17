# Supabase Structure

This file documents the current Oracle Boxing app data structure for the rebuild.

It is written for handoff and collaboration, especially for Sha-Lyn.

---

## Current rebuild principle

The rebuild is centred on:
- curated drills
- workout composition
- simple, reusable training blocks

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

### Layer 2: curated app content
Table:
- `drills`

Purpose:
- hold the approved drill library used by the app

### Layer 3: workout composition
Planned tables:
- `workouts`
- `workout_items`
- `workout_item_drills`

Purpose:
- build reusable sessions from curated drills

---

## Why there are two drill tables

Because raw AI extraction and app content are not the same thing.

If we dump everything directly into `drills`, we get:
- duplicates
- weird names
- overlapping concepts
- inconsistent categories
- messy app UX

So:
- `raw_drill_candidates` is the intake pile
- `drills` is the clean library

That separation is intentional.

---

## Current migration

Main migration file:
- `supabase/migrations/003_drill_candidates_and_curated_drills.sql`

This migration creates and/or upgrades:
- `raw_drill_candidates`
- `drills`

It also:
- handles legacy `drills` shape issues
- adds constraints and indexes
- enables RLS for read access
- expects writes through service role for now

---

## Table summary

### `raw_drill_candidates`
Source preservation + review queue.

Main ideas:
- one row per extracted candidate
- may include duplicates
- may include noisy or partial entries
- linked to canonical drill later if merged

Important review fields:
- `review_status`
- `review_notes`
- `canonical_drill_id`

### `drills`
Canonical reusable drill library.

Main ideas:
- one row per approved reusable drill
- stable naming
- stable categories
- stable difficulty
- can cite multiple raw candidates via `raw_candidate_ids`

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
- Technical drill block
- Combo block
- Round block

Each item should have:
- a parent workout
- an order index
- a title / label
- optional duration / notes

### `workout_item_drills`
Represents ordered drills inside a workout item.

This is important because:
- one workout item can contain multiple drills
- drills need ordering inside the item

This table should reference:
- curated `drills` only

Not raw candidates.
Ever.

---

## Review and collaboration model

### Agent role
- extract raw candidates
- prepare documentation
- help propose canonical merges

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
- drill docs
- schema visual route (`/schema`)
- starter review workflow notes

That gives collaborators enough context to contribute without guessing.

---

## What should happen next

### Immediate next
- continue grade video extraction
- curate the first canonical drills
- expose a simple review list for pending raw candidates

### Then
- build the app-facing drill library UI on `drills`
- build the review/moderation UI on `raw_drill_candidates`

### After drill layer is stable
expand into:
- S&C exercises
- running exercises
- themes
- templates

That is a later phase.
The drill layer comes first.

---

## Blunt version

If the drill model is messy, everything built on top of it becomes messy too.

So the right sequence is:
1. raw intake
2. curation
3. canonical drills
4. workouts
5. broader training architecture

That is the rebuild path.