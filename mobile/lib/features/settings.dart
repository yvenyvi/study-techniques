import 'dart:io';

import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';

import '../data/store.dart';
import '../data/backup.dart';
import '../data/services.dart';
import '../ui/common.dart';

class SettingsPage extends StatefulWidget {
  final StudyStore store;
  const SettingsPage(this.store, {super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final TextEditingController focus, rest;
  bool busy = false, sound = false;
  @override
  void initState() {
    super.initState();
    final prefs = widget.store.find('settings', 'preferences')?['value'];
    focus = TextEditingController(text: '${prefs?['focus'] ?? 25}');
    rest = TextEditingController(text: '${prefs?['rest'] ?? 5}');
    sound = prefs?['sound'] == true;
  }

  @override
  void dispose() {
    focus.dispose();
    rest.dispose();
    super.dispose();
  }

  Future<void> work(Future<void> Function() action) async {
    setState(() => busy = true);
    await safely(context, action);
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(30),
    children: [
      const Heading(
        'Make this space yours',
        'Settings & your data',
        'An offline workspace. Your materials stay on this iPad.',
      ),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Focus preferences',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 20),
            TextField(
              controller: focus,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Focus minutes (1–180)',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: rest,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Break minutes (1–60)',
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Completion sound while app is open'),
              value: sound,
              onChanged: (v) => setState(() => sound = v),
            ),
            FilledButton(
              onPressed: () => safely(context, () async {
                final f = int.tryParse(focus.text), r = int.tryParse(rest.text);
                if (f == null ||
                    r == null ||
                    f < 1 ||
                    f > 180 ||
                    r < 1 ||
                    r > 60) {
                  throw const FormatException(
                    'Enter a focus duration of 1–180 minutes and break of 1–60 minutes.',
                  );
                }
                await widget.store.put('settings', {
                  'id': 'preferences',
                  'value': {'focus': f, 'rest': r, 'sound': sound},
                });
                if (context.mounted) {
                  notice(
                    context,
                    'Preferences saved. New sessions use these defaults.',
                  );
                }
              }),
              child: const Text('Save preferences'),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      const Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Ready for offline study',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 12),
            Text(
              'PDFs, notes, reviewers, and sessions are stored in the app’s local SQLite database. No internet is required after installation.',
            ),
            SizedBox(height: 12),
            Text(
              'Typed notes support Apple Pencil Scribble on compatible iPads. Dedicated handwriting and drawing are outside v1.',
              style: TextStyle(color: muted),
            ),
            SizedBox(height: 12),
            Text(
              'Focus time is recovered after backgrounding or reopening. Alerts while the app is suspended are not guaranteed. No background execution is required for accurate progress.',
              style: TextStyle(color: muted),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Backup & restore',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            const Text(
              'Use the same ZIP format as the web app. Export to Files or share it with another device. Restore requires a completely empty workspace, including settings and history.',
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton.icon(
                  onPressed: busy
                      ? null
                      : () => work(() async {
                          final bytes = await BackupService(widget.store)
                              .export();
                          if (context.mounted) {
                            await shareBackup(context, bytes);
                          }
                        }),
                  icon: const Icon(Icons.ios_share),
                  label: Text(busy ? 'Working…' : 'Export backup'),
                ),
                OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () => work(() async {
                          final file = await FilePicker.platform.pickFiles(
                            type: FileType.custom,
                            allowedExtensions: ['zip'],
                            withData: true,
                          );
                          if (file == null) return;
                          final f = file.files.single;
                          await BackupService(widget.store).restore(
                            f.bytes ?? await File(f.path!).readAsBytes(),
                          );
                          if (context.mounted) {
                            notice(context, 'Backup restored.');
                          }
                        }),
                  icon: const Icon(Icons.file_download_outlined),
                  label: const Text('Restore ZIP'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Deleting this app removes its local data. Keep backups in Files or another safe location. Active timers are not included in backups.',
              style: TextStyle(color: muted),
            ),
          ],
        ),
      ),
      const SizedBox(height: 24),
      Text(
        '${widget.store.rows('documents').length} PDFs · ${widget.store.rows('notes').length} notes · ${widget.store.rows('reviewers').length} reviewers',
        style: const TextStyle(color: muted),
      ),
    ],
  );
}
