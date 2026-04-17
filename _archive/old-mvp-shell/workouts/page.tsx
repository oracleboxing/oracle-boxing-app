import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

const placeholderWorkouts = [
  { id: '1', name: 'Foundation Flow', grade: 'G1', difficulty: 1, duration: 15, rounds: 3 },
  { id: '2', name: 'Combination Builder', grade: 'G2', difficulty: 2, duration: 20, rounds: 4 },
  { id: '3', name: 'Defense Drill Series', grade: 'G1', difficulty: 2, duration: 18, rounds: 3 },
]

export default function WorkoutsPage() {
  return (
    <div>
      <PageHeader
        title="Workouts"
        subtitle="Pre-built training sessions"
        action={
          <Link href="/workouts/builder">
            <Button size="sm" variant="secondary">+ Build</Button>
          </Link>
        }
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Filter tabs placeholder */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', 'G1', 'G2', 'G3', 'Custom'].map((tab) => (
            <button
              key={tab}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium ${
                tab === 'All'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Workout cards */}
        <div className="space-y-3">
          {placeholderWorkouts.map((w) => (
            <Link key={w.id} href={`/workouts/${w.id}`}>
              <Card hoverable>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{w.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {w.rounds} rounds · {w.duration} min
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="gold">{w.grade}</Badge>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            i < w.difficulty ? 'bg-[var(--accent-gold)]' : 'bg-[var(--surface-secondary)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Workouts — will load from Supabase &apos;workout_templates&apos; table
          </p>
        </Card>
      </div>
    </div>
  )
}
