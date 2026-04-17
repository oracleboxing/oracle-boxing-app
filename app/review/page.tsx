import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Json, RawDrillCandidate, ReviewStatus } from '@/lib/supabase/types'
import { ReviewListClient } from './ReviewListClient'

export const dynamic = 'force-dynamic'

const EMPTY_ENV_MESSAGE =
  'Supabase env vars are missing in this local environment, so the review queue cannot load yet.'

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

export default async function ReviewPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <Header />
          <EmptyState title="Review queue unavailable" body={EMPTY_ENV_MESSAGE} />
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('raw_drill_candidates')
    .select(
      'id, cleaned_title, raw_title, dedupe_key, category, difficulty, grade_level, review_status, source_type, source_file, summary, description, what_it_trains, when_to_assign, steps_json, focus_points_json, common_mistakes_json, canonical_drill_id, created_at'
    )
    .order('review_status', { ascending: true })
    .order('grade_level', { ascending: true, nullsFirst: false })
    .order('cleaned_title', { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <Header />
          <EmptyState
            title="Review queue unavailable"
            body={error.message || 'The app could not read raw_drill_candidates. Check table access, RLS, and local Supabase configuration.'}
          />
        </div>
      </div>
    )
  }

  const candidates = (data ?? []) as RawDrillCandidate[]
  const pendingCandidates = candidates.filter((candidate) => candidate.review_status === 'pending')

  const statusCounts = REVIEW_STATUSES.map((status) => ({
    status,
    count: candidates.filter((candidate) => candidate.review_status === status).length,
  }))

  const gradeCounts = pendingCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.grade_level ?? 'unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const missingSummaryCount = pendingCandidates.filter(
    (candidate) => !candidate.summary && !candidate.what_it_trains && !candidate.description
  ).length

  const candidatesWithCanonicalLink = pendingCandidates.filter(
    (candidate) => candidate.canonical_drill_id
  ).length

  const duplicateFamilies = new Set(
    pendingCandidates
      .map((candidate) => candidate.dedupe_key)
      .filter((value): value is string => Boolean(value))
  ).size

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-7xl">
        <Header />

        <section className="mb-8 grid gap-4 lg:grid-cols-5">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 lg:col-span-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Pending review</p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-primary)]">{pendingCandidates.length}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              First-pass queue for Sha-Lyn and Jordan. This view only surfaces raw candidates and keeps curated drills separate.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Duplicate families</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{duplicateFamilies}</p>
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">Distinct pending dedupe keys currently visible in the queue.</p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Needs summary</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{missingSummaryCount}</p>
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">Pending rows with no summary, description, or training note.</p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Already linked</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{candidatesWithCanonicalLink}</p>
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">Pending rows that already point at a canonical drill.</p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Tracked statuses</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{candidates.length}</p>
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">All raw candidates visible to this environment.</p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Queue by review status</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Quick signal for where the backlog is sitting.</p>
              </div>
            </div>
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
                <p className="text-sm text-[var(--text-secondary)]">No pending candidates right now.</p>
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

        <ReviewListClient candidates={candidates} />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Oracle Boxing rebuild</p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">Raw drill review queue</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
          A first useful internal surface for reviewing pending raw_drill_candidates before they become curated drills.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
      >
        Back home
      </Link>
    </div>
  )
}
