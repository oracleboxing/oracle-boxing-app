'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AiDecision, Drill, Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'merged', 'rejected']
const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  merged: 'Merged',
  rejected: 'Rejected',
}

const STATUS_SORT_ORDER: Record<ReviewStatus, number> = {
  pending: 0,
  approved: 1,
  merged: 2,
  rejected: 3,
}

type SortMode = 'triage' | 'pending-first' | 'duplicate-pressure' | 'completeness' | 'newest' | 'grade'
type AiDecisionFilter = 'all' | AiDecision | 'none'

const SORT_MODE_LABELS: Record<SortMode, string> = {
  triage: 'Best next triage',
  'pending-first': 'Pending first',
  'duplicate-pressure': 'Duplicate pressure',
  completeness: 'Most complete',
  newest: 'Newest first',
  grade: 'Grade order',
}

type TriageLevel = 'act-now' | 'worth-a-look' | 'low-signal' | 'already-reviewed'
type CompletenessBand = 'thin' | 'usable' | 'rich'

const COMPLETENESS_BAND_LABELS: Record<CompletenessBand, string> = {
  thin: 'Thin extract',
  usable: 'Usable extract',
  rich: 'Rich extract',
}

type CandidateInsight = {
  familySize: number
  stepsCount: number
  focusPointsCount: number
  mistakesCount: number
  completenessScore: number
  completenessLabel: string
  triageLevel: TriageLevel
  triageScore: number
  triageSummary: string
}

type FamilyDecision = 'keep' | 'merge' | 'reject'
type ReviewMutationAction = 'approve' | 'reject' | 'merge'

const REVIEW_ACTION_STATUS: Record<ReviewMutationAction, ReviewStatus> = {
  approve: 'approved',
  reject: 'rejected',
  merge: 'merged',
}

type DrillMatch = Pick<
  Drill,
  'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
> & {
  matchScore: number
  matchReasons: string[]
}

function getAiDecisionTone(decision: AiDecision | null) {
  switch (decision) {
    case 'approve':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merge':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'reject':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
    case 'review':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
  }
}

function getAiDecisionLabel(decision: AiDecision | null) {
  switch (decision) {
    case 'approve':
      return 'AI approve'
    case 'merge':
      return 'AI merge'
    case 'reject':
      return 'AI reject'
    case 'review':
      return 'AI review'
    default:
      return 'No AI triage yet'
  }
}

function getAiDecisionFilterValue(decision: AiDecision | null): Exclude<AiDecisionFilter, 'all'> {
  return decision ?? 'none'
}

function isAiDecisionFilter(value: string | null): value is AiDecisionFilter {
  return value === 'all' || value === 'approve' || value === 'merge' || value === 'review' || value === 'reject' || value === 'none'
}

function getAiDecisionFilterLabel(value: AiDecisionFilter) {
  return value === 'all' ? 'All AI recommendations' : getAiDecisionLabel(value === 'none' ? null : value)
}

function formatGradeLevel(value: string | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDifficultyLabel(value: string | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function countJsonItems(value: Json | null) {
  return Array.isArray(value) ? value.length : 0
}

function jsonToStringList(value: Json | null) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  const year = date.getUTCFullYear()
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')

  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`
}

function getSourceLabel(candidate: RawDrillCandidate) {
  return candidate.source_file || candidate.source_type || 'Unknown source'
}

function getDisplayTitle(candidate: RawDrillCandidate) {
  return candidate.cleaned_title || candidate.raw_title || 'Untitled candidate'
}

function getShortSummary(candidate: RawDrillCandidate) {
  return candidate.summary || candidate.what_it_trains || candidate.description || 'No summary yet.'
}

function getCandidateDecisionHint(candidate: RawDrillCandidate, insight: CandidateInsight): FamilyDecision {
  if (candidate.review_status === 'rejected') return 'reject'
  if (candidate.review_status === 'merged') return 'merge'
  if (candidate.review_status === 'approved') return 'keep'
  if (candidate.canonical_drill_id) return 'merge'
  if (insight.familySize >= 2 && insight.completenessScore >= 4 && insight.triageScore >= 4) return 'keep'
  if (insight.familySize >= 2 && insight.completenessScore <= 2) return 'reject'
  if (insight.familySize >= 2) return 'merge'
  return insight.completenessScore >= 4 ? 'keep' : 'reject'
}

function getDecisionTone(decision: FamilyDecision) {
  switch (decision) {
    case 'keep':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merge':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'reject':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }
}

function getDecisionLabel(decision: FamilyDecision) {
  switch (decision) {
    case 'keep':
      return 'Keep as canonical seed'
    case 'merge':
      return 'Merge into family winner'
    case 'reject':
      return 'Reject as duplicate/noisy'
  }
}

function getCandidateReadinessGaps(candidate: RawDrillCandidate, insight: CandidateInsight) {
  const gaps: string[] = []

  if (!candidate.summary && !candidate.what_it_trains && !candidate.description) {
    gaps.push('Needs a usable summary or training note')
  }

  if (insight.stepsCount === 0) {
    gaps.push('No steps extracted yet')
  }

  if (insight.focusPointsCount === 0) {
    gaps.push('No focus points extracted yet')
  }

  if (!candidate.grade_level) {
    gaps.push('Missing grade tag')
  }

  if (!candidate.category) {
    gaps.push('Missing category')
  }

  return gaps
}

function getReviewerNextMove(candidate: RawDrillCandidate, insight: CandidateInsight) {
  const decision = getCandidateDecisionHint(candidate, insight)
  const gaps = getCandidateReadinessGaps(candidate, insight)

  if (decision === 'keep') {
    return gaps.length === 0
      ? 'Strong candidate, use this as the canonical starting point.'
      : `Likely canonical seed, but patch ${gaps[0].toLowerCase()} first.`
  }

  if (decision === 'merge') {
    return candidate.canonical_drill_id
      ? 'Already points at a canonical drill, review as supporting merge material.'
      : 'Compare against the best family row or likely library match, then fold over only the useful bits.'
  }

  return gaps.length === 0
    ? 'Probably reject, unless a reviewer spots unique coaching value in the wording.'
    : `Probably reject. Main issue: ${gaps[0].toLowerCase()}.`
}

function getStatusTone(status: ReviewStatus) {
  switch (status) {
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merged':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }
}

function getTriageTone(level: TriageLevel) {
  switch (level) {
    case 'act-now':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
    case 'worth-a-look':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
    case 'low-signal':
      return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
    case 'already-reviewed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  }
}

function getTriageLabel(level: TriageLevel) {
  switch (level) {
    case 'act-now':
      return 'Act now'
    case 'worth-a-look':
      return 'Worth a look'
    case 'low-signal':
      return 'Low signal'
    case 'already-reviewed':
      return 'Already reviewed'
  }
}

function getCompletenessBand(insight: CandidateInsight): CompletenessBand {
  if (insight.completenessScore >= 5) return 'rich'
  if (insight.completenessScore >= 3) return 'usable'
  return 'thin'
}

function getGradeSortValue(value: string | null) {
  switch (value) {
    case 'grade_1':
      return 1
    case 'grade_2':
      return 2
    case 'grade_3':
      return 3
    default:
      return 99
  }
}

function getNextReviewSelection(candidateIds: string[], orderedCandidateIds: string[], currentSelectedId: string | null) {
  if (orderedCandidateIds.length === 0) return null

  const removedIds = new Set(candidateIds)
  const anchorId = currentSelectedId && removedIds.has(currentSelectedId) ? currentSelectedId : candidateIds[0]
  const anchorIndex = orderedCandidateIds.findIndex((id) => id === anchorId)

  if (anchorIndex === -1) {
    return orderedCandidateIds.find((id) => !removedIds.has(id)) ?? null
  }

  for (let index = anchorIndex + 1; index < orderedCandidateIds.length; index += 1) {
    if (!removedIds.has(orderedCandidateIds[index])) return orderedCandidateIds[index]
  }

  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    if (!removedIds.has(orderedCandidateIds[index])) return orderedCandidateIds[index]
  }

  return null
}

function getNextPendingReviewSelection(
  candidateIds: string[],
  pendingCandidateIds: string[],
  orderedCandidateIds: string[],
  currentSelectedId: string | null
) {
  return (
    getNextReviewSelection(candidateIds, pendingCandidateIds, currentSelectedId) ??
    getNextReviewSelection(candidateIds, orderedCandidateIds, currentSelectedId)
  )
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  const interactiveParent = target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="link"]')
  return Boolean(interactiveParent || target.isContentEditable)
}

function normaliseTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

function getOverlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return left.filter((token) => rightSet.has(token)).length
}

function scoreDrillMatch(
  candidate: RawDrillCandidate,
  drill: Pick<
    Drill,
    'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
  >
): DrillMatch | null {
  let matchScore = 0
  const matchReasons: string[] = []

  if (candidate.canonical_drill_id && candidate.canonical_drill_id === drill.id) {
    matchScore += 10
    matchReasons.push('already linked as canonical')
  }

  if (drill.raw_candidate_ids.includes(candidate.id)) {
    matchScore += 8
    matchReasons.push('already references this raw candidate')
  }

  if (candidate.grade_level && candidate.grade_level === drill.grade_level) {
    matchScore += 2
    matchReasons.push(`same ${formatGradeLevel(candidate.grade_level)} tag`)
  }

  if (candidate.category && candidate.category === drill.category) {
    matchScore += 2
    matchReasons.push('same category')
  }

  if (candidate.difficulty === drill.difficulty) {
    matchScore += 1
    matchReasons.push('same difficulty')
  }

  const candidateTitleTokens = normaliseTokens(`${candidate.cleaned_title || ''} ${candidate.raw_title || ''}`)
  const drillTitleTokens = normaliseTokens(drill.title)
  const titleOverlap = getOverlapCount(candidateTitleTokens, drillTitleTokens)

  if (titleOverlap >= 2) {
    matchScore += 4
    matchReasons.push(`title overlap (${titleOverlap})`)
  } else if (titleOverlap === 1) {
    matchScore += 1
    matchReasons.push('light title overlap')
  }

  const candidateTagTokens = Array.from(new Set([...(candidate.skill_tags ?? []), ...(candidate.tags ?? [])].map((item) => item.toLowerCase())))
  const drillTagTokens = Array.from(new Set([...(drill.skill_tags ?? []), ...(drill.tags ?? [])].map((item) => item.toLowerCase())))
  const tagOverlap = getOverlapCount(candidateTagTokens, drillTagTokens)

  if (tagOverlap >= 2) {
    matchScore += 3
    matchReasons.push(`tag overlap (${tagOverlap})`)
  } else if (tagOverlap === 1) {
    matchScore += 1
    matchReasons.push('shared tag')
  }

  if (matchScore <= 0) return null

  return {
    ...drill,
    matchScore,
    matchReasons,
  }
}

function getCreatedAtTimestamp(value: string | null) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function buildCandidateInsight(candidate: RawDrillCandidate, familySize: number): CandidateInsight {
  const stepsCount = countJsonItems(candidate.steps_json)
  const focusPointsCount = countJsonItems(candidate.focus_points_json)
  const mistakesCount = countJsonItems(candidate.common_mistakes_json)
  const hasSummaryLike = Boolean(candidate.summary || candidate.what_it_trains || candidate.description)
  const completenessScore = [
    hasSummaryLike,
    stepsCount > 0,
    focusPointsCount > 0,
    mistakesCount > 0,
    Boolean(candidate.coach_demo_quote),
    Boolean(candidate.when_to_assign),
  ].filter(Boolean).length

  const completenessLabel =
    completenessScore >= 5 ? 'Rich extract' : completenessScore >= 3 ? 'Usable extract' : 'Thin extract'

  if (candidate.review_status !== 'pending') {
    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'already-reviewed',
      triageScore: -100 + completenessScore,
      triageSummary: `Already ${REVIEW_STATUS_LABELS[candidate.review_status].toLowerCase()}, so it is not the next triage target.`,
    }
  }

  let triageScore = 0
  const strengths: string[] = []
  const cautions: string[] = []

  if (familySize >= 5) {
    triageScore += 5
    strengths.push(`${familySize} rows in this duplicate family`)
  } else if (familySize >= 3) {
    triageScore += 3
    strengths.push(`${familySize} rows share this family`)
  } else if (familySize === 1) {
    triageScore -= 1
    cautions.push('isolated row')
  }

  if (candidate.canonical_drill_id) {
    triageScore += 3
    strengths.push('already linked to a canonical drill')
  }

  if (completenessScore >= 5) {
    triageScore += 3
    strengths.push(`${completenessScore}/6 extraction coverage`)
  } else if (completenessScore >= 3) {
    triageScore += 1
    strengths.push(`${completenessScore}/6 extraction coverage`)
  } else {
    triageScore -= 3
    cautions.push('thin extraction')
  }

  if (!hasSummaryLike) {
    triageScore -= 2
    cautions.push('missing summary')
  }

  if (!candidate.grade_level) {
    triageScore -= 1
    cautions.push('no grade yet')
  }

  if (familySize >= 3 && completenessScore >= 4) {
    triageScore += 2
  }

  if (triageScore >= 7) {
    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'act-now',
      triageScore,
      triageSummary: `Why now: ${(strengths.length > 0 ? strengths : ['clear duplicate pressure']).slice(0, 2).join(', ')}.`,
    }
  }

  if (triageScore >= 3) {
    const balancedReasons = [strengths[0], cautions[0]].filter(Boolean)

    return {
      familySize,
      stepsCount,
      focusPointsCount,
      mistakesCount,
      completenessScore,
      completenessLabel,
      triageLevel: 'worth-a-look',
      triageScore,
      triageSummary: `Useful next: ${(balancedReasons.length > 0 ? balancedReasons : ['some structure is present']).slice(0, 2).join(', ')}.`,
    }
  }

  return {
    familySize,
    stepsCount,
    focusPointsCount,
    mistakesCount,
    completenessScore,
    completenessLabel,
    triageLevel: 'low-signal',
    triageScore,
    triageSummary: `Low signal: ${(cautions.length > 0 ? cautions : ['not much extracted yet']).slice(0, 3).join(', ')}.`,
  }
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

export function ReviewQueueClient({
  candidates,
  drills,
}: {
  candidates: RawDrillCandidate[]
  drills: Pick<
    Drill,
    'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
  >[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedCandidateFromUrl = searchParams.get('selected')
  const returnToLibraryHref = useMemo(() => {
    const value = searchParams.get('from')
    if (!value || !value.startsWith('/drills')) return null
    return value
  }, [searchParams])
  const scopedCandidateIds = useMemo(() => {
    const rawIds = searchParams.get('ids')
    if (!rawIds) return null

    const ids = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    return ids.length > 0 ? Array.from(new Set(ids)) : null
  }, [searchParams])
  const scopeRequestedCount = scopedCandidateIds?.length ?? 0
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>(() => {
    const value = searchParams.get('status')
    return value === 'all' || REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as 'all' | ReviewStatus) || 'pending' : 'pending'
  })
  const [gradeFilter, setGradeFilter] = useState<'all' | string>(() => searchParams.get('grade') ?? 'all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | string>(() => searchParams.get('difficulty') ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>(() => searchParams.get('category') ?? 'all')
  const [sourceFilter, setSourceFilter] = useState<'all' | string>(() => searchParams.get('source') ?? 'all')
  const [aiDecisionFilter, setAiDecisionFilter] = useState<AiDecisionFilter>(() => {
    const value = searchParams.get('ai')
    return isAiDecisionFilter(value) ? value : 'all'
  })
  const [triageFilter, setTriageFilter] = useState<'all' | TriageLevel>(() => {
    const value = searchParams.get('triage')
    return value === 'all' || value === 'act-now' || value === 'worth-a-look' || value === 'low-signal' || value === 'already-reviewed'
      ? ((value as 'all' | TriageLevel) ?? 'all')
      : 'all'
  })
  const [completenessFilter, setCompletenessFilter] = useState<'all' | CompletenessBand>(() => {
    const value = searchParams.get('completeness')
    return value === 'all' || value === 'thin' || value === 'usable' || value === 'rich' ? ((value as 'all' | CompletenessBand) ?? 'all') : 'all'
  })
  const [familyFilter, setFamilyFilter] = useState<string | null>(() => {
    const value = searchParams.get('family')
    return value?.trim() ? value : null
  })
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const value = searchParams.get('sort')
    return value && value in SORT_MODE_LABELS ? (value as SortMode) : 'triage'
  })
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => searchParams.get('selected') ?? candidates[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedCanonicalDrillId, setSelectedCanonicalDrillId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const nextQuery = searchParams.get('q') ?? ''
    const nextStatus = searchParams.get('status')
    const nextGrade = searchParams.get('grade') ?? 'all'
    const nextDifficulty = searchParams.get('difficulty') ?? 'all'
    const nextCategory = searchParams.get('category') ?? 'all'
    const nextSource = searchParams.get('source') ?? 'all'
    const nextAiDecision = searchParams.get('ai')
    const nextTriage = searchParams.get('triage')
    const nextCompleteness = searchParams.get('completeness')
    const nextFamily = searchParams.get('family')
    const nextSort = searchParams.get('sort')
    const nextSelected = searchParams.get('selected')

    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setStatusFilter((current) => {
      const resolved = nextStatus === 'all' || REVIEW_STATUSES.includes(nextStatus as ReviewStatus) ? (nextStatus as 'all' | ReviewStatus) || 'pending' : 'pending'
      return current === resolved ? current : resolved
    })
    setGradeFilter((current) => (current === nextGrade ? current : nextGrade))
    setDifficultyFilter((current) => (current === nextDifficulty ? current : nextDifficulty))
    setCategoryFilter((current) => (current === nextCategory ? current : nextCategory))
    setSourceFilter((current) => (current === nextSource ? current : nextSource))
    setAiDecisionFilter((current) => {
      const resolved = isAiDecisionFilter(nextAiDecision) ? nextAiDecision : 'all'
      return current === resolved ? current : resolved
    })
    setTriageFilter((current) => {
      const resolved =
        nextTriage === 'all' || nextTriage === 'act-now' || nextTriage === 'worth-a-look' || nextTriage === 'low-signal' || nextTriage === 'already-reviewed'
          ? ((nextTriage as 'all' | TriageLevel) ?? 'all')
          : 'all'
      return current === resolved ? current : resolved
    })
    setCompletenessFilter((current) => {
      const resolved =
        nextCompleteness === 'all' || nextCompleteness === 'thin' || nextCompleteness === 'usable' || nextCompleteness === 'rich'
          ? ((nextCompleteness as 'all' | CompletenessBand) ?? 'all')
          : 'all'
      return current === resolved ? current : resolved
    })
    setFamilyFilter((current) => {
      const resolved = nextFamily?.trim() ? nextFamily : null
      return current === resolved ? current : resolved
    })
    setSortMode((current) => {
      const resolved = nextSort && nextSort in SORT_MODE_LABELS ? (nextSort as SortMode) : 'triage'
      return current === resolved ? current : resolved
    })
    setSelectedCandidateId((current) => {
      const resolved = nextSelected ?? candidates[0]?.id ?? null
      return current === resolved ? current : resolved
    })
  }, [candidates, searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (query.trim()) nextParams.set('q', query)
    else nextParams.delete('q')

    if (statusFilter !== 'pending') nextParams.set('status', statusFilter)
    else nextParams.delete('status')

    if (gradeFilter !== 'all') nextParams.set('grade', gradeFilter)
    else nextParams.delete('grade')

    if (difficultyFilter !== 'all') nextParams.set('difficulty', difficultyFilter)
    else nextParams.delete('difficulty')

    if (categoryFilter !== 'all') nextParams.set('category', categoryFilter)
    else nextParams.delete('category')

    if (sourceFilter !== 'all') nextParams.set('source', sourceFilter)
    else nextParams.delete('source')

    if (aiDecisionFilter !== 'all') nextParams.set('ai', aiDecisionFilter)
    else nextParams.delete('ai')

    if (triageFilter !== 'all') nextParams.set('triage', triageFilter)
    else nextParams.delete('triage')

    if (completenessFilter !== 'all') nextParams.set('completeness', completenessFilter)
    else nextParams.delete('completeness')

    if (familyFilter) nextParams.set('family', familyFilter)
    else nextParams.delete('family')

    if (sortMode !== 'triage') nextParams.set('sort', sortMode)
    else nextParams.delete('sort')

    if (selectedCandidateId) nextParams.set('selected', selectedCandidateId)
    else nextParams.delete('selected')

    const current = searchParams.toString()
    const next = nextParams.toString()

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [aiDecisionFilter, categoryFilter, completenessFilter, difficultyFilter, sourceFilter, triageFilter, familyFilter, gradeFilter, pathname, query, router, searchParams, selectedCandidateId, sortMode, statusFilter])

  const copyFamilyHandoff = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback('Copied family review notes')
    setTimeout(() => setCopyFeedback(null), 3000)
  }, [])

  const selectCandidate = useCallback((candidateId: string, options?: { scrollIntoView?: boolean }) => {
    setSelectedCandidateId(candidateId)

    if (options?.scrollIntoView === false || typeof document === 'undefined') {
      return
    }

    document.getElementById(`candidate-${candidateId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const copyCurrentView = useCallback((label: string) => {
    if (typeof window === 'undefined') return
    navigator.clipboard.writeText(window.location.href)
    setCopyFeedback(label)
    window.setTimeout(() => setCopyFeedback(null), 3000)
  }, [])

  const clearScopedReview = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('ids')
    nextParams.delete('selected')

    const next = nextParams.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const focusFamily = useCallback(
    (dedupeKey: string, nextSelectedId?: string) => {
      setFamilyFilter(dedupeKey)
      if (statusFilter !== 'all') {
        setStatusFilter('all')
      }
      if (nextSelectedId) {
        setSelectedCandidateId(nextSelectedId)
      }
    },
    [statusFilter]
  )

  const clearFamilyFocus = useCallback(() => {
    setFamilyFilter(null)
  }, [])

  const clearAllViewFilters = useCallback(() => {
    setQuery('')
    setStatusFilter('pending')
    setGradeFilter('all')
    setDifficultyFilter('all')
    setCategoryFilter('all')
    setSourceFilter('all')
    setAiDecisionFilter('all')
    setTriageFilter('all')
    setCompletenessFilter('all')
    setFamilyFilter(null)
    setSortMode('triage')
  }, [])

  const toggleGradeFocus = useCallback((grade: string) => {
    setGradeFilter((current) => (current === grade ? 'all' : grade))
  }, [])

  const toggleCategoryFocus = useCallback((category: string) => {
    setCategoryFilter((current) => (current === category ? 'all' : category))
  }, [])

  const toggleDifficultyFocus = useCallback((difficulty: string) => {
    setDifficultyFilter((current) => (current === difficulty ? 'all' : difficulty))
  }, [])

  const toggleSourceFocus = useCallback((source: string) => {
    setSourceFilter((current) => (current === source ? 'all' : source))
  }, [])

  const toggleAiDecisionFocus = useCallback((decision: Exclude<AiDecisionFilter, 'all'>) => {
    setAiDecisionFilter((current) => (current === decision ? 'all' : decision))
  }, [])

  const toggleCompletenessFocus = useCallback((band: CompletenessBand) => {
    setCompletenessFilter((current) => (current === band ? 'all' : band))
  }, [])

  const toggleStatusFocus = useCallback((status: ReviewStatus) => {
    setStatusFilter((current) => (current === status ? 'all' : status))
  }, [])

  const familySizeByKey = useMemo(() => {
    const counts = new Map<string, number>()

    for (const candidate of candidates) {
      if (!candidate.dedupe_key) continue
      counts.set(candidate.dedupe_key, (counts.get(candidate.dedupe_key) ?? 0) + 1)
    }

    return counts
  }, [candidates])

  const candidateInsights = useMemo(() => {
    const insights = new Map<string, CandidateInsight>()

    for (const candidate of candidates) {
      const familySize = candidate.dedupe_key ? familySizeByKey.get(candidate.dedupe_key) ?? 1 : 1
      insights.set(candidate.id, buildCandidateInsight(candidate, familySize))
    }

    return insights
  }, [candidates, familySizeByKey])

  const availableGrades = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.grade_level ?? 'unassigned'))).sort(),
    [candidates]
  )

  const availableCategories = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.category).filter(Boolean))).sort(),
    [candidates]
  )

  const availableDifficulties = useMemo<string[]>(
    () => Array.from(new Set(candidates.map((candidate) => candidate.difficulty ?? 'unassigned'))).sort(),
    [candidates]
  )

  const availableSources = useMemo(
    () => Array.from(new Set(candidates.map((candidate) => candidate.source_file).filter(Boolean) as string[])).sort(),
    [candidates]
  )

  const baseFilteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const scopedIdSet = scopedCandidateIds ? new Set(scopedCandidateIds) : null

    return candidates.filter((candidate) => {
      if (scopedIdSet && !scopedIdSet.has(candidate.id)) return false
      if (statusFilter !== 'all' && candidate.review_status !== statusFilter) return false

      if (gradeFilter !== 'all') {
        const candidateGrade = candidate.grade_level ?? 'unassigned'
        if (candidateGrade !== gradeFilter) return false
      }

      if (difficultyFilter !== 'all') {
        const candidateDifficulty = candidate.difficulty ?? 'unassigned'
        if (candidateDifficulty !== difficultyFilter) return false
      }

      if (categoryFilter !== 'all' && candidate.category !== categoryFilter) return false
      if (sourceFilter !== 'all' && candidate.source_file !== sourceFilter) return false
      if (aiDecisionFilter !== 'all' && getAiDecisionFilterValue(candidate.ai_decision ?? null) !== aiDecisionFilter) return false
      if (familyFilter && candidate.dedupe_key !== familyFilter) return false

      if (!normalizedQuery) return true

      const haystack = [
        candidate.cleaned_title,
        candidate.raw_title,
        candidate.summary,
        candidate.description,
        candidate.what_it_trains,
        candidate.when_to_assign,
        candidate.dedupe_key,
        candidate.source_file,
        candidate.source_type,
        candidate.review_notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [aiDecisionFilter, candidates, query, statusFilter, gradeFilter, difficultyFilter, categoryFilter, sourceFilter, familyFilter, scopedCandidateIds])

  const filteredCandidates = useMemo(() => {
    return baseFilteredCandidates.filter((candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return false
      if (triageFilter !== 'all' && insight.triageLevel !== triageFilter) return false
      if (completenessFilter !== 'all' && getCompletenessBand(insight) !== completenessFilter) return false
      return true
    })
  }, [baseFilteredCandidates, candidateInsights, completenessFilter, triageFilter])

  const sortedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((left, right) => {
      const leftInsight = candidateInsights.get(left.id)
      const rightInsight = candidateInsights.get(right.id)
      const leftCreatedAt = getCreatedAtTimestamp(left.created_at)
      const rightCreatedAt = getCreatedAtTimestamp(right.created_at)
      const leftTitle = getDisplayTitle(left)
      const rightTitle = getDisplayTitle(right)

      if (!leftInsight || !rightInsight) {
        return leftTitle.localeCompare(rightTitle)
      }

      switch (sortMode) {
        case 'triage':
          return (
            rightInsight.triageScore - leftInsight.triageScore ||
            STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
            rightInsight.familySize - leftInsight.familySize ||
            rightCreatedAt - leftCreatedAt ||
            leftTitle.localeCompare(rightTitle)
          )
        case 'pending-first':
          return (
            STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
            rightCreatedAt - leftCreatedAt ||
            rightInsight.familySize - leftInsight.familySize ||
            leftTitle.localeCompare(rightTitle)
          )
        case 'duplicate-pressure':
          return (
            rightInsight.familySize - leftInsight.familySize ||
            STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
            rightInsight.triageScore - leftInsight.triageScore ||
            leftTitle.localeCompare(rightTitle)
          )
        case 'completeness':
          return (
            rightInsight.completenessScore - leftInsight.completenessScore ||
            rightInsight.familySize - leftInsight.familySize ||
            STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
            leftTitle.localeCompare(rightTitle)
          )
        case 'newest':
          return (
            rightCreatedAt - leftCreatedAt ||
            rightInsight.triageScore - leftInsight.triageScore ||
            leftTitle.localeCompare(rightTitle)
          )
        case 'grade':
          return (
            getGradeSortValue(left.grade_level) - getGradeSortValue(right.grade_level) ||
            STATUS_SORT_ORDER[left.review_status] - STATUS_SORT_ORDER[right.review_status] ||
            rightInsight.triageScore - leftInsight.triageScore ||
            leftTitle.localeCompare(rightTitle)
          )
      }
    })
  }, [filteredCandidates, candidateInsights, sortMode])

  const pendingCandidates = sortedCandidates.filter((candidate) => candidate.review_status === 'pending')
  const basePendingCandidates = baseFilteredCandidates.filter((candidate) => candidate.review_status === 'pending')

  const runReviewAction = useCallback(
    async ({
      action,
      candidateIds,
      canonicalDrillId,
      successLabel,
    }: {
      action: ReviewMutationAction
      candidateIds: string[]
      canonicalDrillId?: string
      successLabel: string
    }) => {
      if (candidateIds.length === 0 || isSubmitting) return

      setActionError(null)
      setIsSubmitting(true)

      try {
        const response = await fetch('/api/review/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            candidateIds,
            canonicalDrillId,
          }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Review action failed.')
        }

        const nextStatus = REVIEW_ACTION_STATUS[action]
        const actedRowsWillDisappear = statusFilter !== 'all' && statusFilter !== nextStatus
        const selectedRowWasActedOn = selectedCandidateId ? candidateIds.includes(selectedCandidateId) : false
        const shouldAdvanceSelection = actedRowsWillDisappear || selectedRowWasActedOn || candidateIds.length === 1

        if (shouldAdvanceSelection) {
          const nextSelectedId = getNextPendingReviewSelection(
            candidateIds,
            pendingCandidates.map((candidate) => candidate.id),
            sortedCandidates.map((candidate) => candidate.id),
            selectedCandidateId
          )
          setSelectedCandidateId(nextSelectedId)
        }

        setCopyFeedback(payload?.message || successLabel)
        setSelectedIds((current) => current.filter((id) => !candidateIds.includes(id)))
        window.setTimeout(() => setCopyFeedback(null), 3000)
        router.refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Review action failed.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, pendingCandidates, router, selectedCandidateId, sortedCandidates, statusFilter]
  )

  const statusCounts = REVIEW_STATUSES.map((status) => ({
    status,
    count: sortedCandidates.filter((candidate) => candidate.review_status === status).length,
  }))

  const gradeCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.grade_level ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const categoryCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.category ?? 'uncategorised'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const difficultyCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.difficulty ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const sourceCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = getSourceLabel(candidate)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const aiDecisionCounts = pendingCandidates.reduce<Record<Exclude<AiDecisionFilter, 'all'>, number>>(
    (acc, candidate) => {
      const key = getAiDecisionFilterValue(candidate.ai_decision ?? null)
      acc[key] += 1
      return acc
    },
    {
      approve: 0,
      merge: 0,
      review: 0,
      reject: 0,
      none: 0,
    }
  )

  const triageCounts = basePendingCandidates.reduce<Record<TriageLevel, number>>(
    (acc, candidate) => {
      const triageLevel = candidateInsights.get(candidate.id)?.triageLevel ?? 'low-signal'
      acc[triageLevel] += 1
      return acc
    },
    {
      'act-now': 0,
      'worth-a-look': 0,
      'low-signal': 0,
      'already-reviewed': 0,
    }
  )

  const completenessCounts = basePendingCandidates.reduce<Record<CompletenessBand, number>>(
    (acc, candidate) => {
      const insight = candidateInsights.get(candidate.id)
      if (!insight) return acc
      acc[getCompletenessBand(insight)] += 1
      return acc
    },
    {
      thin: 0,
      usable: 0,
      rich: 0,
    }
  )

  const visiblePendingTriageCounts = pendingCandidates.reduce<Record<TriageLevel, number>>(
    (acc, candidate) => {
      const triageLevel = candidateInsights.get(candidate.id)?.triageLevel ?? 'low-signal'
      acc[triageLevel] += 1
      return acc
    },
    {
      'act-now': 0,
      'worth-a-look': 0,
      'low-signal': 0,
      'already-reviewed': 0,
    }
  )

  const missingSummaryCount = basePendingCandidates.filter(
    (candidate) => !candidate.summary && !candidate.what_it_trains && !candidate.description
  ).length

  const duplicateFamilies = useMemo(() => {
    const families = new Map<string, RawDrillCandidate[]>()

    for (const candidate of sortedCandidates) {
      if (!candidate.dedupe_key) continue
      const existing = families.get(candidate.dedupe_key) ?? []
      existing.push(candidate)
      families.set(candidate.dedupe_key, existing)
    }

    return Array.from(families.entries())
      .map(([dedupeKey, familyCandidates]) => {
        const leadCandidate = familyCandidates[0] ?? null
        const leadInsight = leadCandidate ? candidateInsights.get(leadCandidate.id) ?? null : null
        const leadDecision = leadCandidate && leadInsight ? getCandidateDecisionHint(leadCandidate, leadInsight) : null

        return {
          dedupeKey,
          count: familyCandidates.length,
          statuses: Array.from(new Set(familyCandidates.map((candidate) => candidate.review_status))),
          sampleTitles: familyCandidates.slice(0, 3).map((candidate) => getDisplayTitle(candidate)),
          leadCandidate,
          leadInsight,
          leadDecision,
        }
      })
      .sort((left, right) => right.count - left.count || left.dedupeKey.localeCompare(right.dedupeKey))
  }, [candidateInsights, sortedCandidates])

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => sortedCandidates.some((candidate) => candidate.id === id)),
    [selectedIds, sortedCandidates]
  )

  const selectedCandidate =
    (selectedCandidateFromUrl
      ? sortedCandidates.find((candidate) => candidate.id === selectedCandidateFromUrl)
      : null) ??
    sortedCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    sortedCandidates[0] ??
    null

  const matchedDrills = useMemo(() => {
    if (!selectedCandidate) return []

    return drills
      .map((drill) => scoreDrillMatch(selectedCandidate, drill))
      .filter((match): match is DrillMatch => Boolean(match))
      .sort((left, right) => right.matchScore - left.matchScore || Number(right.is_curated) - Number(left.is_curated) || left.title.localeCompare(right.title))
      .slice(0, 5)
  }, [drills, selectedCandidate])

  const preferredMergeTargetId = selectedCanonicalDrillId ?? matchedDrills[0]?.id ?? null

  const selectedFamilyCandidates = selectedCandidate?.dedupe_key
    ? sortedCandidates.filter((candidate) => candidate.dedupe_key === selectedCandidate.dedupe_key)
    : []

  const currentSliceSummary = useMemo(() => {
    const leadCandidate = pendingCandidates[0] ?? sortedCandidates[0] ?? null
    const leadInsight = leadCandidate ? candidateInsights.get(leadCandidate.id) ?? null : null
    const dominantVisibleTriage = (Object.entries(visiblePendingTriageCounts) as Array<[TriageLevel, number]>)
      .filter(([, count]) => count > 0 && count)
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null

    const dominantVisibleCompleteness = (Object.entries(completenessCounts) as Array<[CompletenessBand, number]>)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null

    const topVisibleSource = (() => {
      const counts = new Map<string, number>()

      for (const candidate of pendingCandidates) {
        const source = getSourceLabel(candidate)
        counts.set(source, (counts.get(source) ?? 0) + 1)
      }

      return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null
    })()

    const lines = [
      'Review queue handoff',
      `Visible rows: ${sortedCandidates.length}`,
      `Pending rows: ${pendingCandidates.length}`,
      `Current sort: ${SORT_MODE_LABELS[sortMode]}`,
      `Active triage slice: ${triageFilter === 'all' ? 'All visible pending' : getTriageLabel(triageFilter)}`,
      `Active completeness slice: ${completenessFilter === 'all' ? 'All extract levels' : COMPLETENESS_BAND_LABELS[completenessFilter]}`,
      `Family focus: ${familyFilter ?? 'None'}`,
      `Missing summary rows: ${missingSummaryCount}`,
      `Visible duplicate families: ${duplicateFamilies.length}`,
    ]

    if (dominantVisibleTriage) {
      lines.push(`Dominant visible triage: ${getTriageLabel(dominantVisibleTriage)}`)
    }

    if (dominantVisibleCompleteness) {
      lines.push(`Dominant visible completeness: ${COMPLETENESS_BAND_LABELS[dominantVisibleCompleteness]}`)
    }

    if (topVisibleSource) {
      lines.push(`Main visible source: ${topVisibleSource[0]} (${topVisibleSource[1]})`)
    }

    if (leadCandidate && leadInsight) {
      lines.push('')
      lines.push(`Lead visible candidate: ${getDisplayTitle(leadCandidate)}`)
      lines.push(`Lead status: ${REVIEW_STATUS_LABELS[leadCandidate.review_status]} • ${getTriageLabel(leadInsight.triageLevel)}`)
      lines.push(`Lead next move: ${getReviewerNextMove(leadCandidate, leadInsight)}`)
      lines.push(`Lead source: ${getSourceLabel(leadCandidate)}`)
      if (leadCandidate.dedupe_key) {
        lines.push(`Lead family: ${leadCandidate.dedupe_key} (${leadInsight.familySize} rows)`)
      }
    }

    return {
      leadCandidate,
      leadInsight,
      dominantVisibleTriage,
      dominantVisibleCompleteness,
      topVisibleSource,
      handoffText: lines.join('\n'),
    }
  }, [candidateInsights, completenessCounts, completenessFilter, duplicateFamilies.length, familyFilter, missingSummaryCount, pendingCandidates, sortMode, sortedCandidates, triageFilter, visiblePendingTriageCounts])

  const selectedCandidateIndex = selectedCandidate ? sortedCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id) : -1
  const selectedPendingIndex = selectedCandidate ? pendingCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id) : -1
  const previousVisibleCandidate = selectedCandidateIndex > 0 ? sortedCandidates[selectedCandidateIndex - 1] : null
  const nextVisibleCandidate = selectedCandidateIndex >= 0 && selectedCandidateIndex < sortedCandidates.length - 1 ? sortedCandidates[selectedCandidateIndex + 1] : null
  const leadVisibleCandidate = currentSliceSummary.leadCandidate
  const previousPendingCandidate = selectedPendingIndex > 0 ? pendingCandidates[selectedPendingIndex - 1] : null
  const nextPendingCandidate = selectedPendingIndex >= 0 ? pendingCandidates[selectedPendingIndex + 1] ?? null : pendingCandidates[0] ?? null

  const nextFamilyCandidate = useMemo(() => {
    if (!selectedCandidate?.dedupe_key) return null

    const currentIndex = selectedFamilyCandidates.findIndex((candidate) => candidate.id === selectedCandidate.id)
    if (currentIndex === -1) {
      return selectedFamilyCandidates[0] ?? null
    }

    return selectedFamilyCandidates[currentIndex + 1] ?? null
  }, [selectedCandidate, selectedFamilyCandidates])

  const nextDuplicateFamily = useMemo(() => {
    const currentFamilyKey = familyFilter ?? selectedCandidate?.dedupe_key ?? null
    if (!currentFamilyKey || duplicateFamilies.length === 0) return null

    const currentIndex = duplicateFamilies.findIndex((family) => family.dedupeKey === currentFamilyKey)
    if (currentIndex === -1) {
      return duplicateFamilies.find((family) => family.statuses.includes('pending')) ?? duplicateFamilies[0] ?? null
    }

    const laterPendingFamily = duplicateFamilies.slice(currentIndex + 1).find((family) => family.statuses.includes('pending'))
    if (laterPendingFamily) return laterPendingFamily

    return duplicateFamilies.slice(0, currentIndex).find((family) => family.statuses.includes('pending')) ?? null
  }, [duplicateFamilies, familyFilter, selectedCandidate])

  useEffect(() => {
    if (!selectedCandidate) {
      setSelectedCanonicalDrillId(null)
      return
    }

    setSelectedCanonicalDrillId((current) => {
      if (current && matchedDrills.some((drill) => drill.id === current)) {
        return current
      }

      return matchedDrills[0]?.id ?? null
    })
  }, [matchedDrills, selectedCandidate])

  const selectedFamilyWorkspace = useMemo(() => {
    if (!selectedCandidate || !selectedCandidate.dedupe_key || selectedFamilyCandidates.length === 0) {
      return null
    }

    const ranked = [...selectedFamilyCandidates]
      .map((candidate) => ({
        candidate,
        insight: candidateInsights.get(candidate.id),
      }))
      .filter((item): item is { candidate: RawDrillCandidate; insight: CandidateInsight } => Boolean(item.insight))
      .sort((left, right) => {
        return (
          right.insight.triageScore - left.insight.triageScore ||
          right.insight.completenessScore - left.insight.completenessScore ||
          STATUS_SORT_ORDER[left.candidate.review_status] - STATUS_SORT_ORDER[right.candidate.review_status] ||
          getDisplayTitle(left.candidate).localeCompare(getDisplayTitle(right.candidate))
        )
      })

    if (ranked.length === 0) return null

    const keepCandidate =
      ranked.find(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'keep')?.candidate ?? ranked[0].candidate

    const decisionCounts = ranked.reduce<Record<FamilyDecision, number>>(
      (acc, { candidate, insight }) => {
        acc[getCandidateDecisionHint(candidate, insight)] += 1
        return acc
      },
      { keep: 0, merge: 0, reject: 0 }
    )

    const pendingCount = ranked.filter(({ candidate }) => candidate.review_status === 'pending').length
    const nextMergeCandidate =
      ranked.find(
        ({ candidate, insight }) =>
          candidate.id !== keepCandidate.id && candidate.review_status === 'pending' && getCandidateDecisionHint(candidate, insight) === 'merge'
      )?.candidate ?? null
    const nextRejectCandidate = ranked.find(({ candidate, insight }) => candidate.review_status === 'pending' && getCandidateDecisionHint(candidate, insight) === 'reject')?.candidate ?? null

    const handoffLines = [
      `Family: ${selectedCandidate.dedupe_key}`,
      `Suggested canonical seed: ${getDisplayTitle(keepCandidate)} (${keepCandidate.id})`,
      `Visible family rows: ${ranked.length} (${pendingCount} pending)`,
      `Suggested split: keep ${decisionCounts.keep}, merge ${decisionCounts.merge}, reject ${decisionCounts.reject}`,
      '',
      'Review steps:',
      `1. Start with ${getDisplayTitle(keepCandidate)} as the cleanest base shape.`,
      '2. Fold overlapping rows into that canonical drill if they add useful detail.',
      '3. Reject noisy duplicates that do not add anything reusable.',
      '',
      'Suggested bot payload:',
      JSON.stringify(
        {
          target_family: selectedCandidate.dedupe_key,
          keep_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'keep').map(({ candidate }) => candidate.id),
          merge_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'merge').map(({ candidate }) => candidate.id),
          reject_ids: ranked.filter(({ candidate, insight }) => getCandidateDecisionHint(candidate, insight) === 'reject').map(({ candidate }) => candidate.id),
        },
        null,
        2
      ),
    ]

    return {
      ranked,
      keepCandidate,
      nextMergeCandidate,
      nextRejectCandidate,
      decisionCounts,
      pendingCount,
      handoffText: handoffLines.join('\n'),
    }
  }, [candidateInsights, selectedCandidate, selectedFamilyCandidates])

  const bulkSelectionCounts = visibleSelectedIds.reduce<Record<ReviewStatus, number>>(
    (acc, id) => {
      const candidate = sortedCandidates.find((item) => item.id === id)
      if (!candidate) return acc
      acc[candidate.review_status] += 1
      return acc
    },
    { pending: 0, approved: 0, merged: 0, rejected: 0 }
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }, [])

  const toggleSelectAllVisiblePending = useCallback(() => {
    const pendingIds = pendingCandidates.map((candidate) => candidate.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => visibleSelectedIds.includes(id))

    setSelectedIds((current) => {
      const withoutVisiblePending = current.filter((id) => !pendingIds.includes(id))
      return allSelected ? withoutVisiblePending : [...withoutVisiblePending, ...pendingIds]
    })
  }, [pendingCandidates, visibleSelectedIds])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcutTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'j' || key === 'k') {
        event.preventDefault()
        if (sortedCandidates.length === 0) return

        const currentIndex = sortedCandidates.findIndex((c) => c.id === selectedCandidateId)

        if (currentIndex === -1) {
          selectCandidate(sortedCandidates[0].id)
          return
        }

        if (key === 'j' && currentIndex < sortedCandidates.length - 1) {
          selectCandidate(sortedCandidates[currentIndex + 1].id)
        } else if (key === 'k' && currentIndex > 0) {
          selectCandidate(sortedCandidates[currentIndex - 1].id)
        }
        return
      }

      if (key === 'n') {
        event.preventDefault()
        if (nextPendingCandidate) {
          selectCandidate(nextPendingCandidate.id, { scrollIntoView: false })
        }
        return
      }

      if (key === 'p') {
        event.preventDefault()
        if (previousPendingCandidate) {
          selectCandidate(previousPendingCandidate.id, { scrollIntoView: false })
        }
        return
      }

      if (key === 'x') {
        event.preventDefault()
        if (selectedCandidateId) {
          toggleSelected(selectedCandidateId)
        }
        return
      }

      if (key === 'a') {
        event.preventDefault()
        if (selectedCandidateId) {
          runReviewAction({
            action: 'approve',
            candidateIds: [selectedCandidateId],
            successLabel: 'Approved candidate into the drill library.',
          })
        }
        return
      }

      if (key === 'r') {
        event.preventDefault()
        if (selectedCandidateId) {
          runReviewAction({
            action: 'reject',
            candidateIds: [selectedCandidateId],
            successLabel: 'Rejected candidate.',
          })
        }
        return
      }

      if (key === 'm') {
        event.preventDefault()
        if (selectedCandidateId && preferredMergeTargetId) {
          runReviewAction({
            action: 'merge',
            candidateIds: [selectedCandidateId],
            canonicalDrillId: preferredMergeTargetId,
            successLabel: 'Merged candidate into the selected drill.',
          })
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextPendingCandidate, preferredMergeTargetId, previousPendingCandidate, runReviewAction, selectCandidate, selectedCandidateId, sortedCandidates, toggleSelected])

  const allVisiblePendingSelected =
    pendingCandidates.length > 0 && pendingCandidates.every((candidate) => visibleSelectedIds.includes(candidate.id))

  const activeViewChips = useMemo(
    () => [
      query.trim()
        ? {
            key: 'query',
            label: `Search: ${query.trim()}`,
            onClear: () => setQuery(''),
          }
        : null,
      statusFilter !== 'pending'
        ? {
            key: 'status',
            label: `Status: ${statusFilter === 'all' ? 'All statuses' : REVIEW_STATUS_LABELS[statusFilter]}`,
            onClear: () => setStatusFilter('pending'),
          }
        : null,
      gradeFilter !== 'all'
        ? {
            key: 'grade',
            label: `Grade: ${formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}`,
            onClear: () => setGradeFilter('all'),
          }
        : null,
      difficultyFilter !== 'all'
        ? {
            key: 'difficulty',
            label: `Difficulty: ${formatDifficultyLabel(difficultyFilter)}`,
            onClear: () => setDifficultyFilter('all'),
          }
        : null,
      categoryFilter !== 'all'
        ? {
            key: 'category',
            label: `Category: ${categoryFilter}`,
            onClear: () => setCategoryFilter('all'),
          }
        : null,
      sourceFilter !== 'all'
        ? {
            key: 'source',
            label: `Source: ${sourceFilter}`,
            onClear: () => setSourceFilter('all'),
          }
        : null,
      aiDecisionFilter !== 'all'
        ? {
            key: 'ai',
            label: `AI recommendation: ${getAiDecisionFilterLabel(aiDecisionFilter)}`,
            onClear: () => setAiDecisionFilter('all'),
          }
        : null,
      triageFilter !== 'all'
        ? {
            key: 'triage',
            label: `Triage: ${getTriageLabel(triageFilter)}`,
            onClear: () => setTriageFilter('all'),
          }
        : null,
      completenessFilter !== 'all'
        ? {
            key: 'completeness',
            label: `Completeness: ${COMPLETENESS_BAND_LABELS[completenessFilter]}`,
            onClear: () => setCompletenessFilter('all'),
          }
        : null,
      familyFilter
        ? {
            key: 'family',
            label: `Family: ${familyFilter}`,
            onClear: () => setFamilyFilter(null),
          }
        : null,
      sortMode !== 'triage'
        ? {
            key: 'sort',
            label: `Sort: ${SORT_MODE_LABELS[sortMode]}`,
            onClear: () => setSortMode('triage'),
          }
        : null,
      scopedCandidateIds
        ? {
            key: 'scope',
            label: `Scope: ${scopeRequestedCount} linked row${scopeRequestedCount === 1 ? '' : 's'}`,
            onClear: clearScopedReview,
          }
        : null,
    ].filter(
      (
        chip
      ): chip is {
        key: string
        label: string
        onClear: () => void
      } => Boolean(chip)
    ),
    [aiDecisionFilter, categoryFilter, clearScopedReview, completenessFilter, difficultyFilter, familyFilter, gradeFilter, query, scopeRequestedCount, scopedCandidateIds, sortMode, sourceFilter, statusFilter, triageFilter]
  )

  const copyCurrentSliceHandoff = useCallback(() => {
    navigator.clipboard.writeText(currentSliceSummary.handoffText)
    setCopyFeedback('Copied review queue handoff')
    window.setTimeout(() => setCopyFeedback(null), 3000)
  }, [currentSliceSummary.handoffText])

  return (
    <>
      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-[var(--text-primary)]">{copyFeedback}</p>
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review controls</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Default sort surfaces the best next candidates first, instead of making reviewers scroll through transcript soup blindly.
            </p>
            <p className="mt-2 text-xs font-medium text-[var(--text-tertiary)]">
              <span className="mr-2">Keyboard:</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">j</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">k</kbd> navigate visible •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">n</kbd> / <kbd className="rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">p</kbd> navigate pending •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">x</kbd> select •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">a</kbd> approve •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">r</kbd> reject •
              <kbd className="ml-1.5 rounded border border-[var(--border)] bg-[var(--surface-primary)] px-1.5 py-0.5">m</kbd> merge
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, source, summary, dedupe key"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              />
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ReviewStatus)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All statuses</option>
                {REVIEW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {REVIEW_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Grade</span>
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All grades</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {formatGradeLevel(grade === 'unassigned' ? null : grade)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Difficulty</span>
              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All difficulties</option>
                {availableDifficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {formatDifficultyLabel(difficulty)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Source file</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="all">All sources</option>
                {availableSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                {Object.entries(SORT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => copyCurrentView(scopedCandidateIds ? 'Copied scoped review view link' : 'Copied review queue view link')}
              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy current view
            </button>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {sortedCandidates.length} visible
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {pendingCandidates.length} pending
            </span>
            {triageFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setTriageFilter('all')}
                className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Triage slice: {getTriageLabel(triageFilter)} • Clear
              </button>
            ) : null}
            {completenessFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setCompletenessFilter('all')}
                className="rounded-full border border-[var(--accent-primary)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Completeness: {COMPLETENESS_BAND_LABELS[completenessFilter]} • Clear
              </button>
            ) : null}
            {isSubmitting ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300">
                Saving review action...
              </span>
            ) : null}
          </div>

          {actionError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
              {actionError}
            </div>
          ) : null}

          {activeViewChips.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Active view modifiers</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Clear one filter at a time, or reset the queue back to the default pending triage view.</p>
                </div>
                <button
                  type="button"
                  onClick={clearAllViewFilters}
                  className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  Reset view
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeViewChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClear}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                  >
                    <span>{chip.label}</span>
                    <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {familyFilter ? (
        <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Family focus active</p>
              <p className="mt-2 text-sm leading-6">
                Narrowing the queue to dedupe family <span className="font-semibold">{familyFilter}</span> so you can review one duplicate cluster at a time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100">
                {sortedCandidates.length} visible in focus
              </span>
              <button
                type="button"
                onClick={clearFamilyFocus}
                className="inline-flex rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
              >
                Clear family focus
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 md:col-span-2 xl:col-span-1 2xl:col-span-2 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Visible pending review</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-primary)]">{pendingCandidates.length}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Working subset after filters, currently sorted by <span className="font-medium text-[var(--text-primary)]">{SORT_MODE_LABELS[sortMode]}</span>.
            Use the triage and completeness cards to jump straight into the right slice.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'act-now' ? 'all' : 'act-now'))}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'act-now' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Act now</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['act-now']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Pending rows with real duplicate pressure and enough structure to review cleanly.</p>
        </button>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'worth-a-look' ? 'all' : 'worth-a-look'))}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'worth-a-look' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Worth a look</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['worth-a-look']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Reasonable next passes, but not the most urgent cleanup in the queue.</p>
        </button>

        <button
          type="button"
          onClick={() => setTriageFilter((current) => (current === 'low-signal' ? 'all' : 'low-signal'))}
          className={`min-h-[168px] rounded-3xl border bg-[var(--surface-elevated)] p-5 text-left transition-colors ${
            triageFilter === 'low-signal' ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]">Low signal</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['low-signal']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Thin or isolated rows that should wait until better candidates are handled.</p>
        </button>

        <div className="min-h-[168px] rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Duplicate families</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{duplicateFamilies.length}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Distinct dedupe groups currently visible after filtering.</p>
        </div>

        <div className="min-h-[168px] rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Needs summary</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{missingSummaryCount}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Visible pending rows with no summary, description, or training note.</p>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Current review slice</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Shows what the visible queue is mostly about, plus the first row worth touching.</p>
            </div>
            <button
              type="button"
              onClick={copyCurrentSliceHandoff}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy queue handoff
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <InfoBlock label="Visible pending" value={String(pendingCandidates.length)} subdued={`${sortedCandidates.length} total visible`} />
            <InfoBlock
              label="Dominant triage"
              value={currentSliceSummary.dominantVisibleTriage ? getTriageLabel(currentSliceSummary.dominantVisibleTriage) : 'No pending rows'}
              subdued={triageFilter === 'all' ? 'Across the current view' : 'Inside the active slice'}
            />
            <InfoBlock
              label="Dominant completeness"
              value={currentSliceSummary.dominantVisibleCompleteness ? COMPLETENESS_BAND_LABELS[currentSliceSummary.dominantVisibleCompleteness] : 'No pending rows'}
              subdued={completenessFilter === 'all' ? 'Across the current view' : 'Inside the active slice'}
            />
            <InfoBlock
              label="Main source"
              value={currentSliceSummary.topVisibleSource?.[0] ?? 'Mixed'}
              subdued={currentSliceSummary.topVisibleSource ? `${currentSliceSummary.topVisibleSource[1]} pending rows` : 'No dominant source'}
            />
            <InfoBlock label="Visible families" value={String(duplicateFamilies.length)} subdued={`${missingSummaryCount} rows still need a summary`} />
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Lead visible candidate</h2>
          {!currentSliceSummary.leadCandidate || !currentSliceSummary.leadInsight ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">No visible candidate in the current filter set.</p>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{getDisplayTitle(currentSliceSummary.leadCandidate)}</p>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(currentSliceSummary.leadInsight.triageLevel)}`}>
                  {getTriageLabel(currentSliceSummary.leadInsight.triageLevel)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{getReviewerNextMove(currentSliceSummary.leadCandidate, currentSliceSummary.leadInsight)}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoBlock label="Source" value={getSourceLabel(currentSliceSummary.leadCandidate)} />
                <InfoBlock
                  label="Duplicate pressure"
                  value={`${currentSliceSummary.leadInsight.familySize} row${currentSliceSummary.leadInsight.familySize === 1 ? '' : 's'}`}
                  subdued={currentSliceSummary.leadCandidate.dedupe_key || 'No family yet'}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Queue by review status</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Quick signal for where the visible backlog is actually sitting. Click a card to jump into that status.</p>
            </div>
            {statusFilter !== 'all' ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                Focused on {REVIEW_STATUS_LABELS[statusFilter]}
              </span>
            ) : null}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {statusCounts.map(({ status, count }) => {
              const isFocusedStatus = statusFilter === status

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatusFocus(status)}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                    isFocusedStatus
                      ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                      : `${getStatusTone(status)} hover:opacity-90`
                  }`}
                  aria-pressed={isFocusedStatus}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-current">{REVIEW_STATUS_LABELS[status]}</p>
                    {isFocusedStatus ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-current">{count}</p>
                  <p className="mt-2 text-xs font-medium text-[var(--text-tertiary)]">
                    {isFocusedStatus ? 'Click to clear this status filter' : 'Click to filter the queue to this status'}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by grade</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Helpful when scanning current graduation imports. Click a row to jump into that grade.</p>
              </div>
              {gradeFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {formatGradeLevel(gradeFilter === 'unassigned' ? null : gradeFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(gradeCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending candidates in the current filter set.</p>
              ) : (
                Object.entries(gradeCounts)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([grade, count]) => {
                    const isFocusedGrade = gradeFilter === grade

                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => toggleGradeFocus(grade)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          isFocusedGrade
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                        aria-pressed={isFocusedGrade}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{formatGradeLevel(grade === 'unassigned' ? null : grade)}</span>
                            {isFocusedGrade ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedGrade ? 'Click to clear this grade filter' : 'Click to filter the queue to this grade'}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </button>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by AI recommendation</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into the AI-suggested action lane, while keeping the default pending triage flow intact.</p>
              </div>
              {aiDecisionFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {getAiDecisionFilterLabel(aiDecisionFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(Object.values(aiDecisionCounts) as number[]).every((count) => count === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending AI recommendation groups in the current filter set.</p>
              ) : (
                (['approve', 'merge', 'review', 'reject', 'none'] as Array<Exclude<AiDecisionFilter, 'all'>>).map((decision) => {
                  const count = aiDecisionCounts[decision]
                  if (count === 0) return null

                  const isFocusedDecision = aiDecisionFilter === decision

                  return (
                    <button
                      key={decision}
                      type="button"
                      onClick={() => toggleAiDecisionFocus(decision)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isFocusedDecision
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                      }`}
                      aria-pressed={isFocusedDecision}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getAiDecisionTone(decision === 'none' ? null : decision)}`}>
                            {getAiDecisionFilterLabel(decision)}
                          </span>
                          {isFocusedDecision ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                          {isFocusedDecision ? 'Click to clear this AI recommendation filter' : 'Click to filter the queue to this AI recommendation'}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {count} pending
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by completeness</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Jump straight into thin, usable, or rich extracts without losing the rest of the current queue context.</p>
              </div>
              {completenessFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {COMPLETENESS_BAND_LABELS[completenessFilter]}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {(Object.values(completenessCounts) as number[]).every((count) => count === 0) ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending completeness bands in the current filter set.</p>
              ) : (
                (['thin', 'usable', 'rich'] as CompletenessBand[]).map((band) => {
                  const count = completenessCounts[band]
                  if (count === 0) return null

                  const isFocusedBand = completenessFilter === band

                  return (
                    <button
                      key={band}
                      type="button"
                      onClick={() => toggleCompletenessFocus(band)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isFocusedBand
                          ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                          : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                      }`}
                      aria-pressed={isFocusedBand}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)]">{COMPLETENESS_BAND_LABELS[band]}</span>
                          {isFocusedBand ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                          {isFocusedBand ? 'Click to clear this completeness filter' : 'Click to filter the queue to this completeness band'}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {count} pending
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by source</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one import batch at a time instead of mixing different transcript drops together.</p>
              </div>
              {sourceFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {sourceFilter}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(sourceCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending sources in the current filter set.</p>
              ) : (
                Object.entries(sourceCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .slice(0, 6)
                  .map(([source, count]) => {
                    const isFocusedSource = sourceFilter === source

                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => toggleSourceFocus(source)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          isFocusedSource
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                        aria-pressed={isFocusedSource}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-[var(--text-primary)]">{source}</span>
                            {isFocusedSource ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedSource ? 'Click to clear this source filter' : 'Click to filter the queue to this source'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </button>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by difficulty</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one effort band at a time instead of mixing beginner clean-up with harder combinations.</p>
              </div>
              {difficultyFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {formatDifficultyLabel(difficultyFilter)}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(difficultyCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending difficulty bands in the current filter set.</p>
              ) : (
                Object.entries(difficultyCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .map(([difficulty, count]) => {
                    const isFocusedDifficulty = difficultyFilter === difficulty

                    return (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => toggleDifficultyFocus(difficulty)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          isFocusedDifficulty
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                        aria-pressed={isFocusedDifficulty}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{formatDifficultyLabel(difficulty)}</span>
                            {isFocusedDifficulty ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedDifficulty ? 'Click to clear this difficulty filter' : 'Click to filter the queue to this difficulty'}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </button>
                    )
                  })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by category</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Useful when you want to clear one drill type at a time instead of mixing stance, footwork, and defence rows together.</p>
              </div>
              {categoryFilter !== 'all' ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                  Focused on {categoryFilter === 'uncategorised' ? 'Uncategorised' : categoryFilter}
                </span>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {Object.keys(categoryCounts).length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending categories in the current filter set.</p>
              ) : (
                Object.entries(categoryCounts)
                  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                  .slice(0, 6)
                  .map(([category, count]) => {
                    const isFocusedCategory = categoryFilter === category

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategoryFocus(category)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          isFocusedCategory
                            ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                            : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                        }`}
                        aria-pressed={isFocusedCategory}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium capitalize text-[var(--text-primary)]">{category === 'uncategorised' ? 'Uncategorised' : category}</span>
                            {isFocusedCategory ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                            {isFocusedCategory ? 'Click to clear this category filter' : 'Click to filter the queue to this category'}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {count} pending
                        </span>
                      </button>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Duplicate family pressure</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">The biggest clusters first, so Sha-Lyn can clean duplicates instead of reviewing rows in random order.</p>
            </div>
          </div>

          {duplicateFamilies.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--text-secondary)]">No dedupe-key families are visible under the current filter set.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {duplicateFamilies.slice(0, 8).map((family) => {
                const isFocusedFamily = familyFilter === family.dedupeKey

                return (
                  <button
                    key={family.dedupeKey}
                    type="button"
                    onClick={() => focusFamily(family.dedupeKey)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      isFocusedFamily
                        ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                        : 'border-[var(--border)] hover:bg-[var(--surface-primary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{family.dedupeKey}</p>
                          {isFocusedFamily ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                              Focused
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{family.sampleTitles.join(' • ')}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {family.count} rows
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {family.statuses.map((status) => (
                        <span key={status} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(status)}`}>
                          {REVIEW_STATUS_LABELS[status]}
                        </span>
                      ))}
                    </div>
                    {family.leadCandidate && family.leadInsight && family.leadDecision ? (
                      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(family.leadDecision)}`}>
                            {getDecisionLabel(family.leadDecision)}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getTriageTone(family.leadInsight.triageLevel)}`}>
                            {getTriageLabel(family.leadInsight.triageLevel)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Start with {getDisplayTitle(family.leadCandidate)}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{getReviewerNextMove(family.leadCandidate, family.leadInsight)}</p>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs font-medium text-[var(--text-tertiary)]">
                      {isFocusedFamily ? 'Current family focus' : 'Click to focus this duplicate family'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Bulk review actions</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Service-role route is wired now, so this panel can actually push review decisions instead of cosplaying as a clipboard.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Selected visible rows</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{visibleSelectedIds.length}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Pending {bulkSelectionCounts.pending} • Approved {bulkSelectionCounts.approved} • Merged {bulkSelectionCounts.merged} • Rejected {bulkSelectionCounts.rejected}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleSelectAllVisiblePending}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              {allVisiblePendingSelected ? 'Clear visible pending selection' : 'Select all visible pending'}
            </button>

            <button
              type="button"
              disabled={visibleSelectedIds.length === 0 || isSubmitting}
              onClick={() =>
                runReviewAction({
                  action: 'approve',
                  candidateIds: visibleSelectedIds,
                  successLabel: visibleSelectedIds.length === 1 ? 'Approved candidate into the drill library.' : `Approved ${visibleSelectedIds.length} candidates into the drill library.`,
                })
              }
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Approve selected</span>
              <span className="text-xs text-[var(--text-tertiary)]">Create drills</span>
            </button>

            <button
              type="button"
              disabled={visibleSelectedIds.length === 0 || isSubmitting}
              onClick={() =>
                runReviewAction({
                  action: 'reject',
                  candidateIds: visibleSelectedIds,
                  successLabel: visibleSelectedIds.length === 1 ? 'Rejected candidate.' : `Rejected ${visibleSelectedIds.length} candidates.`,
                })
              }
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Reject selected</span>
              <span className="text-xs text-[var(--text-tertiary)]">Mark rejected</span>
            </button>

            <label className="block text-sm text-[var(--text-secondary)]">
              <span className="mb-1 block">Merge target</span>
              <select
                value={preferredMergeTargetId ?? ''}
                onChange={(event) => setSelectedCanonicalDrillId(event.target.value || null)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
              >
                <option value="">No target selected</option>
                {matchedDrills.map((drill) => (
                  <option key={drill.id} value={drill.id}>
                    {drill.title} · Match {drill.matchScore}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={visibleSelectedIds.length === 0 || !preferredMergeTargetId || isSubmitting}
              onClick={() =>
                preferredMergeTargetId
                  ? runReviewAction({
                      action: 'merge',
                      candidateIds: visibleSelectedIds,
                      canonicalDrillId: preferredMergeTargetId,
                      successLabel: visibleSelectedIds.length === 1 ? 'Merged candidate into the selected drill.' : `Merged ${visibleSelectedIds.length} candidates into the selected drill.`,
                    })
                  : null
              }
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Merge selected</span>
              <span className="text-xs text-[var(--text-tertiary)]">{preferredMergeTargetId ? 'Use chosen library match' : 'Pick a candidate with a target first'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Visible raw drill candidates</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Filterable internal scan of the raw intake layer, ordered for curation rather than final library use.
              </p>
            </div>
          </div>

          {scopedCandidateIds ? (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold uppercase tracking-[0.14em]">Scoped review set</p>
                  <p className="mt-2 leading-6">
                    Showing {sortedCandidates.length} of {scopeRequestedCount} linked raw candidate{scopeRequestedCount === 1 ? '' : 's'} passed in from the drill library.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyCurrentView('Copied scoped review view link')}
                    className="inline-flex rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-950 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-100 dark:hover:bg-sky-900/30"
                  >
                    Copy scope link
                  </button>
                  <button
                    type="button"
                    onClick={clearScopedReview}
                    className="inline-flex rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-950 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-100 dark:hover:bg-sky-900/30"
                  >
                    Clear scope
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {sortedCandidates.length === 0 ? (
            <EmptyState title="No matching candidates" body="Nothing in raw_drill_candidates matches the current filter combination." />
          ) : (
            <div className="space-y-4">
              <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)] lg:flex lg.items-center lg:justify-between">
                <span>Sorted by <span className="font-medium text-[var(--text-primary)]">{SORT_MODE_LABELS[sortMode]}</span></span>
                <span>{sortedCandidates.length} visible candidates</span>
              </div>
              {sortedCandidates.map((candidate) => {
                const insight = candidateInsights.get(candidate.id)
                const isSelected = selectedCandidate?.id === candidate.id
                const isBulkSelected = visibleSelectedIds.includes(candidate.id)

                if (!insight) return null

                return (
                  <article
                    key={candidate.id}
                    id={`candidate-${candidate.id}`}
                    className={`rounded-3xl border bg-[var(--surface-elevated)] p-5 transition-colors ${
                      isSelected ? 'border-[var(--accent-primary)] shadow-sm' : 'border-[var(--border)]'
                    }`}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-3">
                          <label className="mt-0.5 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={isBulkSelected}
                              onChange={() => toggleSelected(candidate.id)}
                              className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-primary)] text-[var(--accent-primary)]"
                            />
                            <span className="sr-only">Select {getDisplayTitle(candidate)}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setSelectedCandidateId(candidate.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{getDisplayTitle(candidate)}</h3>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
                                {REVIEW_STATUS_LABELS[candidate.review_status]}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(insight.triageLevel)}`}>
                                {getTriageLabel(insight.triageLevel)}
                              </span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getAiDecisionTone(candidate.ai_decision ?? null)}`}>
                                {getAiDecisionLabel(candidate.ai_decision ?? null)}
                              </span>
                              {candidate.dedupe_key && (
                                <span className="inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                  Family: {candidate.dedupe_key}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{insight.triageSummary}</p>
                            {candidate.ai_reason ? (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                                AI: {candidate.ai_reason}{typeof candidate.ai_confidence === 'number' ? ` (${Math.round(candidate.ai_confidence * 100)}%)` : ''}
                              </p>
                            ) : null}
                            {candidate.when_to_assign && (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            runReviewAction({
                              action: 'approve',
                              candidateIds: [candidate.id],
                              successLabel: 'Approved candidate into the drill library.',
                            })
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Approve
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">Create drill</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            runReviewAction({
                              action: 'reject',
                              candidateIds: [candidate.id],
                              successLabel: 'Rejected candidate.',
                            })
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Reject
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">Mark rejected</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting || !isSelected || !preferredMergeTargetId}
                          onClick={() =>
                            preferredMergeTargetId
                              ? runReviewAction({
                                  action: 'merge',
                                  candidateIds: [candidate.id],
                                  canonicalDrillId: preferredMergeTargetId,
                                  successLabel: 'Merged candidate into the selected drill.',
                                })
                              : null
                          }
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                          title={isSelected ? 'Merge this candidate into the chosen canonical target.' : 'Select this candidate first to choose a merge target.'}
                        >
                          Merge
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">{isSelected ? (preferredMergeTargetId ? 'Use chosen target' : 'No target yet') : 'Select first'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                      <InfoBlock label="Category" value={candidate.category || 'Uncategorised'} />
                      <InfoBlock label="Grade" value={formatGradeLevel(candidate.grade_level)} />
                      <InfoBlock label="Source" value={getSourceLabel(candidate)} subdued={candidate.source_type || undefined} />
                      <InfoBlock
                        label="Completeness"
                        value={`${insight.completenessScore}/6`}
                        subdued={insight.completenessLabel}
                      />
                      <InfoBlock
                        label="Duplicate pressure"
                        value={`${insight.familySize} row${insight.familySize === 1 ? '' : 's'}`}
                        subdued={candidate.dedupe_key ? candidate.dedupe_key : 'No dedupe key yet'}
                      />
                      <InfoBlock
                        label="Structure"
                        value={`${insight.stepsCount} steps`}
                        subdued={`${insight.focusPointsCount} focus points • ${insight.mistakesCount} common mistakes`}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start max-xl:order-first">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review detail</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Honest prep for approve, reject, and merge, with the service-role write path finally wired instead of mocked.
            </p>

            {!selectedCandidate ? (
              <p className="mt-5 text-sm text-[var(--text-secondary)]">Pick a visible candidate to inspect its detail panel.</p>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Review navigator</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Candidate {selectedCandidateIndex + 1} of {sortedCandidates.length} visible
                        {selectedPendingIndex >= 0 ? ` • Pending item ${selectedPendingIndex + 1} of ${pendingCandidates.length}` : ' • Not in the pending slice'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {SORT_MODE_LABELS[sortMode]}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <button
                      type="button"
                      disabled={!previousVisibleCandidate}
                      onClick={() => previousVisibleCandidate ? selectCandidate(previousVisibleCandidate.id, { scrollIntoView: false }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Previous visible
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {previousVisibleCandidate ? getDisplayTitle(previousVisibleCandidate) : 'Start of the visible queue'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!nextVisibleCandidate}
                      onClick={() => nextVisibleCandidate ? selectCandidate(nextVisibleCandidate.id, { scrollIntoView: false }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Next visible
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {nextVisibleCandidate ? getDisplayTitle(nextVisibleCandidate) : 'End of the visible queue'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!previousPendingCandidate}
                      onClick={() => previousPendingCandidate ? selectCandidate(previousPendingCandidate.id, { scrollIntoView: false }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Previous pending
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {previousPendingCandidate ? getDisplayTitle(previousPendingCandidate) : 'Start of the pending slice'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!nextPendingCandidate || nextPendingCandidate.id === selectedCandidate.id}
                      onClick={() => nextPendingCandidate ? selectCandidate(nextPendingCandidate.id, { scrollIntoView: false }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Next pending
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {nextPendingCandidate
                          ? nextPendingCandidate.id === selectedCandidate.id
                            ? 'Already on the next pending review item'
                            : getDisplayTitle(nextPendingCandidate)
                          : 'No more pending rows in this view'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!leadVisibleCandidate || leadVisibleCandidate.id === selectedCandidate.id}
                      onClick={() => leadVisibleCandidate ? selectCandidate(leadVisibleCandidate.id, { scrollIntoView: false }) : null}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                    >
                      Jump to lead
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                        {leadVisibleCandidate
                          ? leadVisibleCandidate.id === selectedCandidate.id
                            ? 'Already on the lead visible candidate'
                            : getDisplayTitle(leadVisibleCandidate)
                          : 'No lead candidate in the current slice'}
                      </span>
                    </button>
                  </div>

                  {nextFamilyCandidate ? (
                    <button
                      type="button"
                      onClick={() => selectCandidate(nextFamilyCandidate.id, { scrollIntoView: false })}
                      className="mt-2 w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      Next family row
                      <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">{getDisplayTitle(nextFamilyCandidate)}</span>
                    </button>
                  ) : null}
                </div>
                {(() => {
                  const insight = candidateInsights.get(selectedCandidate.id)

                  if (!insight) {
                    return <p className="text-sm text-[var(--text-secondary)]">Candidate detail is unavailable.</p>
                  }

                  return (
                    <>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Quick review actions</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                              Review this row from the detail panel, then keep moving through the pending queue without bouncing back to the list.
                            </p>
                          </div>
                          {nextPendingCandidate && nextPendingCandidate.id !== selectedCandidate.id ? (
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              Next pending: {getDisplayTitle(nextPendingCandidate)}
                            </span>
                          ) : (
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              No later pending row in this view
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() =>
                              runReviewAction({
                                action: 'approve',
                                candidateIds: [selectedCandidate.id],
                                successLabel: 'Approved candidate into the drill library.',
                              })
                            }
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            Approve candidate
                            <span className="mt-1 block text-xs font-normal text-emerald-700 dark:text-emerald-400">Shortcut A • Creates a drill and advances selection</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() =>
                              runReviewAction({
                                action: 'reject',
                                candidateIds: [selectedCandidate.id],
                                successLabel: 'Rejected candidate.',
                              })
                            }
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-900 transition-colors hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
                          >
                            Reject candidate
                            <span className="mt-1 block text-xs font-normal text-rose-700 dark:text-rose-400">Shortcut R • Marks it rejected and advances selection</span>
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <label className="text-sm text-[var(--text-secondary)]">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Merge target</span>
                            <select
                              value={preferredMergeTargetId ?? ''}
                              onChange={(event) => setSelectedCanonicalDrillId(event.target.value || null)}
                              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]"
                            >
                              <option value="">No target selected</option>
                              {matchedDrills.map((drill) => (
                                <option key={drill.id} value={drill.id}>
                                  {drill.title} · Match {drill.matchScore}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            disabled={isSubmitting || !preferredMergeTargetId}
                            onClick={() =>
                              preferredMergeTargetId
                                ? runReviewAction({
                                    action: 'merge',
                                    candidateIds: [selectedCandidate.id],
                                    canonicalDrillId: preferredMergeTargetId,
                                    successLabel: 'Merged candidate into the selected drill.',
                                  })
                                : null
                            }
                            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm font-medium text-sky-900 transition-colors hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300 dark:hover:bg-sky-950/30"
                          >
                            Merge candidate
                            <span className="mt-1 block text-xs font-normal text-sky-700 dark:text-sky-400">
                              Shortcut M • {preferredMergeTargetId ? 'Uses the selected canonical target and advances selection' : 'Pick a target first'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-[var(--text-primary)]">{getDisplayTitle(selectedCandidate)}</h3>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(selectedCandidate.review_status)}`}>
                            {REVIEW_STATUS_LABELS[selectedCandidate.review_status]}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getTriageTone(insight.triageLevel)}`}>
                            {getTriageLabel(insight.triageLevel)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{getShortSummary(selectedCandidate)}</p>
                        <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{insight.triageSummary}</p>
                        {returnToLibraryHref ? (
                          <div className="mt-4">
                            <Link
                              href={returnToLibraryHref}
                              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Back to current library view
                            </Link>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoBlock label="Raw title" value={selectedCandidate.raw_title || 'Missing raw title'} />
                        <InfoBlock label="Created" value={formatDateTime(selectedCandidate.created_at)} />
                        <InfoBlock
                          label="AI recommendation"
                          value={getAiDecisionLabel(selectedCandidate.ai_decision ?? null)}
                          subdued={selectedCandidate.ai_reason || (typeof selectedCandidate.ai_confidence === 'number' ? `${Math.round(selectedCandidate.ai_confidence * 100)}% confidence` : 'No AI recommendation yet')}
                        />
                        <InfoBlock label="Grade" value={formatGradeLevel(selectedCandidate.grade_level)} />
                        <InfoBlock label="Duration" value={selectedCandidate.estimated_duration_seconds ? `${selectedCandidate.estimated_duration_seconds}s` : 'Unknown'} />
                        <InfoBlock label="Source file" value={selectedCandidate.source_file || 'Missing'} subdued={selectedCandidate.source_type || undefined} />
                        <InfoBlock label="Canonical link" value={selectedCandidate.canonical_drill_id || 'Not linked yet'} />
                        <InfoBlock label="Completeness" value={`${insight.completenessScore}/6`} subdued={insight.completenessLabel} />
                        <InfoBlock
                          label="Duplicate pressure"
                          value={`${insight.familySize} row${insight.familySize === 1 ? '' : 's'}`}
                          subdued={selectedCandidate.dedupe_key || 'No dedupe key yet'}
                        />
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Reviewer next move</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{getReviewerNextMove(selectedCandidate, insight)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getCandidateReadinessGaps(selectedCandidate, insight).length === 0 ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                              No obvious readiness gaps
                            </span>
                          ) : (
                            getCandidateReadinessGaps(selectedCandidate, insight).map((gap) => (
                              <span key={gap} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">{gap}</span>
                            ))
                          )}
                        </div>
                      </div>

                      <DetailList title="Steps" items={jsonToStringList(selectedCandidate.steps_json)} emptyLabel="No steps extracted yet." />
                      <DetailList title="Focus points" items={jsonToStringList(selectedCandidate.focus_points_json)} emptyLabel="No focus points extracted yet." />
                      <DetailList title="Common mistakes" items={jsonToStringList(selectedCandidate.common_mistakes_json)} emptyLabel="No common mistakes extracted yet." />

                      <TagGroup title="Format tags" items={selectedCandidate.format_tags} />
                      <TagGroup title="Skill tags" items={selectedCandidate.skill_tags} />
                      <TagGroup title="Tags" items={selectedCandidate.tags} />

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Review notes</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {selectedCandidate.review_notes || 'No review notes yet.'}
                        </p>
                        {selectedCandidate.coach_demo_quote ? (
                          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                            Coach quote: {selectedCandidate.coach_demo_quote}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Likely canonical targets</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          These are the strongest likely canonical targets from the curated drills table, so you can merge straight from here instead of juggling IDs by hand.
                        </p>

                        {matchedDrills.length === 0 ? (
                          <p className="mt-4 text-sm text-[var(--text-secondary)]">No likely drill matches surfaced yet from the current library.</p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {matchedDrills.map((drill) => (
                              <div key={drill.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-[var(--text-primary)]">{drill.title}</p>
                                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                                        Match {drill.matchScore}
                                      </span>
                                      {drill.is_curated ? (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                                          Curated
                                        </span>
                                      ) : null}
                                      {!drill.is_active ? (
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
                                          Inactive
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                                      {drill.matchReasons.slice(0, 3).join(' • ')}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCanonicalDrillId(drill.id)}
                                      className={`inline-flex shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                                        preferredMergeTargetId === drill.id
                                          ? 'border-[var(--accent-primary)] bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                                          : 'border-[var(--border)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                                      }`}
                                    >
                                      {preferredMergeTargetId === drill.id ? 'Merge target selected' : 'Use as merge target'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() =>
                                        runReviewAction({
                                          action: 'merge',
                                          candidateIds: [selectedCandidate.id],
                                          canonicalDrillId: drill.id,
                                          successLabel: `Merged candidate into ${drill.title}.`,
                                        })
                                      }
                                      className="inline-flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      Merge now
                                    </button>
                                    <Link
                                      href={returnToLibraryHref ? `${returnToLibraryHref}${returnToLibraryHref.includes('?') ? '&' : '?'}selected=${drill.id}` : `/drills?selected=${drill.id}`}
                                      className="inline-flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                    >
                                      Open in library
                                    </Link>
                                  </div>
                                </div>
                                <p className="mt-2 text-sm text-[var(--text-secondary)]">{drill.summary || 'No library summary yet.'}</p>
                                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                                  {formatGradeLevel(drill.grade_level)} • {drill.category || 'Uncategorised'} • {drill.difficulty}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Family context</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                              {selectedCandidate.dedupe_key
                                ? `${selectedFamilyCandidates.length} visible row${selectedFamilyCandidates.length === 1 ? '' : 's'} share this dedupe key.`
                                : 'No dedupe key on this candidate yet.'}
                            </p>
                          </div>
                          {selectedCandidate.dedupe_key ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                {selectedCandidate.dedupe_key}
                              </span>
                              {familyFilter === selectedCandidate.dedupe_key ? (
                                <button
                                  type="button"
                                  onClick={clearFamilyFocus}
                                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  Clear focus
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => focusFamily(selectedCandidate.dedupe_key!, selectedCandidate.id)}
                                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"
                                >
                                  Focus family
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {selectedCandidate.dedupe_key ? (
                          <div className="mt-4 space-y-2">
                            {selectedFamilyCandidates.slice(0, 6).map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => {
                                  selectCandidate(candidate.id, { scrollIntoView: false })
                                  if (candidate.dedupe_key) {
                                    focusFamily(candidate.dedupe_key, candidate.id)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors ${
                                  candidate.id === selectedCandidate.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)]'
                                    : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
                                }`}
                              >
                                <span className="min-w-0 pr-3 text-sm font-medium text-[var(--text-primary)]">{getDisplayTitle(candidate)}</span>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
                                  {REVIEW_STATUS_LABELS[candidate.review_status]}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {selectedFamilyWorkspace ? (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Family review workspace</p>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                Read-only guidance for cleaning one duplicate cluster without pretending the mutation buttons work yet.
                              </p>
                            </div>
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              {selectedFamilyWorkspace.ranked.length} rows
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <InfoBlock label="Suggested keep" value={String(selectedFamilyWorkspace.decisionCounts.keep)} subdued={getDisplayTitle(selectedFamilyWorkspace.keepCandidate)} />
                            <InfoBlock label="Suggested merge" value={String(selectedFamilyWorkspace.decisionCounts.merge)} subdued="Useful supporting duplicates" />
                            <InfoBlock label="Suggested reject" value={String(selectedFamilyWorkspace.decisionCounts.reject)} subdued="Thin or noisy overlap" />
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <button
                              type="button"
                              onClick={() => selectCandidate(selectedFamilyWorkspace.keepCandidate.id, { scrollIntoView: false })}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            >
                              Open suggested keep
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">{getDisplayTitle(selectedFamilyWorkspace.keepCandidate)}</span>
                            </button>
                            <button
                              type="button"
                              disabled={!selectedFamilyWorkspace.nextMergeCandidate}
                              onClick={() =>
                                selectedFamilyWorkspace.nextMergeCandidate
                                  ? selectCandidate(selectedFamilyWorkspace.nextMergeCandidate.id, { scrollIntoView: false })
                                  : null
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next merge row
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.nextMergeCandidate ? getDisplayTitle(selectedFamilyWorkspace.nextMergeCandidate) : 'No pending merge row left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={!selectedFamilyWorkspace.nextRejectCandidate}
                              onClick={() =>
                                selectedFamilyWorkspace.nextRejectCandidate
                                  ? selectCandidate(selectedFamilyWorkspace.nextRejectCandidate.id, { scrollIntoView: false })
                                  : null
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next reject row
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {selectedFamilyWorkspace.nextRejectCandidate ? getDisplayTitle(selectedFamilyWorkspace.nextRejectCandidate) : 'No pending reject row left'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={!nextDuplicateFamily || nextDuplicateFamily.dedupeKey === selectedCandidate.dedupe_key}
                              onClick={() => focusFamily(nextDuplicateFamily!.dedupeKey, nextDuplicateFamily!.leadCandidate?.id ?? null)}
                              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open next family
                              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">
                                {nextDuplicateFamily
                                  ? `${nextDuplicateFamily.dedupeKey} • ${nextDuplicateFamily.count} rows`
                                  : 'No other pending duplicate family visible'}
                              </span>
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {selectedFamilyWorkspace.ranked.map(({ candidate, insight }) => {
                              const decision = getCandidateDecisionHint(candidate, insight)

                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() => selectCandidate(candidate.id, { scrollIntoView: false })}
                                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                                    candidate.id === selectedCandidate.id
                                      ? 'border-[var(--accent-primary)] bg-[var(--surface-elevated)]'
                                      : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">{getDisplayTitle(candidate)}</p>
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDecisionTone(decision)}`}>
                                          {getDecisionLabel(decision)}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{getShortSummary(candidate)}</p>
                                    </div>
                                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                                      <p>{insight.completenessScore}/6 completeness</p>
                                      <p className="mt-1">{insight.stepsCount} steps • {insight.focusPointsCount} focus</p>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] px-4 py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Reviewer handoff scaffold</p>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                  Copy-ready notes for Jordan or Sha-Lyn when turning this family into a real curation pass.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyFamilyHandoff(selectedFamilyWorkspace.handoffText)}
                                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                              >
                                Copy notes
                              </button>
                            </div>
                            <textarea
                              readOnly
                              value={selectedFamilyWorkspace.handoffText}
                              className="mt-4 min-h-[300px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 font-mono text-xs leading-6 text-[var(--text-secondary)] outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </aside>
      </section>
    </>
  )
}

function InfoBlock({ label, value, subdued }: { label: string; value: string; subdued?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 font-medium text-[var(--text-primary)]">{value}</p>
      {subdued ? <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{subdued}</p> : null}
    </div>
  )
}

function DetailList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          {items.map((item) => (
            <li key={item} className="rounded-xl border border-[var(--border)] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TagGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">None yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
