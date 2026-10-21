import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_quill/flutter_quill.dart' as quill;
import 'package:pdfrx/pdfrx.dart';
import 'package:study_room/data/backup.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:study_room/data/store.dart';
import 'package:study_room/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  setUpAll(() async {
    await (FontLoader(
      'StudySans',
    )..addFont(rootBundle.load('assets/fonts/NotoSans-Regular.ttf'))).load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    Pdfrx.cacheDirectoryPath = Directory.systemTemp.path;
    // Headless Flutter tests do not discover the native-assets bundle the
    // same way an installed application does. Use the package-built library.
    final nativeRoot = Directory(
      '.dart_tool/hooks_runner/shared/pdfium_dart/build',
    );
    if (nativeRoot.existsSync()) {
      final libraries = nativeRoot
          .listSync(recursive: true)
          .whereType<File>()
          .where(
            (f) =>
                f.path.endsWith('libpdfium.so') ||
                f.path.endsWith('libpdfium.dylib'),
          );
      if (libraries.isNotEmpty) {
        Pdfrx.pdfiumModulePath = libraries.first.absolute.path;
      }
    }
    await pdfrxFlutterInitialize();
  });
  for (final size in [
    const Size(1194, 834),
    const Size(834, 1194),
    const Size(520, 900),
  ]) {
    testWidgets(
      'iPad navigation and goals fit ${size.width} x ${size.height}',
      (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final store = await StudyStore.open(
          factory: databaseFactoryFfiNoIsolate,
          path: inMemoryDatabasePath,
        );
        final boundary = GlobalKey();
        await tester.pumpWidget(
          RepaintBoundary(
            key: boundary,
            child: StudyRoomApp(store: store),
          ),
        );
        await tester.pump();
        expect(find.text('Make room for understanding.'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpAndSettle();
        await tester.runAsync(() async {
          final image =
              await (boundary.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await Directory('test-artifacts').create(recursive: true);
          await File('test-artifacts/ipad-${size.width.toInt()}.png')
              .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
        await tester.tap(find.byTooltip('Library').first);
        await tester.pumpAndSettle();
        expect(find.text('Your study library'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(find.byTooltip('Reviewers').first);
        await tester.pumpAndSettle();
        expect(find.text('In your own words.'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(
          find.byTooltip(size.width < 700 ? 'Goals' : 'Goals & history').first,
        );
        await tester.pumpAndSettle();
        expect(find.text('Small goals. Meaningful progress.'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        await store.close();
      },
    );
  }
  testWidgets('native PDF workspace keeps rich notes and enables Scribble', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1194, 834);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = await StudyStore.open(
      factory: databaseFactoryFfiNoIsolate,
      path: inMemoryDatabasePath,
    );
    await BackupService(store)
        .restore(File('test/fixtures/web-v1.zip').readAsBytesSync());
    final workspaceBoundary = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: workspaceBoundary,
        child: StudyRoomApp(store: store),
      ),
    );
    await tester.pump();
    await tester.tap(find.byTooltip('Library').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Memory').first);
    await tester.pump();
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 500)),
    );
    await tester.pump();
    expect(find.byType(PdfViewer), findsOneWidget);
    for (
      var i = 0;
      i < 10 &&
          !tester.widget<PdfViewer>(find.byType(PdfViewer)).controller!.isReady;
      i++
    ) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 100)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(
      tester.widget<PdfViewer>(find.byType(PdfViewer)).controller!.isReady,
      isTrue,
    );
    final rawText = await tester.runAsync(
      () => tester
          .widget<PdfViewer>(find.byType(PdfViewer))
          .controller!
          .document
          .pages
          .first
          .loadText(),
    );
    expect(rawText!.fullText, contains('Working memory supports learning.'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump();
    await tester.runAsync(() async {
      final image =
          await (workspaceBoundary.currentContext!.findRenderObject()
                  as RenderRepaintBoundary)
              .toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('test-artifacts/ipad-workspace.png')
          .writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
    expect(find.byType(quill.QuillEditor), findsOneWidget);
    final editor = tester.widget<quill.QuillEditor>(
      find.byType(quill.QuillEditor),
    );
    expect(editor.config.enableScribble, isTrue);
    expect(
      editor.controller.document.toPlainText(),
      contains('Holding information for active use.'),
    );
    expect(tester.takeException(), isNull);
    tester.view.viewInsets = const FakeViewPadding(bottom: 350);
    await tester.pump();
    expect(tester.takeException(), isNull);
    tester.view.resetViewInsets();
    await tester.pump();
    editor.controller.replaceText(
      editor.controller.document.length - 1,
      0,
      '\nRemember this across rotation.',
      const TextSelection.collapsed(offset: 0),
    );
    tester.view.physicalSize = const Size(520, 900);
    await tester.pump();
    expect(find.text('Reading'), findsOneWidget);
    expect(find.text('Notes'), findsOneWidget);
    await tester.tap(find.text('Notes'));
    await tester.pump();
    expect(
      tester
          .widget<quill.QuillEditor>(find.byType(quill.QuillEditor))
          .controller
          .document
          .toPlainText(),
      contains('Remember this across rotation.'),
    );
    expect(tester.takeException(), isNull);
    tester.view.viewInsets = const FakeViewPadding(bottom: 350);
    await tester.pump();
    expect(tester.takeException(), isNull);
    tester.view.resetViewInsets();
    await tester.pumpWidget(const SizedBox.shrink());
    // pdfrx has a short deferred background-page load that exits after disposal.
    await tester.pump(const Duration(milliseconds: 200));
    await store.close();
  });
}
