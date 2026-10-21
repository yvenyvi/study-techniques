import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../data/services.dart';
import '../ui/common.dart';

class LibraryPage extends StatefulWidget {
  final StudyStore store;
  final void Function(String, int) openDocument;
  final ValueChanged<String> openNote;
  const LibraryPage(
    this.store, {
    required this.openDocument,
    required this.openNote,
    super.key,
  });
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  String query = '', course = '';
  bool busy = false;
  Future<void> import() async {
    setState(() => busy = true);
    await safely(context, () async {
      final id = await pickPdf(widget.store, courseId: course);
      if (id != null && mounted) widget.openDocument(id, 1);
    });
    if (mounted) setState(() => busy = false);
  }

  Future<void> addCourse() async {
    final name = TextEditingController(), description = TextEditingController();
    final create = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Create a course'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(
                  labelText: 'Course name',
                  hintText: 'Cognitive Psychology',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: description,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                name.text.trim().isEmpty ? null : Navigator.pop(c, true),
            child: const Text('Create course'),
          ),
        ],
      ),
    );
    if (create == true && mounted) {
      await safely(
        context,
        () => widget.store.put('courses', {
          'id': newId(),
          'name': name.text.trim(),
          'description': description.text.trim(),
          'color': '#688975',
        }),
      );
    }
    name.dispose();
    description.dispose();
  }

  Future<void> editDocument(Json d) async {
    final title = TextEditingController(text: labelOf(d)),
        tags = TextEditingController(text: d['tags'] as String);
    var selected = d['courseId'] as String;
    final save = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Document details'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              const SizedBox(height: 16),
              CoursePicker(
                widget.store,
                value: selected,
                onChanged: (v) => selected = v,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: tags,
                decoration: const InputDecoration(labelText: 'Topic tags'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (save == true && mounted) {
      await safely(
        context,
        () => widget.store.put('documents', {
          ...d,
          'title': title.text.trim(),
          'tags': tags.text,
          'courseId': selected,
        }),
      );
    }
    title.dispose();
    tags.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final docs = store
        .rows('documents')
        .where(
          (d) =>
              (course.isEmpty || d['courseId'] == course) &&
              '${d['title']} ${d['tags']}'.toLowerCase().contains(
                query.toLowerCase(),
              ),
        )
        .toList();
    final notes = store
        .rows('notes')
        .where(
          (n) =>
              (course.isEmpty || n['courseId'] == course) &&
              '${n['title']} ${searchable(n['content'])}'
                  .toLowerCase()
                  .contains(query.toLowerCase()),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.all(30),
      children: [
        Heading(
          'Collect · organize · explore',
          'Your study library',
          'A home for your readings, lecture slides, and ideas.',
          action: FilledButton.icon(
            onPressed: busy ? null : import,
            icon: const Icon(Icons.file_upload_outlined),
            label: Text(busy ? 'Importing…' : 'Import PDF'),
          ),
        ),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            OutlinedButton.icon(
              onPressed: addCourse,
              icon: const Icon(Icons.add),
              label: const Text('New course'),
            ),
            for (final c in store.rows('courses'))
              InputChip(
                label: Text(c['name'] as String),
                selected: course == c['id'],
                onPressed: () => setState(
                  () => course = course == c['id'] ? '' : c['id'] as String,
                ),
                onDeleted: () => safely(context, () async {
                  if (await confirm(
                    context,
                    'Delete this course?',
                    'Its materials and notes move to Unfiled.',
                  )) {
                    await store.delete('courses', c['id'] as String);
                    if (mounted) setState(() => course = '');
                  }
                }),
              ),
          ],
        ),
        if (course.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(
            store.find('courses', course)?['description'] as String? ?? '',
            style: const TextStyle(color: muted),
          ),
        ],
        const SizedBox(height: 24),
        TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Search titles, tags, and note content',
            labelText: 'Search library',
          ),
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 24),
        if (docs.isEmpty)
          EmptyView(
            Icons.folder_open_outlined,
            'Make space for your materials',
            'PDFs stay on this iPad. Import a reading to start taking notes.',
            action: TextButton(
              onPressed: busy ? null : import,
              child: const Text('Import your first PDF'),
            ),
          ),
        LayoutBuilder(
          builder: (context, c) {
            final count = c.maxWidth > 900
                ? 3
                : c.maxWidth > 530
                ? 2
                : 1;
            final width = (c.maxWidth - (count - 1) * 18) / count;
            return Wrap(
              spacing: 18,
              runSpacing: 18,
              children: [
                for (var i = 0; i < docs.length; i++)
                  SizedBox(
                    width: width,
                    child: Panel(
                      padding: EdgeInsets.zero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          InkWell(
                            onTap: () => widget.openDocument(
                              docs[i]['id'] as String,
                              docs[i]['page'] as int,
                            ),
                            child: Container(
                              height: 150,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: [
                                  const Color(0xffe7eddf),
                                  const Color(0xffede6f1),
                                  const Color(0xfff3ecda),
                                ][i % 3],
                                borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(18),
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    Icons.description_outlined,
                                    size: 42,
                                    color: sage,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    '${docs[i]['pages']} PAGES',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      letterSpacing: 1.7,
                                      color: muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 16, 12, 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                InkWell(
                                  onTap: () => widget.openDocument(
                                    docs[i]['id'] as String,
                                    docs[i]['page'] as int,
                                  ),
                                  child: Text(
                                    labelOf(docs[i]),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Text(
                                  store.courseName(
                                    docs[i]['courseId'] as String,
                                  ),
                                  style: const TextStyle(
                                    color: muted,
                                    fontSize: 12,
                                  ),
                                ),
                                if ((docs[i]['tags'] as String).isNotEmpty)
                                  Text(
                                    docs[i]['tags'] as String,
                                    style: const TextStyle(
                                      color: muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                Row(
                                  children: [
                                    TextButton(
                                      onPressed: () => editDocument(docs[i]),
                                      child: const Text('Edit details'),
                                    ),
                                    const Spacer(),
                                    IconButton(
                                      tooltip: 'Delete PDF',
                                      onPressed: () =>
                                          safely(context, () async {
                                            if (await confirm(
                                              context,
                                              'Delete this PDF?',
                                              'Your notes and reviewers are preserved.',
                                            )) {
                                              await store.delete(
                                                'documents',
                                                docs[i]['id'] as String,
                                              );
                                            }
                                          }),
                                      icon: const Icon(
                                        Icons.delete_outline,
                                        size: 20,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 30),
        Row(
          children: [
            Expanded(
              child: Text(
                'Your notes',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            TextButton.icon(
              onPressed: () => safely(context, () async {
                final n = newNote(courseId: course);
                await store.put('notes', n);
                widget.openNote(n['id'] as String);
              }),
              icon: const Icon(Icons.add),
              label: const Text('New note'),
            ),
          ],
        ),
        for (final n in notes)
          ListTile(
            leading: const Icon(Icons.edit_note, color: sage),
            title: Text(labelOf(n)),
            subtitle: Text(store.courseName(n['courseId'] as String)),
            trailing: const Icon(Icons.north_east, size: 18),
            onTap: () => widget.openNote(n['id'] as String),
          ),
        const SizedBox(height: 30),
      ],
    );
  }
}
