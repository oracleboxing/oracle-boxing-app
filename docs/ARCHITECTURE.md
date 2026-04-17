# Architecture Guide

This rebuild is now intentionally simpler than the old app direction.

The goal is to build the Oracle Boxing app on top of:
- clean drills
- clean workouts
- clean data structure

Not on old MVP clutter.

---

## Current architectural priority

The correct order is:
1. raw drill intake
2. drill curation
3. canonical drill library
4. workout composition
5. wider training architecture

That means the foundation right now is the drill layer.

---

## Rebuild shape

### App routes that matter right now
- `/` = rebuild workspace landing page
- `/schema` = visual schema mock

The repo is currently being used more as a structured rebuild surface than a finished product shell.

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

### Curated drill layer
Source table:
- `drills`

Purpose:
- hold reusable canonical drills
- provide stable app-facing content
- act as the only drill source the real library UI should depend on

### Workout layer
Planned tables:
- `workouts`
- `workout_items`
- `workout_item_drills`

Purpose:
- compose sessions from curated drills
- support multiple drills inside a single workout block
- preserve ordering at both block level and drill level

---

## Why the two-layer drill model matters

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

Current working drill categories:
- `stance`
- `punching`
- `footwork`
- `defence`
- `combination`
- `warmup`

Keep this tight unless a real product reason appears.

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
- helps shape curated drill content
- can build UI against the documented schema

### Agent
- extracts content
- documents the model
- proposes canonical merges
- helps wire the review workflow

---

## What should be built in the app next

### First useful internal UI
A simple review surface for pending raw drill candidates.

That UI should let someone:
- pull pending candidates
- inspect steps / focus points / mistakes
- approve
- reject
- merge into canonical drills later

### First useful product UI
A simple drill library that reads from:
- `drills`

Not `raw_drill_candidates`.

---

## What comes after drills

Once the drill layer is stable enough, then expand into:
- S&C exercises
- running exercises
- themes
- templates

That is a later architecture phase.
The first one is boxing drill content and workout composition.

---

## Blunt take

If the drill layer is shaky, every other training layer gets shaky on top of it.

So the architecture right now should stay boring and disciplined:
- curate drills
- build workouts
- then expand

That is how this avoids turning back into a mess.