# Study Room for iPad

A native Flutter companion to the web workspace, designed for a BS Psychology student. It includes the offline PDF library, linked rich notes, psychology reviewer templates and practice, explicit study goals, a persistent focus timer, and ZIP backup transfer.

Read [the iPad architecture](../docs/IPAD_ARCHITECTURE.md) and [the agreed product plan](../docs/PLAN.md) before changing the application.

## Run on an iPad simulator

Use **Flutter 3.47.7 / Dart 3.13** or a compatible later stable SDK, **macOS**, and **Xcode** with an installed iPad simulator. The iOS deployment target is **15.0**, and the Xcode project targets iPad. See [Flutter’s official iOS setup](https://docs.flutter.dev/platform-integration/ios/setup).

```sh
cd mobile
flutter pub get
flutter analyze
flutter test
open -a Simulator
flutter devices
flutter run -d <ipad-simulator-id>
```

For an unsigned simulator build:

```sh
flutter build ios --simulator --no-codesign
```

To run on a physical iPad, open `ios/Runner.xcworkspace` in Xcode, select your development team and a unique bundle identifier under Signing & Capabilities, and follow Flutter’s device setup instructions. No signing identity is embedded in this repository. Check Scribble with a compatible Apple Pencil on a physical iPad; widget tests and the simulator do not validate handwriting recognition.

## Offline behavior and data

- All study data and PDF bytes are stored locally in SQLite in the application support directory. PDFium is bundled through pdfrx. No AI, account, runtime CDN, or cloud service is required.
- Rich typed notes use Flutter Quill with **Scribble enabled**. Headings, emphasis, lists, quotations, and page-linked excerpts are exchanged as the web app’s Tiptap JSON. Dedicated handwriting/drawing is deferred.
- Import PDFs from Files. PDFs up to 50 MB are validated and deduplicated by content hash. Scanned PDFs remain readable; selection depends on the presence of text. OCR is deferred.
- Landscape uses PDF and notes side by side when there is enough room. Portrait and narrower Split View/Stage Manager windows use reading/notes tabs. Keyboard-constrained editors prioritize the writing area.
- The timer persists deadlines and paused duration. Reopening after expiry counts only the elapsed focus phase and asks for a progress reflection. Goals are completed explicitly. Active timers are not included in exported backups.
- Settings exports the same **version-1 ZIP** as the web app. Use the iPad share sheet to save it to Files or transfer it. Restore requires a completely empty workspace, including preferences/history. This is manual transfer, not automatic cross-device synchronization.
- Deleting a PDF preserves notes and reviewers. Deleting a course moves its content to Unfiled. Deleting the app removes local data; maintain external backups.

## Verification

```sh
flutter analyze
flutter test
```

Linux host tests also need a C compiler supported by Dart native assets (Clang) because pdfrx builds a small PDFium gate library. Linux can validate Dart and Flutter widget behavior; it cannot produce or run an iOS application.

Tests cover database integrity, deletion, editor conversion, web ZIP import/native ZIP export, pause/expiry arithmetic, explicit goal completion, and adaptive iPad navigation. The macOS GitHub Actions workflow additionally builds the unsigned iOS simulator app when run; adding the workflow does not mean it has already passed remotely.

Device acceptance before release: PDF rendering and selection, Files import/share popovers, PDF printing, Scribble, software/hardware keyboard layouts, rotation/Split View resizing, suspend/resume, and airplane-mode use. No App Store submission or release signing has been performed.
