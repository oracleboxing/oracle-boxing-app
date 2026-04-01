# Design System 🎨

**How Oracle Boxing looks and feels — colours, typography, components, and usage examples.**

---

## Colour Tokens

Colours are defined as CSS variables in `app/globals.css`. They automatically switch between light and dark mode based on the user's system preference.

### How to use them

In Tailwind: use `bg-[var(--token-name)]` or `text-[var(--token-name)]`

```tsx
<div className="bg-[var(--surface)] text-[var(--text-primary)]">
  Hello
</div>
```

---

### Background & Surface

| Token | Light | Dark | Use for |
|-------|-------|------|---------|
| `--background` | `#ffffff` | `#0A0A0B` | Page background |
| `--surface` | `#f9fafb` | `#141416` | Cards, panels |
| `--surface-secondary` | `#f3f4f6` | `#1a1a1d` | Input fields, pill buttons |
| `--surface-elevated` | `#ffffff` | `#1C1C1F` | Elevated cards, modals |

### Borders

| Token | Light | Dark | Use for |
|-------|-------|------|---------|
| `--border` | `#e5e7eb` | `rgba(255,255,255,0.08)` | Default card borders |
| `--border-strong` | `#d1d5db` | `rgba(255,255,255,0.15)` | Active/focused borders |

### Text

| Token | Light | Dark | Use for |
|-------|-------|------|---------|
| `--text-primary` | `#111827` | `#FFFFFF` | Headings, important content |
| `--text-secondary` | `#6b7280` | `#A1A1AA` | Descriptions, subtitles |
| `--text-tertiary` | `#9ca3af` | `#71717A` | Placeholders, metadata |

### Accent Colours

| Token | Light | Dark | Use for |
|-------|-------|------|---------|
| `--accent-primary` | `#37322F` | `#C8BEB4` | Primary buttons, active states |
| `--accent-gold` | `#C4985A` | `#D4A96A` | XP, grades, highlights |
| `--accent-green` | `#6B8F71` | `#7FA886` | Success, completion |
| `--accent-red` | `#B85450` | `#C86460` | Errors, destructive actions |
| `--accent-purple` | `#8B7E74` | *(same)* | Tags, secondary labels |

---

## Typography

The app uses the system font stack for fast loading and native feel:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

**Size scale (Tailwind):**

| Class | Size | Use for |
|-------|------|---------|
| `text-xs` | 12px | Badges, metadata, labels |
| `text-sm` | 14px | Body text, card content |
| `text-base` | 16px | Larger body text |
| `text-lg` | 18px | Subheadings |
| `text-xl` | 20px | Page titles |
| `text-2xl` | 24px | Stats, numbers |
| `text-7xl` | 72px | Timer display |

---

## Components

### Button

Four variants. Import from `@/src/components/ui`.

```tsx
import { Button } from '@/src/components/ui'

// Primary — for the main action on a page
<Button variant="primary">Start Workout</Button>

// Secondary — for secondary actions
<Button variant="secondary">Cancel</Button>

// Ghost — for tertiary actions, navigation links
<Button variant="ghost">+ Add Drill</Button>

// Destructive — for dangerous actions (delete, sign out)
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// Full width
<Button fullWidth>Save Changes</Button>
```

---

### Card

A container with rounded corners and a border.

```tsx
import { Card } from '@/src/components/ui'

// Default
<Card>Content goes here</Card>

// Hoverable — shows cursor + hover effect (use for clickable cards)
<Card hoverable>Click me</Card>

// Elevated — slightly lighter background
<Card elevated>Elevated content</Card>

// Dashed border — for empty states, placeholders
<Card className="border-dashed">Nothing here yet</Card>
```

---

### Badge

Small labels for grades, XP, tags.

```tsx
import { Badge } from '@/src/components/ui'

<Badge>Default grey</Badge>
<Badge variant="gold">G1</Badge>       // Grades, XP
<Badge variant="green">Complete</Badge> // Success
<Badge variant="red">Error</Badge>     // Warning/error
<Badge variant="purple">Tag</Badge>    // General tags
<Badge variant="outline">Outline</Badge>
```

---

### PillTabs

Horizontal scrollable tab filter. Needs `'use client'` because it tracks which tab is active.

```tsx
'use client'

import { useState } from 'react'
import { PillTabs } from '@/src/components/ui'

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'g1', label: 'G1' },
  { id: 'g2', label: 'G2' },
]

export function MyComponent() {
  const [activeTab, setActiveTab] = useState('all')
  
  return (
    <PillTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={setActiveTab}
    />
  )
}
```

---

### Progress

A progress bar. Great for XP, workout completion.

```tsx
import { Progress } from '@/src/components/ui'

// Basic
<Progress value={60} />

// With max and label
<Progress value={240} max={500} showLabel />

// Colours
<Progress value={75} color="gold" />   // Default, for XP
<Progress value={75} color="green" />  // For completion
<Progress value={75} color="red" />    // For warnings

// Sizes
<Progress value={75} size="sm" />  // Thin
<Progress value={75} size="md" />  // Default
```

---

### Skeleton

Animated grey placeholder shown while content is loading.

```tsx
import { Skeleton } from '@/src/components/ui'

// A card-shaped loading placeholder
<Skeleton className="h-16 w-full" rounded="lg" />

// A circle (for avatars)
<Skeleton className="w-10 h-10" rounded="full" />

// A text line
<Skeleton className="h-4 w-3/4" />
```

---

## Layout Patterns

### Page structure

Every page follows this pattern:

```tsx
import { PageHeader } from '@/src/components/layout/PageHeader'

export default function MyPage() {
  return (
    <div>
      <PageHeader
        title="Page Title"
        subtitle="Optional subtitle"
        action={<Button size="sm">Action</Button>}  // optional
      />
      
      <div className="px-4 space-y-4 mt-2">
        {/* Page content */}
      </div>
    </div>
  )
}
```

### Standard spacing

- **Page padding:** `px-4` (16px left/right)
- **Section spacing:** `space-y-4` (16px between sections)
- **Card padding:** `p-4` (built into Card component)
- **Small gaps:** `gap-2` or `gap-3`

---

## Do's and Don'ts

✅ **Do:**
- Use CSS variables for all colours (they handle dark mode automatically)
- Use the `Card` component for any container with a border
- Use `Badge` for grade labels, XP values, and tags
- Keep buttons to the variants defined in `Button.tsx`

❌ **Don't:**
- Hardcode hex colours (`#111827`) — use `var(--text-primary)` instead
- Mix Tailwind colour utilities (`bg-gray-100`) with CSS variables
- Add new colours without updating both light and dark mode in `globals.css`
- Install a component library like shadcn (we're building our own)

---

*Questions? Ask Jordan.*
