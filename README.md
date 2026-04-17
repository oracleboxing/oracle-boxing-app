# Oracle Boxing Training App 🥊

This repo is currently a clean rebuild workspace for the Oracle Boxing app.

The old MVP shell was deliberately stripped back so the app can be rebuilt on better foundations.

Current focus:
- curate a clean drill library
- define the Supabase structure properly
- build workouts on top of curated drills
- make the repo easy for Jordan and Sha-Lyn to collaborate in

---

## Current rebuild direction

This rebuild is centred on:
- reusable drills
- workout composition
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
- `raw_drill_candidates` for extracted, reviewable source content
- `drills` for curated app-facing drills

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
- holds extracted drills from transcripts and grade videos
- this is the review layer, not the final app library

### Curated library
- `drills`
- holds approved reusable canonical drills
- this is what the app should read from

### Planned workout composition
- `workouts`
- `workout_items`
- `workout_item_drills`

These will be built on top of curated drills only.

---

## Collaboration flow for Sha-Lyn

The intended workflow is:
1. pull pending raw drill candidates from Supabase
2. review / approve / reject / merge them
3. help shape the canonical drill library
4. build UI against curated `drills`, not raw candidates

This keeps the app clean while still preserving all source material.

---

## Grade content

Grade 1 and Grade 2 videos are being pulled from Google Drive and processed into:
- transcripts
- extracted drill JSON
- grade-tagged drill candidates

Those outputs are being used as cleaner source material for curation.

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

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase

---

## Blunt version

The app is not being rebuilt around flashy features.
It is being rebuilt around clean boxing content structure.

That means:
1. curate drills
2. build workouts
3. then expand into broader training layers like S&C, running, themes, and templates

That order matters.
