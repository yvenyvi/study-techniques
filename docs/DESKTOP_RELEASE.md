Version 1.3 adds interactive first-visit page guides across Overview, Library, courses, PDF workspaces, notes, reviewers, practice, goals, and Settings.

- Short explanations point to real controls, with optional things to try.
- Back, Next, Show me, Skip, and keyboard controls keep guidance easy to follow.
- Each page type is introduced once. Page guide in the header replays it anytime.
- Settings → Show all guides again resets introductions without changing study work.
- Guide progress is separate from the study library and ZIP backups. Visiting a guide does not prevent restoring into an empty workspace.
- Guides work offline and adapt to smaller windows.

This release retains the document editor from 1.2 and the timer preferences fix from 1.1.1. Install 1.3 over your existing Windows preview. Your library folder and storage schema stay the same. The in-development native iPad app still preserves advanced notes as read-only previews and does not yet include these page walkthroughs.

Study Room for Windows 10/11 (64-bit) keeps notes, reviewers, goals, history, and preferences in SQLite, with PDFs stored as local files. Core study tools work offline from the first launch. The installer includes the WebView2 offline runtime for computers that need it.

Download **Study-Room-Windows-x64-Setup.exe**. This preview is unsigned, so Windows may show an unknown-publisher/SmartScreen prompt. Verify that the file came from this repository's release; `SHA256SUMS.txt` is included for integrity checking.

To move your existing work, export a ZIP from the web app's **Settings & data**, then restore it into the desktop app's empty workspace **before saving preferences or starting a timer**. Web, desktop, and iPad use the same backup format. Transfer is manual; there is no automatic sync.

The desktop app shows its library folder in Settings. Clearing browser data does not affect it. Keep regular ZIP backups outside that folder. App updates keep the same library location; deleting that folder or losing the computer still removes your local data.

Keep Study Room open for completion sounds. Saved timer deadlines resume after reopening; alerts do not run while the app is closed or the computer is asleep. This preview has no automatic updater. Install a newer release over the existing app after exporting a backup.
