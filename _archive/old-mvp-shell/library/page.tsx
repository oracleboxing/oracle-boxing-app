import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LibraryPage() {
  return (
    <div>
      <PageHeader
        title="Drill Library"
        subtitle="Browse and search all drills"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Search bar placeholder */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-[var(--text-tertiary)]">🔍</span>
          <span className="text-sm text-[var(--text-tertiary)]">Search drills...</span>
        </div>

        {/* Category filter placeholder */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', 'Footwork', 'Punching', 'Defense', 'Combinations'].map((cat) => (
            <button
              key={cat}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium ${
                cat === 'All'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Drill cards placeholder */}
        <div className="space-y-3">
          {['Jab', 'Cross', 'Slip Outside', 'Pivot'].map((drill) => (
            <Card key={drill} hoverable>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{drill}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">30 sec · Foundation</p>
                </div>
                <Badge variant="gold">G1</Badge>
              </div>
            </Card>
          ))}
        </div>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Drill library — will load from Supabase &apos;drills&apos; table
          </p>
        </Card>

        {/* Loading skeleton example */}
        <div className="space-y-3 opacity-50">
          <Skeleton className="h-16 w-full" rounded="lg" />
          <Skeleton className="h-16 w-full" rounded="lg" />
        </div>
      </div>
    </div>
  )
}
