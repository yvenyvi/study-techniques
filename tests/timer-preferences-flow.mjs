import { expect } from "@playwright/test";

/** @param {import('@playwright/test').Page} page */
export async function checkTimerPreferences(page) {
  const time = page.locator(".time-display");
  const focus = page.getByLabel("Focus minutes", { exact: true });
  const rest = page.getByLabel("Break minutes", { exact: true });
  const save = page.getByRole("button", {
    name: "Save preferences",
    exact: true,
  });
  async function savePreferences() {
    await save.click();
    // Running/paused countdowns do not change when preferences are saved.
    // Wait for the durable-save acknowledgement before reloading or editing again.
    await expect(save).toBeEnabled();
  }
  await page.getByRole("button", { name: "Expand focus timer" }).click();
  // Persist the old 25-minute timer, reproducing the original stale-state bug.
  await page.getByRole("button", { name: "Reset to preferences" }).click();
  await expect(time).toHaveText("25:00");
  await focus.fill("45");
  await rest.fill("12");
  await savePreferences();
  await expect(time).toHaveText("45:00");
  await page.reload();
  await expect(time).toHaveText("45:00");
  await expect(focus).toHaveValue("45");

  // Native storage broadcasts timer writes too: these must not reset form edits.
  await focus.fill("38");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await expect(focus).toHaveValue("38");
  await focus.fill("35");
  await rest.fill("9");
  await savePreferences();
  await expect(time).toHaveText(/^4[45]:\d{2}$/);
  await page.getByRole("button", { name: "Pause timer" }).click();
  const paused = await time.innerText();
  await focus.fill("32");
  await savePreferences();
  await expect(time).toHaveText(paused);
  await page.reload();
  await expect(time).toHaveText(paused);
  await expect(focus).toHaveValue("32");

  await page.getByRole("button", { name: "Expand focus timer" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page
    .getByRole("button", { name: "Save session & prepare break" })
    .click();
  await expect(time).toHaveText("09:00");
  await rest.fill("7");
  await savePreferences();
  await expect(time).toHaveText("07:00");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.getByRole("button", { name: "Pause timer" }).click();
  const pausedBreak = await time.innerText();
  await focus.fill("30");
  await rest.fill("3");
  await savePreferences();
  await expect(time).toHaveText(pausedBreak);
  await page.getByRole("button", { name: "Ready to focus" }).click();
  await expect(time).toHaveText("30:00");
}
