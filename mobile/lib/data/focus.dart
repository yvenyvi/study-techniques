import 'dart:async';

import 'package:flutter/foundation.dart';

import 'models.dart';
import 'store.dart';

class FocusController extends ChangeNotifier {
  final StudyStore store;
  final int Function() clock;
  Timer? _ticker;
  bool _busy = false;
  String? error;
  FocusController(this.store, {int Function()? clock, bool tick = true})
    : clock = clock ?? nowMs {
    if (tick) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        unawaited(reconcile());
        notifyListeners();
      });
    }
  }
  Json get preferences =>
      store.find('settings', 'preferences')?['value'] as Json? ??
      {'focus': 25, 'rest': 5, 'sound': false};
  Json fresh([String goalId = '', String phase = 'focus']) => {
    'id': 'active',
    'phase': phase,
    'running': false,
    'deadline': 0,
    'remaining':
        (preferences[phase == 'focus' ? 'focus' : 'rest'] as num).toInt() * 60,
    'goalId': goalId,
    'started': 0,
    'elapsed': 0,
    'startedOnce': false,
  };
  Json get value => store.find('timers', 'active') ?? fresh();
  int get remaining => remainingSeconds(value, clock());
  bool get needsReflection =>
      value['phase'] == 'focus' &&
      value['startedOnce'] == true &&
      remaining == 0;
  Future<void> chooseGoal(String id) async {
    if (value['startedOnce'] == true) {
      throw StateError('Finish your current session first.');
    }
    await store.put('timers', fresh(id));
    notifyListeners();
  }

  Future<void> toggle() async {
    if (_busy) return;
    _busy = true;
    try {
      final t = value;
      final left = remaining;
      if (left <= 0) return;
      if (t['running'] == true) {
        t['elapsed'] = (t['elapsed'] as num) + (t['remaining'] as num) - left;
        t['remaining'] = left;
        t['running'] = false;
      } else {
        if (t['startedOnce'] != true) t['started'] = clock();
        t['startedOnce'] = true;
        t['running'] = true;
        t['deadline'] = clock() + left * 1000;
      }
      await store.put('timers', t);
      notifyListeners();
    } finally {
      _busy = false;
    }
  }

  Future<void> pause() async {
    if (value['running'] == true) await toggle();
  }

  Future<void> reconcile() async {
    if (_busy) return;
    final t = value;
    if (t['running'] == true && remaining == 0) {
      _busy = true;
      try {
        t['elapsed'] = (t['elapsed'] as num) + (t['remaining'] as num);
        t['remaining'] = 0;
        t['running'] = false;
        await store.put('timers', t);
        error = null;
      } catch (e) {
        error = e.toString();
      } finally {
        _busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> finish({required bool completed, required String note}) async {
    await pause();
    await reconcile();
    final t = value;
    if (t['phase'] != 'focus' || t['startedOnce'] != true) return;
    final goal = store.find('goals', t['goalId'] as String);
    if (completed && goal != null) {
      goal['done'] = true;
      goal['completed'] = clock();
    }
    await store.completeSession(
      {
        'id': newId(),
        'goalId': t['goalId'],
        'started': t['started'],
        'ended': clock(),
        'duration': t['elapsed'],
        'outcome': completed && goal != null
            ? 'Goal completed'
            : 'More work to do',
        'note': note,
      },
      completed ? goal : null,
      fresh(t['goalId'] as String, 'break'),
    );
    notifyListeners();
  }

  Future<void> nextFocus() async {
    await store.put('timers', fresh(value['goalId'] as String));
    notifyListeners();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}
