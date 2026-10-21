import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/store.dart';

const ink = Color(0xff293e36),
    sage = Color(0xff35594b),
    muted = Color(0xff7a887c),
    paper = Color(0xfff7f7f2);
ThemeData studyTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: 'StudySans',
  scaffoldBackgroundColor: paper,
  colorScheme: ColorScheme.fromSeed(
    seedColor: sage,
    primary: sage,
    surface: const Color(0xfffffefa),
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 34,
      fontWeight: FontWeight.w600,
      letterSpacing: -1.1,
      color: ink,
    ),
    headlineMedium: TextStyle(
      fontSize: 26,
      fontWeight: FontWeight.w600,
      letterSpacing: -.6,
      color: ink,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: ink,
    ),
    bodyMedium: TextStyle(fontSize: 14, height: 1.6, color: ink),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.all(16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xffe1e5db)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xffe1e5db)),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(48, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      minimumSize: const Size(48, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
);
void notice(BuildContext context, Object message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message.toString().replaceFirst('Bad state: ', ''))),
  );
}

Future<void> safely(
  BuildContext context,
  Future<void> Function() action,
) async {
  try {
    await action();
  } catch (e) {
    if (context.mounted) notice(context, e);
  }
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String description,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(description),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ??
    false;

class Heading extends StatelessWidget {
  final String eyebrow, title, subtitle;
  final Widget? action;
  const Heading(
    this.eyebrow,
    this.title,
    this.subtitle, {
    this.action,
    super.key,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 26),
    child: LayoutBuilder(
      builder: (context, c) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              letterSpacing: 2,
              color: muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 20,
            runSpacing: 16,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineLarge),
              ?action,
            ],
          ),
          const SizedBox(height: 10),
          Text(subtitle, style: const TextStyle(color: muted)),
        ],
      ),
    ),
  );
}

class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  const Panel({
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.color,
    super.key,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color ?? const Color(0xfffffefa),
      border: Border.all(color: const Color(0xffe3e7dc)),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Material(color: Colors.transparent, child: child),
  );
}

class EmptyView extends StatelessWidget {
  final IconData icon;
  final String title, description;
  final Widget? action;
  const EmptyView(
    this.icon,
    this.title,
    this.description, {
    this.action,
    super.key,
  });
  @override
  Widget build(BuildContext context) => Panel(
    child: Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 38, color: const Color(0xff91a284)),
            const SizedBox(height: 18),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Text(
                description,
                textAlign: TextAlign.center,
                style: const TextStyle(color: muted),
              ),
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    ),
  );
}

class CoursePicker extends StatelessWidget {
  final StudyStore store;
  final String value;
  final ValueChanged<String> onChanged;
  final bool filter;
  const CoursePicker(
    this.store, {
    required this.value,
    required this.onChanged,
    this.filter = false,
    super.key,
  });
  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
    initialValue: store.rows('courses').any((c) => c['id'] == value)
        ? value
        : '',
    decoration: const InputDecoration(labelText: 'Course'),
    items: [
      DropdownMenuItem(
        value: '',
        child: Text(filter ? 'All courses' : 'Unfiled'),
      ),
      for (final c in store.rows('courses'))
        DropdownMenuItem(
          value: c['id'] as String,
          child: Text(c['name'] as String, overflow: TextOverflow.ellipsis),
        ),
    ],
    onChanged: (v) => onChanged(v ?? ''),
  );
}

class SourceLink extends StatelessWidget {
  final StudyStore store;
  final Json source;
  final void Function(String, int) onOpen;
  const SourceLink(this.store, this.source, this.onOpen, {super.key});
  @override
  Widget build(BuildContext context) {
    final doc = store.find('documents', source['documentId'] as String);
    return TextButton.icon(
      onPressed: doc == null
          ? null
          : () => onOpen(doc['id'] as String, source['page'] as int),
      icon: const Icon(Icons.open_in_new, size: 15),
      label: Text(
        '${doc == null ? 'Source unavailable' : labelOf(doc)} · p. ${source['page']}',
      ),
    );
  }
}
