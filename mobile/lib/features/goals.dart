import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../ui/common.dart';

class GoalsPage extends StatefulWidget {
  final StudyStore store;
  final ValueChanged<String> focusGoal;
  final void Function(String, int) openDocument;
  final ValueChanged<String> openReviewer;
  const GoalsPage(
    this.store, {
    required this.focusGoal,
    required this.openDocument,
    required this.openReviewer,
    super.key,
  });
  @override
  State<GoalsPage> createState() => _GoalsPageState();
}

class _GoalsPageState extends State<GoalsPage> {
  final title = TextEditingController(), criterion = TextEditingController();
  String course = '';
  final materials = <String>{};
  @override
  void dispose() {
    title.dispose();
    criterion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final goals = widget.store.rows('goals').reversed.toList();
    return ListView(
      padding: const EdgeInsets.all(30),
      children: [
        const Heading(
          'Progress with purpose',
          'Small goals. Meaningful progress.',
          'Decide what finished looks like before you begin.',
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'What will you work toward?',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 20),
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Study goal',
                  hintText: 'Compare two models of memory',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: criterion,
                decoration: const InputDecoration(
                  labelText: 'Finished looks like…',
                  hintText: 'Complete the comparison section in my reviewer',
                ),
              ),
              const SizedBox(height: 16),
              CoursePicker(
                widget.store,
                value: course,
                onChanged: (v) => setState(() => course = v),
              ),
              const SizedBox(height: 16),
              const Text(
                'Linked materials',
                style: TextStyle(color: muted, fontSize: 12),
              ),
              Wrap(
                spacing: 8,
                children: [
                  for (final d
                      in widget.store
                          .rows('documents')
                          .where(
                            (d) => course.isEmpty || d['courseId'] == course,
                          ))
                    FilterChip(
                      label: Text(labelOf(d)),
                      selected: materials.contains(d['id']),
                      onSelected: (v) => setState(
                        () => v
                            ? materials.add(d['id'] as String)
                            : materials.remove(d['id']),
                      ),
                    ),
                  for (final r
                      in widget.store
                          .rows('reviewers')
                          .where(
                            (r) => course.isEmpty || r['courseId'] == course,
                          ))
                    FilterChip(
                      label: Text('Reviewer: ${labelOf(r)}'),
                      selected: materials.contains('reviewer:${r['id']}'),
                      onSelected: (v) => setState(
                        () => v
                            ? materials.add('reviewer:${r['id']}')
                            : materials.remove('reviewer:${r['id']}'),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () => safely(context, () async {
                  if (title.text.trim().isEmpty ||
                      criterion.text.trim().isEmpty) {
                    notice(
                      context,
                      'Add a goal and a clear completion criterion.',
                    );
                    return;
                  }
                  await widget.store.put('goals', {
                    'id': newId(),
                    'title': title.text.trim(),
                    'criterion': criterion.text.trim(),
                    'courseId': course,
                    'materialIds': materials.toList(),
                    'done': false,
                    'created': nowMs(),
                  });
                  title.clear();
                  criterion.clear();
                  setState(materials.clear);
                }),
                icon: const Icon(Icons.add),
                label: const Text('Create goal'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 30),
        Text('Your goals', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        for (final g in goals)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Checkbox(
                        value: g['done'] as bool,
                        onChanged: (v) => safely(
                          context,
                          () => widget.store.put('goals', {
                            ...g,
                            'done': v,
                            'completed': v == true ? nowMs() : null,
                          }),
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              labelOf(g),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              g['criterion'] as String,
                              style: const TextStyle(
                                color: muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (g['done'] != true)
                        OutlinedButton(
                          onPressed: () => widget.focusGoal(g['id'] as String),
                          child: const Text('Focus'),
                        ),
                    ],
                  ),
                  Wrap(
                    children: [
                      for (final id
                          in (g['materialIds'] as List).cast<String>())
                        TextButton.icon(
                          onPressed: () => id.startsWith('reviewer:')
                              ? widget.openReviewer(id.substring(9))
                              : widget.openDocument(id, 1),
                          icon: const Icon(Icons.open_in_new, size: 15),
                          label: Text(
                            id.startsWith('reviewer:')
                                ? (widget.store
                                          .find(
                                            'reviewers',
                                            id.substring(9),
                                          )?['title']
                                          ?.toString() ??
                                      'Reviewer unavailable')
                                : (widget.store
                                          .find('documents', id)?['title']
                                          ?.toString() ??
                                      'Source unavailable'),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        if (goals.isEmpty)
          const Text(
            'Your first small step starts above.',
            style: TextStyle(color: muted),
          ),
        const SizedBox(height: 28),
        Text('Focus history', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        for (final s in widget.store.rows('sessions').reversed)
          ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 10),
            leading: const Icon(Icons.timer_outlined, color: sage),
            title: Text(
              widget.store.find('goals', s['goalId'] as String)?['title']
                      as String? ??
                  'Independent focus session',
            ),
            subtitle: Text(
              '${((s['duration'] as num) / 60).round()} focused minutes · ${s['outcome']}\n${DateTime.fromMillisecondsSinceEpoch((s['started'] as num).toInt()).toLocal()}\n${s['note']}',
            ),
          ),
        if (widget.store.rows('sessions').isEmpty)
          const Text(
            'Your completed sessions will appear here.',
            style: TextStyle(color: muted),
          ),
      ],
    );
  }
}
