import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkoutDetailPage({ params }: Props) {
  const { id } = await params

  return (
    <div>
      <PageHeader
        title="Workout Detail"
        subtitle="Review and start this session"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Workout meta */}
        <Card elevated>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">Foundation Flow</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">3 rounds · 15 minutes</p>
            </div>
            <Badge variant="gold">G1</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            A beginner-friendly session covering fundamental punches and footwork patterns.
          </p>
        </Card>

        {/* Drill sequence */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Drill Sequence</p>
          <div className="space-y-2">
            {['Jab', 'Cross', 'Jab-Cross', 'Slip Outside'].map((drill, i) => (
              <Card key={drill} className="flex items-center gap-3 py-3">
                <span className="w-6 h-6 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)]">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{drill}</p>
                  <p className="text-xs text-[var(--text-secondary)]">30 sec</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Button fullWidth size="lg">Start Workout</Button>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Workout runner — loads workout ID: <strong>{id}</strong> from Supabase
          </p>
        </Card>
      </div>
    </div>
  )
}
