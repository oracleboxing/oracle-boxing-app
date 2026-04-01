# Roadmap

What we're building and when. Each phase builds on the last - don't skip ahead.

---

## Phase 1: Foundation (Week 1-2)

**Goal:** The app looks like Oracle Boxing and the data layer works.

| Task | Who | Description |
|------|-----|-------------|
| Bottom nav bar | Sha-Lyn | 5 tabs with icons, active state highlighting |
| Page layouts | Sha-Lyn | Each tab page has a header and placeholder content |
| Card and Button components | Sha-Lyn | Build and style using the design tokens |
| Design system polish | Sha-Lyn | Dark mode toggle, fonts, spacing, make it feel premium |
| Supabase schema | Jordan | Run the SQL migration, set up tables |
| Seed drill data | Jordan | Pull techniques from Boxing Brain into the drills table |
| Seed workout templates | Jordan | Create 10-15 starter workouts aligned with Grade 1 |

**Done when:** App loads, looks branded, nav works, database has real data.

---

## Phase 2: Drill Library (Week 2-3)

**Goal:** Browse and search all Oracle Boxing techniques and drills.

| Task | Who | Description |
|------|-----|-------------|
| DrillCard component | Sha-Lyn | Shows drill name, category, difficulty, grade badge |
| Library browse page | Sha-Lyn | Grid of DrillCards with category filter tabs |
| Search bar | Sha-Lyn | Filter drills by name as you type |
| Drill detail page | Sha-Lyn | Full drill info: description, cues, common mistakes, video |
| Drill API route | Jordan | Server route that queries Supabase drills table |
| Boxing Brain search | Jordan | Wire semantic search for "show me footwork drills" |

**Done when:** You can browse, search, and tap into any drill with full detail.

---

## Phase 3: Round Timer (Week 3-4)

**Goal:** A proper boxing round timer you'd actually use in training.

| Task | Who | Description |
|------|-----|-------------|
| Timer display | Sha-Lyn | Big countdown, round number, work/rest indicator |
| Timer controls | Sha-Lyn | Start, pause, reset buttons |
| Settings modal | Sha-Lyn | Configure rounds, work time, rest time |
| useTimer hook | Jordan | Core timer logic: countdown, work/rest toggle, audio cues |
| Audio alerts | Jordan | Bell sounds for round start/end, 10-second warning |

**Done when:** You can set 3x3min rounds with 1min rest and train to it.

---

## Phase 4: Workouts (Week 4-6)

**Goal:** Follow pre-built workouts or create your own.

| Task | Who | Description |
|------|-----|-------------|
| Workout browse page | Sha-Lyn | Grid of workout cards with difficulty/grade filters |
| Workout detail view | Sha-Lyn | Shows drill sequence, total duration, difficulty |
| Workout runner | Sha-Lyn | Step through drills with timer, mark complete |
| Custom workout builder | Sha-Lyn | Pick drills, set durations, save as template |
| Workout API | Jordan | CRUD for workout templates and custom workouts |
| Workout generator | Jordan | AI-powered workout generation using Boxing Brain |
| Log completed workouts | Jordan | Save workout logs to Supabase on completion |

**Done when:** You can pick a Grade 1 workout, run through it with the timer, and it logs your session.

---

## Phase 5: Progress and Gamification (Week 6-8)

**Goal:** See your stats, maintain streaks, earn badges.

| Task | Who | Description |
|------|-----|-------------|
| Stats dashboard | Sha-Lyn | Total rounds, minutes, workouts this week/month |
| Streak display | Sha-Lyn | Current streak, best streak, calendar heatmap |
| Badge grid | Sha-Lyn | All badges with locked/unlocked states |
| Level progress bar | Sha-Lyn | Current XP, progress to next level |
| XP system | Jordan | Points for workouts, streaks, milestones |
| Badge unlock logic | Jordan | Auto-award badges when conditions are met |
| Streak calculation | Jordan | Daily streak tracking, reset on missed days |

**Done when:** After completing workouts you see XP going up, badges unlocking, and your streak growing.

---

## Phase 6: Social Feed (Week 8-10)

**Goal:** See what other members are training and stay motivated.

| Task | Who | Description |
|------|-----|-------------|
| Feed post component | Sha-Lyn | Shows user, workout summary, timestamp, likes |
| Like button | Sha-Lyn | Tap to like/unlike with animation |
| Comment thread | Sha-Lyn | Basic comments on posts |
| Auto-post on workout | Jordan | Automatically create feed post when workout completed |
| Milestone posts | Jordan | Auto-post for badges, streaks, level-ups |
| Feed API | Jordan | Paginated feed with like/unlike |

**Done when:** You finish a workout, it posts to the feed, and others can like it.

---

## Phase 7: Video Analysis (Week 10+)

**Goal:** Upload a boxing clip and get AI feedback on your technique.

| Task | Who | Description |
|------|-----|-------------|
| Upload UI | Sha-Lyn | Video upload with preview |
| Video player with overlay | Sha-Lyn | Playback with pose estimation overlay |
| Feedback display | Sha-Lyn | AI coaching notes alongside the video |
| Pose estimation | Jordan | MediaPipe/MoveNet integration for body tracking |
| Boxing Brain feedback | Jordan | AI analysis comparing form to correct technique |

**Done when:** Upload a video of your jab, get back "your elbow is flaring out, try keeping it tucked."

---

## How We Work Together

**Sha-Lyn** owns the frontend - what the user sees and interacts with. Components, pages, styling, animations.

**Jordan** owns the backend - data, APIs, AI integrations, business logic.

**The handoff:** Jordan builds an API or hook, Sha-Lyn builds the UI that uses it. We review each other's PRs.

**If you're stuck:** Ask Claude Code first. If Claude can't figure it out, ask Jordan.

---

## Stretch Goals (after Phase 7)

- Offline mode (service worker caching)
- Push notifications (workout reminders)
- App Store via Capacitor wrapper
- Integration with Skool community
- Coach dashboard (Jordan/Oliver can see member progress)
- Sparring partner matching
