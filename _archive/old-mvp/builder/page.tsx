import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function WorkoutBuilderPage() {
  return (
    <div>
      <PageHeader
        title="Workout Builder"
        subtitle="Design your own session"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Workout name */}
        <Card>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Workout Name</p>
          <div className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-sm text-[var(--text-tertiary)]">My Custom Workout</span>
          </div>
        </Card>

        {/* Timer settings */}
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Timer Settings</p>
          <div className="space-y-3">
            {[
              { label: 'Rounds', value: '3' },
              { label: 'Round Duration', value: '3:00' },
              { label: 'Rest Duration', value: '1:00' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-medium text-[var(--text-primary)] px-3 py-1 bg-[var(--surface-secondary)] rounded-lg">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Drill list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Drills</p>
            <Button size="sm" variant="ghost">+ Add Drill</Button>
          </div>
          <Card className="border-dashed min-h-[100px] flex items-center justify-center">
            <p className="text-sm text-[var(--text-tertiary)]">Tap + Add Drill to build your sequence</p>
          </Card>
        </div>

        <Button fullWidth size="lg">Save Workout</Button>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Custom workout builder — saves to Supabase &apos;workout_logs&apos; with custom_name
          </p>
        </Card>
      </div>
    </div>
  )
}
