Version 1.4 adds verified Windows app updates, clearer goal controls, and improved layouts at narrow widths.

- Signed releases check for updates on startup, every six hours, and on reconnect.
- **Settings & data → App updates** shows the installed version and a manual **Check for updates** button.
- **Install and restart** downloads and verifies the new installer. **Later** keeps the current session uninterrupted.
- Installation waits for saved notes and refuses to interrupt an active focus session or break. Saved SQLite data and local PDFs stay in the same folder.
- Goal forms explain optional courses and study materials, using custom dropdowns that also work on smaller screens.

For versions 1.3 and earlier, export a backup and install the first signed 1.4 installer once. Future higher versions can then update from inside the app. Updater-enabled installers are published only after the signing requirements and Windows verification steps pass. See [release signing and publication](DESKTOP_UPDATES.md).

Version 1.3 introduced interactive first-visit page guides across Overview, Library, courses, PDF workspaces, notes, reviewers, practice, goals, and Settings.

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

Keep Study Room open for completion sounds. Saved timer deadlines resume after reopening; alerts do not run while the app is closed or the computer is asleep. Signed 1.4 releases add an automatic update check. Earlier previews require the one-time installer upgrade described above.
