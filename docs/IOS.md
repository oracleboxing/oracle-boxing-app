# iOS / Xcode Setup

The iOS app uses Capacitor as a thin native wrapper around the existing Next.js app.

This keeps one product codebase:
- build the app UI/UX in Next.js
- use Capacitor for the Xcode project, signing, App Store packaging, and future native plugins
- keep the repo editable from GitHub, Codex, OpenClaw, or Xcode

## Current setup

- Capacitor app id: `com.oracleboxing.app`
- Capacitor app name: `Oracle Boxing`
- Native project: `ios/App/App.xcodeproj`
- Config: `capacitor.config.ts`
- Placeholder native web assets: `native/www/index.html`

The current Next app still uses dynamic server pages and Supabase server helpers, so it is not yet a fully static offline bundle. For now, the iOS shell should point at a running/deployed Next.js app using `CAPACITOR_SERVER_URL`.

## Local Mac workflow

On the Mac:

```bash
git clone git@github.com:oracleboxing/oracle-boxing-app.git
cd oracle-boxing-app
npm install
npm run dev
```

In a second terminal:

```bash
CAPACITOR_SERVER_URL=http://localhost:3333 npm run ios:sync
npm run ios:open
```

Then run the app from Xcode on a simulator or device.

If testing on a physical iPhone, `localhost` means the phone, not the Mac. Use the Mac LAN address instead:

```bash
CAPACITOR_SERVER_URL=http://192.168.x.x:3333 npm run ios:sync
```

## Production/App Store path

Before App Store submission, point the shell at the deployed app:

```bash
CAPACITOR_SERVER_URL=https://app.oracleboxing.com npm run ios:sync
npm run ios:open
```

Then in Xcode:
1. Select the Oracle Boxing app target.
2. Set the Apple Developer Team.
3. Confirm bundle identifier `com.oracleboxing.app`.
4. Add app icons and launch screen polish.
5. Archive and upload through Xcode Organizer.

## Important product note

A pure website wrapper can get rejected by Apple if it feels like a thin webview. The safe direction is:
- make the app feel native and app-specific
- keep the `Start Workout` experience as the core App Store value
- later add native capabilities where useful, for example haptics, audio cues, offline workout cache, HealthKit, or push reminders

So Capacitor is the right first move, but the UI still needs to become a proper app, not just a website in a trench coat. Obviously.

## Useful commands

```bash
npm run ios:sync        # sync current Capacitor config/native assets
npm run ios:sync:local  # sync pointing at http://localhost:3333
npm run ios:open        # open Xcode project, Mac only
npm run build           # verify the Next.js app still builds
```
