# Vercel deployment and app installation

One Vercel project serves both the public landing page (`/`) and the offline web workspace (`/app/`). All workspace routes live under `/app/`; for example, `/app/library` and `/app/settings`. Native Flutter source remains in `mobile/` and is excluded from Vercel uploads.

## Build and deploy

Requires Node.js 22 or newer and a Vercel account with access to the target project. No application environment variables or backend services are needed.

```sh
npm ci
npm test
npm run build
npm run test:e2e
npx vercel login
npx vercel --prod
```

Run from the repository root. On the first deployment, select the intended Vercel account and project. Use the included `vercel.json`: Vite framework, `npm run build`, output directory `dist`. Alternatively, import this repository in Vercel with the same settings. Do not set the root directory to `mobile`.

`index.html` is a static landing page with its own CSS. `app.html` boots React. Vite builds both entries and uses the same route rewrites locally as Vercel. Old `/library`, `/study/:id`, and other workspace links load the app and normalize to `/app/...`; this preserves source links stored in version-1 web/native backups. No student data format changes are necessary.

An explicit `/app/(.*)` rewrite includes the trailing-slash launch URL `/app/`. Keep that match when editing routing; a named catch-all alone does not cover this URL in every Build Output API configuration.

The service worker is served from `/sw.js` with no-cache headers. It precaches both page shells, scripts, styles, and local PDF assets; navigation fallback only applies to workspace routes. The PWA manifest starts at `/app/` and limits installed-app navigation to `/app/`. The worker itself has root scope so legacy source links can still resolve offline.

Keep the same production domain for future deployments: browser data is tied to its origin. Preview deployments and new domains have separate libraries. Use ZIP export/restore to move work; deployment does not move or delete an existing local database.

## Verify after publishing

1. Open `/`: confirm the landing page and its install instructions.
2. Follow **Open web app**. Create a course, import a PDF, write a note, and reload a deep route such as `/app/library`.
3. Wait for **Ready for offline study**. Disconnect and verify the saved PDF, note, and timer still work.
4. Open `/manifest.webmanifest`: confirm `start_url` and `scope` are `/app/`. Launch the installed app and confirm it opens the workspace.
5. Export a backup in Settings. Uploaded files should stay in IndexedDB and never be sent to Vercel.

## Download and install status

- **Web:** available in the browser. The landing page links to `/app/` and offers installation instructions. On iPad/iPhone, open the workspace in Safari and choose Share → Add to Home Screen. On Chrome/Edge desktop, use the browser's install action when supported. Open the installed app online once and wait for offline readiness.
- **Windows desktop:** Tauri companion with SQLite and local PDF files. See [desktop architecture](DESKTOP_ARCHITECTURE.md) for the build and Windows installer verification workflows. The first preview is unsigned and requires Windows 10/11 x64. The installer build and installed-app check passed in [the verified Windows release run](https://github.com/yvenyvi/study-techniques/actions/runs/39571326135). The landing page links to the `desktop-v1.3.0` GitHub pre-release.
- **Native iPad:** in development. No signed `.ipa`, TestFlight invitation, or App Store listing is available. The landing page accurately says “coming soon”; it has no inactive download buttons or fabricated store URLs.
- **Future native release:** build and sign on macOS with Xcode, test on a physical iPad (including Scribble and suspended timers), distribute through TestFlight or the App Store, then replace the native card's status with the verified release URL. Keep web installation links available.

Some platforms give the installed PWA its own storage. Export/restore a ZIP to move an existing browser workspace if necessary. A downloaded source archive is not an installable iPad app.

## Initial deployment record

On October 20, 2026, the landing page and app were published together at `https://temporary-racing-mercury-knasnik.vercel.app`. This is a temporary Vercel deployment that expires on October 20, 2026 at 18:51:33 UTC unless claimed. The private ownership claim link was provided directly in the conversation and is deliberately not saved in the repository. After claiming or deploying to a permanent project, record its production URL here and verify the routes and offline workflow again.

The initial publication used a direct CLI build deployment. It did not push the local source changes to GitHub or enable automatic deployments from Git. Keep the local checkout; push the reviewed source and link the repository when setting up continuous deployments.

Live verification passed after correcting the trailing-slash rewrite: landing-page navigation, `/app/`, direct `/app/library`, service-worker readiness, and saved-note reload with the browser offline. The production browser emitted no page errors. Local checks passed: 9 unit/data tests, 12 browser tests, and the production build.

## Current production site

The permanent production URL is **https://focus-room-xi-pearl.vercel.app/**. The landing page is `/`, and the workspace lives under `/app/`. GitHub `main` is now connected successfully; pushes automatically deploy to the Vercel `focus-room` and `study-techniques` projects. The earlier legacy page and missing `/app` routes were resolved when the updated source reached GitHub. Current browser checks verify landing navigation, deep links, service-worker readiness, and saved content offline.

## Windows desktop release

GitHub Actions builds the NSIS installer independently of Vercel. The `Windows installer check` workflow installs and runs the artifact on Windows before publication. GitHub Releases hosts installer downloads and checksums; Vercel hosts the landing page and web workspace. Student desktop data stays in the app-local SQLite database and PDF folder and is never stored on either host. See [desktop architecture](DESKTOP_ARCHITECTURE.md) and [preview release notes](DESKTOP_RELEASE.md).
