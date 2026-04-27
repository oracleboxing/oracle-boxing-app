# Sha-Lyn Handoff Notes

This file is the quick handoff for collaboration on the Oracle Boxing app rebuild.

---

## Current app direction

The rebuild is focused on:
- a Skool training companion for today's training
- clean boxing move content
- structured combinations
- Supabase structure
- workout execution and progress tracking
- simple architecture

The rebuild is **not** currently focused on rebuilding all the old MVP pages.

Product copy may still say “drills” where that makes sense for boxers. Database and source-of-truth docs should use `moves`, `combinations`, `combination_items`, and `exercises`.

---

## Where to start

Read these first:
- `README.md`
- `docs/DRILLS.md`
- `docs/SUPABASE.md`
- `docs/ARCHITECTURE.md`

Then open:
- `/schema`

That is the current visual schema reference inside the app.

---

## Current data model

### Raw review layer
- `raw_drill_candidates`

Use this for:
- reviewing extracted drill candidates
- spotting duplicates
- deciding what should be approved / rejected / merged

This exact table name is still live.

### Curated boxing layer
- `moves`
- `combinations`
- `combination_items`

Use this for:
- the actual boxing library the app should display
- stable reusable move cards
- stable reusable combination cards
- future workout linking

### Curated non-boxing layer
- `exercises`

Use this for:
- S&C exercises
- running interval blocks
- other non-boxing reusable training units

---

## Current review goal

We are trying to turn raw extracted drill candidates into a clean Oracle-authored canonical boxing library.

The immediate priority is:
- curate the first canonical moves and combinations
- especially from strong duplicate families

Examples:
- Static Rotations
- Stance and Shape
- Box Step
- Step Pivot
- Dip Pivot
- Jab Technique
- Basic Jab
- Slip and Roll
- 1-2 Combination

---

## How review should work

For each raw drill candidate, decide whether it should be:
- kept
- rejected
- merged into an existing canonical move
- used to create or improve a canonical combination

Useful fields in `raw_drill_candidates`:
- `cleaned_title`
- `category`
- `difficulty`
- `grade_level`
- `steps_json`
- `focus_points_json`
- `common_mistakes_json`
- `review_status`
- `canonical_move_id`

---

## What to build against

### Build product boxing UI against:
- `moves`
- `combinations`
- `combination_items`

### Build internal review UI against:
- `raw_drill_candidates`

### Build S&C / running UI against:
- `exercises`

This separation matters.

---

## Grade 1 / Grade 2 source material

Grade folders from Google Drive are being processed into transcripts and drill candidates.

Those source candidates should be tagged with:
- `grade_1`
- `grade_2`

That gives a cleaner content source for building the canonical move and combination library.

---

## Suggested first UI tasks

Best early contribution areas:
- review queue UI for pending raw drill candidates
- today's training / Start Workout surface
- canonical move detail cards
- canonical combination detail cards
- simple boxing library list/filter view
- approval / rejection / merge controls

---

## What comes later

After the boxing layer is solid:
- workout builder and execution structure
- basic progress tracking
- S&C exercise architecture
- running interval architecture
- themes / templates

Not yet. That comes after the boxing layer is trustworthy.

---

## Blunt version

Don’t build around the mess.
Help clean the mess into a usable canonical library first.
Then everything after that gets easier.
