import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function DrillDetailPage({ params }: Props) {
  const { slug } = await params

  return (
    <div>
      <PageHeader
        title="Drill Detail"
        subtitle={`/${slug}`}
      />

      <div className="px-4 space-y-4 mt-2">
        {/* Video placeholder */}
        <div className="w-full aspect-video rounded-2xl bg-[var(--surface)] flex items-center justify-center border border-[var(--border)]">
          <p className="text-[var(--text-tertiary)] text-sm">▶ Video goes here</p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2">
          <Badge variant="gold">G1</Badge>
          <Badge variant="green">Foundation</Badge>
          <Badge>30 sec</Badge>
        </div>

        {/* Cues */}
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Coaching Cues</p>
          <ul className="space-y-1.5">
            {['Stay relaxed', 'Rotate hips', 'Return to guard'].map((cue) => (
              <li key={cue} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--accent-gold)] mt-0.5">•</span>
                {cue}
              </li>
            ))}
          </ul>
        </Card>

        {/* Common mistakes */}
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Common Mistakes</p>
          <ul className="space-y-1.5">
            {['Dropping the guard', 'Telegraphing'].map((mistake) => (
              <li key={mistake} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--accent-red)] mt-0.5">✗</span>
                {mistake}
              </li>
            ))}
          </ul>
        </Card>

        <Button fullWidth>Add to Workout</Button>

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Drill detail — loads from Supabase by slug: <strong>{slug}</strong>
          </p>
        </Card>
      </div>
    </div>
  )
}
