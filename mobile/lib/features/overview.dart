import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../ui/common.dart';

class OverviewPage extends StatelessWidget {
  final StudyStore store;
  final void Function(int) onNavigate;
  final void Function(String, int) openDocument;
  final ValueChanged<String> openReviewer;
  final ValueChanged<String> focusGoal;
  const OverviewPage(
    this.store, {
    required this.onNavigate,
    required this.openDocument,
    required this.openReviewer,
    required this.focusGoal,
    super.key,
  });
  @override
  Widget build(BuildContext context) {
    final docs = store.rows('documents').toList()
      ..sort(
        (a, b) => (b['lastOpened'] ?? b['created']).compareTo(
          a['lastOpened'] ?? a['created'],
        ),
      );
    final reviewers = store.rows('reviewers').toList()
      ..sort((a, b) => b['updated'].compareTo(a['updated']));
    final goals = store.rows('goals').where((g) => g['done'] != true).toList();
    return ListView(
      padding: const EdgeInsets.all(30),
      children: [
        const Heading(
          'A little progress, every day',
          'Make room for understanding.',
          'Your notes, your materials, your next small step.',
        ),
        Panel(
          color: const Color(0xffe6eedf),
          child: LayoutBuilder(
            builder: (context, c) => Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'STUDY WITH INTENTION',
                        style: TextStyle(
                          fontSize: 10,
                          letterSpacing: 2,
                          color: sage,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'One clear goal.\nOne focused session.',
                        style: Theme.of(context).textTheme.headlineLarge,
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'You don’t have to learn everything today.\nStart with something you can finish.',
                        style: TextStyle(color: muted),
                      ),
                      const SizedBox(height: 22),
                      FilledButton.icon(
                        onPressed: () => onNavigate(3),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Set a study goal'),
                      ),
                    ],
                  ),
                ),
                if (c.maxWidth > 570)
                  const SizedBox(
                    width: 220,
                    height: 230,
                    child: CustomPaint(painter: BooksPainter()),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        LayoutBuilder(
          builder: (context, c) {
            final cards = [
              _stat(
                Icons.library_books_outlined,
                '${docs.length}',
                'Saved materials',
              ),
              _stat(
                Icons.edit_note,
                '${store.rows('notes').length}',
                'Ideas captured',
              ),
              _stat(
                Icons.task_alt,
                '${store.rows('goals').where((g) => g['done'] == true).length}',
                'Goals completed',
              ),
            ];
            return Wrap(
              spacing: 14,
              runSpacing: 14,
              children: [
                for (final card in cards)
                  SizedBox(
                    width: c.maxWidth > 550
                        ? (c.maxWidth - 28) / 3
                        : c.maxWidth,
                    child: card,
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 32),
        _title(context, 'Your next small steps', () => onNavigate(3)),
        const SizedBox(height: 12),
        if (goals.isEmpty)
          const EmptyView(
            Icons.flag_outlined,
            'Give your session a purpose',
            'Choose a topic and describe what “finished” looks like.',
          ),
        for (final g in goals.take(3))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Panel(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.radio_button_unchecked, color: muted),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          g['title'] as String,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          g['criterion'] as String,
                          style: const TextStyle(color: muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () => focusGoal(g['id'] as String),
                    child: const Text('Focus'),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 24),
        _title(context, 'Pick up where you left off', () => onNavigate(1)),
        const SizedBox(height: 12),
        if (docs.isEmpty)
          const EmptyView(
            Icons.menu_book_outlined,
            'Your reading starts here',
            'Bring lecture slides and readings into your library.',
          ),
        for (final d in docs.take(3))
          Card(
            elevation: 0,
            color: Colors.white,
            child: ListTile(
              contentPadding: const EdgeInsets.all(14),
              leading: const Icon(Icons.description_outlined, color: sage),
              title: Text(labelOf(d)),
              subtitle: Text(
                '${store.courseName(d['courseId'] as String?)} · Page ${d['page']} of ${d['pages']}',
              ),
              trailing: const Icon(Icons.north_east, size: 19),
              onTap: () => openDocument(d['id'] as String, d['page'] as int),
            ),
          ),
        const SizedBox(height: 24),
        _title(context, 'Made for future you', () => onNavigate(2)),
        const SizedBox(height: 12),
        if (reviewers.isEmpty)
          const EmptyView(
            Icons.auto_stories_outlined,
            'Understanding, in your words',
            'Build a reviewer one concept at a time.',
          ),
        for (final r in reviewers.take(3))
          ListTile(
            leading: const Icon(Icons.auto_stories_outlined, color: sage),
            title: Text(labelOf(r)),
            subtitle: Text('${(r['sections'] as List).length} sections'),
            onTap: () => openReviewer(r['id'] as String),
          ),
        const SizedBox(height: 30),
      ],
    );
  }

  Widget _stat(IconData icon, String value, String label) => Panel(
    padding: const EdgeInsets.all(18),
    child: Row(
      children: [
        Icon(icon, color: sage),
        const SizedBox(width: 15),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(label, style: const TextStyle(fontSize: 11, color: muted)),
            ],
          ),
        ),
      ],
    ),
  );
  Widget _title(BuildContext context, String title, VoidCallback more) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
      ),
      TextButton(
        onPressed: more,
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('View all'),
            SizedBox(width: 5),
            Icon(Icons.north_east, size: 14),
          ],
        ),
      ),
    ],
  );
}

class BooksPainter extends CustomPainter {
  const BooksPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      98,
      paint..color = const Color(0xffdbe5d1),
    );
    canvas.save();
    canvas.translate(35, 35);
    canvas.rotate(-.12);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, 0, 135, 170),
        const Radius.circular(7),
      ),
      paint..color = const Color(0xffa4b498),
    );
    canvas.restore();
    canvas.save();
    canvas.translate(70, 30);
    canvas.rotate(.12);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, 0, 130, 170),
        const Radius.circular(7),
      ),
      paint..color = const Color(0xfffffcf0),
    );
    canvas.drawLine(
      const Offset(20, 100),
      const Offset(108, 100),
      paint
        ..color = const Color(0xffd6deca)
        ..strokeWidth = 3,
    );
    canvas.drawLine(const Offset(20, 115), const Offset(90, 115), paint);
    canvas.drawLine(const Offset(20, 130), const Offset(100, 130), paint);
    final text = TextPainter(
      text: const TextSpan(
        text: 'small steps,\ndeeper\nunderstanding.',
        style: TextStyle(
          color: sage,
          fontSize: 15,
          height: 1.35,
          fontFamily: 'StudySans',
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: 110);
    text.paint(canvas, const Offset(16, 20));
    canvas.restore();
  }

  @override
  bool shouldRepaint(BooksPainter oldDelegate) => false;
}
