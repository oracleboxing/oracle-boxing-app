'use client'

import { useState, useMemo } from 'react'
import type { Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'

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

export function ReviewListClient({ candidates }: { candidates: RawDrillCandidate[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('pending') // default to pending
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const { filteredCandidates, duplicateCounts, uniqueCategories, uniqueGrades } = useMemo(() => {
    const dupCounts: Record<string, number> = {}
    const cats = new Set<string>()
    const grades = new Set<string>()

    for (const c of candidates) {
      if (c.dedupe_key) {
        dupCounts[c.dedupe_key] = (dupCounts[c.dedupe_key] || 0) + 1
      }
      if (c.category) cats.add(c.category)
      grades.add(c.grade_level || 'unassigned')
    }

    const filtered = candidates.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.review_status !== statusFilter) return false
      
      // Grade filter
      if (gradeFilter !== 'all' && (c.grade_level || 'unassigned') !== gradeFilter) return false

      // Category filter
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false

      // Search
      if (search) {
        const q = search.toLowerCase()
        const title = getDisplayTitle(c).toLowerCase()
        const summary = getShortSummary(c).toLowerCase()
        const key = c.dedupe_key?.toLowerCase() || ''
        if (!title.includes(q) && !summary.includes(q) && !key.includes(q)) {
          return false
        }
      }

      return true
    })

    return {
      filteredCandidates: filtered,
      duplicateCounts: dupCounts,
      uniqueCategories: Array.from(cats).sort(),
      uniqueGrades: Array.from(grades).sort(),
    }
  }, [candidates, search, statusFilter, gradeFilter, categoryFilter])

  return (
    <section>
      <div className="mb-6 flex flex-col items-start gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Raw drill candidates</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Desktop-first scan of the raw intake layer, ordered for curation rather than final library use.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search titles, summary, dedupe key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full lg:w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-amber-500/50"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-amber-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="merged">Merged</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-amber-500/50"
          >
            <option value="all">All Grades</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {formatGradeLevel(g === 'unassigned' ? null : g)}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-amber-500/50"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredCandidates.length === 0 ? (
        <EmptyState title="No candidates found" body="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)]">
          <div className="grid grid-cols-[2.2fr_1.1fr_0.9fr_1fr_1fr_1fr_2fr_1fr] gap-4 border-b border-[var(--border)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            <div>Candidate</div>
            <div>Category</div>
            <div>Difficulty</div>
            <div>Grade</div>
            <div>Status</div>
            <div>Structure</div>
            <div>Source</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {filteredCandidates.map((candidate) => {
              const stepsCount = countJsonItems(candidate.steps_json)
              const focusPointsCount = countJsonItems(candidate.focus_points_json)
              const mistakesCount = countJsonItems(candidate.common_mistakes_json)
              
              const isDuplicate = candidate.dedupe_key && duplicateCounts[candidate.dedupe_key] > 1

              return (
                <article key={candidate.id} className="grid grid-cols-[2.2fr_1.1fr_0.9fr_1fr_1fr_1fr_2fr_1fr] gap-4 px-5 py-5 items-start">
                  <div>
                    <div className="flex flex-col items-start gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{getDisplayTitle(candidate)}</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">Raw title: {candidate.raw_title || 'Missing raw title'}</p>
                      </div>
                      {isDuplicate && (
                        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          Family: {candidate.dedupe_key}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{getShortSummary(candidate)}</p>
                    {candidate.when_to_assign && (
                      <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Assign when: {candidate.when_to_assign}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{candidate.category || 'Uncategorised'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{candidate.difficulty || 'Unset'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{formatGradeLevel(candidate.grade_level)}</p>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(candidate.review_status)}`}>
                      {REVIEW_STATUS_LABELS[candidate.review_status]}
                    </span>
                  </div>

                  <div>
                    <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                      <p>{stepsCount} steps</p>
                      <p>{focusPointsCount} focus points</p>
                      <p>{mistakesCount} common mistakes</p>
                    </div>
                  </div>

                  <div>
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={getSourceLabel(candidate)}>
                      {getSourceLabel(candidate)}
                    </p>
                    {candidate.source_type && (
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{candidate.source_type}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <button 
                      onClick={() => alert('Review actions are placeholders and currently disabled.')}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 transition-colors w-full text-center border border-emerald-500/20"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => alert('Review actions are placeholders and currently disabled.')}
                      className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 transition-colors w-full text-center border border-sky-500/20"
                    >
                      Merge
                    </button>
                    <button 
                      onClick={() => alert('Review actions are placeholders and currently disabled.')}
                      className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 transition-colors w-full text-center border border-rose-500/20"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
