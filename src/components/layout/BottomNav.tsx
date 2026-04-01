'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Timer, Dumbbell, TrendingUp, User } from 'lucide-react'

const tabs = [
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/timer', label: 'Timer', icon: Timer },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] border-t border-[var(--border)] bg-[var(--surface-elevated)] z-50">
      <div className="flex items-center justify-around py-2 pb-safe">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors duration-150 min-w-[56px]',
                isActive
                  ? 'text-[var(--accent-gold)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              ].join(' ')}
            >
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
