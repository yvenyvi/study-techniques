import { guideIds, type GuideId } from "./guides-content";

// UI introductions are deliberately separate from study records and backups.
export const GUIDE_STORAGE_KEY = "study-room-page-guides:v1";
const memory = new Set<GuideId>();
function readSeen(): Set<GuideId> {
  try {
    const value = JSON.parse(localStorage.getItem(GUIDE_STORAGE_KEY) || "null");
    if (value?.version === 1 && Array.isArray(value.seen))
      return new Set([
        ...memory,
        ...value.seen.filter((id: GuideId) => guideIds.includes(id)),
      ]);
  } catch {
    /* Unavailable storage must never block study tools. */
  }
  return new Set(memory);
}
export const hasSeenGuide = (id: GuideId) => readSeen().has(id);
export function markGuideSeen(id: GuideId) {
  const seen = readSeen();
  seen.add(id);
  memory.add(id);
  try {
    localStorage.setItem(
      GUIDE_STORAGE_KEY,
      JSON.stringify({ version: 1, seen: [...seen] }),
    );
  } catch {}
}
export function resetGuideProgress() {
  memory.clear();
  try {
    localStorage.removeItem(GUIDE_STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event("reset-page-guides"));
}
