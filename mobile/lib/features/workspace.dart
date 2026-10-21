import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart' as quill;
import 'package:pdfrx/pdfrx.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../data/draft.dart';
import '../data/editor_codec.dart';
import '../data/services.dart';
import '../ui/common.dart';

class StudyWorkspace extends StatefulWidget {
  final StudyStore store;
  final String id;
  final bool standalone;
  final bool keyboardOpen;
  final int initialPage;
  final void Function(String, int) openDocument;
  final VoidCallback onDeleted;
  const StudyWorkspace(
    this.store,
    this.id, {
    this.standalone = false,
    this.keyboardOpen = false,
    this.initialPage = 1,
    required this.openDocument,
    required this.onDeleted,
    super.key,
  });
  @override
  State<StudyWorkspace> createState() => _StudyWorkspaceState();
}

class _StudyWorkspaceState extends State<StudyWorkspace> {
  late Future<Uint8List?> bytes;
  final pdfController = PdfViewerController();
  // Keep the live editor and PDF selection when rotation reparents the panels.
  final readerKey = GlobalKey();
  final editorKey = GlobalKey();
  String? noteId;
  int page = 1, tab = 0;
  String quote = '';
  int quotePage = 1;
  double ratio = .52;
  @override
  void initState() {
    super.initState();
    page = widget.initialPage.clamp(
      1,
      (widget.store.find('documents', widget.id)?['pages'] as int?) ?? 1,
    );
    bytes = widget.standalone
        ? Future.value(null)
        : widget.store.pdfBytes(widget.id);
    final notes = widget.standalone
        ? [widget.store.find('notes', widget.id)].whereType<Json>().toList()
        : widget.store
              .rows('notes')
              .where((n) => n['documentId'] == widget.id)
              .toList();
    if (notes.isNotEmpty) noteId = notes.first['id'] as String;
  }

  Future<void> createNote() async {
    if (!await widget.store.flushEditors()) {
      if (mounted) notice(context, 'Save your edits before switching notes.');
      return;
    }
    final doc = widget.store.find('documents', widget.id);
    final note = newNoteRecord(doc);
    await widget.store.put('notes', note);
    if (mounted) {
      setState(() {
        noteId = note['id'] as String;
        tab = 1;
      });
    }
  }

  Json newNoteRecord(Json? doc) => newNote(
    documentId: widget.standalone ? '' : widget.id,
    title: doc == null ? 'Untitled note' : '${labelOf(doc)} — notes',
    courseId: doc?['courseId'] as String? ?? '',
  );
  @override
  Widget build(BuildContext context) {
    final doc = widget.store.find('documents', widget.id);
    final notes = widget.standalone
        ? widget.store
              .rows('notes')
              .where((n) => n['id'] == widget.id || (n['id'] == noteId))
              .toList()
        : widget.store
              .rows('notes')
              .where((n) => n['documentId'] == widget.id)
              .toList();
    final current = widget.store.find('notes', noteId ?? '');
    final typing = widget.keyboardOpen;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 14, 24, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!typing) ...[
            Text(
              widget.standalone
                  ? (current?['title']?.toString() ?? 'Notes')
                  : (doc?['title']?.toString() ?? 'Source unavailable'),
              style: Theme.of(context).textTheme.headlineMedium,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            const Text(
              'Read a little. Make sense of it in your own words.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
            const SizedBox(height: 16),
          ] else
            const SizedBox(height: 8),
          Expanded(
            child: LayoutBuilder(
              builder: (context, c) {
                final wide = c.maxWidth >= 850 && !widget.standalone;
                final reader = Panel(
                  key: readerKey,
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          IconButton(
                            tooltip: 'Previous page',
                            onPressed: page <= 1
                                ? null
                                : () => pdfController.goToPage(
                                    pageNumber: page - 1,
                                  ),
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('Page $page / ${doc?['pages'] ?? '—'}'),
                          IconButton(
                            tooltip: 'Next page',
                            onPressed: doc == null || page >= doc['pages']
                                ? null
                                : () => pdfController.goToPage(
                                    pageNumber: page + 1,
                                  ),
                            icon: const Icon(Icons.chevron_right),
                          ),
                          IconButton(
                            tooltip: 'Zoom out',
                            onPressed: () => pdfController.zoomDown(),
                            icon: const Icon(Icons.remove, size: 19),
                          ),
                          IconButton(
                            tooltip: 'Zoom in',
                            onPressed: () => pdfController.zoomUp(),
                            icon: const Icon(Icons.add, size: 19),
                          ),
                        ],
                      ),
                      Expanded(
                        child: FutureBuilder<Uint8List?>(
                          future: bytes,
                          builder: (context, s) {
                            if (s.hasError) {
                              return const Center(
                                child: Text(
                                  'The PDF could not be opened. Your notes are preserved.',
                                ),
                              );
                            }
                            if (s.connectionState != ConnectionState.done) {
                              return const Center(
                                child: CircularProgressIndicator(),
                              );
                            }
                            if (s.data == null) {
                              return const EmptyView(
                                Icons.description_outlined,
                                'Source unavailable',
                                'The PDF may have been deleted. Your notes remain available.',
                              );
                            }
                            return PdfViewer.data(
                              s.data!,
                              sourceName: widget.id,
                              controller: pdfController,
                              initialPageNumber: page,
                              params: PdfViewerParams(
                                backgroundColor: const Color(0xffe8ebe3),
                                onPageChanged: (v) {
                                  if (v == null) return;
                                  setState(() => page = v);
                                  final latest = widget.store.find(
                                    'documents',
                                    widget.id,
                                  );
                                  if (latest != null) {
                                    unawaited(
                                      widget.store
                                          .put('documents', {
                                            ...latest,
                                            'page': v,
                                            'lastOpened': nowMs(),
                                          })
                                          .catchError((Object e) {
                                            if (context.mounted) {
                                              notice(context, e);
                                            }
                                          }),
                                    );
                                  }
                                },
                                textSelectionParams: PdfTextSelectionParams(
                                  onTextSelectionChange: (selection) async {
                                    final text = selection.isCopyAllowed
                                        ? await selection.getSelectedText()
                                        : '';
                                    final ranges = selection.isCopyAllowed
                                        ? await selection
                                              .getSelectedTextRanges()
                                        : [];
                                    if (mounted) {
                                      setState(() {
                                        quote = text;
                                        quotePage = ranges.isEmpty
                                            ? page
                                            : ranges.first.pageNumber;
                                      });
                                    }
                                  },
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      if (quote.trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: FilledButton.tonalIcon(
                            onPressed: current == null
                                ? null
                                : () {
                                    setState(() => tab = 1);
                                    NoteEditorState.insertInto(
                                      noteId!,
                                      quote,
                                      widget.id,
                                      quotePage,
                                      labelOf(doc ?? {}),
                                    );
                                    setState(() => quote = '');
                                  },
                            icon: const Icon(Icons.format_quote),
                            label: Text('Add excerpt from p. $quotePage'),
                          ),
                        ),
                      if (current == null)
                        const Padding(
                          padding: EdgeInsets.all(12),
                          child: Text(
                            'Create a note to keep selected passages.',
                            style: TextStyle(color: muted, fontSize: 11),
                          ),
                        ),
                    ],
                  ),
                );
                final editor = Panel(
                  key: editorKey,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.edit_note, color: sage),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Your notes',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () => safely(context, createNote),
                            icon: const Icon(Icons.add, size: 17),
                            label: const Text('New'),
                          ),
                        ],
                      ),
                      if (notes.isNotEmpty)
                        DropdownButton<String>(
                          isExpanded: true,
                          value: notes.any((n) => n['id'] == noteId)
                              ? noteId
                              : null,
                          items: [
                            for (final n in notes)
                              DropdownMenuItem(
                                value: n['id'] as String,
                                child: Text(
                                  labelOf(n),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (id) => safely(context, () async {
                            if (!await widget.store.flushEditors()) {
                              throw StateError('Save your current note first.');
                            }
                            if (mounted) setState(() => noteId = id);
                          }),
                        ),
                      Expanded(
                        child: current == null
                            ? EmptyView(
                                Icons.edit_note,
                                'Make sense of what you read',
                                'Capture an idea, ask a question, or explain a concept.',
                                action: FilledButton(
                                  onPressed: () => safely(context, createNote),
                                  child: const Text('Create a note'),
                                ),
                              )
                            : NoteEditor(
                                widget.store,
                                current,
                                key: ValueKey(noteId),
                                openDocument: widget.openDocument,
                                onDeleted: widget.onDeleted,
                              ),
                      ),
                    ],
                  ),
                );
                if (widget.standalone) return editor;
                if (wide) {
                  return Column(
                    children: [
                      if (!typing)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            const Text(
                              'Reading / notes',
                              style: TextStyle(color: muted, fontSize: 10),
                            ),
                            SizedBox(
                              width: 150,
                              child: Slider(
                                value: ratio,
                                min: .35,
                                max: .65,
                                onChanged: (v) => setState(() => ratio = v),
                              ),
                            ),
                          ],
                        ),
                      Expanded(
                        child: Row(
                          children: [
                            Expanded(
                              flex: (ratio * 100).round(),
                              child: reader,
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              flex: 100 - (ratio * 100).round(),
                              child: editor,
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                }
                return Column(
                  children: [
                    SegmentedButton<int>(
                      segments: const [
                        ButtonSegment(
                          value: 0,
                          icon: Icon(Icons.menu_book_outlined),
                          label: Text('Reading'),
                        ),
                        ButtonSegment(
                          value: 1,
                          icon: Icon(Icons.edit_note),
                          label: Text('Notes'),
                        ),
                      ],
                      selected: {tab},
                      onSelectionChanged: (v) => setState(() => tab = v.first),
                    ),
                    const SizedBox(height: 14),
                    Expanded(
                      child: IndexedStack(
                        index: tab,
                        children: [reader, editor],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class NoteEditor extends StatefulWidget {
  final StudyStore store;
  final Json initial;
  final void Function(String, int) openDocument;
  final VoidCallback onDeleted;
  const NoteEditor(
    this.store,
    this.initial, {
    required this.openDocument,
    required this.onDeleted,
    super.key,
  });
  @override
  State<NoteEditor> createState() => NoteEditorState();
}

class NoteEditorState extends State<NoteEditor> {
  static final _open = <String, NoteEditorState>{};
  late DraftSaver draft;
  late quill.QuillController editor;
  late TextEditingController title;
  late StreamSubscription<dynamic> changes;
  static void insertInto(
    String id,
    String quote,
    String doc,
    int page,
    String name,
  ) {
    _open[id]?._insert(quote, doc, page, name);
  }

  @override
  void initState() {
    super.initState();
    draft = DraftSaver(widget.store, 'notes', widget.initial);
    title = TextEditingController(text: labelOf(widget.initial));
    editor = quill.QuillController(
      document: quill.Document.fromDelta(
        toDelta(widget.initial['content'] as Json),
      ),
      selection: const TextSelection.collapsed(offset: 0),
    );
    changes = editor.document.changes.listen((_) {
      draft.change({
        ...draft.value,
        'content': fromDelta(editor.document.toDelta()),
        'updated': nowMs(),
      });
    });
    _open[widget.initial['id'] as String] = this;
  }

  void _insert(String quote, String doc, int page, String name) {
    final offset = editor.document.length - 1;
    editor.replaceText(
      offset,
      0,
      '\n$quote\n$name · page $page\n',
      TextSelection.collapsed(offset: offset),
    );
    editor.formatText(offset + 1, quote.length, quill.Attribute.blockQuote);
    final start = offset + quote.length + 2;
    editor.formatText(
      start,
      '$name · page $page'.length,
      quill.LinkAttribute('/study/$doc?page=$page'),
    );
  }

  @override
  void dispose() {
    _open.remove(widget.initial['id']);
    changes.cancel();
    title.dispose();
    editor.dispose();
    draft.dispose();
    super.dispose();
  }

  Future<void> addToReviewer() async {
    final selection = editor.selection;
    if (selection.isCollapsed) {
      notice(context, 'Select note text to add to a reviewer.');
      return;
    }
    final text = editor.document.toPlainText().substring(
      selection.start,
      selection.end,
    );
    final reviewers = widget.store.rows('reviewers');
    if (reviewers.isEmpty) {
      notice(
        context,
        'Create a reviewer first, then return to your selected notes.',
      );
      return;
    }
    String id = reviewers.first['id'] as String;
    String target = '';
    final result = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: const Text('Add to a reviewer'),
          content: SizedBox(
            width: 450,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(text, maxLines: 6, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: id,
                    decoration: const InputDecoration(labelText: 'Reviewer'),
                    items: [
                      for (final r in reviewers)
                        DropdownMenuItem(
                          value: r['id'] as String,
                          child: Text(labelOf(r)),
                        ),
                    ],
                    onChanged: (v) => set(() {
                      id = v!;
                      target = '';
                    }),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    key: ValueKey(id),
                    initialValue: target,
                    decoration: const InputDecoration(
                      labelText: 'Destination field',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('New notes section'),
                      ),
                      for (final s
                          in (widget.store.find('reviewers', id)!['sections']
                              as List))
                        for (final f in (s['fields'] as Map).keys)
                          DropdownMenuItem(
                            value: '${s['id']}:$f',
                            child: Text('${s['kind']} — $f'),
                          ),
                    ],
                    onChanged: (v) => target = v!,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'This makes an independent copy.',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Copy to reviewer'),
            ),
          ],
        ),
      ),
    );
    if (result != true || !mounted) return;
    await safely(context, () async {
      final r = widget.store.find('reviewers', id)!;
      final sections = (r['sections'] as List).cast<Json>();
      final selectedContent = fromDelta(
        editor.document.toDelta().slice(selection.start, selection.end),
      );
      final refs = sourceReferences(selectedContent);
      for (final ref in refs) {
        ref['quote'] = text;
      }
      if (target.isEmpty) {
        final s = newSection('Free notes');
        s['fields']['Notes'] = text;
        s['refs'] = refs;
        sections.add(s);
      } else {
        final pos = target.indexOf(':');
        final s = sections.firstWhere(
          (s) => s['id'] == target.substring(0, pos),
        );
        final field = target.substring(pos + 1);
        s['fields'][field] = '${s['fields'][field]}\n\n$text'.trim();
        (s['refs'] as List).addAll(refs);
      }
      await widget.store.put('reviewers', {
        ...r,
        'sections': sections,
        'updated': nowMs(),
      });
      if (mounted) notice(context, 'Added to reviewer.');
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: draft,
    builder: (context, _) {
      final note = draft.value;
      return LayoutBuilder(
        builder: (context, c) {
          final compact = c.maxHeight < 300;
          return Column(
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Note title',
                  border: InputBorder.none,
                ),
                onChanged: (v) => draft.change({
                  ...draft.value,
                  'title': v,
                  'updated': nowMs(),
                }),
              ),
              if (note['documentId'] == null && !compact)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: CoursePicker(
                    widget.store,
                    value: note['courseId'] as String,
                    onChanged: (v) => draft.change({
                      ...draft.value,
                      'courseId': v,
                      'updated': nowMs(),
                    }),
                  ),
                ),
              Row(
                children: [
                  TextButton(
                    onPressed: draft.flush,
                    child: Text(
                      draft.status,
                      style: const TextStyle(fontSize: 11),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${editor.document.toPlainText().trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).length} words',
                    style: const TextStyle(color: muted, fontSize: 10),
                  ),
                ],
              ),
              if (!compact)
                SizedBox(
                  height: 48,
                  child: quill.QuillSimpleToolbar(
                    controller: editor,
                    config: const quill.QuillSimpleToolbarConfig(
                      multiRowsDisplay: false,
                      showFontFamily: false,
                      showFontSize: false,
                      showColorButton: false,
                      showBackgroundColorButton: false,
                      showSearchButton: false,
                      showClearFormat: false,
                      showSubscript: false,
                      showSuperscript: false,
                    ),
                  ),
                ),
              Expanded(
                key: const ValueKey('note-body'),
                child: quill.QuillEditor.basic(
                  controller: editor,
                  config: quill.QuillEditorConfig(
                    enableScribble: true,
                    padding: const EdgeInsets.symmetric(
                      vertical: 18,
                      horizontal: 6,
                    ),
                    placeholder: 'Explain it in your own words…',
                    onLaunchUrl: (url) {
                      final uri = Uri.tryParse(url);
                      if (uri?.pathSegments.length == 2 &&
                          uri!.pathSegments.first == 'study') {
                        widget.openDocument(
                          uri.pathSegments[1],
                          int.tryParse(uri.queryParameters['page'] ?? '1') ?? 1,
                        );
                      }
                    },
                  ),
                ),
              ),
              if (!compact)
                Wrap(
                  spacing: 4,
                  children: [
                    TextButton.icon(
                      onPressed: () => safely(context, addToReviewer),
                      icon: const Icon(Icons.auto_stories_outlined, size: 17),
                      label: const Text(
                        'Add selection to reviewer',
                        style: TextStyle(fontSize: 11),
                      ),
                    ),
                    TextButton(
                      onPressed: () => safely(
                        context,
                        () => printContent(labelOf(note), [
                          editor.document.toPlainText(),
                        ]),
                      ),
                      child: const Text(
                        'Export PDF',
                        style: TextStyle(fontSize: 11),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Delete note',
                      onPressed: () => safely(context, () async {
                        if (await confirm(
                          context,
                          'Delete this note?',
                          'The source PDF is preserved.',
                        )) {
                          if (!await draft.flush()) return;
                          await widget.store.delete(
                            'notes',
                            note['id'] as String,
                          );
                          widget.onDeleted();
                        }
                      }),
                      icon: const Icon(Icons.delete_outline, size: 19),
                    ),
                  ],
                ),
            ],
          );
        },
      );
    },
  );
}
