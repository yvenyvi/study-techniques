import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/models.dart';
import '../data/store.dart';
import '../data/focus.dart';
import '../ui/common.dart';
import 'overview.dart';
import 'library.dart';
import 'reviewers.dart';
import 'goals.dart';
import 'settings.dart';
import 'workspace.dart';

class StudyShell extends StatefulWidget {
  final StudyStore store;
  const StudyShell({required this.store, super.key});
  @override
  State<StudyShell> createState() => _StudyShellState();
}

class _StudyShellState extends State<StudyShell> with WidgetsBindingObserver {
  late FocusController focus;
  int selected = 0;
  Json? detail;
  bool expanded = false, reflectionOpen = false;
  String alerted = '';
  static const labels = [
    'Overview',
    'Library',
    'Reviewers',
    'Goals & history',
    'Settings',
  ];
  static const icons = [
    Icons.grid_view_outlined,
    Icons.library_books_outlined,
    Icons.auto_stories_outlined,
    Icons.flag_outlined,
    Icons.tune,
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    focus = FocusController(widget.store)..addListener(focusChanged);
    unawaited(focus.reconcile());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    focus.removeListener(focusChanged);
    focus.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(focus.reconcile());
    } else {
      unawaited(widget.store.flushEditors());
    }
  }

  void focusChanged() {
    if (!mounted || !focus.needsReflection || reflectionOpen) return;
    final token = '${focus.value['started']}';
    if (alerted != token) {
      alerted = token;
      if (focus.preferences['sound'] == true) {
        unawaited(SystemSound.play(SystemSoundType.alert));
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !reflectionOpen) unawaited(reflect());
    });
  }

  Future<bool> flush() async {
    final saved = await widget.store.flushEditors();
    if (!saved && mounted) {
      notice(context, 'Your edits could not be saved. Retry before leaving.');
    }
    return saved;
  }

  Future<void> navigate(int index) async {
    if (!await flush() || !mounted) return;
    setState(() {
      selected = index;
      detail = null;
    });
  }

  Future<void> open(String kind, String id, [int page = 1]) async {
    if (!await flush() || !mounted) return;
    if (kind == 'reviewer' && widget.store.find('reviewers', id) == null) {
      notice(context, 'Reviewer unavailable.');
      return;
    }
    setState(() => detail = {'kind': kind, 'id': id, 'page': page});
  }

  void openDoc(String id, int page) => unawaited(open('document', id, page));
  void openReviewer(String id) => unawaited(open('reviewer', id));
  Future<void> focusGoal(String id) async {
    await safely(context, () async {
      await focus.chooseGoal(id);
      if (mounted) setState(() => expanded = true);
    });
  }

  Future<void> reflect() async {
    if (reflectionOpen) return;
    reflectionOpen = true;
    try {
      await focus.pause();
    } catch (_) {
      reflectionOpen = false;
      rethrow;
    }
    if (!mounted) return;
    final note = TextEditingController();
    var complete = false, saving = false;
    final goal = widget.store.find('goals', focus.value['goalId'] as String);
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: const Text('What did you move forward?'),
          content: SizedBox(
            width: 460,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'A MOMENT TO REFLECT',
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 2,
                      color: muted,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    goal?['criterion']?.toString() ??
                        'Save a short reflection before your next step.',
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: note,
                    minLines: 3,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Progress note',
                      hintText: 'What did you understand? What comes next?',
                    ),
                  ),
                  if (goal != null)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'I finished my goal’s completion criterion',
                        style: TextStyle(fontSize: 13),
                      ),
                      value: complete,
                      onChanged: saving
                          ? null
                          : (v) => set(() => complete = v == true),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      set(() => saving = true);
                      try {
                        await focus.finish(
                          completed: complete,
                          note: note.text,
                        );
                        if (c.mounted) Navigator.pop(c);
                      } catch (e) {
                        if (c.mounted) {
                          notice(c, e);
                          set(() => saving = false);
                        }
                      }
                    },
              child: Text(saving ? 'Saving…' : 'Save session & prepare break'),
            ),
          ],
        ),
      ),
    );
    note.dispose();
    reflectionOpen = false;
  }

  Widget content() {
    final s = widget.store;
    if (detail != null) {
      final d = detail!;
      if (d['kind'] == 'reviewer') {
        return ReviewerEditor(
          s,
          d['id'] as String,
          key: ValueKey('reviewer-${d['id']}'),
          onDeleted: () => navigate(2),
          openDocument: openDoc,
        );
      }
      return StudyWorkspace(
        s,
        d['id'] as String,
        key: ValueKey('${d['kind']}-${d['id']}-${d['page']}'),
        standalone: d['kind'] == 'note',
        keyboardOpen: MediaQuery.viewInsetsOf(context).bottom > 0,
        initialPage: d['page'] as int,
        openDocument: openDoc,
        onDeleted: () => navigate(1),
      );
    }
    switch (selected) {
      case 1:
        return LibraryPage(
          s,
          openDocument: openDoc,
          openNote: (id) => unawaited(open('note', id)),
        );
      case 2:
        return ReviewersPage(s, openReviewer);
      case 3:
        return GoalsPage(
          s,
          focusGoal: (id) => unawaited(focusGoal(id)),
          openDocument: openDoc,
          openReviewer: openReviewer,
        );
      case 4:
        return SettingsPage(s);
      default:
        return OverviewPage(
          s,
          onNavigate: (i) => unawaited(navigate(i)),
          openDocument: openDoc,
          openReviewer: openReviewer,
          focusGoal: (id) => unawaited(focusGoal(id)),
        );
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([widget.store, focus]),
    builder: (context, _) => LayoutBuilder(
      builder: (context, c) {
        final wide = c.maxWidth >= 1150, rail = c.maxWidth >= 700;
        final availableHeight =
            c.maxHeight - MediaQuery.viewInsetsOf(context).bottom;
        return PopScope(
          canPop: detail == null,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop) unawaited(navigate(selected));
          },
          child: Scaffold(
            bottomNavigationBar: rail
                ? null
                : NavigationBar(
                    selectedIndex: selected,
                    onDestinationSelected: (v) => unawaited(navigate(v)),
                    destinations: [
                      for (var i = 0; i < labels.length; i++)
                        NavigationDestination(
                          icon: Icon(icons[i]),
                          label: i == 3 ? 'Goals' : labels[i],
                        ),
                    ],
                  ),
            body: SafeArea(
              child: Row(
                children: [
                  if (rail)
                    _sidebar(
                      wide && availableHeight >= 650,
                      compactHeight: availableHeight < 600,
                    ),
                  Expanded(
                    child: Column(
                      children: [
                        Container(
                          height: 62,
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: Color(0xffe3e7dc)),
                            ),
                          ),
                          child: Row(
                            children: [
                              if (detail != null)
                                IconButton(
                                  tooltip: 'Back to workspace',
                                  onPressed: () => navigate(selected),
                                  icon: const Icon(Icons.arrow_back, size: 20),
                                ),
                              Expanded(
                                child: Text(
                                  detail != null
                                      ? 'YOUR STUDY SPACE'
                                      : rail
                                      ? 'YOUR SPACE TO LEARN, AT YOUR PACE'
                                      : 'study room.',
                                  style: TextStyle(
                                    fontSize: rail ? 9 : 19,
                                    letterSpacing: rail ? 1.7 : -.5,
                                    fontWeight: rail
                                        ? FontWeight.w500
                                        : FontWeight.w700,
                                    color: rail ? muted : sage,
                                  ),
                                ),
                              ),
                              const Icon(
                                Icons.offline_pin_outlined,
                                size: 16,
                                color: sage,
                              ),
                              if (c.maxWidth > 450) ...[
                                const SizedBox(width: 8),
                                const Text(
                                  'Stored on this iPad',
                                  style: TextStyle(color: muted, fontSize: 11),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Expanded(child: content()),
                        _dock(context),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  );

  Widget _sidebar(bool wide, {bool compactHeight = false}) {
    final items = <Widget>[
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: sage,
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.menu_book_rounded,
              color: Colors.white,
              size: 23,
            ),
          ),
          if (wide) ...[
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'study room.',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 23,
                  letterSpacing: -1,
                  color: ink,
                ),
              ),
            ),
          ],
        ],
      ),
      SizedBox(height: compactHeight ? 12 : 44),
      if (wide)
        const Padding(
          padding: EdgeInsets.only(left: 14, bottom: 12),
          child: Text(
            'YOUR WORKSPACE',
            style: TextStyle(fontSize: 9, letterSpacing: 1.8, color: muted),
          ),
        ),
      for (var i = 0; i < labels.length; i++)
        Padding(
          padding: EdgeInsets.only(bottom: compactHeight ? 3 : 9),
          child: Tooltip(
            message: labels[i],
            child: Material(
              color: selected == i
                  ? const Color(0xffe7eddf)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => navigate(i),
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: compactHeight ? 12 : 14,
                  ),
                  child: Row(
                    mainAxisAlignment: wide
                        ? MainAxisAlignment.start
                        : MainAxisAlignment.center,
                    children: [
                      Icon(
                        icons[i],
                        size: 21,
                        color: selected == i ? sage : muted,
                      ),
                      if (wide) ...[
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            labels[i],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: selected == i
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                              color: selected == i ? sage : muted,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      if (wide) ...[
        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 20),
        const Text(
          'YOUR COURSES',
          style: TextStyle(fontSize: 9, letterSpacing: 1.8, color: muted),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: ListView(
            children: [
              for (final course in widget.store.rows('courses'))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(Icons.circle, size: 7, color: sage),
                  title: Text(
                    course['name'] as String,
                    style: const TextStyle(fontSize: 12, color: muted),
                  ),
                  onTap: () => navigate(1),
                ),
            ],
          ),
        ),
      ] else if (!compactHeight)
        const Spacer(),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.offline_pin_outlined, size: 16, color: sage),
            if (wide) ...[
              const SizedBox(width: 7),
              const Text(
                'Offline',
                style: TextStyle(fontSize: 11, color: muted),
              ),
            ],
          ],
        ),
      ),
    ];
    return Container(
      width: wide ? 235 : 85,
      decoration: const BoxDecoration(
        color: Color(0xfffcfcf8),
        border: Border(right: BorderSide(color: Color(0xffe3e7dc))),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: wide ? 20 : 10,
        vertical: compactHeight ? 12 : 28,
      ),
      child: Material(
        color: Colors.transparent,
        child: compactHeight
            ? SingleChildScrollView(child: Column(children: items))
            : Column(
                crossAxisAlignment: wide
                    ? CrossAxisAlignment.start
                    : CrossAxisAlignment.center,
                children: items,
              ),
      ),
    );
  }

  Widget _dock(BuildContext context) {
    final t = focus.value,
        goal = widget.store.find('goals', focus.value['goalId'] as String);
    final remaining = focus.remaining;
    final duration =
        ((t['phase'] == 'focus'
                ? focus.preferences['focus']
                : focus.preferences['rest'])
            as num) *
        60;
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xfffffefa),
        border: Border(top: BorderSide(color: Color(0xffe0e5d8))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () => setState(() => expanded = !expanded),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 36,
                          height: 36,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              CircularProgressIndicator(
                                value: (remaining / duration).clamp(0.0, 1.0),
                                strokeWidth: 3,
                                backgroundColor: const Color(0xffe4eadc),
                              ),
                              const Icon(
                                Icons.timer_outlined,
                                size: 18,
                                color: sage,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t['phase'] == 'focus'
                                    ? 'Focus session'
                                    : 'Take a breath',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                              ConstrainedBox(
                                constraints: BoxConstraints(
                                  maxWidth:
                                      MediaQuery.sizeOf(context).width < 500
                                      ? 105
                                      : 300,
                                ),
                                child: Text(
                                  goal?['title']?.toString() ??
                                      'One small step at a time',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: muted,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          expanded ? Icons.expand_more : Icons.expand_less,
                          size: 18,
                          color: muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Text(
                '${(remaining ~/ 60).toString().padLeft(2, '0')}:${(remaining % 60).toString().padLeft(2, '0')}',
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w600,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 12),
              IconButton.filled(
                tooltip: t['running'] == true ? 'Pause timer' : 'Start timer',
                onPressed: remaining <= 0
                    ? null
                    : () => safely(context, focus.toggle),
                icon: Icon(
                  t['running'] == true ? Icons.pause : Icons.play_arrow,
                ),
              ),
            ],
          ),
          if (expanded) ...[
            const Divider(),
            if (focus.error != null)
              Text(
                'Timer could not be saved. Retry before closing. ${focus.error}',
                style: const TextStyle(color: Colors.red),
              ),
            DropdownButtonFormField<String>(
              initialValue: goal == null ? '' : goal['id'] as String,
              decoration: const InputDecoration(labelText: 'Study goal'),
              items: [
                const DropdownMenuItem(
                  value: '',
                  child: Text('Independent focus'),
                ),
                for (final g
                    in widget.store
                        .rows('goals')
                        .where(
                          (g) => g['done'] != true || g['id'] == t['goalId'],
                        ))
                  DropdownMenuItem(
                    value: g['id'] as String,
                    child: Text(labelOf(g), overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: t['startedOnce'] == true
                  ? null
                  : (id) => safely(context, () => focus.chooseGoal(id ?? '')),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Focus ${focus.preferences['focus']} min · Break ${focus.preferences['rest']} min',
                    style: const TextStyle(color: muted, fontSize: 11),
                  ),
                ),
                if (t['phase'] == 'focus' && t['startedOnce'] == true)
                  OutlinedButton(
                    onPressed: () => safely(context, reflect),
                    child: const Text('End session'),
                  ),
                if (t['phase'] == 'break')
                  OutlinedButton(
                    onPressed: () => safely(context, focus.nextFocus),
                    child: const Text('Ready to focus'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
