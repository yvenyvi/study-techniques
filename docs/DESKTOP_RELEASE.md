Version 1.2 adds a document-style editor to PDF-linked and standalone notes:

- Bold, italic, underline, strikethrough, headings, font families/sizes, text colors, and highlights.
- Alignment, bullet and numbered lists, quotations, links, and undo/redo.
- Editable tables with row/column controls, header rows, resizing, and merged cells.
- Saved one-, two-, and three-column layouts, with a single-column view on narrow screens.
- Offline autosave, ZIP backup/restore, and printing with tables and highlights intact.

This release also includes the timer preferences fix from 1.1.1. Install 1.2 over your existing Windows preview to receive these updates. Your library folder and storage schema stay the same. Upgrade older Windows installations before opening notes containing the new formatting. The in-development native iPad app preserves these notes as read-only previews until its editor supports the complete format.

Study Room for Windows 10/11 (64-bit) keeps notes, reviewers, goals, history, and preferences in SQLite, with PDFs stored as local files. Core study tools work offline from the first launch. The installer includes the WebView2 offline runtime for computers that need it.

Download **Study-Room-Windows-x64-Setup.exe**. This preview is unsigned, so Windows may show an unknown-publisher/SmartScreen prompt. Verify that the file came from this repository's release; `SHA256SUMS.txt` is included for integrity checking.

To move your existing work, export a ZIP from the web app's **Settings & data**, then restore it into the desktop app's empty workspace **before saving preferences or starting a timer**. Web, desktop, and iPad use the same backup format. Transfer is manual; there is no automatic sync.

The desktop app shows its library folder in Settings. Clearing browser data does not affect it. Keep regular ZIP backups outside that folder. App updates keep the same library location; deleting that folder or losing the computer still removes your local data.

Keep Study Room open for completion sounds. Saved timer deadlines resume after reopening; alerts do not run while the app is closed or the computer is asleep. This preview has no automatic updater. Install a newer release over the existing app after exporting a backup.
