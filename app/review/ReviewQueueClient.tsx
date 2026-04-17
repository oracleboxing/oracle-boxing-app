'use client'

import { useEffect, useMemo, useState } from 'react'
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

function getJsonItems(value: Json | null) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
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
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])

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

  useEffect(() => {
    if (filteredCandidates.length === 0) {
      setSelectedCandidateId(null)
      return
    }

    const selectedStillVisible = filteredCandidates.some((candidate) => candidate.id === selectedCandidateId)
    if (!selectedStillVisible) {
      setSelectedCandidateId(filteredCandidates[0]?.id ?? null)
    }
  }, [filteredCandidates, selectedCandidateId])

  useEffect(() => {
    setSelectedCandidateIds((current) => current.filter((id) => filteredCandidates.some((candidate) => candidate.id === id)))
  }, [filteredCandidates])

  const selectedCandidate = filteredCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
  const selectedCount = selectedCandidateIds.length
  const selectedPendingCount = selectedCandidateIds.filter(
    (id) => filteredCandidates.find((candidate) => candidate.id === id)?.review_status === 'pending'
  ).length

  function toggleCandidateSelection(candidateId: string) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]
    )
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredCandidates.map((candidate) => candidate.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCandidateIds.includes(id))

    setSelectedCandidateIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }

      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

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
                <button
                  key={family.dedupeKey}
                  type="button"
                  onClick={() => {
                    const familyMatch = filteredCandidates.find((candidate) => candidate.dedupe_key === family.dedupeKey)
                    if (familyMatch) setSelectedCandidateId(familyMatch.id)
                  }}
                  className="block w-full rounded-2xl border border-[var(--border)] px-4 py-4 text-left transition-colors hover:bg-[var(--surface-primary)]"
                >
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
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Planned review actions</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Writes are still intentionally unwired here. The table shape is ready, but this local app surface should not pretend the moderation rules are final when service-role writes are still a separate decision.</p>
          <div className="mt-5 space-y-3">
            {['Approve into curated flow', 'Reject as noise', 'Merge into canonical drill'].map((label) => (
              <button
                key={label}
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] opacity-70"
              >
                <span>{label}</span>
                <span className="text-xs text-[var(--text-tertiary)]">UI placeholder</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">
            This pass focuses on better review context and batch prep, not fake approve buttons that quietly do nothing.
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Selection staging</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Queue up candidates for a future merge or reject pass. This is honest bulk-selection scaffolding only, no write path yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            >
              {filteredCandidates.length > 0 && filteredCandidates.every((candidate) => selectedCandidateIds.includes(candidate.id))
                ? 'Clear visible selection'
                : 'Select visible rows'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCandidateIds([])}
              disabled={selectedCount === 0}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset staged rows
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoBlock label="Selected rows" value={String(selectedCount)} subdued="Temporary local staging only" />
          <InfoBlock label="Pending in selection" value={String(selectedPendingCount)} subdued="Useful when preparing one clean moderation pass" />
          <InfoBlock
            label="Selected families"
            value={String(new Set(filteredCandidates.filter((candidate) => selectedCandidateIds.includes(candidate.id)).map((candidate) => candidate.dedupe_key).filter(Boolean)).size)}
            subdued="Helps spot when a merge pass is actually duplicate-heavy"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
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
                const isSelected = selectedCandidateIds.includes(candidate.id)
                const isActive = selectedCandidateId === candidate.id

                return (
                  <article
                    key={candidate.id}
                    className={`rounded-3xl border bg-[var(--surface-elevated)] p-5 transition-colors ${
                      isActive ? 'border-[var(--accent-primary)]' : 'border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCandidateSelection(candidate.id)}
                        className="mt-1 h-4 w-4 rounded border-[var(--border)]"
                        aria-label={`Select ${getDisplayTitle(candidate)}`}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
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
                              {isSelected ? (
                                <span className="inline-flex rounded-full border border-[var(--accent-primary)] px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)]">
                                  Staged
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                            {candidate.when_to_assign && (
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                            )}
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
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 xl:sticky xl:top-6 xl:self-start">
          {selectedCandidate ? <CandidateDetailPanel candidate={selectedCandidate} /> : <EmptyState title="No candidate selected" body="Pick a row to inspect its review context in more detail." />}
        </aside>
      </section>
    </>
  )
}

function CandidateDetailPanel({ candidate }: { candidate: RawDrillCandidate }) {
  const steps = getJsonItems(candidate.steps_json)
  const focusPoints = getJsonItems(candidate.focus_points_json)
  const mistakes = getJsonItems(candidate.common_mistakes_json)

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Review detail</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{getDisplayTitle(candidate)}</h3>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
          {REVIEW_STATUS_LABELS[candidate.review_status]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>

      <div className="mt-5 grid gap-3">
        <InfoBlock label="Raw title" value={candidate.raw_title || 'Missing raw title'} />
        <InfoBlock label="Dedupe family" value={candidate.dedupe_key || 'No dedupe key yet'} />
        <InfoBlock label="Source" value={getSourceLabel(candidate)} subdued={candidate.source_type} />
        <InfoBlock label="Grade" value={formatGradeLevel(candidate.grade_level)} subdued={candidate.category} />
        <InfoBlock label="Canonical drill link" value={candidate.canonical_drill_id || 'Not linked yet'} />
      </div>

      <div className="mt-6 space-y-4">
        <DetailList title="Steps" items={steps} emptyMessage="No structured steps on this candidate yet." />
        <DetailList title="Focus points" items={focusPoints} emptyMessage="No focus points extracted yet." />
        <DetailList title="Common mistakes" items={mistakes} emptyMessage="No common mistakes extracted yet." />
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-primary)] p-4">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Why there are still no live approve buttons</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          The schema can support review states, but this app surface still needs a deliberate service-role write path and clearer moderation rules before it should mutate anything. Tonight’s pass makes review sharper without lying about that gap.
        </p>
      </div>
    </div>
  )
}

function DetailList({ title, items, emptyMessage }: { title: string; items: string[]; emptyMessage: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] p-4">
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <span className="text-[var(--text-tertiary)]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function InfoBlock({ label, value, subdued }: { label: string; value: string; subdued?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p>
      {subdued ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{subdued}</p> : null}
    </div>
  )
}
