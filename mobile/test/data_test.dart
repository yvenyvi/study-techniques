import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:study_room/data/store.dart';
import 'package:study_room/data/models.dart';
import 'package:study_room/data/backup.dart';
import 'package:study_room/data/focus.dart';
import 'package:study_room/data/draft.dart';
import 'package:study_room/data/editor_codec.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late StudyStore store;
  setUp(() async {
    store = await StudyStore.open(
      factory: databaseFactoryFfi,
      path: inMemoryDatabasePath,
    );
  });
  tearDown(() async {
    await store.close();
  });
  test('course and document deletion preserve written study work', () async {
    await store.put('courses', {
      'id': 'c',
      'name': 'Cognitive',
      'description': '',
      'color': '#688975',
    });
    await store.importDocument({
      'id': 'd',
      'title': 'Memory',
      'courseId': 'c',
      'tags': '',
      'hash': 'h',
      'page': 1,
      'pages': 1,
      'created': 0,
    }, Uint8List.fromList(utf8.encode('%PDF-test')));
    final note = newNote(documentId: 'd', courseId: 'c');
    await store.put('notes', note);
    await store.delete('courses', 'c');
    expect(store.find('notes', note['id'])!['courseId'], '');
    await store.delete('documents', 'd');
    expect(store.rows('notes'), hasLength(1));
    expect(await store.pdfBytes('d'), isNull);
  });
  test(
    'ZIP round trip preserves web-compatible content and PDF bytes',
    () async {
      await store.importDocument({
        'id': 'd',
        'title': 'Memory',
        'courseId': '',
        'tags': '',
        'hash': 'h',
        'page': 1,
        'pages': 1,
        'created': 0,
      }, Uint8List.fromList(utf8.encode('%PDF-test')));
      await store.put('notes', newNote(documentId: 'd'));
      final service = BackupService(store),
          bytes = await BackupService(store).export();
      await expectLater(service.restore(bytes), throwsStateError);
      await store.db.delete('records');
      await store.db.delete('pdfs');
      await store.reload();
      await service.restore(bytes);
      expect(store.rows('documents'), hasLength(1));
      expect(store.rows('notes'), hasLength(1));
      expect(utf8.decode((await store.pdfBytes('d'))!), '%PDF-test');
    },
  );
  test('malformed manifest is rejected before restore writes', () async {
    expect(() => validateManifest({'version': 2}, {}), throwsFormatException);
    expect(store.rows('documents'), isEmpty);
  });
  test(
    'advanced web notes retain their original JSON through preview and backup',
    () async {
      final rich = jsonDecode(
        await File('../tests/fixtures/rich-note.json').readAsString(),
      ) as Json;
      expect(needsDocumentEditor(rich), isTrue);
      expect(toDelta(rich).toString(), contains('Mental processes'));
      final note = newNote(title: 'Rich psychology note');
      note['content'] = rich;
      await store.put('notes', note);
      final bytes = await BackupService(store).export();
      await store.db.delete('records');
      await store.reload();
      await BackupService(store).restore(bytes);
      expect(store.find('notes', note['id'])!['content'], rich);
      expect(needsDocumentEditor(newNote()['content'] as Json), isFalse);
    },
  );
  test(
    'rich notes retain formatting and page references across editor codecs',
    () {
      final note = {
        'type': 'doc',
        'content': [
          {
            'type': 'heading',
            'attrs': {'level': 2},
            'content': [
              {'type': 'text', 'text': 'Memory'},
            ],
          },
          {
            'type': 'blockquote',
            'content': [
              {
                'type': 'paragraph',
                'content': [
                  {'type': 'text', 'text': 'Working memory'},
                ],
              },
            ],
          },
          {
            'type': 'paragraph',
            'content': [
              {
                'type': 'text',
                'text': 'Source p. 2',
                'marks': [
                  {
                    'type': 'link',
                    'attrs': {'href': '/study/d?page=2'},
                  },
                  {'type': 'bold'},
                ],
              },
            ],
          },
        ],
      };
      final roundtrip = fromDelta(toDelta(note));
      expect(searchable(roundtrip), contains('Working memory'));
      expect(sourceReferences(roundtrip).single['page'], 2);
      expect((roundtrip['content'] as List).first['type'], 'heading');
      expect(jsonEncode(roundtrip), contains('"bold"'));
    },
  );
  test(
    'timer pause, reload, and expiry count focus time only and preserve goal',
    () async {
      var now = 1000;
      await store.put('goals', {
        'id': 'g',
        'title': 'Compare',
        'criterion': 'Write comparison',
        'courseId': '',
        'materialIds': [],
        'done': false,
        'created': 0,
      });
      final focus = FocusController(store, clock: () => now, tick: false);
      await focus.chooseGoal('g');
      await focus.toggle();
      now += 60000;
      await focus.pause();
      expect(focus.remaining, 1440);
      expect(focus.value['elapsed'], 60);
      now += 500000;
      expect(focus.remaining, 1440);
      await focus.toggle();
      now += 1500000;
      await focus.reconcile();
      expect(focus.value['elapsed'], 1500);
      expect(focus.needsReflection, isTrue);
      await focus.finish(completed: false, note: 'First theory complete');
      expect(store.rows('sessions').single['duration'], 1500);
      expect(store.find('goals', 'g')!['done'], false);
      expect(focus.value['phase'], 'break');
      expect(focus.value['running'], false);
      focus.dispose();
    },
  );
  test('goal completion requires an explicit session outcome', () async {
    var now = 1000;
    await store.put('goals', {
      'id': 'g',
      'title': 'Compare',
      'criterion': 'Write comparison',
      'courseId': '',
      'materialIds': [],
      'done': false,
      'created': 0,
    });
    final f = FocusController(store, clock: () => now, tick: false);
    await f.chooseGoal('g');
    await f.toggle();
    now += 20000;
    await f.finish(completed: true, note: 'Comparison finished');
    expect(store.find('goals', 'g')!['done'], true);
    expect(store.rows('sessions').single['duration'], 20);
    f.dispose();
  });
  test('imports the web backup and exports the shared v1 format', () async {
    final bytes = await File('test/fixtures/web-v1.zip').readAsBytes();
    await BackupService(store).restore(bytes);
    expect(
      store.find('notes', 'note-memory')!['title'],
      'Working memory notes',
    );
    expect(
      sourceReferences(store.find('notes', 'note-memory')!['content'] as Json)
          .single['page'],
      1,
    );
    expect(
      store.find(
        'reviewers',
        'reviewer-memory',
      )!['sections'][0]['fields']['Answer'],
      'Holds information for active use.',
    );
    final exported = await BackupService(store).export();
    if (const bool.fromEnvironment('WRITE_COMPAT_FIXTURE')) {
      await File('test/fixtures/native-v1.zip').writeAsBytes(exported);
    }
    expect(exported, isNotEmpty);
  });
  test('a failed autosave preserves the draft and succeeds on retry', () async {
    final flaky = FailingStore(store.db);
    final note = newNote(title: 'Notes that must survive');
    final draft = DraftSaver(flaky, 'notes', note);
    draft.change({...note, 'title': 'Still here after storage failure'});
    expect(await flaky.flushEditors(), isFalse);
    expect(draft.value['title'], 'Still here after storage failure');
    expect(draft.status, contains('Save failed'));
    flaky.fail = false;
    expect(await draft.flush(), isTrue);
    expect(
      flaky.find('notes', note['id'])!['title'],
      'Still here after storage failure',
    );
    draft.dispose();
    flaky.dispose();
  });
}

class FailingStore extends StudyStore {
  bool fail = true;
  FailingStore(super.db);
  @override
  Future<void> put(String kind, Json value) async {
    if (fail) throw StateError('Simulated storage failure');
    await super.put(kind, value);
  }
}
