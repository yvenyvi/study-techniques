import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../data/draft.dart';
import '../data/services.dart';
import '../ui/common.dart';

class ReviewersPage extends StatefulWidget {
  final StudyStore store;
  final ValueChanged<String> onOpen;
  const ReviewersPage(this.store, this.onOpen, {super.key});
  @override
  State<ReviewersPage> createState() => _ReviewersPageState();
}

class _ReviewersPageState extends State<ReviewersPage> {
  String query = '', course = '';
  @override
  Widget build(BuildContext context) {
    final rows = widget.store
        .rows('reviewers')
        .where(
          (r) =>
              (course.isEmpty || r['courseId'] == course) &&
              '${r['title']} ${r['tags']} ${(r['sections'] as List).map((s) => (s['fields'] as Map).values.join(' ')).join(' ')}'
                  .toLowerCase()
                  .contains(query.toLowerCase()),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.all(30),
      children: [
        Heading(
          'Connect · understand · remember',
          'In your own words.',
          'Turn your notes into something you can return to.',
          action: FilledButton.icon(
            onPressed: () => safely(context, () async {
              final id = newId();
              await widget.store.put('reviewers', {
                'id': id,
                'title': 'Untitled reviewer',
                'courseId': course,
                'tags': '',
                'sections': <Json>[],
                'updated': nowMs(),
              });
              widget.onOpen(id);
            }),
            icon: const Icon(Icons.add),
            label: const Text('New reviewer'),
          ),
        ),
        TextField(
          decoration: const InputDecoration(
            labelText: 'Search reviewers',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 16),
        CoursePicker(
          widget.store,
          value: course,
          onChanged: (v) => setState(() => course = v),
          filter: true,
        ),
        const SizedBox(height: 24),
        if (rows.isEmpty)
          const EmptyView(
            Icons.auto_stories_outlined,
            'Understanding deserves a home',
            'Start with a concept, theory comparison, or research summary.',
          ),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Panel(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.auto_stories_outlined,
                  color: sage,
                  size: 32,
                ),
                title: Text(
                  labelOf(r),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${widget.store.courseName(r['courseId'] as String)} · ${(r['sections'] as List).length} sections\n${r['tags']}',
                ),
                trailing: const Icon(Icons.north_east),
                onTap: () => widget.onOpen(r['id'] as String),
              ),
            ),
          ),
      ],
    );
  }
}

class ReviewerEditor extends StatefulWidget {
  final StudyStore store;
  final String id;
  final VoidCallback onDeleted;
  final void Function(String, int) openDocument;
  const ReviewerEditor(
    this.store,
    this.id, {
    required this.onDeleted,
    required this.openDocument,
    super.key,
  });
  @override
  State<ReviewerEditor> createState() => _ReviewerEditorState();
}

class _ReviewerEditorState extends State<ReviewerEditor> {
  late DraftSaver draft;
  bool practice = false;
  final revealed = <String>{};
  @override
  void initState() {
    super.initState();
    draft = DraftSaver(
      widget.store,
      'reviewers',
      widget.store.find('reviewers', widget.id)!,
    );
  }

  @override
  void dispose() {
    draft.dispose();
    super.dispose();
  }

  void change(Json value) {
    value['updated'] = nowMs();
    draft.change(value);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: draft,
    builder: (context, _) {
      final r = draft.value;
      final sections = (r['sections'] as List).cast<Json>();
      return ListView(
        padding: const EdgeInsets.all(30),
        children: [
          Heading(
            'Your personal reviewer',
            practice ? labelOf(r) : 'Build your understanding',
            'Write it simply. Connect it to what you know.',
            action: Wrap(
              spacing: 8,
              children: [
                OutlinedButton(
                  onPressed: () => setState(() {
                    practice = !practice;
                    revealed.clear();
                  }),
                  child: Text(practice ? 'Edit reviewer' : 'Practice'),
                ),
                OutlinedButton.icon(
                  onPressed: () => safely(
                    context,
                    () => printContent(labelOf(r), [
                      for (final s in sections)
                        '${s['kind']}\n${(s['fields'] as Map).entries.map((e) => '${e.key}\n${e.value}').join('\n\n')}\n${(s['refs'] as List).map((ref) => '${widget.store.find('documents', ref['documentId'])?['title'] ?? 'Source unavailable'} · p. ${ref['page']}\n${ref['quote']}').join('\n')}',
                    ]),
                  ),
                  icon: const Icon(Icons.ios_share, size: 18),
                  label: const Text('Export PDF'),
                ),
              ],
            ),
          ),
          if (!practice) ...[
            TextFormField(
              initialValue: r['title'] as String,
              decoration: const InputDecoration(labelText: 'Reviewer title'),
              onChanged: (v) => change({...r, 'title': v}),
            ),
            const SizedBox(height: 14),
            CoursePicker(
              widget.store,
              value: r['courseId'] as String,
              onChanged: (v) => change({...r, 'courseId': v}),
            ),
            const SizedBox(height: 14),
            TextFormField(
              initialValue: r['tags'] as String,
              decoration: const InputDecoration(labelText: 'Topic tags'),
              onChanged: (v) => change({...r, 'tags': v}),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: draft.flush,
                child: Text(draft.status),
              ),
            ),
          ],
          for (final s in sections)
            Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            (s['kind'] as String).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              letterSpacing: 1.4,
                              color: muted,
                            ),
                          ),
                        ),
                        if (!practice)
                          IconButton(
                            tooltip: 'Remove section',
                            onPressed: () => change({
                              ...r,
                              'sections': sections
                                  .where((x) => x['id'] != s['id'])
                                  .toList(),
                            }),
                            icon: const Icon(Icons.delete_outline, size: 20),
                          ),
                      ],
                    ),
                    for (final entry in (s['fields'] as Map).entries)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: practice
                            ? Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    entry.key as String,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  if (entry.key == 'Answer' &&
                                      !revealed.contains(s['id']))
                                    OutlinedButton(
                                      onPressed: () => setState(
                                        () => revealed.add(s['id'] as String),
                                      ),
                                      child: const Text('Reveal answer'),
                                    )
                                  else
                                    SelectableText(
                                      (entry.value as String).isEmpty
                                          ? 'Not filled in yet.'
                                          : entry.value as String,
                                    ),
                                ],
                              )
                            : TextFormField(
                                key: ValueKey('${s['id']}:${entry.key}'),
                                initialValue: entry.value as String,
                                minLines: 2,
                                maxLines: null,
                                decoration: InputDecoration(
                                  labelText: entry.key as String,
                                  alignLabelWithHint: true,
                                ),
                                onChanged: (v) {
                                  final next = clone(r);
                                  final target = (next['sections'] as List)
                                      .firstWhere((x) => x['id'] == s['id']);
                                  target['fields'][entry.key] = v;
                                  change(next);
                                },
                              ),
                      ),
                    for (final ref in (s['refs'] as List).cast<Json>()) ...[
                      const SizedBox(height: 12),
                      if ((ref['quote'] as String).isNotEmpty)
                        Text(
                          '“${ref['quote']}”',
                          style: const TextStyle(
                            color: muted,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      SourceLink(widget.store, ref, widget.openDocument),
                    ],
                  ],
                ),
              ),
            ),
          if (!practice) ...[
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Add a section',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final kind in templates.keys)
                        OutlinedButton.icon(
                          onPressed: () => change({
                            ...r,
                            'sections': [...sections, newSection(kind)],
                          }),
                          icon: const Icon(Icons.add, size: 18),
                          label: Text(kind),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => safely(context, () async {
                  if (await confirm(
                    context,
                    'Delete this reviewer?',
                    'This removes the reviewer from this iPad.',
                  )) {
                    if (!await draft.flush()) return;
                    await widget.store.delete('reviewers', widget.id);
                    widget.onDeleted();
                  }
                }),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete reviewer'),
              ),
            ),
          ],
          const SizedBox(height: 30),
        ],
      );
    },
  );
}
