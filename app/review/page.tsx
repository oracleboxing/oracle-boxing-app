import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RawDrillCandidate } from '@/lib/supabase/types'

// Simple helper to count items in a JSON array securely
function countJsonArray(json: any): number {
  if (Array.isArray(json)) return json.length
  return 0
}

export default async function ReviewPage() {
  const supabase = await createClient()

  // Attempt to fetch raw_drill_candidates
  const { data: candidates, error } = await supabase
    .from('raw_drill_candidates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Oracle Boxing
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
                Drill Review Queue
              </h1>
            </div>
            <Link
              href="/"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-elevated)]"
            >
              Back to Home
            </Link>
          </div>
          
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">Failed to load candidates</h2>
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {error.message || 'There was an error communicating with the database. Check your Supabase configuration or table schema.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const allCandidates = candidates as RawDrillCandidate[] || []
  const pendingCandidates = allCandidates.filter(c => c.review_status === 'pending')
  const approvedCandidates = allCandidates.filter(c => c.review_status === 'approved')
  const mergedCandidates = allCandidates.filter(c => c.review_status === 'merged')

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Curate Content
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              Drill Review Queue
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-elevated)]"
          >
            Back to Home
          </Link>
        </div>

        {/* Summary Strip */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Total Extracted</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{allCandidates.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-900/10">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-500">Pending Review</p>
            <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-400">{pendingCandidates.length}</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-900/30 dark:bg-green-900/10">
            <p className="text-sm font-medium text-green-800 dark:text-green-500">Approved</p>
            <p className="mt-2 text-3xl font-bold text-green-900 dark:text-green-400">{approvedCandidates.length}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-500">Merged</p>
            <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-400">{mergedCandidates.length}</p>
          </div>
        </div>

        {/* Pending List */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Pending Candidates</h2>
          
          {pendingCandidates.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 text-center">
              <p className="text-[var(--text-secondary)]">No pending drill candidates found. You're all caught up!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingCandidates.map(candidate => {
                const stepsCount = countJsonArray(candidate.steps_json)
                const focusPointsCount = countJsonArray(candidate.focus_points_json)
                const mistakesCount = countJsonArray(candidate.common_mistakes_json)

                return (
                  <div 
                    key={candidate.id}
                    className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2">
                        {candidate.cleaned_title || candidate.raw_title || 'Untitled Drill'}
                      </h3>
                      {candidate.grade_level && (
                        <span className="shrink-0 rounded bg-[var(--surface-primary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)]">
                          {candidate.grade_level.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>

                    <p className="mb-4 text-xs text-[var(--text-secondary)] line-clamp-1">
                      Raw: {candidate.raw_title || 'N/A'}
                    </p>

                    {candidate.summary && (
                      <p className="mb-4 text-sm text-[var(--text-secondary)] line-clamp-3">
                        {candidate.summary}
                      </p>
                    )}

                    <div className="mt-auto space-y-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {candidate.category && (
                          <span className="rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 font-medium text-[var(--accent-primary)]">
                            {candidate.category}
                          </span>
                        )}
                        {candidate.difficulty && (
                          <span className="rounded-full bg-[var(--surface-primary)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-secondary)]">
                            {candidate.difficulty}
                          </span>
                        )}
                        <span className="rounded-full bg-[var(--surface-primary)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-secondary)]">
                          {stepsCount} steps
                        </span>
                        <span className="rounded-full bg-[var(--surface-primary)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-secondary)]">
                          {focusPointsCount} cues
                        </span>
                        <span className="rounded-full bg-[var(--surface-primary)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-secondary)]">
                          {mistakesCount} errs
                        </span>
                      </div>

                      {candidate.source_file && (
                        <div className="border-t border-[var(--border)] pt-3">
                          <p className="truncate text-xs text-[var(--text-tertiary)]" title={candidate.source_file}>
                            Source: {candidate.source_file}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
