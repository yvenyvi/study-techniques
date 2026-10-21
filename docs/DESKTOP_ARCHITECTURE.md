# Study Room desktop architecture

The desktop app reuses the React study workspace in Tauri 2. The first installer targets Windows 10/11 x64. The Flutter app remains the iPad companion. There is no AI, account, server upload, or automatic sync.

## Pages and features

Overview, Library/Courses, PDF & Notes Workspace, Reviewers/Practice, Goals & History, and Settings use the shared web interface. Existing PDF imports, page-linked excerpts, typed rich notes, templates, focus timer, pinned deletion controls, and the Ivory Frias dedication are retained.

Desktop Settings shows the app-data folder and explains local storage, backup transfer, and timer limits. The browser persistence request and browser-notification controls are hidden. ZIP exports use a native Save dialog. A failed library open presents a retry screen; the application never silently falls back to browser storage.

## Layers and source files

```text
Shared React pages
       │
StudyStore + useLiveQuery
       ├── Web: Dexie / IndexedDB + Workbox asset cache
       └── Desktop: metadata cache + Tauri commands
                              │
                  Rust Library / rusqlite
                       ├── study-room.sqlite3
                       └── pdfs/<sha256>.pdf
```

- `src/models.ts`: shared record shapes and PDF byte-reading contract.
- `src/storage/store.ts`: small table/query API and explicit transaction context; browser adapter delegates to Dexie transactions.
- `src/storage/desktop.ts`: serialized native mutations, isolated transaction snapshots, lazy PDF reads, and metadata cache. Native commits must succeed before publishing changes to React. Independent UI events cannot accidentally join a pending transaction.
- `src/storage/live.ts`: Dexie subscriptions on web, commit revisions on desktop.
- `src/platform.ts`: runtime Tauri detection and command bridge.
- `src-tauri/src/storage.rs`: SQLite schema, PDF persistence, validation, orphan recovery, and atomic backup file writes.
- `src-tauri/src/lib.rs`: restricted command handlers, native Save dialog plugin, and single-instance behavior.
- `src/main.tsx`: hash routing on desktop, startup recovery screen, and editor flush before window close. Web keeps its `/app` browser routes and PWA updates.
- `vite.config.ts`: separate `dist-desktop` build without a service worker or public landing page. Desktop ships local PDF worker/font/character-map assets. Web output remains `dist`.

## Native storage and durability

The stable identifier is `com.studyroom.desktop`. Use Tauri's `app_local_data_dir()` for the library; Windows normally resolves this to `%LOCALAPPDATA%\com.studyroom.desktop`. Settings shows the actual path. Keep that identifier unchanged across releases.

SQLite schema version 1 stores one JSON record per `(table_name, id)`, plus the native PDF key for documents. The tables represent courses, documents, notes, reviewers, goals, completed sessions, the active timer, and preferences. Queries currently filter/sort metadata in memory, suitable for a personal library; PDF bodies are read only when opened or exported. Future normalized/indexed migrations can preserve the shared data contract. A newer unsupported SQLite schema is rejected without resetting the library.

SQLite uses WAL mode, `synchronous=FULL`, and explicit transactions. PDF bytes are validated (header and 50 MB limit), hashed, written to a temporary file, flushed, and renamed before a transaction can reference the final filename. Record IDs never become disk paths. A failed operation rolls back all SQL changes and removes unreferenced files. Startup cleans up orphaned files from interrupted imports. Cleanup failure after a successful SQL commit does not report a false failed save; startup retries cleanup.

Deleting a PDF removes its record and unreferenced PDF file while preserving notes and reviewer references. Course deletion unfiles its content atomically. Autosave updates existing records, preventing deleted notes from being recreated. Only one native process/window owns the library; opening Study Room again focuses the existing window. Closing the window flushes drafts and queued writes, keeping the window open if saving fails. Forced process termination or power loss can still lose edits that have not finished saving.

Clearing browser site data cannot clear the desktop library. Deleting the desktop data folder, disk failure, or losing the computer can still remove work. Keep exported backups outside the library directory.

## Backup compatibility and migration

All three apps use version-1 ZIPs: `manifest.json` plus `pdfs/<document-id>.pdf`. Native storage paths and keys are excluded. The same validation and limits apply: 250 MB archive, 512 MB expanded, 50 MB per entry; restore requires every table to be empty, including preferences, sessions, and the active timer. The restore writes records and PDF files as one native transaction.

To migrate from web, export in web Settings, open a fresh desktop workspace, and restore before saving preferences or starting a session. No browser database is read or changed by the desktop app. Active timers are deliberately excluded from backup transfer; completed session history is included. Web, desktop, and iPad stay independent after transfer.

## Offline behavior, security, and updates

All study assets ship inside the installer, so first launch can be offline. A content-security policy blocks remote scripts and network APIs; no broad filesystem or arbitrary SQL plugin is exposed. Native PDF reads accept only validated content hashes. Student PDFs are parsed by the bundled PDF.js worker.

Timer state persists in SQLite using absolute deadlines. Opening the app after a deadline processes the expired phase once. The app does not run a background service; notifications/sounds are not promised while closed or asleep. Browser notifications are hidden in this preview; optional completion sounds work while open.

There is no automatic desktop updater in v1. Install a later release over the existing app, preserving the app-data directory. Export a backup before upgrading. Native code signing requires a publisher certificate and is not configured for this initial preview; Windows can show an unknown-publisher/SmartScreen warning.

## Build and release

Requires Node 22+, stable Rust, and the Tauri prerequisites on the build computer. Windows requires Microsoft C++ Build Tools and WebView2. Run:

```sh
npm ci
npm run desktop:dev
npm run desktop:build -- --bundles nsis
```

The NSIS installer installs for the current user and bundles the WebView2 offline installer. `.github/workflows/desktop.yml` builds and verifies Windows on GitHub Actions. Each run uploads `Study-Room-Windows-x64-Setup.exe` and SHA-256 checksums as diagnostic artifacts, then installs and verifies that exact package. Failed native checks block publication. A manually dispatched publish run creates the `desktop-v1.2.0` GitHub pre-release; it must complete successfully before the landing page advertises a download. Subsequent releases need a new version/tag and verification.

## Verification

```sh
npm test
npm run build
npm run build:desktop
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --locked
npm run test:desktop:integration
npm run test:e2e
```

Rust tests verify reopen persistence, SQL/file rollback, PDF deletion semantics, rejected files and traversal, schema protection, and atomic export replacement. Integration tests run the TypeScript desktop adapter against the real Rust/SQLite implementation via a test-only stdin bridge; they cover ZIP exchange with IndexedDB, failed commits, independent concurrent operations, course unfiling, and timer recovery. Web Playwright tests guard the shared student workflows. Building the Windows installer validates the actual native shell and configuration on the supported target. The manual `Windows installer check` workflow accepts a successful build run ID, verifies its checksum, installs that exact installer on a clean Windows runner, and drives the real WebView2 app through CDP to verify native saves and reopen persistence. The test process explicitly sets `STUDY_ROOM_VERIFY_WEBVIEW=1`; only that opt-in launch enables CDP on port 9222, developer tools, and an isolated WebView2 profile. Normal launches keep debugging disabled. Native library storage is unchanged. A physical Windows study-session check is still required before calling this a stable release.

### Windows preview validation — October 21, 2026

[Release verification run](https://github.com/yvenyvi/study-techniques/actions/runs/39546961334) built the NSIS package and installed that exact installer on a Windows runner. The actual WebView2 app imported and displayed a PDF, saved a linked rich note through the native commands, closed, reopened, recovered both note and PDF from the native library, and reported no IndexedDB databases. Native Settings showed installed offline assets and omitted browser persistence controls.

Supporting checks passed: 9 shared data/unit tests, 5 Rust persistence tests, 5 TypeScript-to-Rust/SQLite integration tests, 17 web browser workflows, and the desktop browser-to-native-storage workflow. The landing page was checked at 1440, 834, and 390 pixels with no horizontal overflow or browser page errors. Web and desktop production builds passed. The initial release remains an unsigned preview pending normal use on a student's Windows device.

### Timer preferences fix — version 1.1.1

[The 1.1.1 Windows verification run](https://github.com/yvenyvi/study-techniques/actions/runs/39556198475) passed the installed-app check, including saved focus/break durations, reload recovery, and preservation of running/paused progress. Shared code normalizes older idle timer records and saves preferences plus idle countdown changes atomically. Settings observes saved preference values so unrelated native timer writes cannot reset form edits. The progress ring uses the active phase's original duration.

Supporting checks passed: 16 shared unit/data tests, 6 TypeScript-to-Rust/SQLite integration tests, 18 web browser workflows, and the desktop browser-to-native-storage workflow. The timer preference flow also passed against the live Vercel web app. Install 1.1.1 over the existing Windows preview to receive this fix; the native library location and storage schema are unchanged.

### Document editor — version 1.2

[The Windows 1.2 verification run](https://github.com/yvenyvi/study-techniques/actions/runs/39560874869) passed the desktop workflow and installed-package check. The actual Windows app exercised rich text, fonts, highlights, links, table rows/columns, undo/redo, and saved document columns, then closed and reopened to verify recovery from SQLite. The library location and schema remain unchanged.

Supporting checks passed: 18 shared unit/data tests, 6 TypeScript-to-Rust/SQLite integration tests, 20 web browser workflows, and the desktop browser-to-native-storage workflow. Browser checks cover merged/split table cells, print styling, responsive columns, offline recovery, and ZIP restoration. The live Vercel editor passed formatting and offline recovery at iPad width. Native iPad analysis, tests, and an unsigned simulator build passed with advanced notes protected as read-only previews.

Timer verification now waits for the Settings save acknowledgement before reloading. The corrected flow also passed against real SQLite with every write delayed by 500 ms; unchanged paused countdown text is not used as a save acknowledgement.
