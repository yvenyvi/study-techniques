import { expect } from "@playwright/test";

export const GUIDE_KEY = "study-room-page-guides:v1";
export const ALL_GUIDES = [
  "overview",
  "library",
  "course",
  "workspace",
  "note",
  "reviewers",
  "reviewer",
  "practice",
  "goals",
  "settings",
];

export async function disableGuidesForContext(context) {
  await context.addInitScript(
    ({ key, seen }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, seen }));
    },
    { key: GUIDE_KEY, seen: ALL_GUIDES },
  );
}

export async function suppressRemainingGuides(page) {
  await page.evaluate(
    ({ key, seen }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, seen }));
    },
    { key: GUIDE_KEY, seen: ALL_GUIDES },
  );
  await disableGuidesForContext(page.context());
}

export async function checkIntroGuide(page) {
  const card = page.locator(".page-guide-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("A small goal is a good start");
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(card).toContainText("Pick your next step");
  await card.getByRole("button", { name: "Back", exact: true }).click();
  await expect(card).toContainText("Step 1 of 4");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  const help = page.getByRole("button", { name: "Page guide", exact: true });
  await expect(help).toBeEnabled();
  await expect(card).toHaveCount(0);
  await help.click();
  await expect(card).toContainText("A small goal is a good start");
  await expect(
    card.getByRole("button", { name: "Next", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(card).toContainText("Step 2 of 4");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(help).toBeFocused();
  await help.click();
  for (let i = 0; i < 3; i++)
    await card.getByRole("button", { name: "Next", exact: true }).click();
  await card.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(card).toHaveCount(0);
}
