import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BottomNav } from '@/src/components/layout/BottomNav'

export const metadata: Metadata = {
  title: 'Oracle Boxing',
  description: 'Your personal boxing training app — drills, workouts, and progress tracking.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Oracle Boxing',
  },
}

export const viewport: Viewport = {
  themeColor: '#37322F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Desktop wrapper: centers the phone shell */}
        <div className="min-h-screen bg-[var(--surface-secondary)] flex items-start justify-center">
          {/* Phone shell: max 430px, full height */}
          <div className="relative w-full max-w-[430px] min-h-screen bg-[var(--background)] shadow-2xl">
            {/* Scrollable content area with bottom padding for nav */}
            <main className="pb-20 min-h-screen">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  )
}
