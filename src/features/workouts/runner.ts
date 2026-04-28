import { createClient } from '@/lib/supabase/server'
import type { Database, WorkoutItemType } from '@/lib/supabase/types'

export type RunnableWorkoutBlockType = 'prep' | 'work' | 'rest'

export type RunnableWorkoutBlock = {
  id: string
  type: RunnableWorkoutBlockType
  durationSeconds: number
  title: string
  instructions: string[]
  sourceItemType?: WorkoutItemType | null
}

export type RunnableWorkout = {
  id: string
  title: string
  summary: string | null
  estimatedDurationMinutes: number | null
  blocks: RunnableWorkoutBlock[]
}

export type WorkoutRunnerLoadResult = {
  workout: RunnableWorkout
  dataSource: 'supabase' | 'fallback'
  notice?: string
}

type WorkoutRow = Database['public']['Tables']['workouts']['Row']
type WorkoutItemRow = Database['public']['Tables']['workout_items']['Row']

const FALLBACK_WORKOUT: RunnableWorkout = {
  id: 'prototype-grade-1-basics',
  title: 'Grade 1 Basics Prototype',
  summary: 'A runner-safe demo workout while the clean workouts schema waits to be applied live.',
  estimatedDurationMinutes: 11,
  blocks: [
    {
      id: 'prep-1',
      type: 'prep',
      durationSeconds: 10,
      title: 'Get Ready',
      instructions: ['Wrap up', 'Gloves on', 'Find your stance'],
    },
    {
      id: 'round-1',
      type: 'work',
      durationSeconds: 180,
      title: 'Round 1: Basics',
      instructions: ['Jab - Cross', 'Keep hands up', 'Move after every combo'],
    },
    {
      id: 'rest-1',
      type: 'rest',
      durationSeconds: 60,
      title: 'Rest',
      instructions: ['Breathe through the nose', 'Keep the shoulders loose'],
    },
    {
      id: 'round-2',
      type: 'work',
      durationSeconds: 180,
      title: 'Round 2: Add The Hook',
      instructions: ['Jab - Cross - Lead Hook', 'Pivot on the hook', 'Reset to guard instantly'],
    },
    {
      id: 'rest-2',
      type: 'rest',
      durationSeconds: 60,
      title: 'Rest',
      instructions: ['Slow the breathing down', 'Stay switched on for the final round'],
    },
    {
      id: 'round-3',
      type: 'work',
      durationSeconds: 180,
      title: 'Round 3: Controlled Burnout',
      instructions: ['Sharp 1-2s', 'Do not reach', 'Finish every exchange balanced'],
    },
  ],
}

const EMPTY_ENV_NOTICE =
  'Supabase env vars are missing, so the runner is showing the local prototype workout.'

const SCHEMA_PENDING_NOTICE =
  'Live Supabase does not expose the clean workouts tables yet, so the runner is showing the local prototype workout.'

export async function loadWorkoutRunnerData(slug?: string): Promise<WorkoutRunnerLoadResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return fallbackResult(EMPTY_ENV_NOTICE)
  }

  try {
    const supabase = await createClient()
    let workoutQuery = supabase
      .from('workouts')
      .select('id, title, slug, summary, description, discipline, difficulty, estimated_duration_minutes, is_published, created_at, updated_at')
      .eq('is_published', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (slug) {
      workoutQuery = workoutQuery.eq('slug', slug)
    }

    const { data: workouts, error: workoutError } = await workoutQuery

    if (workoutError) {
      return fallbackResult(SCHEMA_PENDING_NOTICE)
    }

    const workout = workouts?.[0] as WorkoutRow | undefined

    if (!workout) {
      return fallbackResult('No published workouts found yet, so the runner is showing the local prototype workout.')
    }

    const { data: items, error: itemsError } = await supabase
      .from('workout_items')
      .select('id, workout_id, title, item_type, order_index, notes, duration_seconds, created_at, updated_at')
      .eq('workout_id', workout.id)
      .order('order_index', { ascending: true })

    if (itemsError) {
      return fallbackResult(SCHEMA_PENDING_NOTICE)
    }

    const blocks = ((items ?? []) as WorkoutItemRow[])
      .filter((item) => item.duration_seconds && item.duration_seconds > 0)
      .map(workoutItemToBlock)

    if (blocks.length === 0) {
      return fallbackResult('The published workout has no timed blocks yet, so the runner is showing the local prototype workout.')
    }

    return {
      dataSource: 'supabase',
      workout: {
        id: workout.id,
        title: workout.title,
        summary: workout.summary,
        estimatedDurationMinutes: workout.estimated_duration_minutes,
        blocks,
      },
    }
  } catch {
    return fallbackResult(SCHEMA_PENDING_NOTICE)
  }
}

export function getFallbackWorkout(): RunnableWorkout {
  return FALLBACK_WORKOUT
}

function fallbackResult(notice: string): WorkoutRunnerLoadResult {
  return {
    dataSource: 'fallback',
    notice,
    workout: FALLBACK_WORKOUT,
  }
}

function workoutItemToBlock(item: WorkoutItemRow): RunnableWorkoutBlock {
  return {
    id: item.id,
    type: mapWorkoutItemType(item.item_type),
    durationSeconds: item.duration_seconds ?? 60,
    title: item.title,
    instructions: notesToInstructions(item.notes),
    sourceItemType: item.item_type,
  }
}

function mapWorkoutItemType(itemType: WorkoutItemType | null): RunnableWorkoutBlockType {
  if (itemType === 'recovery') return 'rest'
  if (itemType === 'warmup') return 'prep'
  return 'work'
}

function notesToInstructions(notes: string | null): string[] {
  if (!notes) return ['Follow the block focus and stay technically clean.']

  return notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}
