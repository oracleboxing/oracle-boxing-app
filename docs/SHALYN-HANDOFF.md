# Sha-Lyn Handoff Notes

This file is the quick handoff for collaboration on the Oracle Boxing app rebuild.

---

## Current app direction

The rebuild is focused on:
- clean drill content
- Supabase structure
- workout composition
- simple architecture

The rebuild is **not** currently focused on rebuilding all the old MVP pages.

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

### Curated app layer
- `drills`

Use this for:
- the actual drill library the app should display
- stable reusable drill cards
- future workout linking

---

## Current review goal

We are trying to turn raw extracted drill candidates into a clean canonical library.

The immediate priority is:
- curate the first canonical drills
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
- merged into an existing canonical drill

Useful fields in `raw_drill_candidates`:
- `cleaned_title`
- `category`
- `difficulty`
- `grade_level`
- `steps_json`
- `focus_points_json`
- `common_mistakes_json`
- `review_status`
- `canonical_drill_id`

---

## What to build against

### Build product UI against:
- `drills`

### Build internal review UI against:
- `raw_drill_candidates`

This separation matters.

---

## Grade 1 / Grade 2 source material

Grade folders from Google Drive are being processed into transcripts and drill candidates.

Those drills should be tagged with:
- `grade_1`
- `grade_2`

That gives a cleaner content source for building the drill library.

---

## Suggested first UI tasks

Best early contribution areas:
- review queue UI for pending raw drill candidates
- canonical drill detail cards
- simple drill library list/filter view
- drill approval / rejection controls

---

## What comes later

After the drill layer is solid:
- workout builder structure
- S&C exercise architecture
- running exercise architecture
- themes / templates

Not yet. That comes after the drill layer is trustworthy.

---

## Blunt version

Don’t build around the mess.
Help clean the mess into a usable library first.
Then everything after that gets easier.