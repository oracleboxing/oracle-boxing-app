import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" />

      <div className="px-4 space-y-4 mt-2">
        {/* Avatar + name */}
        <Card elevated className="flex items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-3xl">
            🥊
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-[var(--text-primary)]">Boxer Name</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="gold">Level 1</Badge>
              <Badge>White Belt</Badge>
            </div>
          </div>
        </Card>

        {/* XP */}
        <Card>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-[var(--text-primary)]">XP Progress</span>
            <span className="text-[var(--accent-gold)] font-bold">240 / 500</span>
          </div>
          <Progress value={240} max={500} color="gold" />
        </Card>

        {/* Settings / account */}
        <div>
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Account</p>
          <Card>
            <div className="space-y-3">
              {['Edit Profile', 'Notifications', 'Privacy', 'Help & Support'].map((item) => (
                <div key={item} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                  <span className="text-sm text-[var(--text-primary)]">{item}</span>
                  <span className="text-[var(--text-tertiary)]">›</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Button variant="secondary" fullWidth>Sign Out</Button>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Profile — loads from Supabase &apos;user_profiles&apos; table, auth via Supabase Auth
          </p>
        </Card>
      </div>
    </div>
  )
}
