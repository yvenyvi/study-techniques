import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  GUIDE_STORAGE_KEY,
  hasSeenGuide,
  markGuideSeen,
  resetGuideProgress,
} from "./guides-progress";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  resetGuideProgress();
});
afterEach(() => vi.unstubAllGlobals());

it("persists seen pages independently and resets only the guide key", () => {
  values.set("unrelated", "keep");
  markGuideSeen("library");
  expect(hasSeenGuide("library")).toBe(true);
  expect(hasSeenGuide("note")).toBe(false);
  expect(JSON.parse(values.get(GUIDE_STORAGE_KEY)!).seen).toEqual(["library"]);
  resetGuideProgress();
  expect(hasSeenGuide("library")).toBe(false);
  expect(values.get("unrelated")).toBe("keep");
});
it("keeps guides usable in memory when local storage is blocked", () => {
  vi.stubGlobal("localStorage", {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  });
  expect(() => markGuideSeen("note")).not.toThrow();
  expect(hasSeenGuide("note")).toBe(true);
  resetGuideProgress();
  expect(hasSeenGuide("note")).toBe(false);
});
it("recovers from malformed stored progress and ignores unknown guide IDs", () => {
  values.set(GUIDE_STORAGE_KEY, "not-json");
  expect(hasSeenGuide("goals")).toBe(false);
  markGuideSeen("goals");
  expect(hasSeenGuide("goals")).toBe(true);
  values.set(
    GUIDE_STORAGE_KEY,
    JSON.stringify({ version: 1, seen: ["unknown", "settings"] }),
  );
  expect(hasSeenGuide("settings")).toBe(true);
});
