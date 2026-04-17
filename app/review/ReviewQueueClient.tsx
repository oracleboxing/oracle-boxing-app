'use client'

import { useMemo, useState } from 'react'
import type { Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'merged', 'rejected']
const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  merged: 'Merged',
  rejected: 'Rejected',
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

export function ReviewQueueClient({ candidates }: { candidates: RawDrillCandidate[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('pending')
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(candidates[0]?.id ?? null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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

  const pendingCandidates = filteredCandidates.filter((candidate) => candidate.review_status === 'pending')

  const statusCounts = REVIEW_STATUSES.map((status) => ({
    status,
    count: filteredCandidates.filter((candidate) => candidate.review_status === status).length,
  }))

  const gradeCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.grade_level ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const missingSummaryCount = pendingCandidates.filter(
    (candidate) => !candidate.summary && !candidate.what_it_trains && !candidate.description
  ).length

  const candidatesWithCanonicalLink = pendingCandidates.filter((candidate) => candidate.canonical_drill_id).length

  const duplicateFamilies = useMemo(() => {
    const families = new Map<string, RawDrillCandidate[]>()

    for (const candidate of filteredCandidates) {
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
  }, [filteredCandidates])

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => filteredCandidates.some((candidate) => candidate.id === id)),
    [selectedIds, filteredCandidates]
  )

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? filteredCandidates[0] ?? null

  const selectedFamilyCandidates = selectedCandidate?.dedupe_key
    ? filteredCandidates.filter((candidate) => candidate.dedupe_key === selectedCandidate.dedupe_key)
    : []

  const bulkSelectionCounts = visibleSelectedIds.reduce<Record<ReviewStatus, number>>(
    (acc, id) => {
      const candidate = filteredCandidates.find((item) => item.id === id)
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
      <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review controls</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Filter the raw queue before anyone starts approving messy boxing transcript chaos.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-5">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 lg:col-span-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Visible pending review</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-primary)]">{pendingCandidates.length}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Working subset after filters. This stays pointed at raw candidates, not the curated drill library.
          </p>
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

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Already linked</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{candidatesWithCanonicalLink}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">Visible pending rows that already point at a canonical drill.</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Visible rows</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{filteredCandidates.length}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">All raw candidates currently surviving the active filters.</p>
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
            Real mutations are not wired yet. The schema says writes should go through a service role, and this app currently only has the public read client.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Selected visible rows</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{visibleSelectedIds.length}</p>
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

            {['Approve selected', 'Reject selected', 'Merge selected'].map((label) => (
              <button
                key={label}
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] opacity-70"
              >
                <span>{label}</span>
                <span className="text-xs text-[var(--text-tertiary)]">Awaiting safe write path</span>
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

          {filteredCandidates.length === 0 ? (
            <EmptyState title="No matching candidates" body="Nothing in raw_drill_candidates matches the current filter combination." />
          ) : (
            <div className="space-y-4">
              {filteredCandidates.map((candidate) => {
                const stepsCount = countJsonItems(candidate.steps_json)
                const focusPointsCount = countJsonItems(candidate.focus_points_json)
                const mistakesCount = countJsonItems(candidate.common_mistakes_json)
                const isSelected = selectedCandidate?.id === candidate.id
                const isBulkSelected = visibleSelectedIds.includes(candidate.id)

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
                              {candidate.dedupe_key && (
                                <span className="inline-flex rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                                  Family: {candidate.dedupe_key}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                            {candidate.when_to_assign && (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
                        {['Approve', 'Reject', 'Merge'].map((label) => (
                          <button
                            key={label}
                            type="button"
                            disabled
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] opacity-70"
                            title="Placeholder only, no mutation is wired yet"
                          >
                            {label}
                            <span className="ml-2 text-xs text-[var(--text-tertiary)]">Soon</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <InfoBlock label="Category" value={candidate.category || 'Uncategorised'} />
                      <InfoBlock label="Difficulty" value={candidate.difficulty || 'Unset'} />
                      <InfoBlock label="Grade" value={formatGradeLevel(candidate.grade_level)} />
                      <InfoBlock label="Source" value={getSourceLabel(candidate)} subdued={candidate.source_type || undefined} />
                      <InfoBlock
                        label="Structure"
                        value={`${stepsCount} steps`}
                        subdued={`${focusPointsCount} focus points • ${mistakesCount} common mistakes`}
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
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">{getDisplayTitle(selectedCandidate)}</h3>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(selectedCandidate.review_status)}`}>
                      {REVIEW_STATUS_LABELS[selectedCandidate.review_status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{getShortSummary(selectedCandidate)}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBlock label="Raw title" value={selectedCandidate.raw_title || 'Missing raw title'} />
                  <InfoBlock label="Created" value={formatDateTime(selectedCandidate.created_at)} />
                  <InfoBlock label="Grade" value={formatGradeLevel(selectedCandidate.grade_level)} />
                  <InfoBlock label="Duration" value={selectedCandidate.estimated_duration_seconds ? `${selectedCandidate.estimated_duration_seconds}s` : 'Unknown'} />
                  <InfoBlock label="Source file" value={selectedCandidate.source_file || 'Missing'} subdued={selectedCandidate.source_type || undefined} />
                  <InfoBlock label="Canonical link" value={selectedCandidate.canonical_drill_id || 'Not linked yet'} />
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
