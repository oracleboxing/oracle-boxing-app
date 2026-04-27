'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Drill, DrillCategory, DrillDifficulty, GradeLevel, Json, RawDrillCandidate } from '@/lib/supabase/types'

type DrillStatusFilter = 'all' | 'active' | 'inactive'
type DrillReviewHealthFilter = 'all' | 'pending' | 'reviewed' | 'unlinked'
type DrillCompletenessFilter = 'all' | 'ready' | 'usable' | 'thin'
type DrillDemoReadinessFilter = 'all' | 'ready' | 'needs_either' | 'needs_video' | 'needs_quote'
type DrillAuditPriorityFilter = 'all' | 'audit_now' | 'watch_next' | 'healthy'
type DrillSortMode = 'library' | 'newest' | 'grade' | 'completeness' | 'least_complete' | 'proof_gaps' | 'audit_priority'
type SummaryPreset =
  | 'all'
  | 'audit_now'
  | 'watch_next'
  | 'ready'
  | 'demo_ready'
  | 'needs_proof'
  | 'thin'
  | 'pending_review'
  | 'unlinked'

const SUMMARY_PRESET_META: Record<SummaryPreset, { label: string; hint: string }> = {
  all: {
    label: 'Full library',
    hint: 'Default active-canonical view with no audit narrowing.',
  },
  audit_now: {
    label: 'Audit now',
    hint: 'Weakest canonical moves that need attention first.',
  },
  watch_next: {
    label: 'Watch next',
    hint: 'Worth monitoring soon, but not the ugliest fires.',
  },
  ready: {
    label: 'Ready-ish',
    hint: 'Most complete drills, useful when you want the strongest rows first.',
  },
  demo_ready: {
    label: 'Demo ready',
    hint: 'Already has both a demo video and coach quote.',
  },
  needs_proof: {
    label: 'Needs proof',
    hint: 'Missing demo proof, so frontend confidence is still thin.',
  },
  thin: {
    label: 'Thin drills',
    hint: 'Teaching detail is still patchy and needs filling in.',
  },
  pending_review: {
    label: 'Pending source review',
    hint: 'Linked raw rows still need reviewer judgment.',
  },
  unlinked: {
    label: 'No raw links',
    hint: 'Canonical drill lacks raw-source traceability.',
  },
}

const SORT_MODE_LABELS: Record<DrillSortMode, string> = {
  library: 'Library order',
  newest: 'Newest first',
  grade: 'Grade order',
  completeness: 'Most complete',
  least_complete: 'Least complete',
  proof_gaps: 'Needs proof first',
  audit_priority: 'Audit weakest first',
}

const REVIEW_HEALTH_FILTER_LABELS: Record<DrillReviewHealthFilter, string> = {
  all: 'All source review states',
  pending: 'Pending raw review',
  reviewed: 'Source mostly reviewed',
  unlinked: 'No linked raw rows',
}

const COMPLETENESS_FILTER_LABELS: Record<DrillCompletenessFilter, string> = {
  all: 'All content states',
  ready: 'Ready (8+ pts)',
  usable: 'Usable (5-7 pts)',
  thin: 'Thin (< 5 pts)',
}

const DEMO_READINESS_FILTER_LABELS: Record<DrillDemoReadinessFilter, string> = {
  all: 'All demo states',
  ready: 'Has video & quote',
  needs_either: 'Missing video or quote',
  needs_video: 'Missing video',
  needs_quote: 'Missing quote',
}

const AUDIT_PRIORITY_FILTER_LABELS: Record<DrillAuditPriorityFilter, string> = {
  all: 'All audit states',
  audit_now: 'Audit now',
  watch_next: 'Watch next',
  healthy: 'Healthy-ish',
}

function formatGradeLevel(value: GradeLevel | null) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatCategory(value: DrillCategory | null) {
  if (!value) return 'Uncategorised'
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDifficulty(value: DrillDifficulty) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function countJsonItems(value: Json) {
  return Array.isArray(value) ? value.length : 0
}

function jsonToStringList(value: Json) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getCompletenessScore(drill: Drill) {
  return [
    Boolean(drill.summary),
    Boolean(drill.description),
    countJsonItems(drill.steps_json) > 0,
    countJsonItems(drill.focus_points_json) > 0,
    countJsonItems(drill.common_mistakes_json) > 0,
    Boolean(drill.what_it_trains),
    Boolean(drill.when_to_assign),
    Boolean(drill.coach_demo_quote),
    Boolean(drill.demo_video_url),
    Boolean(drill.animation_key),
  ].filter(Boolean).length
}

function getCompletenessLabel(score: number) {
  if (score >= 8) return 'Ready'
  if (score >= 5) return 'Usable'
  return 'Thin'
}

function getCompletenessTone(score: number) {
  if (score >= 8) return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  if (score >= 5) return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
  return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
}

function getDemoReadinessLabel(drill: Drill) {
  const hasVideo = Boolean(drill.demo_video_url)
  const hasQuote = Boolean(drill.coach_demo_quote)

  if (hasVideo && hasQuote) return 'Frontend-ready proof'
  if (!hasVideo && !hasQuote) return 'Missing video and quote'
  if (!hasVideo) return 'Missing demo video'
  return 'Missing coach quote'
}

function getDemoReadinessTone(drill: Drill) {
  const hasVideo = Boolean(drill.demo_video_url)
  const hasQuote = Boolean(drill.coach_demo_quote)

  if (hasVideo && hasQuote) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  }

  if (!hasVideo && !hasQuote) {
    return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }

  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
}

function getDrillReadinessGaps(drill: Drill) {
  const gaps: string[] = []

  if (countJsonItems(drill.steps_json) === 0) gaps.push('No steps')
  if (countJsonItems(drill.focus_points_json) === 0) gaps.push('No focus points')
  if (countJsonItems(drill.common_mistakes_json) === 0) gaps.push('No common mistakes')
  if (!drill.what_it_trains) gaps.push('No training outcome')
  if (!drill.when_to_assign) gaps.push('No assignment guidance')
  if (!drill.coach_demo_quote) gaps.push('No coach quote')
  if (!drill.demo_video_url) gaps.push('No demo video')

  return gaps
}

function getStatusTone(isActive: boolean) {
  return isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

type LinkedCandidate = Pick<RawDrillCandidate, 'id' | 'cleaned_title' | 'raw_title' | 'review_status'>

type LinkedCandidateReviewSummary = {
  pending: number
  approved: number
  merged: number
  rejected: number
  total: number
}

function buildLinkedCandidateReviewSummary(candidates: LinkedCandidate[]): LinkedCandidateReviewSummary {
  return candidates.reduce<LinkedCandidateReviewSummary>(
    (acc, candidate) => {
      acc[candidate.review_status] += 1
      acc.total += 1
      return acc
    },
    {
      pending: 0,
      approved: 0,
      merged: 0,
      rejected: 0,
      total: 0,
    }
  )
}

function getLinkedReviewHealthLabel(summary: LinkedCandidateReviewSummary) {
  if (summary.total === 0) return 'No linked raw review context'
  if (summary.pending > 0) return summary.pending === summary.total ? 'Needs raw review' : 'Raw review still in progress'
  if (summary.approved + summary.merged > 0) return 'Source set mostly reviewed'
  return 'Source set needs judgment'
}

function getLinkedReviewHealthTone(summary: LinkedCandidateReviewSummary) {
  if (summary.total === 0) return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
  if (summary.pending > 0) return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
  if (summary.approved + summary.merged > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
  return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300'
}

function getLinkedReviewNextMove(summary: LinkedCandidateReviewSummary) {
  if (summary.total === 0) return 'This drill has no linked raw rows yet, so traceability is still thin.'
  if (summary.pending > 0) return `Review the ${summary.pending} pending raw row${summary.pending === 1 ? '' : 's'} before treating this drill as settled.`
  if (summary.approved + summary.merged > 0) return 'Raw source rows are already reviewed, so this drill is in decent shape for canonical polish.'
  return 'Linked source rows exist, but they still need a proper review decision.'
}

function getReviewStatusTone(reviewStatus: LinkedCandidate['review_status']) {
  switch (reviewStatus) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
    case 'merged':
      return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-300'
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
    case 'pending':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
  }
}

function getReviewStatusLabel(reviewStatus: LinkedCandidate['review_status']) {
  return reviewStatus.charAt(0).toUpperCase() + reviewStatus.slice(1)
}

function getAuditPriority(drill: Drill, linkedCandidates: LinkedCandidate[]) {
  const reviewSummary = buildLinkedCandidateReviewSummary(linkedCandidates)
  const completenessScore = getCompletenessScore(drill)
  const reasons: string[] = []
  let score = 0

  if (completenessScore < 5) {
    score += 3
    reasons.push('Thin teaching detail')
  } else if (completenessScore < 8) {
    score += 1
    reasons.push('Still missing some teaching detail')
  }

  if (!drill.demo_video_url && !drill.coach_demo_quote) {
    score += 2
    reasons.push('No demo proof yet')
  } else if (!drill.demo_video_url || !drill.coach_demo_quote) {
    score += 1
    reasons.push('Proof is only half there')
  }

  if (reviewSummary.pending > 0) {
    score += 2
    reasons.push(`${reviewSummary.pending} pending raw review`)
  }

  if (reviewSummary.total === 0) {
    score += 2
    reasons.push('No raw traceability')
  }

  if (!drill.grade_level) {
    score += 1
    reasons.push('No grade assigned')
  }

  if (!drill.is_active) {
    score += 1
    reasons.push('Inactive row')
  }

  const bucket: DrillAuditPriorityFilter = score >= 6 ? 'audit_now' : score >= 3 ? 'watch_next' : 'healthy'

  return {
    score,
    bucket,
    label: bucket === 'audit_now' ? 'Audit now' : bucket === 'watch_next' ? 'Watch next' : 'Healthy-ish',
    reasons,
  }
}

function getAuditPriorityTone(bucket: DrillAuditPriorityFilter) {
  if (bucket === 'audit_now') {
    return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
  }

  if (bucket === 'watch_next') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
}

function getCandidateTitle(candidate: LinkedCandidate) {
  return candidate.cleaned_title || candidate.raw_title || 'Untitled raw candidate'
}

export function DrillLibraryClient({ drills, linkedCandidates }: { drills: Drill[]; linkedCandidates: LinkedCandidate[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedDrillFromUrl = searchParams.get('selected')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [categoryFilter, setCategoryFilter] = useState<'all' | DrillCategory>(() => (searchParams.get('category') as 'all' | DrillCategory) ?? 'all')
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel | 'unassigned'>(() => (searchParams.get('grade') as 'all' | GradeLevel | 'unassigned') ?? 'all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DrillDifficulty>(() => (searchParams.get('difficulty') as 'all' | DrillDifficulty) ?? 'all')
  const [statusFilter, setStatusFilter] = useState<DrillStatusFilter>(() => (searchParams.get('status') as DrillStatusFilter) ?? 'active')
  const [reviewHealthFilter, setReviewHealthFilter] = useState<DrillReviewHealthFilter>(() => (searchParams.get('review') as DrillReviewHealthFilter) ?? 'all')
  const [completenessFilter, setCompletenessFilter] = useState<DrillCompletenessFilter>(() => (searchParams.get('completeness') as DrillCompletenessFilter) ?? 'all')
  const [demoReadinessFilter, setDemoReadinessFilter] = useState<DrillDemoReadinessFilter>(() => (searchParams.get('demo') as DrillDemoReadinessFilter) ?? 'all')
  const [auditPriorityFilter, setAuditPriorityFilter] = useState<DrillAuditPriorityFilter>(() => (searchParams.get('audit') as DrillAuditPriorityFilter) ?? 'all')
  const [curatedOnly, setCuratedOnly] = useState(() => searchParams.get('curated') !== '0')
  const [sortMode, setSortMode] = useState<DrillSortMode>(() => {
    const value = searchParams.get('sort')
    return value && value in SORT_MODE_LABELS ? (value as DrillSortMode) : 'library'
  })
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(() => searchParams.get('selected') ?? drills[0]?.id ?? null)
  const reviewReturnHref = useMemo(() => {
    const current = searchParams.toString()
    return current ? `${pathname}?${current}` : pathname
  }, [pathname, searchParams])

  const categories = useMemo(
    () => Array.from(new Set(drills.map((drill) => drill.category).filter(Boolean))) as DrillCategory[],
    [drills]
  )

  const gradeLevels = useMemo(
    () => Array.from(new Set(drills.map((drill) => drill.grade_level ?? 'unassigned'))),
    [drills]
  )

  useEffect(() => {
    const nextQuery = searchParams.get('q') ?? ''
    const nextCategory = (searchParams.get('category') as 'all' | DrillCategory) ?? 'all'
    const nextGrade = (searchParams.get('grade') as 'all' | GradeLevel | 'unassigned') ?? 'all'
    const nextDifficulty = (searchParams.get('difficulty') as 'all' | DrillDifficulty) ?? 'all'
    const nextStatus = (searchParams.get('status') as DrillStatusFilter) ?? 'active'
    const nextReview = (searchParams.get('review') as DrillReviewHealthFilter) ?? 'all'
    const nextCompleteness = (searchParams.get('completeness') as DrillCompletenessFilter) ?? 'all'
    const nextDemo = (searchParams.get('demo') as DrillDemoReadinessFilter) ?? 'all'
    const nextAudit = (searchParams.get('audit') as DrillAuditPriorityFilter) ?? 'all'
    const nextCurated = searchParams.get('curated') !== '0'
    const nextSort = searchParams.get('sort')
    const nextSelected = searchParams.get('selected')

    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setCategoryFilter((current) => (current === nextCategory ? current : nextCategory))
    setGradeFilter((current) => (current === nextGrade ? current : nextGrade))
    setDifficultyFilter((current) => (current === nextDifficulty ? current : nextDifficulty))
    setStatusFilter((current) => (current === nextStatus ? current : nextStatus))
    setReviewHealthFilter((current) => (current === nextReview ? current : nextReview))
    setCompletenessFilter((current) => (current === nextCompleteness ? current : nextCompleteness))
    setDemoReadinessFilter((current) => (current === nextDemo ? current : nextDemo))
    setAuditPriorityFilter((current) => (current === nextAudit ? current : nextAudit))
    setCuratedOnly((current) => (current === nextCurated ? current : nextCurated))
    setSortMode((current) => {
      const resolved = nextSort && nextSort in SORT_MODE_LABELS ? (nextSort as DrillSortMode) : 'library'
      return current === resolved ? current : resolved
    })
    setSelectedDrillId((current) => {
      const resolved = nextSelected ?? drills[0]?.id ?? null
      return current === resolved ? current : resolved
    })
  }, [drills, searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (query.trim()) nextParams.set('q', query)
    else nextParams.delete('q')

    if (categoryFilter !== 'all') nextParams.set('category', categoryFilter)
    else nextParams.delete('category')

    if (gradeFilter !== 'all') nextParams.set('grade', gradeFilter)
    else nextParams.delete('grade')

    if (difficultyFilter !== 'all') nextParams.set('difficulty', difficultyFilter)
    else nextParams.delete('difficulty')

    if (statusFilter !== 'active') nextParams.set('status', statusFilter)
    else nextParams.delete('status')

    if (reviewHealthFilter !== 'all') nextParams.set('review', reviewHealthFilter)
    else nextParams.delete('review')

    if (completenessFilter !== 'all') nextParams.set('completeness', completenessFilter)
    else nextParams.delete('completeness')

    if (demoReadinessFilter !== 'all') nextParams.set('demo', demoReadinessFilter)
    else nextParams.delete('demo')

    if (auditPriorityFilter !== 'all') nextParams.set('audit', auditPriorityFilter)
    else nextParams.delete('audit')

    if (!curatedOnly) nextParams.set('curated', '0')
    else nextParams.delete('curated')

    if (sortMode !== 'library') nextParams.set('sort', sortMode)
    else nextParams.delete('sort')

    if (selectedDrillId) nextParams.set('selected', selectedDrillId)
    else nextParams.delete('selected')

    const current = searchParams.toString()
    const next = nextParams.toString()

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [auditPriorityFilter, categoryFilter, completenessFilter, curatedOnly, demoReadinessFilter, difficultyFilter, gradeFilter, pathname, query, reviewHealthFilter, router, searchParams, selectedDrillId, sortMode, statusFilter])

  function copyCurrentView(label: string) {
    if (typeof window === 'undefined') return
    navigator.clipboard.writeText(window.location.href)
    setCopyFeedback(label)
    window.setTimeout(() => setCopyFeedback(null), 3000)
  }

  function applySummaryPreset(preset: SummaryPreset) {
    setQuery('')
    setCategoryFilter('all')
    setGradeFilter('all')
    setDifficultyFilter('all')
    setStatusFilter('active')
    setReviewHealthFilter('all')
    setCompletenessFilter('all')
    setDemoReadinessFilter('all')
    setAuditPriorityFilter('all')
    setCuratedOnly(true)
    setSortMode('library')

    if (preset === 'audit_now') {
      setAuditPriorityFilter('audit_now')
      setSortMode('audit_priority')
      return
    }

    if (preset === 'watch_next') {
      setAuditPriorityFilter('watch_next')
      setSortMode('audit_priority')
      return
    }

    if (preset === 'ready') {
      setCompletenessFilter('ready')
      setSortMode('completeness')
      return
    }

    if (preset === 'demo_ready') {
      setDemoReadinessFilter('ready')
      return
    }

    if (preset === 'needs_proof') {
      setDemoReadinessFilter('needs_either')
      setSortMode('proof_gaps')
      return
    }

    if (preset === 'thin') {
      setCompletenessFilter('thin')
      setSortMode('least_complete')
      return
    }

    if (preset === 'pending_review') {
      setReviewHealthFilter('pending')
      return
    }

    if (preset === 'unlinked') {
      setReviewHealthFilter('unlinked')
    }
  }

  function isSummaryPresetActive(preset: SummaryPreset) {
    if (query.trim()) return false
    if (categoryFilter !== 'all' || gradeFilter !== 'all' || difficultyFilter !== 'all') return false
    if (statusFilter !== 'active' || !curatedOnly) return false

    if (preset === 'all') {
      return reviewHealthFilter === 'all' && completenessFilter === 'all' && demoReadinessFilter === 'all' && auditPriorityFilter === 'all' && sortMode === 'library'
    }

    if (preset === 'audit_now') {
      return reviewHealthFilter === 'all' && completenessFilter === 'all' && demoReadinessFilter === 'all' && auditPriorityFilter === 'audit_now' && sortMode === 'audit_priority'
    }

    if (preset === 'watch_next') {
      return reviewHealthFilter === 'all' && completenessFilter === 'all' && demoReadinessFilter === 'all' && auditPriorityFilter === 'watch_next' && sortMode === 'audit_priority'
    }

    if (preset === 'ready') {
      return reviewHealthFilter === 'all' && completenessFilter === 'ready' && demoReadinessFilter === 'all' && auditPriorityFilter === 'all' && sortMode === 'completeness'
    }

    if (preset === 'demo_ready') {
      return reviewHealthFilter === 'all' && completenessFilter === 'all' && demoReadinessFilter === 'ready' && auditPriorityFilter === 'all' && sortMode === 'library'
    }

    if (preset === 'needs_proof') {
      return reviewHealthFilter === 'all' && completenessFilter === 'all' && demoReadinessFilter === 'needs_either' && auditPriorityFilter === 'all' && sortMode === 'proof_gaps'
    }

    if (preset === 'thin') {
      return reviewHealthFilter === 'all' && completenessFilter === 'thin' && demoReadinessFilter === 'all' && auditPriorityFilter === 'all' && sortMode === 'least_complete'
    }

    if (preset === 'pending_review') {
      return reviewHealthFilter === 'pending' && completenessFilter === 'all' && demoReadinessFilter === 'all' && auditPriorityFilter === 'all' && sortMode === 'library'
    }

    return reviewHealthFilter === 'unlinked' && completenessFilter === 'all' && demoReadinessFilter === 'all' && auditPriorityFilter === 'all' && sortMode === 'library'
  }

  const activeSummaryPreset = (Object.keys(SUMMARY_PRESET_META) as SummaryPreset[]).find((preset) => isSummaryPresetActive(preset)) ?? null

  const filteredDrills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const next = drills.filter((drill) => {
      if (categoryFilter !== 'all' && drill.category !== categoryFilter) return false
      if (difficultyFilter !== 'all' && drill.difficulty !== difficultyFilter) return false
      if (statusFilter === 'active' && !drill.is_active) return false
      if (statusFilter === 'inactive' && drill.is_active) return false
      if (curatedOnly && !drill.is_curated) return false

      if (completenessFilter !== 'all') {
        const score = getCompletenessScore(drill)
        if (completenessFilter === 'ready' && score < 8) return false
        if (completenessFilter === 'usable' && (score < 5 || score >= 8)) return false
        if (completenessFilter === 'thin' && score >= 5) return false
      }

      if (demoReadinessFilter !== 'all') {
        const hasVideo = Boolean(drill.demo_video_url)
        const hasQuote = Boolean(drill.coach_demo_quote)
        
        if (demoReadinessFilter === 'ready' && (!hasVideo || !hasQuote)) return false
        if (demoReadinessFilter === 'needs_either' && hasVideo && hasQuote) return false
        if (demoReadinessFilter === 'needs_video' && hasVideo) return false
        if (demoReadinessFilter === 'needs_quote' && hasQuote) return false
      }

      const drillCandidates = linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id))
      const reviewSummary = buildLinkedCandidateReviewSummary(drillCandidates)
      const auditPriority = getAuditPriority(drill, drillCandidates)

      if (reviewHealthFilter === 'pending' && reviewSummary.pending === 0) return false
      if (reviewHealthFilter === 'reviewed' && (reviewSummary.total === 0 || reviewSummary.pending > 0 || reviewSummary.approved + reviewSummary.merged === 0)) return false
      if (reviewHealthFilter === 'unlinked' && reviewSummary.total > 0) return false
      if (auditPriorityFilter !== 'all' && auditPriority.bucket !== auditPriorityFilter) return false

      if (gradeFilter !== 'all') {
        const value = drill.grade_level ?? 'unassigned'
        if (value !== gradeFilter) return false
      }

      if (!normalizedQuery) return true

      const haystack = [
        drill.title,
        drill.summary,
        drill.description,
        drill.what_it_trains,
        drill.when_to_assign,
        drill.category,
        drill.grade_level,
        ...drill.skill_tags,
        ...drill.format_tags,
        ...drill.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    next.sort((a, b) => {
      const completenessDiff = getCompletenessScore(b) - getCompletenessScore(a)
      const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      const gradeDiff = (a.grade_level ?? 'zzz').localeCompare(b.grade_level ?? 'zzz')
      const proofGapScoreA = Number(!a.demo_video_url) + Number(!a.coach_demo_quote)
      const proofGapScoreB = Number(!b.demo_video_url) + Number(!b.coach_demo_quote)
      const proofGapDiff = proofGapScoreB - proofGapScoreA
      const auditPriorityA = getAuditPriority(a, linkedCandidates.filter((candidate) => a.raw_candidate_ids.includes(candidate.id)))
      const auditPriorityB = getAuditPriority(b, linkedCandidates.filter((candidate) => b.raw_candidate_ids.includes(candidate.id)))
      const auditPriorityDiff = auditPriorityB.score - auditPriorityA.score

      if (sortMode === 'newest') return updatedDiff || a.title.localeCompare(b.title)
      if (sortMode === 'grade') return gradeDiff || a.title.localeCompare(b.title)
      if (sortMode === 'completeness') return completenessDiff || a.title.localeCompare(b.title)
      if (sortMode === 'least_complete') return -completenessDiff || a.title.localeCompare(b.title)
      if (sortMode === 'proof_gaps') return proofGapDiff || completenessDiff || a.title.localeCompare(b.title)
      if (sortMode === 'audit_priority') return auditPriorityDiff || proofGapDiff || -completenessDiff || updatedDiff || a.title.localeCompare(b.title)

      return Number(b.is_active) - Number(a.is_active) || Number(b.is_curated) - Number(a.is_curated) || gradeDiff || a.title.localeCompare(b.title)
    })

    return next
  }, [auditPriorityFilter, categoryFilter, curatedOnly, difficultyFilter, drills, gradeFilter, linkedCandidates, query, reviewHealthFilter, sortMode, statusFilter, completenessFilter, demoReadinessFilter])

  useEffect(() => {
    if (filteredDrills.length === 0) {
      setSelectedDrillId(null)
      return
    }

    if (selectedDrillFromUrl && filteredDrills.some((drill) => drill.id === selectedDrillFromUrl)) {
      setSelectedDrillId(selectedDrillFromUrl)
      return
    }

    if (!selectedDrillId || !filteredDrills.some((drill) => drill.id === selectedDrillId)) {
      setSelectedDrillId(filteredDrills[0].id)
    }
  }, [filteredDrills, selectedDrillFromUrl, selectedDrillId])

  const selectedDrill = filteredDrills.find((drill) => drill.id === selectedDrillId) ?? null

  const summary = useMemo(() => {
    const activeCount = drills.filter((drill) => drill.is_active).length
    const curatedCount = drills.filter((drill) => drill.is_curated).length
    const withGradeCount = drills.filter((drill) => drill.grade_level).length
    const readyCount = drills.filter((drill) => getCompletenessScore(drill) >= 8).length
    const withPendingRawReviewCount = drills.filter((drill) => {
      const reviewSummary = buildLinkedCandidateReviewSummary(
        linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id))
      )

      return reviewSummary.pending > 0
    }).length
    const auditNowCount = drills.filter((drill) => getAuditPriority(drill, linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id))).bucket === 'audit_now').length
    const watchNextCount = drills.filter((drill) => getAuditPriority(drill, linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id))).bucket === 'watch_next').length
    const thinCount = drills.filter((drill) => getCompletenessScore(drill) < 5).length
    const demoReadyCount = drills.filter((drill) => Boolean(drill.demo_video_url) && Boolean(drill.coach_demo_quote)).length
    const needsProofCount = drills.filter((drill) => !drill.demo_video_url || !drill.coach_demo_quote).length
    const unlinkedCount = drills.filter((drill) => drill.raw_candidate_ids.length === 0).length

    return {
      activeCount,
      curatedCount,
      withGradeCount,
      readyCount,
      withPendingRawReviewCount,
      auditNowCount,
      watchNextCount,
      thinCount,
      demoReadyCount,
      needsProofCount,
      unlinkedCount,
    }
  }, [drills, linkedCandidates])

  if (drills.length === 0) {
    return (
      <EmptyState
        title="No curated drills yet"
        body="The moves table is reachable, but it does not have any curated library rows yet. That is fine for now. The next real job is turning reviewed source candidates into canonical moves."
      />
    )
  }

  return (
    <>
      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-[var(--text-primary)]">{copyFeedback}</p>
        </div>
      )}

      <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-11">
        <SummaryCard label="Total drills" value={String(drills.length)} hint="Rows currently in the moves table" onClick={() => applySummaryPreset('all')} isActive={isSummaryPresetActive('all')} />
        <SummaryCard label="Active drills" value={String(summary.activeCount)} hint="Visible candidates for the real app library" onClick={() => applySummaryPreset('all')} isActive={isSummaryPresetActive('all')} />
        <SummaryCard label="Marked curated" value={String(summary.curatedCount)} hint="Rows already treated as canonical" onClick={() => applySummaryPreset('all')} isActive={isSummaryPresetActive('all')} />
        <SummaryCard label="Audit now" value={String(summary.auditNowCount)} hint="Weak canonical rows that need eyes first" onClick={() => applySummaryPreset('audit_now')} isActive={isSummaryPresetActive('audit_now')} />
        <SummaryCard label="Watch next" value={String(summary.watchNextCount)} hint="Not broken, but still a bit suspect" onClick={() => applySummaryPreset('watch_next')} isActive={isSummaryPresetActive('watch_next')} />
        <SummaryCard label="Ready-ish" value={String(summary.readyCount)} hint="8+ completeness points across copy and drill structure" onClick={() => applySummaryPreset('ready')} isActive={isSummaryPresetActive('ready')} />
        <SummaryCard label="Demo ready" value={String(summary.demoReadyCount)} hint="Has demo video and coach quote, so frontend work is less guessy" onClick={() => applySummaryPreset('demo_ready')} isActive={isSummaryPresetActive('demo_ready')} />
        <SummaryCard label="Needs proof" value={String(summary.needsProofCount)} hint="Still missing a demo video, a coach quote, or both" onClick={() => applySummaryPreset('needs_proof')} isActive={isSummaryPresetActive('needs_proof')} />
        <SummaryCard label="Thin drills" value={String(summary.thinCount)} hint="Canonical move rows still missing core teaching detail" onClick={() => applySummaryPreset('thin')} isActive={isSummaryPresetActive('thin')} />
        <SummaryCard label="Pending source review" value={String(summary.withPendingRawReviewCount)} hint="Drills still linked to at least one pending raw review row" onClick={() => applySummaryPreset('pending_review')} isActive={isSummaryPresetActive('pending_review')} />
        <SummaryCard label="No raw links" value={String(summary.unlinkedCount)} hint="Canonical rows with no raw candidate traceability yet" onClick={() => applySummaryPreset('unlinked')} isActive={isSummaryPresetActive('unlinked')} />
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_repeat(9,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, summary, tags, grade"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
            />
          </label>

          <FilterSelect
            label="Category"
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as 'all' | DrillCategory)}
            options={[{ value: 'all', label: 'All categories' }, ...categories.map((value) => ({ value, label: formatCategory(value) }))]}
          />
          <FilterSelect
            label="Grade"
            value={gradeFilter}
            onChange={(value) => setGradeFilter(value as 'all' | GradeLevel | 'unassigned')}
            options={[{ value: 'all', label: 'All grades' }, ...gradeLevels.map((value) => ({ value, label: value === 'unassigned' ? 'Unassigned' : formatGradeLevel(value as GradeLevel) }))]}
          />
          <FilterSelect
            label="Difficulty"
            value={difficultyFilter}
            onChange={(value) => setDifficultyFilter(value as 'all' | DrillDifficulty)}
            options={[{ value: 'all', label: 'All levels' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as DrillStatusFilter)}
            options={[{ value: 'active', label: 'Active only' }, { value: 'all', label: 'All statuses' }, { value: 'inactive', label: 'Inactive only' }]}
          />
          <FilterSelect
            label="Source review"
            value={reviewHealthFilter}
            onChange={(value) => setReviewHealthFilter(value as DrillReviewHealthFilter)}
            options={Object.entries(REVIEW_HEALTH_FILTER_LABELS).map(([value, label]) => ({ value: value as DrillReviewHealthFilter, label }))}
          />
          <FilterSelect
            label="Completeness"
            value={completenessFilter}
            onChange={(value) => setCompletenessFilter(value as DrillCompletenessFilter)}
            options={Object.entries(COMPLETENESS_FILTER_LABELS).map(([value, label]) => ({ value: value as DrillCompletenessFilter, label }))}
          />
          <FilterSelect
            label="Demo / Proof"
            value={demoReadinessFilter}
            onChange={(value) => setDemoReadinessFilter(value as DrillDemoReadinessFilter)}
            options={Object.entries(DEMO_READINESS_FILTER_LABELS).map(([value, label]) => ({ value: value as DrillDemoReadinessFilter, label }))}
          />
          <FilterSelect
            label="Audit priority"
            value={auditPriorityFilter}
            onChange={(value) => setAuditPriorityFilter(value as DrillAuditPriorityFilter)}
            options={Object.entries(AUDIT_PRIORITY_FILTER_LABELS).map(([value, label]) => ({ value: value as DrillAuditPriorityFilter, label }))}
          />
          <FilterSelect
            label="Sort"
            value={sortMode}
            onChange={(value) => setSortMode(value as DrillSortMode)}
            options={Object.entries(SORT_MODE_LABELS).map(([value, label]) => ({ value: value as DrillSortMode, label }))}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={curatedOnly} onChange={(event) => setCuratedOnly(event.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
            Curated only
          </label>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {filteredDrills.length} visible
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {summary.withGradeCount} with grade tags
          </span>
          <button
            type="button"
            onClick={() => copyCurrentView('Copied drill library view link')}
            className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
          >
            Copy current view
          </button>
        </div>

        {activeSummaryPreset && activeSummaryPreset !== 'all' ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
            <span className="rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
              Preset active: {SUMMARY_PRESET_META[activeSummaryPreset].label}
            </span>
            <p className="text-sm text-[var(--text-secondary)]">{SUMMARY_PRESET_META[activeSummaryPreset].hint}</p>
            <button
              type="button"
              onClick={() => applySummaryPreset('all')}
              className="ml-auto inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Reset to full library
            </button>
          </div>
        ) : null}
      </section>

      {filteredDrills.length === 0 ? (
        <EmptyState
          title="No drills match this filter"
          body="Try widening the grade or status filters. If curated-only is on, you may simply not have promoted enough rows yet."
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-3">
            {filteredDrills.map((drill) => {
              const isSelected = selectedDrillId === drill.id
              const completenessScore = getCompletenessScore(drill)
              const drillCandidates = linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id))
              const reviewSummary = buildLinkedCandidateReviewSummary(drillCandidates)
              const readinessGaps = getDrillReadinessGaps(drill)
              const auditPriority = getAuditPriority(drill, drillCandidates)

              return (
                <button
                  key={drill.id}
                  type="button"
                  onClick={() => setSelectedDrillId(drill.id)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-primary)]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">{drill.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{drill.summary}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(drill.is_active)}`}>
                      {drill.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip>{formatCategory(drill.category)}</Chip>
                    <Chip>{formatDifficulty(drill.difficulty)}</Chip>
                    <Chip>{formatGradeLevel(drill.grade_level)}</Chip>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditPriorityTone(auditPriority.bucket)}`}>
                      {auditPriority.label}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCompletenessTone(completenessScore)}`}>
                      {getCompletenessLabel(completenessScore)}
                    </span>
                    {drill.is_curated ? <Chip>Canonical</Chip> : <Chip>Needs curation</Chip>}
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDemoReadinessTone(drill)}`}>
                      {getDemoReadinessLabel(drill)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getLinkedReviewHealthTone(reviewSummary)}`}>
                      {getLinkedReviewHealthLabel(reviewSummary)}
                    </span>
                    {reviewSummary.total > 0
                      ? (Object.entries(reviewSummary) as Array<[keyof LinkedCandidateReviewSummary, number]>)
                          .filter(([status, count]) => status !== 'total' && count > 0)
                          .map(([status, count]) => (
                            <span key={status} className={`rounded-full border px-3 py-1 text-xs font-semibold ${getReviewStatusTone(status as LinkedCandidate['review_status'])}`}>
                              {count} {getReviewStatusLabel(status as LinkedCandidate['review_status'])} raw
                            </span>
                          ))
                      : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {auditPriority.reasons.slice(0, 2).map((reason) => (
                      <span key={reason} className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditPriorityTone(auditPriority.bucket)}`}>
                        {reason}
                      </span>
                    ))}
                    {readinessGaps.length > 0 ? (
                      readinessGaps.slice(0, 3).map((gap) => (
                        <span key={gap} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                          {gap}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                        No obvious readiness gaps
                      </span>
                    )}
                    {readinessGaps.length > 3 ? <Chip>+{readinessGaps.length - 3} more gaps</Chip> : null}
                  </div>

                  <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">{getLinkedReviewNextMove(reviewSummary)}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Steps" value={String(countJsonItems(drill.steps_json))} />
                    <MiniStat label="Focus points" value={String(countJsonItems(drill.focus_points_json))} />
                    <MiniStat label="Mistakes" value={String(countJsonItems(drill.common_mistakes_json))} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 xl:sticky xl:top-6 xl:self-start">
            {selectedDrill ? (
              <DrillDetail
                drill={selectedDrill}
                linkedCandidates={linkedCandidates.filter((candidate) => selectedDrill.raw_candidate_ids.includes(candidate.id))}
                reviewReturnHref={reviewReturnHref}
                onCopyFeedback={setCopyFeedback}
              />
            ) : (
              <EmptyState title="Choose a drill" body="Select a drill from the library list to inspect its content quality and app readiness." />
            )}
          </div>
        </section>
      )}
      </div>
    </>
  )
}

function DrillDetail({
  drill,
  linkedCandidates,
  reviewReturnHref,
  onCopyFeedback,
}: {
  drill: Drill
  linkedCandidates: LinkedCandidate[]
  reviewReturnHref: string
  onCopyFeedback: (value: string | null) => void
}) {
  const steps = jsonToStringList(drill.steps_json)
  const focusPoints = jsonToStringList(drill.focus_points_json)
  const mistakes = jsonToStringList(drill.common_mistakes_json)
  const completenessScore = getCompletenessScore(drill)
  const reviewSummary = buildLinkedCandidateReviewSummary(linkedCandidates)
  const firstPendingCandidate = linkedCandidates.find((candidate) => candidate.review_status === 'pending')
  const readinessGaps = getDrillReadinessGaps(drill)
  const auditPriority = getAuditPriority(drill, linkedCandidates)
  const linkedCandidateIds = linkedCandidates.map((candidate) => candidate.id).join(',')
  const linkedReviewHref = linkedCandidates.length > 0 ? `/review?selected=${linkedCandidates[0].id}&ids=${linkedCandidateIds}&from=${encodeURIComponent(reviewReturnHref)}` : null
  const firstPendingReviewHref = firstPendingCandidate ? `/review?selected=${firstPendingCandidate.id}&ids=${linkedCandidateIds}&from=${encodeURIComponent(reviewReturnHref)}` : null

  function copyAuditBrief() {
    if (typeof window === 'undefined') return

    const reviewStatusBreakdown = (Object.entries(reviewSummary) as Array<[keyof LinkedCandidateReviewSummary, number]>)
      .filter(([status, count]) => status !== 'total' && count > 0)
      .map(([status, count]) => `${count} ${getReviewStatusLabel(status as LinkedCandidate['review_status']).toLowerCase()}`)
      .join(', ')

    const auditBrief = [
      `Drill audit: ${drill.title}`,
      `Priority: ${auditPriority.label}`,
      `Completeness: ${getCompletenessLabel(completenessScore)} (${completenessScore}/10)`,
      `Proof: ${getDemoReadinessLabel(drill)}`,
      `Gaps: ${readinessGaps.length > 0 ? readinessGaps.join('; ') : 'No obvious readiness gaps'}`,
      `Source review: ${getLinkedReviewHealthLabel(reviewSummary)}${reviewStatusBreakdown ? ` (${reviewStatusBreakdown})` : ''}`,
      `Next move: ${getLinkedReviewNextMove(reviewSummary)}`,
      linkedReviewHref ? `Linked review set: ${window.location.origin}${linkedReviewHref}` : null,
      firstPendingReviewHref ? `First pending row: ${window.location.origin}${firstPendingReviewHref}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard.writeText(auditBrief)
    onCopyFeedback('Copied audit brief')
    window.setTimeout(() => onCopyFeedback(null), 3000)
  }

  function copyReviewHandoff() {
    if (typeof window === 'undefined') return

    const handoff = {
      drill_id: drill.id,
      drill_title: drill.title,
      audit_priority: auditPriority.bucket,
      suggested_next_move: getLinkedReviewNextMove(reviewSummary),
      linked_review_set_url: linkedReviewHref ? `${window.location.origin}${linkedReviewHref}` : null,
      first_pending_review_url: firstPendingReviewHref ? `${window.location.origin}${firstPendingReviewHref}` : null,
      raw_candidate_ids: linkedCandidates.map((candidate) => candidate.id),
      pending_raw_candidate_ids: linkedCandidates.filter((candidate) => candidate.review_status === 'pending').map((candidate) => candidate.id),
      source_review_status_breakdown: {
        pending: reviewSummary.pending,
        approved: reviewSummary.approved,
        merged: reviewSummary.merged,
        rejected: reviewSummary.rejected,
      },
      readiness_gaps: readinessGaps,
    }

    navigator.clipboard.writeText(JSON.stringify(handoff, null, 2))
    onCopyFeedback('Copied review handoff JSON')
    window.setTimeout(() => onCopyFeedback(null), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Library detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{drill.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditPriorityTone(auditPriority.bucket)}`}>
              {auditPriority.label}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCompletenessTone(completenessScore)}`}>
              {getCompletenessLabel(completenessScore)} {completenessScore}/10
            </span>
            <button
              type="button"
              onClick={copyAuditBrief}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy audit brief
            </button>
            <button
              type="button"
              onClick={copyReviewHandoff}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Copy review handoff JSON
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{drill.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip>{formatCategory(drill.category)}</Chip>
        <Chip>{formatDifficulty(drill.difficulty)}</Chip>
        <Chip>{formatGradeLevel(drill.grade_level)}</Chip>
        <Chip>{drill.is_curated ? 'Curated' : 'Not yet curated'}</Chip>
        <Chip>{drill.is_active ? 'Active' : 'Inactive'}</Chip>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDemoReadinessTone(drill)}`}>
          {getDemoReadinessLabel(drill)}
        </span>
      </div>

      <DetailBlock title="Description" body={drill.description || 'No fuller description yet.'} />
      <DetailBlock title="What it trains" body={drill.what_it_trains || 'Not written yet.'} />
      <DetailBlock title="When to assign" body={drill.when_to_assign || 'No assignment guidance yet.'} />
      <DetailBlock title="Coach demo quote" body={drill.coach_demo_quote || 'No coach quote saved yet.'} />
      <DetailBlock title="Demo video" body={drill.demo_video_url ? `Available (${drill.demo_video_url})` : 'No demo video saved yet.'} />

      <div className="grid gap-4 md:grid-cols-3">
        <ListBlock title="Steps" items={steps} emptyLabel="No steps yet" />
        <ListBlock title="Focus points" items={focusPoints} emptyLabel="No focus points yet" />
        <ListBlock title="Common mistakes" items={mistakes} emptyLabel="No mistakes yet" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Audit priority</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              One blunt queue for weak canonical moves, so Jordan or Sha-Lyn can hit the dodgy rows first instead of scanning the whole library like muppets.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditPriorityTone(auditPriority.bucket)}`}>
            {auditPriority.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {auditPriority.reasons.length > 0 ? (
            auditPriority.reasons.map((reason) => (
              <span key={reason} className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditPriorityTone(auditPriority.bucket)}`}>
                {reason}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
              No urgent audit flags
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Readiness gaps</p>
          {readinessGaps.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {readinessGaps.map((gap) => (
                <span key={gap} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                  {gap}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">No obvious readiness gaps on this row. Lovely, for once.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetaCard label="Database ID" value={drill.id} />
        <MetaCard label="Source type" value={drill.source_type || 'Unknown'} />
        <MetaCard label="Source file" value={drill.source_file || 'Unknown'} />
        <MetaCard label="Raw candidates linked" value={String(drill.raw_candidate_ids.length)} />
        <MetaCard label="Updated" value={formatDateTime(drill.updated_at)} />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Linked raw candidates</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Jump straight back into the review queue for the raw rows feeding this canonical move.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {firstPendingCandidate ? (
              <Link
                href={firstPendingReviewHref!}
                className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Open first pending row
              </Link>
            ) : null}
            {linkedCandidates.length > 0 ? (
              <Link
                href={linkedReviewHref!}
                className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Open linked review set
              </Link>
            ) : null}
            <Link
              href={`/review?from=${encodeURIComponent(reviewReturnHref)}`}
              className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Open review queue
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getLinkedReviewHealthTone(reviewSummary)}`}>
              {getLinkedReviewHealthLabel(reviewSummary)}
            </span>
            {reviewSummary.total > 0
              ? (Object.entries(reviewSummary) as Array<[keyof LinkedCandidateReviewSummary, number]>)
                  .filter(([status, count]) => status !== 'total' && count > 0)
                  .map(([status, count]) => (
                    <span key={status} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getReviewStatusTone(status as LinkedCandidate['review_status'])}`}>
                      {count} {getReviewStatusLabel(status as LinkedCandidate['review_status'])}
                    </span>
                  ))
              : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{getLinkedReviewNextMove(reviewSummary)}</p>
        </div>

        {linkedCandidates.length > 0 ? (
          <div className="mt-4 space-y-3">
            {linkedCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{getCandidateTitle(candidate)}</p>
                    <p className="mt-2 break-all text-xs text-[var(--text-tertiary)]">{candidate.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getReviewStatusTone(candidate.review_status)}`}>
                      {getReviewStatusLabel(candidate.review_status)}
                    </span>
                    <Link
                      href={`/review?selected=${candidate.id}&ids=${linkedCandidateIds}&from=${encodeURIComponent(reviewReturnHref)}`}
                      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      Open in review
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">No linked raw candidates are recorded on this drill yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Tags</p>
        <div className="flex flex-wrap gap-2">
          {[...drill.skill_tags, ...drill.format_tags, ...drill.tags].length > 0 ? (
            [...drill.skill_tags, ...drill.format_tags, ...drill.tags].map((tag) => <Chip key={tag}>{tag}</Chip>)
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">No tags on this row yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  onClick,
  isActive = false,
}: {
  label: string
  value: string
  hint: string
  onClick?: () => void
  isActive?: boolean
}) {
  const className = `rounded-3xl border p-5 text-left transition ${
    isActive
      ? 'border-[var(--accent-primary)] bg-[var(--surface-primary)] shadow-sm'
      : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-primary)]'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{hint}</p>
      </button>
    )
  }

  return (
    <div className={className}>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{hint}</p>
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{title}</p>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

function ListBlock({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <span className="text-[var(--accent-primary)]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{emptyLabel}</p>
      )}
    </div>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">{children}</span>
}
