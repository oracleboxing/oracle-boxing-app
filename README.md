# Oracle Boxing Training App 🥊

**START HERE** — Welcome! This is the Oracle Boxing Training App. It's a mobile-first web app (works in your phone browser, and can be installed like an app) that lets members track drills, run workouts, use a round timer, follow their progress, and connect with the community.

---

## What This App Does

| Feature | What it is |
|---------|-----------|
| **Drill Library** | Browse and search every drill in the Oracle Boxing curriculum |
| **Round Timer** | Customisable interval timer for your training sessions |
| **Workouts** | Pre-built sessions and a custom workout builder |
| **Progress** | Track your XP, level, streaks, and badges |
| **Community Feed** | See what other members are training |

---

## How to Run It (Quick Version)

1. Make sure you have **Node.js** installed (see [docs/SETUP.md](docs/SETUP.md) for help)
2. Copy `.env.example` to `.env.local` and fill in the Supabase credentials
3. Run these commands in your terminal:

```bash
npm install
npm run dev
```

4. Open your browser and go to: **http://localhost:3000**

---

## Folder Structure (Quick Overview)

```
oracle-boxing-app/
├── app/              ← All the pages (each folder = one URL)
├── src/
│   ├── components/   ← Reusable building blocks (buttons, cards, etc.)
│   └── lib/          ← Supabase database connection
├── supabase/         ← Database setup files
├── public/           ← Static files (icons, manifest)
└── docs/             ← You are here! More detailed guides
```

---

## More Detailed Docs

- [docs/SETUP.md](docs/SETUP.md) — Step-by-step setup guide (start here if you're new!)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — How to make changes safely with GitHub Desktop
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Deep explanation of how everything fits together
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) — Colours, components, and styling guide

---

## Tech Stack

- **Next.js 15** — The framework that powers the app
- **TypeScript** — JavaScript with type safety (catches bugs before they happen)
- **Tailwind CSS v4** — Utility-first styling
- **Supabase** — Database and authentication

---

*Built for Oracle Boxing — Questions? Ask Jordan.*
