import { test } from "@playwright/test";
import { checkTimerPreferences } from "./timer-preferences-flow.mjs";

test("saved durations update idle timers, survive reload, and preserve running and paused phases", async ({
  page,
}) => {
  await page.goto("/app/settings");
  await checkTimerPreferences(page);
});
