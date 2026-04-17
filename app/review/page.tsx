import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { RawDrillCandidate } from '@/lib/supabase/types'
import { ReviewQueueClient } from './ReviewQueueClient'

export const dynamic = 'force-dynamic'

const EMPTY_ENV_MESSAGE =
  'Supabase env vars are missing in this local environment, so the review queue cannot load yet.'

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

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-7xl">
        <Header />
        <ReviewQueueClient candidates={candidates} />
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
