import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Oracle Boxing App Rebuild
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
          Clean rebuild workspace
        </h1>
        <p className="mt-4 max-w-3xl text-base text-[var(--text-secondary)] sm:text-lg">
          The old mobile-first shell has been stripped out so you can work on schema, modules, and structure properly on desktop.
        </p>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Current working pages</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/schema"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-elevated)]"
            >
              Open schema mock
            </Link>
            <Link
              href="/drills"
              className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Open curated move library
            </Link>
            <Link
              href="/review"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Review raw candidate queue
            </Link>
            <Link
              href="/workout/run"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              Workout Run Prototype
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
