import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'models.dart';
import 'store.dart';

Future<String?> pickPdf(StudyStore store, {String courseId = ''}) async {
  final picked = await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: ['pdf'],
    withData: true,
  );
  if (picked == null) return null;
  final file = picked.files.single;
  if (file.size > 50 * 1024 * 1024) {
    throw const FormatException('Choose a PDF smaller than 50 MB.');
  }
  final bytes = file.bytes ?? await File(file.path!).readAsBytes();
  if (!latin1.decode(bytes.take(1024).toList()).contains('%PDF-')) {
    throw const FormatException('This file is not a PDF.');
  }
  final hash = sha256.convert(bytes).toString();
  for (final d in store.rows('documents')) {
    if (d['hash'] == hash) return d['id'] as String;
  }
  int pages;
  try {
    final pdf = await PdfDocument.openData(bytes);
    pages = pdf.pages.length;
    await pdf.dispose();
  } catch (_) {
    throw const FormatException(
      'This PDF is corrupt, password-protected, or unsupported. Try an unlocked copy.',
    );
  }
  final id = newId();
  await store.importDocument({
    'id': id,
    'title': file.name.replaceFirst(
      RegExp(r'\.pdf$', caseSensitive: false),
      '',
    ),
    'courseId': courseId,
    'tags': '',
    'hash': hash,
    'pages': pages,
    'page': 1,
    'created': nowMs(),
    'lastOpened': nowMs(),
  }, bytes);
  return id;
}

Future<void> shareBackup(BuildContext context, Uint8List bytes) async {
  final directory = await getTemporaryDirectory();
  final file = File('${directory.path}/study-room-${nowMs()}.zip');
  await file.writeAsBytes(bytes, flush: true);
  if (!context.mounted) return;
  final box = context.findRenderObject() as RenderBox?;
  final origin = box == null
      ? const Rect.fromLTWH(0, 0, 1, 1)
      : box.localToGlobal(Offset.zero) & box.size;
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path)],
      subject: 'Study Room backup',
      sharePositionOrigin: origin,
    ),
  );
}

Future<void> printContent(String title, List<String> paragraphs) async {
  final font = pw.Font.ttf(
    await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
  );
  final document = pw.Document(
    theme: pw.ThemeData.withFont(
      base: font,
      bold: font,
      italic: font,
      boldItalic: font,
    ),
  );
  document.addPage(
    pw.MultiPage(
      build: (_) => [
        pw.Header(level: 0, child: pw.Text(title)),
        for (final text in paragraphs)
          pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 12),
            child: pw.Text(text),
          ),
      ],
    ),
  );
  await Printing.layoutPdf(
    name: '$title.pdf',
    onLayout: (_) => document.save(),
  );
}
