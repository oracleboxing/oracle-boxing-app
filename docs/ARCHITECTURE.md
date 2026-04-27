# Architecture Guide

This rebuild is now intentionally simpler than the old app direction.

The goal is to build the Oracle Boxing app on top of:
- clean boxing moves
- clean combinations
- clean exercises
- clean workouts
- clean data structure

Not on old MVP clutter.

---

## Current architectural priority

The correct order is:
1. raw drill intake
2. move curation
3. canonical move library
4. combination building
5. exercise library
6. workout composition
7. wider training architecture

That means the foundation right now is the curated movement layer.

---

## Rebuild shape

### App routes that matter right now
- `/` = rebuild workspace landing page
- `/schema` = visual schema mock
- `/review` = raw drill candidate moderation workspace
- `/drills` = current internal library route reading from the `moves` table

The member-facing app direction is a Skool training companion, not a social feed or RPG shell. Keep the route work pointed at today's training, workout execution, and progress tracking.

---

## Content architecture

### Raw source layer
Source table:
- `raw_drill_candidates`

Purpose:
- preserve extracted drills from transcripts and grade videos
- hold duplicate families
- provide a review queue
- stop raw AI extraction from polluting the real app library

### Curated movement layer
Source tables:
- `moves`
- `combinations`
- `combination_items`
- `exercises`

Purpose:
- hold reusable canonical boxing moves
- hold ordered boxing combinations built from moves
- hold reusable S&C and running exercises
- provide stable app-facing content
- act as the only curated source the real library UI should depend on

### Workout layer
Planned tables:
- `workouts`
- `workout_items`

Purpose:
- compose sessions from curated moves, combinations, and exercises
- support mixed training blocks without stuffing every item into one generic drill table
- preserve ordering at workout-item level

---

## Why the raw-to-curated model matters

Because extracted content is messy.

The raw layer contains:
- duplicates
- naming drift
- category drift
- partial overlap
- candidate rows that are useful as source material but not yet suitable as app content

So the architecture deliberately separates:
- intake
- curation
- final app content

That decision is not bureaucracy.
It is what stops the app from becoming a duplicate graveyard.

---

## Current categories

Current working move categories:
- `stance`
- `punching`
- `footwork`
- `defence`
- `combination`
- `warmup`
- `feint`

Current working combination categories:
- `basic_attack`
- `attack_defence`
- `feint_entry`
- `body_head`
- `footwork_entry`
- `exit`
- `counter`

Keep these tight unless a real product reason appears.

---

## Current grade content path

Grade 1 and Grade 2 videos are being processed from Google Drive into:
- local transcripts
- extracted drill JSON
- grade-tagged drill candidates

Those grade videos are useful because they are cleaner instructional sources than chaotic live coaching transcripts.

---

## Collaboration model

### Jordan
- sets product direction
- makes final content judgments
- defines what counts as a real drill

### Sha-Lyn
- helps review raw candidates
- helps shape curated move, combination, and exercise content
- can build UI against the documented schema

### Agent
- extracts content
- documents the model
- proposes canonical merges
- helps wire the review workflow

---

## What should be built in the app next

### First useful internal UI
A review surface for pending raw drill candidates exists at `/review`.

That UI should keep making it easier to:
- pull pending candidates
- inspect steps / focus points / mistakes
- approve
- reject
- merge into canonical moves
- hand off clean review slices to Jordan or Sha-Lyn

### First useful product UI
A simple library that reads from:
- `moves`
- `combinations`
- `exercises`

Not `raw_drill_candidates`.

---

## What comes after the curated movement layer

Once the movement layer is stable enough, then expand into:
- hand-authored combinations
- richer S&C exercises
- richer running exercises
- workout templates for Skool companion training
- progress tracking around completed workouts

That is a later architecture phase.
The first one is boxing moves, combinations, exercises, and workout composition.

---

## Blunt take

If the curated movement layer is shaky, every other training layer gets shaky on top of it.

So the architecture right now should stay boring and disciplined:
- curate moves
- build combinations and exercises cleanly
- build workouts
- then expand

That is how this avoids turning back into a mess.