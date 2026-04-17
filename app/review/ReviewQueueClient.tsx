'use client'

import { useMemo, useState } from 'react'
import type { Drill, Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'

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

const SORT_MODE_LABELS: Record<SortMode, string> = {
  triage: 'Best next triage',
  'pending-first': 'Pending first',
  'duplicate-pressure': 'Duplicate pressure',
  completeness: 'Most complete',
  newest: 'Newest first',
  grade: 'Grade order',
}

type TriageLevel = 'act-now' | 'worth-a-look' | 'low-signal' | 'already-reviewed'

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

type DrillMatch = Pick<
  Drill,
  'id' | 'title' | 'category' | 'difficulty' | 'grade_level' | 'summary' | 'skill_tags' | 'tags' | 'raw_candidate_ids' | 'is_active' | 'is_curated'
> & {
  matchScore: number
  matchReasons: string[]
}

function formatGradeLevel(value: string | null) {
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

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('pending')
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('triage')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(candidates[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  function copyHandoff(action: ReviewStatus, ids: string[], label?: string) {
    const payload = {
      action,
      timestamp: new Date().toISOString(),
      ids,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopyFeedback(label || `Copied ${ids.length} to ${action}`)
    setTimeout(() => setCopyFeedback(null), 3000)
  }

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

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return candidates.filter((candidate) => {
      if (statusFilter !== 'all' && candidate.review_status !== statusFilter) return false

      if (gradeFilter !== 'all') {
        const candidateGrade = candidate.grade_level ?? 'unassigned'
        if (candidateGrade !== gradeFilter) return false
      }

      if (categoryFilter !== 'all' && candidate.category !== categoryFilter) return false

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
  }, [candidates, query, statusFilter, gradeFilter, categoryFilter])

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

  const statusCounts = REVIEW_STATUSES.map((status) => ({
    status,
    count: sortedCandidates.filter((candidate) => candidate.review_status === status).length,
  }))

  const gradeCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.grade_level ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const triageCounts = pendingCandidates.reduce<Record<TriageLevel, number>>(
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

  const missingSummaryCount = pendingCandidates.filter(
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
      .map(([dedupeKey, familyCandidates]) => ({
        dedupeKey,
        count: familyCandidates.length,
        statuses: Array.from(new Set(familyCandidates.map((candidate) => candidate.review_status))),
        sampleTitles: familyCandidates.slice(0, 3).map((candidate) => getDisplayTitle(candidate)),
      }))
      .sort((left, right) => right.count - left.count || left.dedupeKey.localeCompare(right.dedupeKey))
  }, [sortedCandidates])

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => sortedCandidates.some((candidate) => candidate.id === id)),
    [selectedIds, sortedCandidates]
  )

  const selectedCandidate = sortedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? sortedCandidates[0] ?? null

  const matchedDrills = useMemo(() => {
    if (!selectedCandidate) return []

    return drills
      .map((drill) => scoreDrillMatch(selectedCandidate, drill))
      .filter((match): match is DrillMatch => Boolean(match))
      .sort((left, right) => right.matchScore - left.matchScore || Number(right.is_curated) - Number(left.is_curated) || left.title.localeCompare(right.title))
      .slice(0, 5)
  }, [drills, selectedCandidate])

  const selectedFamilyCandidates = selectedCandidate?.dedupe_key
    ? sortedCandidates.filter((candidate) => candidate.dedupe_key === selectedCandidate.dedupe_key)
    : []

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

    const handoffLines = [
      `Family: ${selectedCandidate.dedupe_key}`,
      `Suggested canonical seed: ${getDisplayTitle(keepCandidate)}`,
      `Visible family rows: ${ranked.length} (${pendingCount} pending)`,
      `Suggested split: keep ${decisionCounts.keep}, merge ${decisionCounts.merge}, reject ${decisionCounts.reject}`,
      '',
      'Review steps:',
      `1. Start with ${getDisplayTitle(keepCandidate)} as the cleanest base shape.`,
      '2. Fold overlapping rows into that canonical drill if they add useful detail.',
      '3. Reject noisy duplicates that do not add anything reusable.',
    ]

    return {
      ranked,
      keepCandidate,
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

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function toggleSelectAllVisiblePending() {
    const pendingIds = pendingCandidates.map((candidate) => candidate.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => visibleSelectedIds.includes(id))

    setSelectedIds((current) => {
      const withoutVisiblePending = current.filter((id) => !pendingIds.includes(id))
      return allSelected ? withoutVisiblePending : [...withoutVisiblePending, ...pendingIds]
    })
  }

  const allVisiblePendingSelected =
    pendingCandidates.length > 0 && pendingCandidates.every((candidate) => visibleSelectedIds.includes(candidate.id))

  return (
    <>
      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-[var(--text-primary)]">{copyFeedback}</p>
        </div>
      )}

      <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review controls</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Default sort surfaces the best next candidates first, instead of making reviewers scroll through transcript soup blindly.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 lg:col-span-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Visible pending review</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-primary)]">{pendingCandidates.length}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Working subset after filters, currently sorted by <span className="font-medium text-[var(--text-primary)]">{SORT_MODE_LABELS[sortMode]}</span>.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Act now</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['act-now']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Pending rows with real duplicate pressure and enough structure to review cleanly.</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Worth a look</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['worth-a-look']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Reasonable next passes, but not the most urgent cleanup in the queue.</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Low signal</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{triageCounts['low-signal']}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Thin or isolated rows that should wait until better candidates are handled.</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Duplicate families</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{duplicateFamilies.length}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Distinct dedupe groups currently visible after filtering.</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Needs summary</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{missingSummaryCount}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Visible pending rows with no summary, description, or training note.</p>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Queue by review status</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Quick signal for where the visible backlog is actually sitting.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className={`rounded-2xl border px-4 py-4 ${getStatusTone(status)}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">{REVIEW_STATUS_LABELS[status]}</p>
                <p className="mt-2 text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending by grade</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Helpful when scanning current graduation imports.</p>
          <div className="mt-5 space-y-3">
            {Object.keys(gradeCounts).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No pending candidates in the current filter set.</p>
            ) : (
              Object.entries(gradeCounts)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([grade, count]) => (
                  <div key={grade} className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{formatGradeLevel(grade === 'unassigned' ? null : grade)}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{count}</span>
                  </div>
                ))
            )}
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
              {duplicateFamilies.slice(0, 8).map((family) => (
                <div key={family.dedupeKey} className="rounded-2xl border border-[var(--border)] px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{family.dedupeKey}</p>
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
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Bulk review scaffold</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Write actions happen via the service role. Select rows here, copy the handoff JSON, and pass it to the agent.
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

            {[
              { label: 'Approve selected', status: 'approved' as ReviewStatus },
              { label: 'Reject selected', status: 'rejected' as ReviewStatus },
              { label: 'Merge selected', status: 'merged' as ReviewStatus }
            ].map(({ label, status }) => (
              <button
                key={label}
                type="button"
                disabled={visibleSelectedIds.length === 0}
                onClick={() => copyHandoff(status, visibleSelectedIds, `Copied handoff (${visibleSelectedIds.length})`)}
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>{label}</span>
                <span className="text-xs text-[var(--text-tertiary)]">Copy JSON</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Visible raw drill candidates</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Filterable internal scan of the raw intake layer, ordered for curation rather than final library use.
              </p>
            </div>
          </div>

          {sortedCandidates.length === 0 ? (
            <EmptyState title="No matching candidates" body="Nothing in raw_drill_candidates matches the current filter combination." />
          ) : (
            <div className="space-y-4">
              {sortedCandidates.map((candidate) => {
                const insight = candidateInsights.get(candidate.id)
                const isSelected = selectedCandidate?.id === candidate.id
                const isBulkSelected = visibleSelectedIds.includes(candidate.id)

                if (!insight) return null

                return (
                  <article
                    key={candidate.id}
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
                              {candidate.dedupe_key && (
                                <span className="inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                  Family: {candidate.dedupe_key}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{insight.triageSummary}</p>
                            {candidate.when_to_assign && (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
                        {[
                          { label: 'Approve', status: 'approved' as ReviewStatus },
                          { label: 'Reject', status: 'rejected' as ReviewStatus },
                          { label: 'Merge', status: 'merged' as ReviewStatus }
                        ].map(({ label, status }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              copyHandoff(status, [candidate.id], `Copied ${label}`)
                            }}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                            title="Copy single handoff JSON"
                          >
                            {label}
                            <span className="ml-2 text-xs text-[var(--text-tertiary)]">Copy</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review detail</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Honest prep for approve, reject, and merge. Read here first, mutate later when the write path exists.
            </p>

            {!selectedCandidate ? (
              <p className="mt-5 text-sm text-[var(--text-secondary)]">Pick a visible candidate to inspect its detail panel.</p>
            ) : (
              <div className="mt-5 space-y-5">
                {(() => {
                  const insight = candidateInsights.get(selectedCandidate.id)

                  if (!insight) {
                    return <p className="text-sm text-[var(--text-secondary)]">Candidate detail is unavailable.</p>
                  }

                  return (
                    <>
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
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoBlock label="Raw title" value={selectedCandidate.raw_title || 'Missing raw title'} />
                        <InfoBlock label="Created" value={formatDateTime(selectedCandidate.created_at)} />
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
                          Merge prep only. These are likely matches from the curated drills table, so reviewers can compare before any safe write path exists.
                        </p>

                        {matchedDrills.length === 0 ? (
                          <p className="mt-4 text-sm text-[var(--text-secondary)]">No likely drill matches surfaced yet from the current library.</p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {matchedDrills.map((drill) => (
                              <div key={drill.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
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
                            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                              {selectedCandidate.dedupe_key}
                            </span>
                          ) : null}
                        </div>

                        {selectedCandidate.dedupe_key ? (
                          <div className="mt-4 space-y-2">
                            {selectedFamilyCandidates.slice(0, 6).map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => setSelectedCandidateId(candidate.id)}
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

                          <div className="mt-4 space-y-3">
                            {selectedFamilyWorkspace.ranked.map(({ candidate, insight }) => {
                              const decision = getCandidateDecisionHint(candidate, insight)

                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() => setSelectedCandidateId(candidate.id)}
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
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Reviewer handoff scaffold</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">
                              Copy-ready notes for Jordan or Sha-Lyn when turning this family into a real curation pass.
                            </p>
                            <textarea
                              readOnly
                              value={selectedFamilyWorkspace.handoffText}
                              className="mt-3 min-h-[180px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none"
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-[var(--text-primary)]">{value}</p>
      {subdued ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{subdued}</p> : null}
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
