import { PageHeader } from '@/src/components/layout/PageHeader'
import { Card } from '@/src/components/ui/Card'
import { Button } from '@/src/components/ui/Button'

export default function TimerPage() {
  return (
    <div>
      <PageHeader
        title="Round Timer"
        subtitle="Customise your rounds and rest"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Timer display */}
        <Card elevated className="text-center py-8">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-2">Round 1 / 3</p>
          <p className="text-7xl font-bold text-[var(--text-primary)] tabular-nums">3:00</p>
          <p className="text-sm text-[var(--accent-gold)] mt-3 font-medium">WORK</p>
        </Card>

        {/* Controls */}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth>Reset</Button>
          <Button fullWidth>Start</Button>
        </div>

        {/* Settings */}
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Timer Settings</p>
          <div className="space-y-3">
            {[
              { label: 'Rounds', value: '3' },
              { label: 'Round Duration', value: '3:00' },
              { label: 'Rest Duration', value: '1:00' },
              { label: 'Warm-up', value: '0:10' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Round timer — interactive countdown to be built with React state
          </p>
        </Card>
      </div>
    </div>
  )
}
