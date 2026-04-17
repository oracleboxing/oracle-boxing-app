'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Drill, DrillCategory, DrillDifficulty, GradeLevel, Json, RawDrillCandidate } from '@/lib/supabase/types'

type DrillStatusFilter = 'all' | 'active' | 'inactive'
type DrillReviewHealthFilter = 'all' | 'pending' | 'reviewed' | 'unlinked'
type DrillSortMode = 'library' | 'newest' | 'grade' | 'completeness'

const SORT_MODE_LABELS: Record<DrillSortMode, string> = {
  library: 'Library order',
  newest: 'Newest first',
  grade: 'Grade order',
  completeness: 'Most complete',
}

const REVIEW_HEALTH_FILTER_LABELS: Record<DrillReviewHealthFilter, string> = {
  all: 'All source review states',
  pending: 'Pending raw review',
  reviewed: 'Source mostly reviewed',
  unlinked: 'No linked raw rows',
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

function getCandidateTitle(candidate: LinkedCandidate) {
  return candidate.cleaned_title || candidate.raw_title || 'Untitled raw candidate'
}

export function DrillLibraryClient({ drills, linkedCandidates }: { drills: Drill[]; linkedCandidates: LinkedCandidate[] }) {
  const searchParams = useSearchParams()
  const selectedDrillFromUrl = searchParams.get('selected')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | DrillCategory>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel | 'unassigned'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DrillDifficulty>('all')
  const [statusFilter, setStatusFilter] = useState<DrillStatusFilter>('active')
  const [reviewHealthFilter, setReviewHealthFilter] = useState<DrillReviewHealthFilter>('all')
  const [curatedOnly, setCuratedOnly] = useState(true)
  const [sortMode, setSortMode] = useState<DrillSortMode>('library')
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(drills[0]?.id ?? null)

  const categories = useMemo(
    () => Array.from(new Set(drills.map((drill) => drill.category).filter(Boolean))) as DrillCategory[],
    [drills]
  )

  const gradeLevels = useMemo(
    () => Array.from(new Set(drills.map((drill) => drill.grade_level ?? 'unassigned'))),
    [drills]
  )

  const filteredDrills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const next = drills.filter((drill) => {
      if (categoryFilter !== 'all' && drill.category !== categoryFilter) return false
      if (difficultyFilter !== 'all' && drill.difficulty !== difficultyFilter) return false
      if (statusFilter === 'active' && !drill.is_active) return false
      if (statusFilter === 'inactive' && drill.is_active) return false
      if (curatedOnly && !drill.is_curated) return false

      const reviewSummary = buildLinkedCandidateReviewSummary(linkedCandidates.filter((candidate) => drill.raw_candidate_ids.includes(candidate.id)))

      if (reviewHealthFilter === 'pending' && reviewSummary.pending === 0) return false
      if (reviewHealthFilter === 'reviewed' && (reviewSummary.total === 0 || reviewSummary.pending > 0 || reviewSummary.approved + reviewSummary.merged === 0)) return false
      if (reviewHealthFilter === 'unlinked' && reviewSummary.total > 0) return false

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

      if (sortMode === 'newest') return updatedDiff || a.title.localeCompare(b.title)
      if (sortMode === 'grade') return gradeDiff || a.title.localeCompare(b.title)
      if (sortMode === 'completeness') return completenessDiff || a.title.localeCompare(b.title)

      return Number(b.is_active) - Number(a.is_active) || Number(b.is_curated) - Number(a.is_curated) || gradeDiff || a.title.localeCompare(b.title)
    })

    return next
  }, [categoryFilter, curatedOnly, difficultyFilter, drills, gradeFilter, linkedCandidates, query, reviewHealthFilter, sortMode, statusFilter])

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

    return { activeCount, curatedCount, withGradeCount, readyCount, withPendingRawReviewCount }
  }, [drills, linkedCandidates])

  if (drills.length === 0) {
    return (
      <EmptyState
        title="No curated drills yet"
        body="The drills table is reachable, but it does not have any curated library rows yet. That is fine for now. The next real job is turning reviewed source candidates into canonical drills."
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total drills" value={String(drills.length)} hint="Rows currently in the drills table" />
        <SummaryCard label="Active drills" value={String(summary.activeCount)} hint="Visible candidates for the real app library" />
        <SummaryCard label="Marked curated" value={String(summary.curatedCount)} hint="Rows already treated as canonical" />
        <SummaryCard label="Ready-ish" value={String(summary.readyCount)} hint="8+ completeness points across copy and drill structure" />
        <SummaryCard label="Pending source review" value={String(summary.withPendingRawReviewCount)} hint="Drills still linked to at least one pending raw review row" />
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_repeat(6,minmax(0,1fr))]">
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
        </div>
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
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCompletenessTone(completenessScore)}`}>
                      {getCompletenessLabel(completenessScore)}
                    </span>
                    {drill.is_curated ? <Chip>Canonical</Chip> : <Chip>Needs curation</Chip>}
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
              />
            ) : (
              <EmptyState title="Choose a drill" body="Select a drill from the library list to inspect its content quality and app readiness." />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function DrillDetail({ drill, linkedCandidates }: { drill: Drill; linkedCandidates: LinkedCandidate[] }) {
  const steps = jsonToStringList(drill.steps_json)
  const focusPoints = jsonToStringList(drill.focus_points_json)
  const mistakes = jsonToStringList(drill.common_mistakes_json)
  const completenessScore = getCompletenessScore(drill)
  const reviewSummary = buildLinkedCandidateReviewSummary(linkedCandidates)
  const firstPendingCandidate = linkedCandidates.find((candidate) => candidate.review_status === 'pending')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Library detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{drill.title}</h2>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCompletenessTone(completenessScore)}`}>
            {getCompletenessLabel(completenessScore)} {completenessScore}/10
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{drill.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip>{formatCategory(drill.category)}</Chip>
        <Chip>{formatDifficulty(drill.difficulty)}</Chip>
        <Chip>{formatGradeLevel(drill.grade_level)}</Chip>
        <Chip>{drill.is_curated ? 'Curated' : 'Not yet curated'}</Chip>
        <Chip>{drill.is_active ? 'Active' : 'Inactive'}</Chip>
      </div>

      <DetailBlock title="Description" body={drill.description || 'No fuller description yet.'} />
      <DetailBlock title="What it trains" body={drill.what_it_trains || 'Not written yet.'} />
      <DetailBlock title="When to assign" body={drill.when_to_assign || 'No assignment guidance yet.'} />
      <DetailBlock title="Coach demo quote" body={drill.coach_demo_quote || 'No coach quote saved yet.'} />

      <div className="grid gap-4 md:grid-cols-3">
        <ListBlock title="Steps" items={steps} emptyLabel="No steps yet" />
        <ListBlock title="Focus points" items={focusPoints} emptyLabel="No focus points yet" />
        <ListBlock title="Common mistakes" items={mistakes} emptyLabel="No mistakes yet" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
              Jump straight back into the review queue for the raw rows feeding this canonical drill.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {firstPendingCandidate ? (
              <Link
                href={`/review?selected=${firstPendingCandidate.id}`}
                className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                Open first pending row
              </Link>
            ) : null}
            <Link
              href="/review"
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
                      href={`/review?selected=${candidate.id}`}
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

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
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
