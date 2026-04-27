# Setup Guide 🛠️

**This guide assumes you've never coded before. We'll go step by step.**

---

## Step 1 — Install Node.js

Node.js is the engine that runs this app on your computer.

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the left button — "Recommended for most users")
3. Run the installer and follow the prompts (just click Next → Next → Install)
4. To check it worked, open **Terminal** (Mac) or **Command Prompt** (Windows) and type:

```bash
node --version
```

You should see something like `v22.0.0`. If you do, Node is installed! ✅

---

## Step 2 — Get the Code

You'll need **GitHub Desktop** installed: [https://desktop.github.com](https://desktop.github.com)

1. Open GitHub Desktop
2. Click **File → Clone Repository**
3. Paste the repository URL and choose where to save it (e.g. your Desktop)
4. Click **Clone**

Now you have a copy of the code on your computer.

---

## Step 3 — Open the Project in Your Terminal

1. In GitHub Desktop, go to **Repository → Open in Terminal** (Mac) or **Repository → Open in Command Prompt** (Windows)
2. This opens a terminal already pointed at the right folder

---

## Step 4 — Install Dependencies

Dependencies are extra packages the app needs to run. Think of them like ingredients in a recipe.

In your terminal, type:

```bash
npm install
```

Wait for it to finish. You'll see a message saying how many packages were added. This is normal — don't worry about the numbers.

---

## Step 5 — Set Up Your Environment Variables

Environment variables are secret settings (like database passwords) that the app needs. We keep them out of the code so they're not accidentally shared publicly.

1. Find the file called `.env.example` in the project folder
2. Make a copy of it and rename the copy to `.env.local`
3. Open `.env.local` in a text editor (Notepad on Windows, TextEdit on Mac, or VS Code)
4. Fill in the values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find these values:**
- Log in to [https://supabase.com](https://supabase.com)
- Open the Oracle Boxing project
- Go to **Settings → API**
- Copy the **Project URL** and **anon/public** key

> ⚠️ Never share `.env.local` with anyone. Never commit it to GitHub. It contains secret keys.

---

## Step 6 — Run the App

In your terminal:

```bash
npm run dev
```

You'll see output ending in something like:

```
▲ Next.js 16.x.x
- Local: http://localhost:3000
✓ Ready
```

Open your browser and go to **http://localhost:3000** — you should see the Oracle Boxing app!

---

## Common Problems

**"npm is not recognised" or "command not found"**
→ Node.js isn't installed correctly. Go back to Step 1 and try again. Restart your terminal after installing.

**"Cannot find module" errors**
→ Run `npm install` again. Dependencies may not have installed properly.

**White screen / nothing loads**
→ Check your `.env.local` file. Make sure the Supabase URL and keys are filled in correctly (no spaces around the `=`).

**Port 3000 already in use**
→ Something else is running on that port. Stop the other process, or run `npm run dev -- --port 3001` to use a different port.

---

*Still stuck? Message Jordan on Telegram.*
