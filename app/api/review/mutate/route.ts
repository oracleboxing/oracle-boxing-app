import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Drill, Json, RawDrillCandidate } from '@/lib/supabase/types'

type ReviewAction = 'approve' | 'reject' | 'merge'

type ReviewMutationPayload = {
  action?: ReviewAction
  candidateIds?: string[]
  canonicalDrillId?: string
  reviewNotes?: string | null
}

type DrillSeed = Database['public']['Tables']['moves']['Insert']

function isReviewAction(value: unknown): value is ReviewAction {
  return value === 'approve' || value === 'reject' || value === 'merge'
}

function normaliseCandidateIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function getDisplayTitle(candidate: Pick<RawDrillCandidate, 'cleaned_title' | 'raw_title'>) {
  return candidate.cleaned_title?.trim() || candidate.raw_title?.trim() || 'Untitled drill'
}

function getSummary(candidate: Pick<RawDrillCandidate, 'summary' | 'what_it_trains' | 'description' | 'cleaned_title' | 'raw_title'>) {
  return candidate.summary?.trim() || candidate.what_it_trains?.trim() || candidate.description?.trim() || getDisplayTitle(candidate)
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'drill'
}

async function ensureUniqueSlug(baseSlug: string) {
  const supabase = createAdminClient()
  let candidateSlug = baseSlug
  let suffix = 2

  while (true) {
    const { data, error } = await supabase.from('moves').select('id').eq('slug', candidateSlug).maybeSingle()

    if (error) {
      throw new Error(`Could not validate move slug uniqueness: ${error.message}`)
    }

    if (!data) return candidateSlug

    candidateSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

function asStringList(value: Json | null) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

function uniqueStrings(...lists: Array<string[] | null | undefined>) {
  return Array.from(
    new Set(
      lists
        .flatMap((list) => list ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function uniqueJsonList(...values: Array<Json | null | undefined>): Json {
  return uniqueStrings(...values.map((value) => asStringList(value ?? null)))
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function mergeReviewNotes(existing: string | null, incoming: string | null | undefined) {
  const next = incoming?.trim()
  if (!next) return existing
  if (!existing?.trim()) return next
  if (existing.includes(next)) return existing
  return `${existing.trim()}\n\n${next}`
}

function seedDrillFromCandidate(candidate: RawDrillCandidate, slug: string): DrillSeed {
  return {
    title: getDisplayTitle(candidate),
    slug,
    summary: getSummary(candidate),
    description: candidate.description,
    category: candidate.category,
    difficulty: candidate.difficulty,
    grade_level: candidate.grade_level,
    format_tags: candidate.format_tags,
    skill_tags: candidate.skill_tags,
    tags: candidate.tags,
    steps_json: candidate.steps_json,
    focus_points_json: candidate.focus_points_json,
    common_mistakes_json: candidate.common_mistakes_json,
    what_it_trains: candidate.what_it_trains,
    when_to_assign: candidate.when_to_assign,
    coach_demo_quote: candidate.coach_demo_quote,
    source_type: candidate.source_type,
    source_file: candidate.source_file,
    raw_candidate_ids: [candidate.id],
    is_active: true,
    is_curated: true,
  }
}

async function loadCandidates(candidateIds: string[]) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('raw_drill_candidates')
    .select('*')
    .in('id', candidateIds)

  if (error) {
    throw new Error(`Could not load raw drill candidates: ${error.message}`)
  }

  const candidates = (data ?? []) as RawDrillCandidate[]

  if (candidates.length !== candidateIds.length) {
    const foundIds = new Set(candidates.map((candidate) => candidate.id))
    const missing = candidateIds.filter((id) => !foundIds.has(id))
    throw new Error(`Some raw drill candidates were missing: ${missing.join(', ')}`)
  }

  return candidates
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewMutationPayload
    const action = body.action
    const candidateIds = normaliseCandidateIds(body.candidateIds)
    const reviewNotes = body.reviewNotes ?? null

    if (!isReviewAction(action)) {
      return NextResponse.json({ error: 'Invalid review action.' }, { status: 400 })
    }

    if (candidateIds.length === 0) {
      return NextResponse.json({ error: 'Pick at least one raw drill candidate.' }, { status: 400 })
    }

    if (action === 'merge' && (!body.canonicalDrillId || !body.canonicalDrillId.trim())) {
      return NextResponse.json({ error: 'Merge needs a target canonical move.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const candidates = await loadCandidates(candidateIds)

    if (action === 'approve') {
      let approvedCount = 0

      for (const candidate of candidates) {
        const slug = await ensureUniqueSlug(slugify(candidate.slug_candidate || getDisplayTitle(candidate)))
        const seed = seedDrillFromCandidate(candidate, slug)

        const { data: insertedDrill, error: insertError } = await (supabase.from('moves') as any)
          .insert(seed)
          .select('id')
          .single()

        if (insertError || !insertedDrill) {
          throw new Error(`Could not create canonical move for ${getDisplayTitle(candidate)}: ${insertError?.message || 'unknown error'}`)
        }

        const { error: updateError } = await (supabase.from('raw_drill_candidates') as any)
          .update({
            review_status: 'approved',
            canonical_move_id: insertedDrill.id,
            review_notes: mergeReviewNotes(candidate.review_notes, reviewNotes),
          })
          .eq('id', candidate.id)

        if (updateError) {
          throw new Error(`Could not mark ${getDisplayTitle(candidate)} as approved: ${updateError.message}`)
        }

        approvedCount += 1
      }

      revalidatePath('/review')
      revalidatePath('/drills')

      return NextResponse.json({
        ok: true,
        message: approvedCount === 1 ? 'Approved candidate into the move library.' : `Approved ${approvedCount} candidates into the move library.`,
      })
    }

    if (action === 'reject') {
      const updates = candidates.map((candidate) => ({
        id: candidate.id,
        review_status: 'rejected' as const,
        canonical_move_id: null,
        review_notes: mergeReviewNotes(candidate.review_notes, reviewNotes),
      }))

      for (const update of updates) {
        const { error } = await (supabase.from('raw_drill_candidates') as any)
          .update({
            review_status: update.review_status,
            canonical_move_id: update.canonical_move_id,
            review_notes: update.review_notes,
          })
          .eq('id', update.id)

        if (error) {
          throw new Error(`Could not reject raw candidate ${update.id}: ${error.message}`)
        }
      }

      revalidatePath('/review')
      revalidatePath('/drills')

      return NextResponse.json({
        ok: true,
        message: updates.length === 1 ? 'Rejected candidate.' : `Rejected ${updates.length} candidates.`,
      })
    }

    const canonicalDrillId = body.canonicalDrillId!.trim()
    const { data: targetDrill, error: targetError } = await supabase
      .from('moves')
      .select('*')
      .eq('id', canonicalDrillId)
      .single()

    if (targetError || !targetDrill) {
      throw new Error(`Could not load target canonical move: ${targetError?.message || canonicalDrillId}`)
    }

    const drill = targetDrill as Drill
    const mergedFromCandidates = candidates.reduce(
      (acc, candidate) => {
        acc.summary = firstNonEmpty(acc.summary, candidate.summary, candidate.what_it_trains, candidate.description) || acc.summary
        acc.description = firstNonEmpty(acc.description, candidate.description, candidate.summary)
        acc.whatItTrains = firstNonEmpty(acc.whatItTrains, candidate.what_it_trains, candidate.summary)
        acc.whenToAssign = firstNonEmpty(acc.whenToAssign, candidate.when_to_assign)
        acc.coachDemoQuote = firstNonEmpty(acc.coachDemoQuote, candidate.coach_demo_quote)
        acc.sourceFile = firstNonEmpty(acc.sourceFile, candidate.source_file)
        acc.sourceType = acc.sourceType ?? candidate.source_type
        acc.category = acc.category ?? candidate.category
        acc.gradeLevel = acc.gradeLevel ?? candidate.grade_level
        acc.difficulty = acc.difficulty ?? candidate.difficulty
        return acc
      },
      {
        summary: drill.summary,
        description: drill.description,
        whatItTrains: drill.what_it_trains,
        whenToAssign: drill.when_to_assign,
        coachDemoQuote: drill.coach_demo_quote,
        sourceFile: drill.source_file,
        sourceType: drill.source_type,
        category: drill.category,
        gradeLevel: drill.grade_level,
        difficulty: drill.difficulty,
      }
    )

    const { error: drillUpdateError } = await (supabase.from('moves') as any)
      .update({
        summary: mergedFromCandidates.summary || drill.summary,
        description: mergedFromCandidates.description,
        what_it_trains: mergedFromCandidates.whatItTrains,
        when_to_assign: mergedFromCandidates.whenToAssign,
        coach_demo_quote: mergedFromCandidates.coachDemoQuote,
        source_file: mergedFromCandidates.sourceFile,
        source_type: mergedFromCandidates.sourceType,
        category: mergedFromCandidates.category,
        grade_level: mergedFromCandidates.gradeLevel,
        difficulty: mergedFromCandidates.difficulty,
        raw_candidate_ids: uniqueStrings(drill.raw_candidate_ids, candidates.map((candidate) => candidate.id)),
        format_tags: uniqueStrings(drill.format_tags, ...candidates.map((candidate) => candidate.format_tags)),
        skill_tags: uniqueStrings(drill.skill_tags, ...candidates.map((candidate) => candidate.skill_tags)),
        tags: uniqueStrings(drill.tags, ...candidates.map((candidate) => candidate.tags)),
        steps_json: uniqueJsonList(drill.steps_json, ...candidates.map((candidate) => candidate.steps_json)),
        focus_points_json: uniqueJsonList(drill.focus_points_json, ...candidates.map((candidate) => candidate.focus_points_json)),
        common_mistakes_json: uniqueJsonList(drill.common_mistakes_json, ...candidates.map((candidate) => candidate.common_mistakes_json)),
      })
      .eq('id', drill.id)

    if (drillUpdateError) {
      throw new Error(`Could not merge into canonical move ${drill.title}: ${drillUpdateError.message}`)
    }

    for (const candidate of candidates) {
      const { error } = await (supabase.from('raw_drill_candidates') as any)
        .update({
          review_status: 'merged',
          canonical_move_id: drill.id,
          review_notes: mergeReviewNotes(candidate.review_notes, reviewNotes),
        })
        .eq('id', candidate.id)

      if (error) {
        throw new Error(`Could not mark ${getDisplayTitle(candidate)} as merged: ${error.message}`)
      }
    }

    revalidatePath('/review')
    revalidatePath('/drills')

    return NextResponse.json({
      ok: true,
      message: candidates.length === 1 ? `Merged candidate into ${drill.title}.` : `Merged ${candidates.length} candidates into ${drill.title}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review mutation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
