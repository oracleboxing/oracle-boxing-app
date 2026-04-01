import { PageHeader } from '@/src/components/layout/PageHeader'
import { Card } from '@/src/components/ui/Card'
import { Badge } from '@/src/components/ui/Badge'

const placeholderPosts = [
  {
    id: '1',
    user: 'Alex T.',
    avatar: '🥊',
    workout: 'Foundation Flow',
    xp: 45,
    time: '2h ago',
    content: 'Smashed 3 rounds today. Jab-cross is really clicking now!',
    likes: 7,
  },
  {
    id: '2',
    user: 'Sam K.',
    avatar: '💪',
    workout: 'Defense Drill Series',
    xp: 60,
    time: '5h ago',
    content: 'Finally got the slip-outside timing right. Week 3 consistency!',
    likes: 12,
  },
]

export default function FeedPage() {
  return (
    <div>
      <PageHeader
        title="Community Feed"
        subtitle="See what others are training"
      />

      <div className="px-4 space-y-4 mt-2">
        {placeholderPosts.map((post) => (
          <Card key={post.id} hoverable>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-lg">
                {post.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{post.user}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{post.time}</p>
              </div>
              <Badge variant="gold">+{post.xp} XP</Badge>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">{post.content}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">🥊 {post.workout}</span>
              <button className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-red)]">
                ❤️ {post.likes}
              </button>
            </div>
          </Card>
        ))}

        <Card className="border-dashed">
          <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
            🏗️ Social feed — pulls from Supabase &apos;feed_posts&apos; table with likes
          </p>
        </Card>
      </div>
    </div>
  )
}
