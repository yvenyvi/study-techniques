# Study Room

An offline-first workspace for a BS Psychology student: organize readings, write notes, create guided reviewers, and finish clear study goals. No AI, account, backend, or document uploads to a server.

## Windows desktop app

The Tauri companion stores study records in SQLite and PDFs as local files, independently of browser data. It works offline from first launch. Build with `npm run desktop:dev` or `npm run desktop:build -- --bundles nsis` on Windows with Rust and Microsoft C++ Build Tools. GitHub Actions builds a Windows x64 installer with the WebView2 offline runtime. See [desktop architecture](docs/DESKTOP_ARCHITECTURE.md) and [preview release notes](docs/DESKTOP_RELEASE.md).

Move web materials by exporting a ZIP in Settings, then restoring into the desktop app's empty workspace before saving preferences or starting a timer. Keep external backups; the apps do not sync automatically. The initial Windows preview is unsigned.

## iPad app

The native Flutter companion lives in [mobile/](mobile/README.md). It provides an adaptive iPad workspace with typed rich notes and Scribble enabled, local SQLite storage, and manual ZIP transfer with the web app. See [the iPad architecture](docs/IPAD_ARCHITECTURE.md). Building or running the iPad simulator requires macOS and Xcode.

## Run the web app locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

For the installable offline app:

```sh
npm run build
npm run preview
```

Open the displayed localhost URL for the landing page, or `/app/` for the workspace. Open the workspace online once and wait for **Ready for offline study**. Development mode does not install a service worker. In production, serve `dist/` over HTTPS using the included Vercel rewrites: `/` is the landing page and `/app/` is the workspace. Build hooks copy the PDF worker’s font and character-map assets from the installed dependency; all core assets are cached locally.

## Study workflow

1. Create courses in Library and import PDFs (up to 50 MB each).
2. Read a PDF next to autosaved notes. Select text and add a page-linked excerpt, or write independent notes.
3. Create reviewers using concept, theory comparison, research summary, and practice-question sections. Copy note selections into a reviewer; practice by revealing answers.
4. Create a goal with an explicit completion criterion, link materials, and start a focus session. Ending the timer does not automatically complete your goal.
5. Resume saved materials offline. Export a ZIP backup from Settings regularly.

Use **Delete note** beside a Library/course note or in the pinned study-workspace toolbar. That toolbar keeps note and PDF deletion visible while scrolling. Use **Delete PDF** on its Library card or in the reading workspace. Confirm the named item before removing it; deleting a PDF preserves its notes and reviewers. Notes open for editing in another tab must be closed before deleting them from Library.

Home, Library/Course, Study Workspace, Reviewers/Practice, Goals & History, and Settings are connected application routes. The mobile workspace switches between reading and writing. Notes and reviewers support browser printing / Save as PDF.

## Data and limitations

- IndexedDB holds PDF blobs and structured student content on this browser profile. Clearing browser data removes it. Request persistent storage in Settings and maintain backups.
- ZIP backups include PDFs, courses, notes, reviewers, preferences, goals, and completed session history. Active timers are not restored. Restore is transactional and requires a completely empty workspace, including preferences/history; use a fresh browser profile to recover without deleting existing work.
- Scanned PDFs can be read; they do not offer selectable text without OCR. OCR, AI summaries, cloud sync, collaborative editing, dedicated flashcard decks, and spaced repetition are deferred.
- Timer deadlines survive reloads and background throttling. Sounds and notifications require browser permission/support and may not fire while the browser is closed or suspended.
- One tab owns the timer. An editor open in another tab is read-only; close the owning tab and reload to take control. Modern browsers with IndexedDB, Service Workers, and Web Locks are recommended.
- Offline availability requires one successful initial cache. First load can take longer because PDF fonts and character maps are bundled for offline reading.
- Existing legacy localStorage values are preserved. The old app did not persist PDF or flashcard content; `lastTechnique` is not migrated into the new model.

## Architecture and verification

Start with [the agreed architecture plan](docs/PLAN.md), then read [the implementation architecture](docs/ARCHITECTURE.md). React/TypeScript + Vite; Dexie/IndexedDB; PDF.js; Tiptap; a Workbox service worker. No external runtime CDN dependencies.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover database integrity, backup/restore, and deadline calculations. Production browser tests cover PDF reading and notes offline, reviewer practice, goal/session behavior, and mobile layout.

## Publish on Vercel

The landing page and workspace deploy together as one Vite project using [vercel.json](vercel.json). No application secrets are required. See [deployment and installation](docs/DEPLOYMENT.md) for the CLI steps, offline verification, and native release status. The landing page includes browser installation instructions; a signed native iPad download is not yet available.
