import 'dart:convert';

import 'package:uuid/uuid.dart';

typedef Json = Map<String, dynamic>;
String newId() => const Uuid().v4();
int nowMs() => DateTime.now().millisecondsSinceEpoch;
Json clone(Json value) => jsonDecode(jsonEncode(value)) as Json;
String labelOf(Json row) => (row['title'] ?? row['name'] ?? '').toString();
const collections = [
  'courses',
  'documents',
  'notes',
  'reviewers',
  'goals',
  'sessions',
  'settings',
];
const templates = <String, List<String>>{
  'Key concepts': ['Term', 'Explanation', 'Example'],
  'Theory comparison': [
    'Theory',
    'Main ideas',
    'Similarities',
    'Differences',
    'Applications',
  ],
  'Research summary': [
    'Research question',
    'Method',
    'Findings',
    'Limitations',
  ],
  'Practice questions': ['Question', 'Answer'],
  'Free notes': ['Notes'],
};
Json newSection(String kind) => {
  'id': newId(),
  'kind': kind,
  'fields': {for (final f in templates[kind]!) f: ''},
  'refs': <Json>[],
};
String searchable(dynamic node) {
  if (node is String) return node;
  if (node is List) return node.map(searchable).join(' ');
  if (node is Map) {
    return (node['text'] ?? searchable(node['content'] ?? [])).toString();
  }
  return '';
}

Json newNote({
  String documentId = '',
  String title = 'Untitled note',
  String courseId = '',
}) => {
  'id': newId(),
  'title': title,
  'courseId': courseId,
  if (documentId.isNotEmpty) 'documentId': documentId,
  'content': {
    'type': 'doc',
    'content': [
      {'type': 'paragraph'},
    ],
  },
  'updated': nowMs(),
};
int remainingSeconds(Json timer, int now) => timer['running'] == true
    ? (((timer['deadline'] as num).toInt() - now) / 1000).ceil().clamp(0, 10800)
    : (timer['remaining'] as num).toInt();
