# Boxing Move Data Guide

This is the working source of truth for how boxing drill content is structured for the Oracle Boxing app rebuild.

The product may still call this area “drills” because that is natural for boxers. The database source of truth is now:
- `raw_drill_candidates` for intake and review
- `moves` for approved canonical boxing movements
- `combinations` and `combination_items` for ordered boxing combinations built from moves
- `exercises` for reusable S&C and running work

The current direction is deliberately simple:
- keep raw extracted drill candidates separate from curated app content
- curate a clean canonical move library first
- build combinations and workouts on top of curated moves, not messy source data

---

## Core idea

There are two layers of boxing source data:

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

### 2. `moves`
This is the curated app-facing boxing movement library.

It stores:
- approved canonical move rows
- clean naming
- stable categories
- stable difficulty
- merged steps and focus points
- links back to the raw candidates that informed the final move

This is what boxing library UI should read from.

### 3. `combinations` and `combination_items`
These are the structured combination layer.

They store:
- reusable combinations such as `1-2`, `1-2-3`, or jab-entry-exit patterns
- ordered links back to canonical `moves`
- role notes for each move in the sequence, for example attack, defence, feint, footwork, or position

This keeps “Jab” as a reusable move and “1-2 Combination” as a structured sequence, instead of duplicating punch instructions across rows.

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
- `canonical_move_id`

### `moves`
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

### `combinations`
Important fields:
- `id`
- `title`
- `slug`
- `summary`
- `description`
- `difficulty`
- `category`
- `goal_tags`
- `is_active`
- `is_curated`

### `combination_items`
Important fields:
- `id`
- `combination_id`
- `move_id`
- `order_index`
- `role`
- `notes`

---

## Review workflow

### What Sha-Lyn should pull from Supabase
For review and clean-up, Sha-Lyn should start with:
- `raw_drill_candidates`
- filtered to `review_status = 'pending'`

That gives her the queue of raw extracted drill candidates.

### What she should do with them
For each candidate or duplicate family:
- keep it and promote toward a canonical move
- merge it into an existing canonical move
- reject it if it is too messy, duplicate, or not reusable

### Review status meaning
- `pending` = not reviewed yet
- `approved` = accepted as valid source material
- `rejected` = not suitable for the app library
- `merged` = folded into a canonical move in `moves`

### Promotion path
The intended flow is:
1. extract raw candidates
2. review duplicates and overlap
3. create or update a curated row in `moves`
4. optionally create combinations in `combinations` plus ordered rows in `combination_items`
5. set raw candidates to `merged`
6. store the linked `canonical_move_id`

---

## Current content state

### Already loaded
- `raw_drill_candidates` contains the first 671 imported drill candidates from coaching/transcript extraction
- curated `moves` is intentionally still mostly/entirely empty while curation happens

### Grade video extraction
We are also extracting from the Grade 1 and Grade 2 Google Drive folders.
Those extracted drills should be tagged with:
- `grade_1`
- `grade_2`

These are useful because they are cleaner instructional source material than live transcript chaos.

---

## Working categories
Current move category set:
- `stance`
- `punching`
- `footwork`
- `defence`
- `combination`
- `warmup`
- `feint`

Keep this set tight unless there is a very good reason to expand it.

---

## First curated batch
The current recommendation is to start by curating the first 20 canonical moves and combinations from the strongest duplicate families.

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

### Boxing library UI
Read from:
- `moves`
- `combinations`
- `combination_items`

The route or labels may still say drills if that is clearer for members.

### Boxing review / moderation UI
Read from:
- `raw_drill_candidates`

### S&C / running library UI
Read from:
- `exercises`

Do **not** build the boxing library UI directly on raw candidates.
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
4. canonical moves get created or updated in `moves`
5. combinations get created in `combinations` and `combination_items` when a source candidate is a sequence
6. workouts later reference only curated moves, combinations, or exercises

This keeps review work separated from product-facing content.

---

## Next layer after moves
Once moves are clean enough, build:
- `workouts`
- `workout_items`
- move/combination references for boxing work
- `workout_item_exercises` for S&C and running work

The parallel non-boxing lane is:
- `exercises`
- `workout_item_exercises`

Only after that should we broaden into:
- S&C exercises
- running interval blocks
- training themes
- session templates

That is the correct sequence.
Not because it is academic, but because otherwise the content model gets bloated before the boxing move layer is even trustworthy.
