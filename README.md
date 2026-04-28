# Oracle Boxing Training App 🥊

This repo is currently a clean rebuild workspace for the Oracle Boxing app.

The old MVP shell was deliberately stripped back so the app can be rebuilt on better foundations.

Current focus:
- build a Skool training companion around today's training, workout execution, and progress tracking
- curate a clean Oracle-authored canonical moves library, with member-facing copy still free to say “drills” where that reads naturally
- define the Supabase structure properly
- build workouts on top of curated moves, combinations, and exercises
- make the repo easy for Jordan and Sha-Lyn to collaborate in

---

## Current rebuild direction

This rebuild is centred on:
- reusable boxing moves
- combinations and workout composition
- today's training as the primary member flow
- simple structure
- coach-led training content

Not on:
- gamification bloat
- social feed complexity
- feature sprawl before the core content model is right

---

## What exists right now

### In the app
- a clean desktop-first rebuild surface
- a schema mock route at `/schema`
- a simplified home page for working on structure

### In Supabase
- `raw_drill_candidates` for extracted, reviewable source content and AI-assisted draft support only
- `moves` for curated canonical boxing movements
- `combinations` and `combination_items` for reusable boxing sequences
- `exercises` for non-boxing training items, now seeded with a first dynamic warm-up draft
- `workout_templates` still exists as a legacy table with 1 row
- the clean workout tables live in migration `009`, but are not live in Supabase yet

### In docs
- rebuild architecture notes
- drill data model notes
- Supabase structure notes

---

## Key docs

Read these first:
- [docs/DRILLS.md](docs/DRILLS.md)
- [docs/SUPABASE.md](docs/SUPABASE.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

Supporting docs:
- [docs/SETUP.md](docs/SETUP.md)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

---

## Current data model direction

### Raw intake
- `raw_drill_candidates`
- holds extracted drill candidates from transcripts and grade videos
- this is the review layer, not the final app library

### Curated boxing library
- `moves`
- holds approved reusable canonical boxing movements authored and curated by Oracle
- this is what the app should read from for canonical boxing content

### Curated sequence library
- `combinations`
- `combination_items`
- holds reusable ordered move sequences

### Workout composition
Target clean schema in migration `009`:
- `workouts`
- `workout_items`
- `workout_item_exercises`
- `workout_item_moves`
- `workout_item_combinations`

Live Supabase has not applied that layer yet. Do not build new UI on the old `workout_templates` table unless explicitly doing legacy support.

These are built on top of curated source-of-truth rows, not raw candidates.

---

## Collaboration flow for Sha-Lyn

The intended workflow is:
1. pull pending raw drill candidates from Supabase
2. review / approve / reject / merge them
3. help shape the manual Oracle-authored canonical moves library
4. build UI against curated `moves`, `combinations`, and `exercises`, not raw candidates

This keeps the app clean while still preserving all source material.

---

## Grade content

Grade 1 and Grade 2 videos are being pulled from Google Drive and processed into:
- transcripts
- extracted drill JSON
- grade-tagged drill candidates

Those outputs are being used as cleaner source material for manual Oracle curation, not auto-published as app content.

---

## Run locally

```bash
npm install
npm run dev
```

Then open:
- `http://localhost:3000`
- `http://localhost:3000/schema`

---

## Tech stack

- Next.js 16
- TypeScript
- Tailwind CSS
- Supabase

---

## Blunt version

The app is not being rebuilt around flashy features.
It is being rebuilt around clean boxing content structure.

That means:
1. curate moves
2. build combinations, exercises, and workouts
3. then expand into broader training layers like S&C, running, themes, and templates

That order matters.
