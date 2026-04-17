import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Drill } from '@/lib/supabase/types'
import { DrillLibraryClient } from './DrillLibraryClient'

export const dynamic = 'force-dynamic'

const EMPTY_ENV_MESSAGE =
  'Supabase env vars are missing in this local environment, so the curated drill library cannot load yet.'

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

export default async function DrillsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <Header />
          <EmptyState title="Curated drill library unavailable" body={EMPTY_ENV_MESSAGE} />
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drills')
    .select(
      'id, title, slug, summary, description, category, difficulty, grade_level, format_tags, skill_tags, tags, steps_json, focus_points_json, common_mistakes_json, what_it_trains, when_to_assign, coach_demo_quote, demo_video_url, animation_key, source_type, source_file, raw_candidate_ids, is_active, is_curated, created_at, updated_at'
    )
    .order('is_active', { ascending: false })
    .order('is_curated', { ascending: false })
    .order('grade_level', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <Header />
          <EmptyState
            title="Curated drill library unavailable"
            body={error.message || 'The app could not read drills. Check table access, RLS, and local Supabase configuration.'}
          />
        </div>
      </div>
    )
  }

  const drills = (data ?? []) as Drill[]

  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-7xl">
        <Header />
        <DrillLibraryClient drills={drills} />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Oracle Boxing rebuild</p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">Curated drill library</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
          App-facing browse surface for canonical drills from the drills table only, separate from the raw review queue.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/review"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
        >
          Open review queue
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
        >
          Back home
        </Link>
      </div>
    </div>
  )
}
