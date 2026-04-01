import { PageHeader } from '@/src/components/layout/PageHeader'
import { Card } from '@/src/components/ui/Card'
import { Badge } from '@/src/components/ui/Badge'
import { Progress } from '@/src/components/ui/Progress'

export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="Oracle Boxing"
        subtitle="GOOD MORNING, BOXER 👊"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* XP / Level card */}
        <Card elevated>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Level</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">1</p>
            </div>
            <Badge variant="gold">White Belt</Badge>
          </div>
          <Progress value={240} max={500} color="gold" showLabel />
          <p className="text-xs text-[var(--text-tertiary)] mt-1">240 / 500 XP to Level 2</p>
        </Card>

        {/* Streak */}
        <Card hoverable>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">🔥 Current Streak</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Keep it going!</p>
            </div>
            <span className="text-3xl font-bold text-[var(--accent-gold)]">5</span>
          </div>
        </Card>

        {/* Quick actions */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Quick Start</p>
          <div className="grid grid-cols-2 gap-3">
            <Card hoverable className="text-center py-6">
              <p className="text-2xl mb-1">🥊</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">Today&apos;s Workout</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">3 rounds · 12 min</p>
            </Card>
            <Card hoverable className="text-center py-6">
              <p className="text-2xl mb-1">⏱️</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">Round Timer</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Custom rounds</p>
            </Card>
          </div>
        </div>

        {/* Placeholder notice */}
        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Home dashboard — live stats will appear here once connected to Supabase
          </p>
        </Card>
      </div>
    </div>
  )
}
