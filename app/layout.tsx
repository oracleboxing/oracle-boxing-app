import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Oracle Boxing',
  description: 'Coach-led boxing training app for workouts, session execution, and progress.',
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
        <main className="min-h-screen bg-[var(--surface-secondary)]">
          {children}
        </main>
      </body>
    </html>
  )
}
