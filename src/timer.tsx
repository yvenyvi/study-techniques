import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "./storage/live";
import {
  Play,
  Pause,
  Square,
  Timer as TimerIcon,
  ChevronUp,
} from "lucide-react";
import { db, secondsLeft, uid, type Timer } from "./data";
import { report } from "./shared";
import {
  applyTimerPreferences,
  defaultFocusPreferences,
} from "./timer-preferences";
export function FocusTimer() {
  const stored = useLiveQuery(() => db.timers.get("active"), []);
  const preferences = useLiveQuery(() => db.settings.get("preferences"), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []) || [];
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const [owner, setOwner] = useState(false);
  const [ending, setEnding] = useState(false);
  const [note, setNote] = useState("");
  const [complete, setComplete] = useState(false);
  const handled = useRef("");
  const prefs = preferences?.value || defaultFocusPreferences;
  const fresh = (): Timer => ({
    id: "active",
    phase: "focus",
    running: false,
    deadline: 0,
    remaining: prefs.focus * 60,
    goalId: "",
    started: 0,
    elapsed: 0,
  });
  const t = applyTimerPreferences(stored || fresh(), prefs);
  const remaining = secondsLeft(t, now);
  const total = t.elapsed + t.remaining;
  const fraction = total > 0 ? Math.min(1, remaining / total) : 0;
  const current = useRef(t);
  current.current = t;
  useEffect(() => {
    let release = () => {};
    let cancelled = false;
    if (navigator.locks)
      navigator.locks.request(
        "study-room-timer",
        { ifAvailable: true },
        async (lock) => {
          if (cancelled) return;
          setOwner(!!lock);
          if (lock) await new Promise<void>((r) => (release = r));
        },
      );
    else setOwner(true);
    return () => {
      cancelled = true;
      release();
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const start = async (e: Event) => {
      if (!owner)
        return report(
          "The timer is controlled in another tab. Close that tab and reload.",
        );
      if (current.current.started)
        return report("End your current session before changing goals.");
      await db.timers.put({ ...fresh(), goalId: (e as CustomEvent).detail });
      setExpanded(true);
    };
    window.addEventListener("start-goal", start);
    return () => window.removeEventListener("start-goal", start);
  }, [owner, prefs.focus]);
  useEffect(() => {
    if (!owner || !stored?.running || remaining > 0) return;
    const token = String(stored.deadline);
    if (handled.current === token) return;
    handled.current = token;
    db.timers
      .put({
        ...stored,
        running: false,
        remaining: 0,
        elapsed: stored.elapsed + stored.remaining,
        started: stored.started,
      })
      .catch(report);
    setExpanded(true);
    if (stored.phase === "focus") setEnding(true);
    if (prefs.sound) {
      try {
        const ac = new AudioContext();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g);
        g.connect(ac.destination);
        o.frequency.value = 660;
        g.gain.setValueAtTime(0.12, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
        o.start();
        o.stop(ac.currentTime + 0.8);
        o.onended = () => ac.close();
      } catch {}
    }
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(
        stored.phase === "focus" ? "Focus session finished" : "Break finished",
        { body: "Return to your study room to choose your next step." },
      );
  }, [remaining, stored, owner]);
  async function toggle() {
    if (!owner) return;
    if (t.running) {
      const elapsed = t.elapsed + Math.max(0, t.remaining - remaining);
      await db.timers.put({ ...t, running: false, remaining, elapsed });
    } else {
      if (remaining <= 0) return;
      await db.timers.put({
        ...t,
        running: true,
        started: t.started || Date.now(),
        deadline: Date.now() + remaining * 1000,
      });
    }
  }
  async function finish() {
    const actual =
      t.phase === "focus"
        ? t.running
          ? t.elapsed + Math.max(0, t.remaining - secondsLeft(t))
          : t.elapsed
        : 0;
    await db.atomic("rw", [db.sessions, db.goals, db.timers], async (tx) => {
      if (t.phase === "focus" && t.started) {
        await tx.sessions.add({
          id: uid(),
          goalId: t.goalId,
          started: t.started,
          ended: Date.now(),
          duration: Math.round(actual),
          outcome: complete ? "Goal completed" : "More work to do",
          note,
        });
        if (complete && t.goalId)
          await tx.goals.update(t.goalId, {
            done: true,
            completed: Date.now(),
          });
      }
      await tx.timers.put({
        ...fresh(),
        phase: "break",
        remaining: prefs.rest * 60,
        goalId: t.goalId,
      });
    });
    setEnding(false);
    setNote("");
    setComplete(false);
  }
  return (
    <>
      <div className={`focus-dock ${expanded ? "expanded" : ""}`}>
        <button
          className="dock-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-label="Expand focus timer"
        >
          <span
            className="mini-ring"
            style={{
              background: `conic-gradient(#6d927c ${fraction * 360}deg,#e4e9e1 0)`,
            }}
          >
            <TimerIcon size={16} />
          </span>
          <span>
            <strong>
              {t.phase === "focus" ? "Focus session" : "Take a breath"}
            </strong>
            <small>
              {goals.find((g) => g.id === t.goalId)?.title ||
                "One small step at a time"}
            </small>
          </span>
          <ChevronUp size={16} />
        </button>
        <span className="time-display">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}
          <span>:</span>
          {String(remaining % 60).padStart(2, "0")}
        </span>
        <button
          className="timer-play"
          aria-label={t.running ? "Pause timer" : "Start timer"}
          disabled={!owner || remaining === 0 || ending}
          onClick={() => toggle().catch(report)}
        >
          {t.running ? <Pause size={17} /> : <Play size={17} />}
        </button>
        {expanded && (
          <div className="timer-details">
            {!owner && (
              <p className="banner">
                Timer controlled in another tab. Close it and reload to take
                control.
              </p>
            )}
            <label>
              Study goal
              <select
                value={t.goalId}
                disabled={!!t.started || !owner}
                onChange={(e) =>
                  db.timers.put({ ...t, goalId: e.target.value }).catch(report)
                }
              >
                <option value="">Independent focus</option>
                {goals
                  .filter((g) => !g.done)
                  .map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
            </label>
            <p className="small muted">
              Preferences: Focus {prefs.focus} min · Break {prefs.rest} min ·
              Transitions start when you’re ready.
            </p>
            <div className="actions">
              {t.started && t.phase === "focus" && (
                <button
                  className="secondary"
                  disabled={!owner}
                  onClick={async () => {
                    if (t.running) await toggle();
                    setEnding(true);
                  }}
                >
                  <Square size={14} />
                  End session
                </button>
              )}
              {t.phase === "break" && (
                <button
                  className="secondary"
                  disabled={!owner}
                  onClick={() =>
                    db.timers
                      .put({ ...fresh(), goalId: t.goalId })
                      .catch(report)
                  }
                >
                  Ready to focus
                </button>
              )}
              {!t.started && t.phase === "focus" && (
                <button
                  className="text-button"
                  disabled={!owner}
                  onClick={() =>
                    db.timers
                      .put({ ...fresh(), goalId: t.goalId })
                      .catch(report)
                  }
                >
                  Reset to preferences
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {ending && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Session progress"
          >
            <p className="eyebrow">A MOMENT TO REFLECT</p>
            <h2>What did you move forward?</h2>
            <p>
              {goals.find((g) => g.id === t.goalId)?.criterion ||
                "Save a short reflection before your next step."}
            </p>
            <label>
              Progress note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you understand? What comes next?"
              />
            </label>
            {t.goalId && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={complete}
                  onChange={(e) => setComplete(e.target.checked)}
                />
                I finished my goal’s completion criterion
              </label>
            )}
            <button onClick={() => finish().catch(report)}>
              Save session & prepare break
            </button>
          </section>
        </div>
      )}
    </>
  );
}
