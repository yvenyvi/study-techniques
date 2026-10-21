import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';

import 'models.dart';
import 'store.dart';

void validateManifest(Json data, Map<String, Uint8List> files) {
  Never invalid() =>
      throw const FormatException('Invalid or unsupported Study Room backup.');
  bool str(dynamic v) => v is String;
  bool number(dynamic v) => v is num && v.isFinite && v >= 0;
  if (data['version'] != 1) invalid();
  for (final k in collections) {
    if (data[k] is! List) invalid();
    final ids = <String>{};
    for (final row in data[k]) {
      if (row is! Map ||
          !str(row['id']) ||
          (row['id'] as String).isEmpty ||
          (row['id'] as String).contains('/') ||
          !ids.add(row['id'])) {
        invalid();
      }
    }
  }
  for (final c in data['courses']) {
    if (!str(c['name']) || !str(c['description']) || !str(c['color'])) {
      invalid();
    }
  }
  for (final k in ['documents', 'notes', 'reviewers', 'goals']) {
    for (final r in data[k]) {
      if (!str(r['courseId'])) invalid();
    }
  }
  for (final d in data['documents']) {
    final bytes = files[d['id']];
    if (bytes == null ||
        bytes.length > 50 * 1024 * 1024 ||
        !latin1.decode(bytes.take(1024).toList()).contains('%PDF-') ||
        !str(d['title']) ||
        !str(d['tags']) ||
        !str(d['hash']) ||
        !number(d['created']) ||
        d['pages'] is! int ||
        d['pages'] < 1 ||
        d['page'] is! int ||
        d['page'] < 1 ||
        d['page'] > d['pages']) {
      invalid();
    }
  }
  bool content(dynamic v, [int depth = 0]) =>
      v is Map &&
      depth < 40 &&
      str(v['type']) &&
      (v['text'] == null || str(v['text'])) &&
      (v['content'] == null ||
          v['content'] is List &&
              (v['content'] as List).every((c) => content(c, depth + 1)));
  for (final n in data['notes']) {
    if (!str(n['title']) ||
        !number(n['updated']) ||
        !content(n['content']) ||
        n['content']['type'] != 'doc') {
      invalid();
    }
  }
  for (final r in data['reviewers']) {
    if (!str(r['title']) ||
        !str(r['tags']) ||
        !number(r['updated']) ||
        r['sections'] is! List) {
      invalid();
    }
    for (final s in r['sections']) {
      if (s is! Map ||
          !str(s['id']) ||
          !str(s['kind']) ||
          s['fields'] is! Map ||
          (s['fields'] as Map).values.any((v) => !str(v)) ||
          s['refs'] is! List) {
        invalid();
      }
      for (final ref in s['refs']) {
        if (ref is! Map ||
            !str(ref['documentId']) ||
            ref['page'] is! int ||
            ref['page'] < 1 ||
            !str(ref['quote'])) {
          invalid();
        }
      }
    }
  }
  for (final g in data['goals']) {
    if (!str(g['title']) ||
        !str(g['criterion']) ||
        g['done'] is! bool ||
        !number(g['created']) ||
        g['materialIds'] is! List ||
        (g['materialIds'] as List).any((v) => !str(v))) {
      invalid();
    }
  }
  for (final s in data['sessions']) {
    if (!str(s['goalId']) ||
        !number(s['started']) ||
        !number(s['ended']) ||
        !number(s['duration']) ||
        !str(s['outcome']) ||
        !str(s['note'])) {
      invalid();
    }
  }
  for (final s in data['settings']) {
    final v = s['value'];
    if (s['id'] != 'preferences' ||
        v is! Map ||
        !number(v['focus']) ||
        v['focus'] < 1 ||
        v['focus'] > 180 ||
        !number(v['rest']) ||
        v['rest'] < 1 ||
        v['rest'] > 60 ||
        v['sound'] is! bool) {
      invalid();
    }
  }
}

class BackupService {
  final StudyStore store;
  BackupService(this.store);
  Future<Uint8List> export() async {
    if (!await store.flushEditors()) {
      throw StateError('Save your edits before exporting.');
    }
    final manifest = <String, dynamic>{'version': 1};
    final pdfs = <String, Uint8List>{};
    await store.db.transaction((tx) async {
      final rows = await tx.query('records');
      for (final k in collections) {
        manifest[k] = rows
            .where((r) => r['kind'] == k)
            .map((r) => jsonDecode(r['json'] as String))
            .toList();
      }
      for (final r in await tx.query('pdfs')) {
        pdfs[r['id'] as String] = r['bytes'] as Uint8List;
      }
    });
    final archive = Archive()
      ..addFile(
        ArchiveFile(
          'manifest.json',
          utf8.encode(jsonEncode(manifest)).length,
          utf8.encode(jsonEncode(manifest)),
        ),
      );
    for (final e in pdfs.entries) {
      archive.addFile(
        ArchiveFile('pdfs/${e.key}.pdf', e.value.length, e.value),
      );
    }
    return Uint8List.fromList(ZipEncoder().encode(archive));
  }

  Future<void> restore(Uint8List bytes) async {
    if (bytes.length > 250 * 1024 * 1024) {
      throw const FormatException('Backup exceeds 250 MB.');
    }
    final archive = ZipDecoder().decodeBytes(bytes, verify: true);
    var size = 0;
    final files = <String, Uint8List>{};
    Uint8List? manifest;
    for (final f in archive.files) {
      size += f.size;
      if (size > 512 * 1024 * 1024 || f.size > 50 * 1024 * 1024) {
        throw const FormatException('Expanded backup exceeds limits.');
      }
      if (f.name == 'manifest.json') {
        manifest = f.content;
      } else if (f.name.startsWith('pdfs/') && f.name.endsWith('.pdf')) {
        files[f.name.substring(5, f.name.length - 4)] = f.content;
      }
    }
    if (manifest == null) {
      throw const FormatException('Missing backup manifest.');
    }
    final data = jsonDecode(utf8.decode(manifest)) as Json;
    validateManifest(data, files);
    await store.restoreRecords(data, files);
  }
}
