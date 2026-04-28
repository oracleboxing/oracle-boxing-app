# Workouts Architecture & Execution Plan

This document outlines how the Oracle Boxing App composes, delivers, and executes workouts using the newly established canonical movement library (`moves`, `combinations`, `exercises`).

## 1. The Core Schema

The old MVP assumed workouts were made exclusively of "drills". The new architecture acknowledges that a boxing session is structured into blocks containing different types of curated items.

- **`workouts`**: The overarching session template. Contains title, summary, discipline (e.g. `boxing`), difficulty, and estimated duration.
- **`workout_items`**: The ordered blocks of a workout. A workout is built sequentially from items (e.g., Block 1: Warmup, Block 2: Shadowboxing Round 1, Block 3: Heavy Bag Round 1). Each item specifies an `item_type` (warmup, skill, conditioning) and a duration.
- **Components (`workout_item_moves`, `workout_item_combinations`, `workout_item_exercises`)**: Link the curated canonical content to a specific `workout_item`. This allows a single round (item) to prescribe 3 specific combinations and 1 defensive move to practice.

## 2. Admin: The Workout Builder

We need an internal UI to assemble `workouts`.

**Flow:**
1. Create a `workout`.
2. Add `workout_items` (blocks/rounds). For a standard boxing session, this might be 10-12 blocks (warmups, 6x rounds, cooldown).
3. Inside each `workout_item`, assign specific canonical `moves`, `combinations`, or `exercises` from the library.
4. Set the `duration_seconds` for each block (e.g., 180s for a standard round, 60s for rest).

*Next Step:* Build `/admin/workouts/builder` (or similar) to replace the old drill-centric template builder.

## 3. User: Workout Execution (The Timer Prototype)

A prototype timer exists at `/workout/run`. The next phase is wiring this prototype to the actual `workouts` schema.

**Execution Flow:**
1. **Load:** The user hits "Start Workout" and the app loads the `workout` and its ordered `workout_items`.
2. **Display:** The timer counts down the `duration_seconds` of the current `workout_item`.
3. **Instruction:** The screen displays the linked `moves` and `combinations` for the current block. For example, "Round 2: Focus on Jab - Cross - Lead Hook".
4. **Transition:** When the timer hits 0, it auto-advances to the next `workout_item` (e.g., Rest), giving an audio cue (bell).

*Next Step:* Wire `TimerPrototype.tsx` to read from the live Supabase schema instead of `MOCK_WORKOUT`.

## 4. Progress Tracking (Future)

To be built after the execution layer is stable:
- `workout_sessions` (or `workout_logs`) to track completion state.
- Skool companion integration to push completion data or celebrate streaks.
