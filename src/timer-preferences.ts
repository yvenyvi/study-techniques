import type { Timer } from "./models";
import type { StudyStore } from "./storage/store";

export type FocusPreferences = { focus: number; rest: number; sound: boolean };
export const defaultFocusPreferences: FocusPreferences = {
  focus: 25,
  rest: 5,
  sound: false,
};

// A session that has begun keeps its progress, including while paused or expired.
// Also normalizes idle timers saved by older app versions before the next start.
export function applyTimerPreferences(
  timer: Timer,
  prefs: FocusPreferences,
): Timer {
  if (timer.running || timer.started || timer.elapsed) return timer;
  return {
    ...timer,
    remaining: (timer.phase === "focus" ? prefs.focus : prefs.rest) * 60,
  };
}

export async function saveFocusPreferences(
  store: StudyStore,
  prefs: FocusPreferences,
) {
  if (
    !Number.isInteger(prefs.focus) ||
    prefs.focus < 1 ||
    prefs.focus > 180 ||
    !Number.isInteger(prefs.rest) ||
    prefs.rest < 1 ||
    prefs.rest > 60 ||
    typeof prefs.sound !== "boolean"
  )
    throw Error("Choose whole minutes: focus 1–180 and break 1–60.");

  await store.atomic("rw", [store.settings, store.timers], async (tx) => {
    await tx.settings.put({ id: "preferences", value: prefs });
    const timer = await tx.timers.get("active");
    if (timer && !timer.running && !timer.started && !timer.elapsed)
      await tx.timers.put(applyTimerPreferences(timer, prefs));
  });
}
