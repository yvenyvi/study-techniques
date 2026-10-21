import 'dart:async';

import 'package:flutter/foundation.dart';

import 'models.dart';
import 'store.dart';

class DraftSaver extends ChangeNotifier {
  final StudyStore store;
  final String kind;
  Json value;
  String status = 'Saved';
  Timer? _debounce;
  Future<void> _tail = Future.value();
  int _revision = 0;
  bool _disposed = false;
  DraftSaver(this.store, this.kind, Json initial) : value = clone(initial) {
    store.editors.add(flush);
  }
  void change(Json next) {
    value = clone(next);
    _revision++;
    status = 'Unsaved';
    notifyListeners();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      unawaited(flush());
    });
  }

  Future<bool> flush() async {
    _debounce?.cancel();
    if (status == 'Saved') return true;
    final snapshot = clone(value);
    final revision = _revision;
    status = 'Saving…';
    if (!_disposed) notifyListeners();
    try {
      final task = _tail
          .catchError((_) {})
          .then((_) => store.put(kind, snapshot));
      _tail = task;
      await task;
      if (_revision == revision) {
        status = 'Saved';
      }
    } catch (_) {
      status = 'Save failed. Tap to retry.';
    }
    if (!_disposed) notifyListeners();
    return status == 'Saved';
  }

  @override
  void dispose() {
    _disposed = true;
    _debounce?.cancel();
    store.editors.remove(flush);
    super.dispose();
  }
}
