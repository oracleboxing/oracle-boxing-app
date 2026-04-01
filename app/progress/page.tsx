import { PageHeader } from '@/src/components/layout/PageHeader'
import { Card } from '@/src/components/ui/Card'
import { Badge } from '@/src/components/ui/Badge'
import { Progress } from '@/src/components/ui/Progress'

export default function ProgressPage() {
  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Your stats and achievements"
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Rounds', value: '47', icon: '🥊' },
            { label: 'Total Minutes', value: '312', icon: '⏱️' },
            { label: 'Current Streak', value: '5 days', icon: '🔥' },
            { label: 'Best Streak', value: '12 days', icon: '⭐' },
          ].map(({ label, value, icon }) => (
            <Card key={label} elevated>
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
              <p className="text-xs text-[var(--text-secondary)]">{label}</p>
            </Card>
          ))}
        </div>

        {/* XP progress */}
        <Card elevated>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Level 1 Progress</p>
            <Badge variant="gold">240 XP</Badge>
          </div>
          <Progress value={240} max={500} color="gold" />
          <p className="text-xs text-[var(--text-tertiary)] mt-1">260 XP to Level 2</p>
        </Card>

        {/* Badges */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Badges Earned</p>
          <div className="grid grid-cols-3 gap-3">
            {['First Punch 👊', 'Week Warrior 🔥', 'Early Bird 🌅'].map((badge) => (
              <Card key={badge} className="text-center py-3">
                <p className="text-2xl mb-1">{badge.split(' ')[1]}</p>
                <p className="text-xs text-[var(--text-secondary)]">{badge.split(' ')[0]}</p>
              </Card>
            ))}
            {/* Locked badges */}
            {['Shadow ?', 'Iron ?', 'Combo ?'].map((badge) => (
              <Card key={badge} className="text-center py-3 opacity-40">
                <p className="text-2xl mb-1">🔒</p>
                <p className="text-xs text-[var(--text-tertiary)]">Locked</p>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Progress — pulls from Supabase &apos;user_profiles&apos; and &apos;workout_logs&apos;
          </p>
        </Card>
      </div>
    </div>
  )
}
