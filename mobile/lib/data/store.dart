import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'models.dart';

class StudyStore extends ChangeNotifier {
  final Database db;
  final Map<String, List<Json>> _rows = {};
  final Set<Future<bool> Function()> editors = {};
  StudyStore(this.db);
  static Future<StudyStore> open({
    DatabaseFactory? factory,
    String? path,
  }) async {
    final f = factory ?? databaseFactory;
    final location =
        path ??
        p.join(
          (await getApplicationSupportDirectory()).path,
          'study-room.sqlite',
        );
    final database = await f.openDatabase(
      location,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (d, _) async {
          await d.execute(
            'CREATE TABLE records(kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(kind,id))',
          );
          await d.execute(
            'CREATE TABLE pdfs(id TEXT PRIMARY KEY,bytes BLOB NOT NULL)',
          );
        },
      ),
    );
    final store = StudyStore(database);
    await store.reload();
    return store;
  }

  Future<void> reload() async {
    final values = await db.query('records');
    _rows.clear();
    for (final v in values) {
      (_rows[v['kind'] as String] ??= []).add(
        jsonDecode(v['json'] as String) as Json,
      );
    }
    notifyListeners();
  }

  List<Json> rows(String kind) => List.unmodifiable(_rows[kind] ?? []);
  Json? find(String kind, String id) {
    for (final r in rows(kind)) {
      if (r['id'] == id) return clone(r);
    }
    return null;
  }

  String courseName(String? id) =>
      find('courses', id ?? '')?['name'] as String? ?? 'Unfiled';
  Future<void> put(String kind, Json value) async {
    await db.insert('records', {
      'kind': kind,
      'id': value['id'],
      'json': jsonEncode(value),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    await reload();
  }

  Future<void> delete(String kind, String id) async {
    await db.transaction((txn) async {
      await txn.delete(
        'records',
        where: 'kind=? AND id=?',
        whereArgs: [kind, id],
      );
      if (kind == 'documents') {
        await txn.delete('pdfs', where: 'id=?', whereArgs: [id]);
      }
      if (kind == 'courses') {
        for (final k in ['documents', 'notes', 'reviewers', 'goals']) {
          for (final r in rows(k).where((r) => r['courseId'] == id)) {
            final value = clone(r)..['courseId'] = '';
            await txn.update(
              'records',
              {'json': jsonEncode(value)},
              where: 'kind=? AND id=?',
              whereArgs: [k, r['id']],
            );
          }
        }
      }
    });
    await reload();
  }

  Future<void> importDocument(Json doc, Uint8List bytes) async {
    await db.transaction((t) async {
      await t.insert('pdfs', {'id': doc['id'], 'bytes': bytes});
      await t.insert('records', {
        'kind': 'documents',
        'id': doc['id'],
        'json': jsonEncode(doc),
      });
    });
    await reload();
  }

  Future<Uint8List?> pdfBytes(String id) async {
    final values = await db.query(
      'pdfs',
      where: 'id=?',
      whereArgs: [id],
      limit: 1,
    );
    return values.isEmpty ? null : values.first['bytes'] as Uint8List;
  }

  Future<bool> flushEditors() async {
    for (final save in List.of(editors)) {
      if (!await save()) return false;
    }
    return true;
  }

  Future<void> restoreRecords(
    Json manifest,
    Map<String, Uint8List> pdfs,
  ) async {
    await db.transaction((txn) async {
      if (Sqflite.firstIntValue(
                await txn.rawQuery('SELECT count(*) FROM records'),
              ) !=
              0 ||
          Sqflite.firstIntValue(
                await txn.rawQuery('SELECT count(*) FROM pdfs'),
              ) !=
              0) {
        throw StateError('Restore requires an empty workspace.');
      }
      for (final kind in collections) {
        for (final row in manifest[kind] as List) {
          await txn.insert('records', {
            'kind': kind,
            'id': row['id'],
            'json': jsonEncode(row),
          });
        }
      }
      for (final entry in pdfs.entries) {
        await txn.insert('pdfs', {'id': entry.key, 'bytes': entry.value});
      }
    });
    await reload();
  }

  Future<void> completeSession(Json session, Json? goal, Json timer) async {
    await db.transaction((t) async {
      for (final entry in {
        'sessions': session,
        'goals': ?goal,
        'timers': timer,
      }.entries) {
        await t.insert('records', {
          'kind': entry.key,
          'id': entry.value['id'],
          'json': jsonEncode(entry.value),
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      }
    });
    await reload();
  }

  Future<void> close() async {
    await db.close();
    dispose();
  }
}
