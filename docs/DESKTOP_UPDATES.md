# Windows automatic updates

Study Room 1.4 adds Tauri's verified updater. Windows 10/11 x64 builds made with the release signing configuration check on startup, every six hours, on reconnect, and through **Settings & data → App updates → Check for updates**. An available update shows **Install and restart** and **Later**. Downloads happen only after the user chooses to install. No account, PDF upload, or cloud library is involved.

Versions 1.3 and earlier do not contain an updater. Install the first signed 1.4 installer once, over the existing application. Export a ZIP backup first. Keep the application identifier `com.studyroom.desktop` and the same app-data folder; the installer does not migrate or clear that library. After that first installation, later published versions can update from inside the app.

A running or paused focus session/break blocks installation. The app flushes open editors and waits for queued SQLite writes before downloading, then checks again before installation. During download/installation the workspace is unavailable for editing. A failed download or invalid signature leaves the application running with its library intact. Windows launches the passive NSIS updater, closes Study Room, and restarts the new version.

## One-time release signing setup

An updater signature verifies that an update comes from this project. It is separate from Windows Authenticode signing; the installer can still show an unknown-publisher warning. Keep the same updater private key across future releases.

From a trusted developer computer, outside the Git checkout, generate a key pair using the project's installed Tauri CLI:

```powershell
# Run from the project after npm ci. The key files are written outside the repo.
npx tauri signer generate --ci --write-keys "$env:USERPROFILE\study-room-updater.key"
```

In this GitHub repository, open **Settings → Secrets and variables → Actions**:

- Under **Secrets**, create `TAURI_SIGNING_PRIVATE_KEY` with the complete contents of `study-room-updater.key`.
- Under **Variables**, create `STUDY_ROOM_UPDATER_PUBLIC_KEY` with the complete contents of `study-room-updater.key.pub`.
- If the key was generated with a password, create the secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Otherwise leave that secret unset.

Keep an encrypted offline backup of the private key. Do not commit it, paste it into chat, or place it in release assets. Losing the key prevents signing updates accepted by already installed copies. Never replace the public key in a routine release.

The cloud GitHub connection may be able to read code and push changes without access to Actions secrets. Configuring these two entries needs a repository owner/administrator or a connection with Actions-secret administration access. A build without the signing configuration is a development build: Settings explicitly disables updates. Publication refuses to proceed without a signing configuration and signature file. Pull requests never receive signing credentials.

## Publish the bootstrap installer and later updates

1. Keep `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` at the same version. Increase the version for each new release; the updater never intentionally installs an equal or older version.
2. Push the tested version to GitHub `main`.
3. In **Actions → Windows desktop app → Run workflow**, select `main`, enable **Publish the signed installer and automatic update feed**, and run it. A push builds and tests the app but does not publish a desktop release.
4. The Windows job builds the installer, generates `.sig`, runs desktop UI/native storage checks, and installs/reopens the actual Windows package. Only after it succeeds does the publication job create the versioned GitHub release and mark it latest.
5. Download the first 1.4 installer from that release and install it once. Update the landing page's versioned Windows download link to this verified release after publication; it intentionally continues to point at the existing 1.3 installer until the signed release exists.

The release includes `Study-Room-Windows-x64-Setup.exe`, its Tauri `.sig`, `SHA256SUMS.txt`, and `latest.json`. The feed is always fetched at:

```text
https://github.com/yvenyvi/study-techniques/releases/latest/download/latest.json
```

The feed references the versioned installer asset, so a later release cannot change the bytes referenced by an older feed. Tauri verifies downloaded bytes against the public key embedded at build time and uses HTTPS with normal certificate validation. Do not change GitHub's latest release to an unrelated release without `latest.json`. Mobile releases should not use the desktop feed's latest-release designation.

## Validation and limits

```sh
npm test
npm run test:release
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --locked
npm run test:desktop:integration
npm run build:desktop
npm run test:desktop:e2e
```

The release tests exercise feed generation, byte preservation, checksums, missing signatures, and stale feed removal. Desktop browser tests use real Rust/SQLite persistence with simulated updater IPC to cover notifications, manual checks, offline failures, signature refusal, installation/restart requests, unsaved edits, and active sessions. They do not execute an installer or prove cryptographic verification in a real Windows upgrade.

For final acceptance, install the signed bootstrap version on Windows, save a sample library, publish a higher version using the same signing key, and use **Install and restart**. Verify the new version in Settings and that the sample PDF and notes remain. Also test a cancelled/failed download. A successful initial installer smoke test alone does not establish that this version-to-version upgrade has passed.
