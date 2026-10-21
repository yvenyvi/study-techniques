Version 1.1.1 fixes timer preferences: saving durations immediately updates an unstarted focus or break timer. Sessions already running or paused keep their remaining time; new durations apply to the next phase. The progress ring keeps the current session's original duration, and timer updates no longer reset unsaved Settings edits.

Study Room for Windows 10/11 (64-bit) keeps notes, reviewers, goals, history, and preferences in SQLite, with PDFs stored as local files. Core study tools work offline from the first launch. The installer includes the WebView2 offline runtime for computers that need it.

Download **Study-Room-Windows-x64-Setup.exe**. This preview is unsigned, so Windows may show an unknown-publisher/SmartScreen prompt. Verify that the file came from this repository's release; `SHA256SUMS.txt` is included for integrity checking.

To move your existing work, export a ZIP from the web app's **Settings & data**, then restore it into the desktop app's empty workspace **before saving preferences or starting a timer**. Web, desktop, and iPad use the same backup format. Transfer is manual; there is no automatic sync.

The desktop app shows its library folder in Settings. Clearing browser data does not affect it. Keep regular ZIP backups outside that folder. App updates keep the same library location; deleting that folder or losing the computer still removes your local data.

Keep Study Room open for completion sounds. Saved timer deadlines resume after reopening; alerts do not run while the app is closed or the computer is asleep. This preview has no automatic updater. Install a newer release over the existing app after exporting a backup.
