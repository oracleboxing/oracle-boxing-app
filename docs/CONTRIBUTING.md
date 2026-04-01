# Contributing Guide 🤝

**How to make changes safely using GitHub Desktop.**

The golden rule: **never work directly on the `main` branch.** Always create a new branch for your changes. This protects the live code.

---

## The Git Workflow (Step by Step)

### 1. Sync with the latest code

Before starting any work, make sure you have the latest version.

In GitHub Desktop:
1. Click **Fetch origin** (top right)
2. If there are changes, click **Pull origin**

You're now up to date.

---

### 2. Create a new branch

A branch is like a separate workspace. Your changes stay isolated until they're reviewed.

In GitHub Desktop:
1. Click **Current Branch** (top, shows `main`)
2. Click **New Branch**
3. Name your branch something descriptive, like:
   - `add-drill-card-component`
   - `fix-timer-display`
   - `update-profile-page`
4. Click **Create Branch**

You're now on your new branch. Changes here won't affect `main`.

---

### 3. Make your changes

Now make whatever changes you need to the code files.

You can use **Visual Studio Code** to edit files — it's free: [https://code.visualstudio.com](https://code.visualstudio.com)

In GitHub Desktop, you'll see your changes listed on the left side.

---

### 4. Commit your changes

A commit is a snapshot of your changes with a description.

In GitHub Desktop:
1. On the left, you'll see a list of changed files
2. Make sure the ones you want are ticked
3. At the bottom, write a **Summary** — be specific:
   - ✅ `Add hover state to drill cards`
   - ✅ `Fix timer not resetting on round change`
   - ❌ `Changes` (too vague)
4. Optionally add a **Description** for more detail
5. Click **Commit to [your-branch-name]**

---

### 5. Push to GitHub

Pushing sends your committed changes to GitHub so others can see them.

In GitHub Desktop:
1. Click **Push origin** (top right)

Your branch is now on GitHub.

---

### 6. Open a Pull Request

A Pull Request (PR) asks someone to review your changes before they go into `main`.

In GitHub Desktop:
1. Click **Create Pull Request** (it may appear after pushing)
2. This opens GitHub in your browser
3. Write a clear title and description:
   - **Title:** What did you change?
   - **Description:** Why? Any context? Screenshots if it's a visual change.
4. Assign **Jordan** as a reviewer
5. Click **Create Pull Request**

---

### 7. Wait for review

Jordan (or another reviewer) will look at your PR. They may:
- **Approve** it → it gets merged into `main` ✅
- **Request changes** → they'll leave comments, you fix them and push again

---

### 8. After merge: clean up

Once your PR is merged:
1. Switch back to `main` in GitHub Desktop
2. Click **Fetch origin** → **Pull origin**
3. Delete your old branch (optional but keeps things tidy)

---

## Quick Reference

| Task | GitHub Desktop action |
|------|----------------------|
| Get latest code | Fetch + Pull origin |
| Start new feature | New Branch |
| Save progress | Commit |
| Share with GitHub | Push origin |
| Request code review | Create Pull Request |

---

## Important Rules

- **Never force push** — it can overwrite other people's work
- **Never commit `.env.local`** — it has secret keys
- **Small PRs are better** — easier to review and less risky
- **Ask if unsure** — no such thing as a dumb question

---

*Questions? Message Jordan.*
