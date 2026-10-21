import 'package:dart_quill_delta/dart_quill_delta.dart';

import 'models.dart';

// Quill cannot round-trip every node/attribute supported by the document editor.
// Keep these notes read-only here; store/export their original JSON unchanged.
bool needsDocumentEditor(Json content) {
  const nodes = {
    'doc',
    'paragraph',
    'heading',
    'text',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'horizontalRule',
    'hardBreak',
    'codeBlock',
  };
  const marks = {'bold', 'italic', 'underline', 'strike', 'code', 'link'};
  bool visit(dynamic node) {
    if (node is! Map || !nodes.contains(node['type'])) return true;
    final attrs = node['attrs'] as Map? ?? {};
    if ((attrs['columns'] ?? 1) != 1 ||
        (attrs['textAlign'] != null && attrs['textAlign'] != 'left')) {
      return true;
    }
    for (final mark in (node['marks'] as List? ?? [])) {
      if (!marks.contains(mark['type'])) return true;
    }
    return (node['content'] as List? ?? []).any(visit);
  }

  return visit(content);
}

// Exchange format is Tiptap JSON, identical to the web backup. Native editing
// uses Quill Delta; no generated HTML or platform-specific editor data is saved.
Delta toDelta(Json content) {
  final result = Delta();
  void block(Json node, [Map<String, dynamic> inherited = const {}]) {
    final type = node['type'];
    if (type == 'doc') {
      for (final child in (node['content'] as List? ?? [])) {
        block(Map<String, dynamic>.from(child));
      }
      return;
    }
    if (['table', 'tableRow', 'tableCell', 'tableHeader'].contains(type)) {
      for (final child in (node['content'] as List? ?? [])) {
        block(Map<String, dynamic>.from(child));
      }
      return;
    }
    if (type == 'bulletList' || type == 'orderedList') {
      for (final child in (node['content'] as List? ?? [])) {
        block(Map<String, dynamic>.from(child), {
          'list': type == 'bulletList' ? 'bullet' : 'ordered',
        });
      }
      return;
    }
    if (type == 'listItem' || type == 'blockquote') {
      for (final child in (node['content'] as List? ?? [])) {
        block(Map<String, dynamic>.from(child), {
          ...inherited,
          if (type == 'blockquote') 'blockquote': true,
        });
      }
      return;
    }
    if (type == 'horizontalRule') {
      result.insert('────────\n');
      return;
    }
    for (final child in (node['content'] as List? ?? [])) {
      if (child['type'] == 'hardBreak') {
        result.insert('\n');
        continue;
      }
      final attrs = <String, dynamic>{};
      for (final mark in (child['marks'] as List? ?? [])) {
        if ([
          'bold',
          'italic',
          'underline',
          'strike',
          'code',
        ].contains(mark['type'])) {
          attrs[mark['type']] = true;
        }
        if (mark['type'] == 'link') {
          final href = mark['attrs']?['href'];
          if (href is String) {
            attrs['link'] = href;
          }
        }
      }
      final text = child['text']?.toString() ?? '';
      if (text.isNotEmpty) result.insert(text, attrs.isEmpty ? null : attrs);
    }
    result.insert('\n', {
      ...inherited,
      if (type == 'heading') 'header': node['attrs']?['level'] ?? 2,
      if (type == 'codeBlock') 'code-block': true,
    });
  }

  block(content);
  if (result.isEmpty) result.insert('\n');
  return result;
}

Json fromDelta(Delta delta) {
  final blocks = <Json>[];
  var inline = <Json>[];
  void finish(Map<String, dynamic> attrs) {
    Json p = {
      'type': attrs.containsKey('header')
          ? 'heading'
          : attrs['code-block'] == true
          ? 'codeBlock'
          : 'paragraph',
      if (attrs.containsKey('header')) 'attrs': {'level': attrs['header']},
      if (inline.isNotEmpty) 'content': inline,
    };
    if (attrs['blockquote'] == true) {
      p = {
        'type': 'blockquote',
        'content': [p],
      };
    }
    if (attrs.containsKey('list')) {
      p = {
        'type': attrs['list'] == 'ordered' ? 'orderedList' : 'bulletList',
        'content': [
          {
            'type': 'listItem',
            'content': [p],
          },
        ],
      };
    }
    blocks.add(p);
    inline = [];
  }

  for (final op in delta.toJson()) {
    final value = op['insert'];
    if (value is! String) continue;
    final attrs = Map<String, dynamic>.from(op['attributes'] as Map? ?? {});
    final parts = value.split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) {
        final marks = <Json>[
          for (final type in ['bold', 'italic', 'underline', 'strike', 'code'])
            if (attrs[type] == true) {'type': type},
          if (attrs['link'] is String)
            {
              'type': 'link',
              'attrs': {'href': attrs['link']},
            },
        ];
        inline.add({
          'type': 'text',
          'text': parts[i],
          if (marks.isNotEmpty) 'marks': marks,
        });
      }
      if (i < parts.length - 1) finish(attrs);
    }
  }
  if (inline.isNotEmpty) finish({});
  return {
    'type': 'doc',
    'content': blocks.isEmpty
        ? [
            {'type': 'paragraph'},
          ]
        : blocks,
  };
}

List<Json> sourceReferences(Json content) {
  final refs = <Json>[];
  void visit(dynamic node) {
    if (node is Map) {
      for (final m in (node['marks'] as List? ?? [])) {
        final href = m['attrs']?['href'];
        if (m['type'] == 'link' && href is String) {
          final uri = Uri.tryParse(href);
          final parts = uri?.pathSegments ?? [];
          final page = int.tryParse(uri?.queryParameters['page'] ?? '');
          if (parts.length == 2 &&
              parts.first == 'study' &&
              page != null &&
              page > 0 &&
              !refs.any(
                (r) => r['documentId'] == parts[1] && r['page'] == page,
              )) {
            refs.add({'documentId': parts[1], 'page': page, 'quote': ''});
          }
        }
      }
      visit(node['content']);
    } else if (node is List) {
      for (final child in node) {
        visit(child);
      }
    }
  }

  visit(content);
  return refs;
}
