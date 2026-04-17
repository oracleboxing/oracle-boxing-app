# Drill Data Guide

This is the working source of truth for how drill data is structured for the Oracle Boxing app rebuild.

The current direction is deliberately simple:
- keep raw extracted drill candidates separate from curated app content
- curate a clean drill library first
- build workouts on top of curated drills, not messy source data

---

## Core idea

There are two layers of drill data:

### 1. `raw_drill_candidates`
This is the intake layer.

It stores:
- drills extracted from transcripts
- drills extracted from grade videos
- duplicates
- messy naming
- partial overlap
- unreviewed AI output

This table is for:
- review
- dedupe
- merge decisions
- source preservation

It is **not** the final app library.

### 2. `drills`
This is the curated app-facing library.

It stores:
- approved canonical drill rows
- clean naming
- stable categories
- stable difficulty
- merged steps and focus points
- links back to the raw candidates that informed the final drill

This is what the app should read from.

---

## Current Supabase structure

### `raw_drill_candidates`
Important fields:
- `id`
- `raw_title`
- `cleaned_title`
- `slug_candidate`
- `dedupe_key`
- `summary`
- `description`
- `category`
- `difficulty`
- `grade_level` (`grade_1`, `grade_2`, `grade_3`, nullable)
- `format_tags`
- `skill_tags`
- `tags`
- `steps_json`
- `focus_points_json`
- `common_mistakes_json`
- `what_it_trains`
- `when_to_assign`
- `coach_demo_quote`
- `estimated_duration_seconds`
- `source_type`
- `source_file`
- `review_status` (`pending`, `approved`, `rejected`, `merged`)
- `review_notes`
- `canonical_drill_id`

### `drills`
Important fields:
- `id`
- `title`
- `slug`
- `summary`
- `description`
- `category`
- `difficulty`
- `grade_level`
- `format_tags`
- `skill_tags`
- `tags`
- `steps_json`
- `focus_points_json`
- `common_mistakes_json`
- `what_it_trains`
- `when_to_assign`
- `coach_demo_quote`
- `demo_video_url`
- `animation_key`
- `source_type`
- `source_file`
- `raw_candidate_ids`
- `is_active`
- `is_curated`

---

## Review workflow

### What Sha-Lyn should pull from Supabase
For review and clean-up, Sha-Lyn should start with:
- `raw_drill_candidates`
- filtered to `review_status = 'pending'`

That gives her the queue of raw extracted drill candidates.

### What she should do with them
For each candidate or duplicate family:
- keep it and promote toward a canonical drill
- merge it into an existing canonical drill
- reject it if it is too messy / duplicate / non-reusable

### Review status meaning
- `pending` = not reviewed yet
- `approved` = accepted as valid source material
- `rejected` = not suitable for the app library
- `merged` = folded into a canonical drill in `drills`

### Promotion path
The intended flow is:
1. extract raw candidates
2. review duplicates / overlap
3. create or update a curated row in `drills`
4. set raw candidates to `merged`
5. store the linked `canonical_drill_id`

---

## Current content state

### Already loaded
- `raw_drill_candidates` contains the first 671 imported drill candidates from coaching/transcript extraction
- curated `drills` is intentionally still mostly/entirely empty while curation happens

### Grade video extraction
We are also extracting from the Grade 1 and Grade 2 Google Drive folders.
Those extracted drills should be tagged with:
- `grade_1`
- `grade_2`

These are useful because they are cleaner instructional source material than live transcript chaos.

---

## Working categories
Current drill category set:
- `stance`
- `punching`
- `footwork`
- `defence`
- `combination`
- `warmup`

Keep this set tight unless there is a very good reason to expand it.

---

## First curated batch
The current recommendation is to start by curating the first 20 canonical drills from the strongest duplicate families.

Examples:
- Static Rotations
- Stance and Shape
- Box Step
- Step Pivot
- Dip Pivot
- Pivot
- Jab Technique
- Basic Jab
- Flicker Jab
- Power Jab
- Jab to the Body
- Cross to the Body
- Slip and Roll
- Jab and Move
- Box Step with Jab
- 1-2 Combination
- Static 1-2
- 1-2 and Move
- 1-2-3 Combination
- 1-1-2 Combination

See:
- `~/clawd/plans/oracle-boxing-app-first-canonical-drill-shortlist.md`

---

## What the app should read

### Library UI
Read from:
- `drills`

### Review / moderation UI
Read from:
- `raw_drill_candidates`

Do **not** build the library UI directly on raw candidates.
That would turn the app into a duplicate warehouse.

---

## Suggested Sha-Lyn workflow

For now, the simplest collaboration pattern is:

1. Jordan / agent extracts new raw candidates
2. Sha-Lyn pulls pending candidates from Supabase
3. Sha-Lyn reviews and marks:
   - approve
   - reject
   - merge
4. canonical drills get created or updated in `drills`
5. workouts later reference only curated drills

This keeps review work separated from product-facing content.

---

## Next layer after drills
Once drills are clean enough, build:
- `workouts`
- `workout_items`
- `workout_item_drills`

Only after that should we broaden into:
- S&C exercises
- running exercises
- training themes
- session templates

That is the correct sequence.
Not because it is academic, but because otherwise the content model gets bloated before the drill layer is even trustworthy.