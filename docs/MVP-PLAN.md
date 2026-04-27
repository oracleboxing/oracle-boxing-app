# Oracle Boxing App MVP Plan

This is the lean working plan for the Oracle Boxing app MVP.

The point of this file is not to predict every future feature.
The point is to keep the build focused, sequence the work properly, and stop scope drift.

---

## Core principle

Do **not** fully blueprint the whole product before building.

Instead, lock:
- the MVP outcome
- the core data model
- the build order
- the non-goals

That is enough to build fast without building blind.

---

## MVP outcome

The MVP should let a member:
- open the app as a Skool training companion
- start today's training with a clear primary action
- access a clean moves and combinations library
- open a move or combination and understand how to perform it
- access structured boxing workouts
- run a workout session with a timer / simple session flow
- track basic progress or completion state

And it should let the internal team:
- ingest raw drill candidates
- review raw drill candidates
- manually author and curate canonical moves and combinations
- use Supabase as the source of truth for the moves, combinations, and exercises library

That is the real MVP.

---

## What is in scope

### Member-facing
- authentication
- today's training / Start Workout surface
- moves and combinations library
- move and combination detail pages
- workout library
- workout detail pages
- workout run flow
- basic round / interval timer
- basic progress tracking

### Internal / content-facing
- `raw_drill_candidates` review path
- canonical `moves` and `combinations` library
- simple review workflow for approve / reject / merge
- grade-tagged drill ingestion for Grade 1 and Grade 2 source content

### Product / engineering
- stable Supabase schema for moves, combinations, exercises, and workouts
- documentation inside the repo
- GitHub-ready handoff for collaboration

---

## What is out of scope for MVP

These are explicit non-goals for now:
- social feed
- gamification systems
- badges / XP economy complexity
- AI coaching assistant inside the app
- AI-authored canonical content without Oracle review
- video analysis
- broad content types beyond boxing moves, combinations, exercises, and workouts
- full S&C architecture
- full running architecture
- themes / templates beyond basic planning notes
- advanced analytics
- complex admin dashboards

If it does not help moves, combinations, exercises, workouts, or the basic member training flow, it is probably out for MVP.

---

## Core data model

### Already established
- `raw_drill_candidates`
- `moves`
- `combinations`
- `combination_items`
- `exercises`

### Planned next
- `workouts`
- `workout_items`
- `workout_item_exercises`

### Key rule
Workout composition should reference curated moves, combinations, and exercises only.
Never raw candidates.

---

## Build order

## Phase 1, content foundation
Goal:
- make the moves and combinations layer trustworthy

Tasks:
- finish Grade 1 / Grade 2 extraction
- import grade-derived drill candidates into `raw_drill_candidates`
- curate first canonical moves into `moves` and combinations into `combinations` / `combination_items`
- settle naming, categories, difficulty, and grade tagging

Exit condition:
- there is a usable curated moves and combinations library, not just raw intake

---

## Phase 2, internal review workflow
Goal:
- let Jordan and Sha-Lyn review raw drill candidates properly

Tasks:
- build a simple review page for pending `raw_drill_candidates`
- surface fields like title, category, difficulty, steps, focus points, mistakes
- support approve / reject / merge workflow

Exit condition:
- raw drill review can happen inside the app without manual DB poking

---

## Phase 3, member boxing library
Goal:
- expose the curated moves and combinations library to users

Tasks:
- build a today's training / Start Workout entry point
- build moves/combinations list page
- build move/combination detail page
- support basic filtering
- support category / grade / difficulty views if useful

Exit condition:
- a member can browse and understand the moves and combinations library

---

## Phase 4, workouts
Goal:
- let curated moves, combinations, and exercises become real training sessions

Tasks:
- create workout schema
- create workout list / detail pages
- build workout session structure from `workout_items` and `workout_item_exercises`, with forward-compatible support for moves and combinations where needed
- support multiple curated training elements inside one workout item

Exit condition:
- workouts exist as structured content, not just a moves catalogue

---

## Phase 5, workout run flow
Goal:
- let members actually use the app during training

Tasks:
- simple session runner
- basic timer / interval flow
- next / previous block handling
- clear move, combination, and exercise instructions during a live session

Exit condition:
- a member can open a workout and run it end to end

---

## Phase 6, basic progress
Goal:
- add enough persistence to make the app feel alive

Tasks:
- store workout completion
- basic recent activity / progress state
- maybe current grade / completion markers if useful

Exit condition:
- member activity persists in a useful minimal way

---

## Phase 7, packaging and release
Goal:
- ship the MVP

Tasks:
- QA core flows
- mobile polish
- PWA / wrapper decisions
- packaging for app distribution if needed
- App Store / Play Store submission prep

Exit condition:
- the app is usable, stable, and distributable

---

## Recommended collaboration split

### Jordan
- final product decisions
- final manual content judgment
- prioritisation
- scope discipline

### Sha-Lyn
- frontend build
- drill review UI
- library and workout UI
- collaboration on content structure

### Agent
- schema design
- extraction and curation support, not final canonical authorship
- docs
- Supabase and workflow wiring
- plan maintenance

---

## Timeline, realistic

## If scope stays tight

### Build to usable web MVP
- roughly **2 to 4 weeks**

Meaning:
- moves and combinations layer works
- workouts exist
- session flow exists
- review flow exists
- enough polish to test properly

### Build to polished MVP
- roughly **4 to 8 weeks**

Meaning:
- cleaner UX
- fewer rough edges
- better mobile handling
- more confidence in content quality

### App Store / Play Store release
If wrapped / packaged after the web MVP:
- add roughly **1 to 2 weeks**

This includes:
- packaging
- app icons / splash / metadata
- native config
- testing
- review delays

### Total realistic release range
- **fast disciplined path:** 4 to 6 weeks
- **more realistic path:** 6 to 10 weeks

---

## Biggest risks

The main risks are not coding speed.
They are:
- scope drift
- overplanning the whole future product
- unstable content model
- trying to solve S&C / running too early
- review bottlenecks on moves and combinations curation
- app store friction at the end

---

## Decisions to make soon

### 1. Member auth shape
Decide whether MVP auth is:
- simple email auth
- invite-only auth
- magic link

### 2. Progress depth
Decide whether MVP progress is:
- just completed workouts
- or completed moves/combinations and grade markers too

### 3. Release format
Decide whether first shipping format is:
- web app first
- PWA first
- wrapped app store build shortly after

Recommendation:
- **web MVP first**, then package

---

## Recommendation

Do not pause to define the entire future product.

Do this instead:
- lock this MVP plan
- finish raw candidate extraction + review workflow
- build the moves and combinations library
- build workouts
- ship the first working version

Then expand into:
- S&C
- running
- themes
- templates

That order will save a lot of time and nonsense.

---

## Blunt version

A tight MVP plan is useful.
A giant complete masterplan is usually just fear wearing a clipboard.

Build the core thing first.