# Architecture Guide 🏗️

**A deep explanation of how this app is built and how all the pieces fit together.**

---

## Overview

This is a **Next.js** web app. Next.js is a framework that lets you build websites and web apps using React (a popular way of building user interfaces). It handles things like routing (what URL shows what page), server-side rendering, and bundling all the code together.

---

## Folder Structure

```
oracle-boxing-app/
│
├── app/                        ← Pages and routing
│   ├── layout.tsx              ← The "frame" around every page (nav, shell)
│   ├── globals.css             ← Global styles and CSS variables
│   ├── page.tsx                ← The home page (/)
│   ├── library/
│   │   ├── page.tsx            ← Drill library page (/library)
│   │   └── [slug]/
│   │       └── page.tsx        ← Individual drill page (/library/jab)
│   ├── timer/
│   │   └── page.tsx            ← Round timer (/timer)
│   ├── workouts/
│   │   ├── page.tsx            ← Browse workouts (/workouts)
│   │   ├── [id]/
│   │   │   └── page.tsx        ← Workout detail (/workouts/abc123)
│   │   └── builder/
│   │       └── page.tsx        ← Custom workout builder (/workouts/builder)
│   ├── progress/
│   │   └── page.tsx            ← Progress stats (/progress)
│   ├── feed/
│   │   └── page.tsx            ← Community feed (/feed)
│   └── profile/
│       └── page.tsx            ← User profile (/profile)
│
├── src/
│   ├── components/
│   │   ├── ui/                 ← Reusable building blocks
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── PillTabs.tsx
│   │   │   ├── Progress.tsx
│   │   │   └── Skeleton.tsx
│   │   └── layout/             ← App-level layout components
│   │       ├── BottomNav.tsx   ← The tab bar at the bottom
│   │       └── PageHeader.tsx  ← The title bar at the top of each page
│   └── lib/
│       └── supabase/           ← Database connection helpers
│           ├── client.ts       ← Browser-side database client
│           ├── server.ts       ← Server-side database client
│           └── types.ts        ← TypeScript types matching the database schema
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  ← Database setup script
│
├── public/
│   └── manifest.json           ← PWA manifest (makes the app installable)
│
└── docs/                       ← You are here
```

---

## How Routing Works

In Next.js App Router, **folders = URLs**. The structure of the `app/` folder directly maps to the URLs of your app:

| Folder | URL |
|--------|-----|
| `app/page.tsx` | `/` (home) |
| `app/library/page.tsx` | `/library` |
| `app/library/[slug]/page.tsx` | `/library/jab`, `/library/cross`, etc. |
| `app/workouts/[id]/page.tsx` | `/workouts/abc123`, `/workouts/xyz789`, etc. |

The `[slug]` and `[id]` folders are **dynamic routes** — the brackets mean "this part of the URL can be anything." The value gets passed into the page so you can load the right content.

---

## How the Layout Works

`app/layout.tsx` is special — it wraps **every page** in the app. This is where:
- The bottom navigation bar lives
- The "phone shell" wrapper (max 430px wide, centred on desktop) is applied
- Global fonts and styles are applied

Think of it like a picture frame. Every page is a picture, and `layout.tsx` is the frame around all of them.

---

## How the Database Works (Supabase)

**Supabase** is the database service. It stores all the app's data — drills, workouts, user profiles, etc.

There are two ways to connect to it:

### Browser Client (`src/lib/supabase/client.ts`)
Used on the **client side** (code that runs in the user's browser). Used for reading public data and user-specific data after they're logged in.

### Server Client (`src/lib/supabase/server.ts`)
Used on the **server side** (code that runs on the server before the page is sent to the browser). More secure — used for sensitive operations.

### Types (`src/lib/supabase/types.ts`)
TypeScript types that match the database tables exactly. This means if you try to access a column that doesn't exist, TypeScript will warn you before the code even runs. Catches bugs early.

---

## How Components Work

Components are reusable building blocks. Instead of writing the same button styles 50 times, you write a `Button` component once and use it everywhere.

### UI Components (`src/components/ui/`)

| Component | What it does |
|-----------|-------------|
| `Button` | A clickable button with 4 styles: primary, secondary, ghost, destructive |
| `Card` | A rounded container with optional hover effects |
| `Badge` | A small label (for grades, XP, tags) |
| `PillTabs` | Horizontal scrollable filter tabs |
| `Progress` | A progress bar (for XP, completion) |
| `Skeleton` | A grey pulsing placeholder shown while data loads |

### How to use a component

```tsx
import { Button, Card, Badge } from '@/src/components/ui'

export default function MyPage() {
  return (
    <Card hoverable>
      <Badge variant="gold">G1</Badge>
      <Button variant="primary">Start Workout</Button>
    </Card>
  )
}
```

---

## How Styling Works

This app uses **Tailwind CSS v4** — a system where you style things by adding class names directly to your HTML/JSX.

Instead of writing:
```css
.button { background: #37322F; color: white; border-radius: 12px; }
```

You write:
```tsx
<button className="bg-[#37322F] text-white rounded-xl">Click me</button>
```

### Design Tokens (CSS Variables)

Colours and spacing are defined as **CSS variables** in `globals.css`. This makes it easy to support both light and dark mode — the variable automatically switches value based on the user's system preference.

Instead of hardcoding `#111827`, you use `var(--text-primary)` — and it automatically becomes white in dark mode.

---

## How Data Flows (When It's Wired Up)

```
User opens /library
    ↓
app/library/page.tsx runs on the server
    ↓
Calls createClient() from src/lib/supabase/server.ts
    ↓
Queries the 'drills' table in Supabase
    ↓
Renders the list of drills as Card components
    ↓
Page HTML is sent to the user's browser
```

Currently all pages are **static placeholders** — no data fetching yet. The structure is ready; connecting the data is the next step.

---

## The PWA (Progressive Web App)

The `public/manifest.json` file and the manifest link in `layout.tsx` tell browsers that this app can be "installed" on a phone, appearing like a native app with its own icon.

When Sha-Lyn's phone visits the app and taps "Add to Home Screen," it uses this manifest to create an icon, name, and splash screen.

---

*Questions about any of this? Ask Jordan.*
