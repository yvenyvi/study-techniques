import "fake-indexeddb/auto";
import { afterAll, beforeEach, expect, it } from "vitest";
import { StudyDB, type Timer } from "./data";
import { webStore } from "./storage/store";
import {
  applyTimerPreferences,
  saveFocusPreferences,
} from "./timer-preferences";

const raw = new StudyDB("timer-preferences-test");
const store = webStore(raw);
const prefs = { focus: 45, rest: 12, sound: true };
const idle: Timer = {
  id: "active",
  phase: "focus",
  running: false,
  deadline: 0,
  remaining: 1500,
  goalId: "my-goal",
  started: 0,
  elapsed: 0,
};
beforeEach(async () => {
  await store.settings.clear();
  await store.timers.clear();
});
afterAll(() => raw.delete());

it.each(["focus", "break"] as const)(
  "updates a persisted idle %s timer and retains its goal",
  async (phase) => {
    await store.timers.put({ ...idle, phase });
    await saveFocusPreferences(store, prefs);
    expect((await store.settings.get("preferences"))?.value).toEqual(prefs);
    expect(await store.timers.get("active")).toEqual({
      ...idle,
      phase,
      remaining: (phase === "focus" ? 45 : 12) * 60,
    });
  },
);

it.each([
  { running: true, started: 100, deadline: 90000, remaining: 60, elapsed: 0 },
  { running: false, started: 100, deadline: 90000, remaining: 40, elapsed: 20 },
  { running: false, started: 100, deadline: 90000, remaining: 0, elapsed: 60 },
])("preserves an in-progress or completed phase: %j", async (state) => {
  for (const phase of ["focus", "break"] as const) {
    const timer = { ...idle, ...state, phase };
    await store.timers.put(timer);
    await saveFocusPreferences(store, prefs);
    expect(await store.timers.get("active")).toEqual(timer);
    expect(applyTimerPreferences(timer, prefs)).toEqual(timer);
  }
});

it("corrects an older idle record at display/start without requiring another settings save", () => {
  expect(applyTimerPreferences(idle, prefs).remaining).toBe(2700);
});

it("does not overwrite valid preferences or a timer with invalid durations", async () => {
  await store.timers.put(idle);
  await saveFocusPreferences(store, prefs);
  await expect(
    saveFocusPreferences(store, { ...prefs, focus: 0 }),
  ).rejects.toThrow("whole minutes");
  expect((await store.settings.get("preferences"))?.value).toEqual(prefs);
  expect((await store.timers.get("active"))?.remaining).toBe(2700);
});
