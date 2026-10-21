import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:pdfrx/pdfrx.dart';

import 'data/store.dart';
import 'features/shell.dart';
import 'ui/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await pdfrxFlutterInitialize();
  try {
    final store = await StudyStore.open();
    runApp(StudyRoomApp(store: store));
  } catch (e) {
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                'Your local workspace could not be opened. Please restart the app. Your data has not been reset.\n\n$e',
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class StudyRoomApp extends StatelessWidget {
  final StudyStore store;
  const StudyRoomApp({required this.store, super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Study Room',
    debugShowCheckedModeBanner: false,
    theme: studyTheme(),
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      FlutterQuillLocalizations.delegate,
    ],
    supportedLocales: const [Locale('en')],
    home: StudyShell(store: store),
  );
}
