import { test, expect } from "./fixtures";

const seconds = (text: string) => {
  const [minutes, seconds] = text.trim().split(":").map(Number);
  return minutes * 60 + seconds;
};

test("entering and leaving Focus zone preserves the same running timer and ownership", async ({
  page,
}) => {
  await page.goto("/app/goals");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause timer", exact: true }),
  ).toBeEnabled();
  const before = seconds(await page.locator(".time-display").innerText());
  await page.getByRole("link", { name: "Focus zone", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/focus$/);
  await expect(
    page.getByRole("button", { name: "Pause timer", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".time-display")).toHaveCount(1);
  const after = seconds(await page.locator(".time-display").innerText());
  expect(after).toBeLessThanOrEqual(before);
  expect(after).toBeGreaterThan(before - 10);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  await page.getByRole("button", { name: "Pause timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled();
  const paused = await page.locator(".time-display").innerText();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".time-display")).toHaveText(paused);
  await page
    .getByRole("link", { name: "Leave focus zone", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/goals$/);
  await expect(page.locator(".time-display")).toHaveText(paused);
});

test("Focus zone respects reduced motion, works offline, and records completed session reflections", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/focus");
  await expect(page.locator(".focus-zone-scene")).toHaveAttribute(
    "data-motion",
    "off",
  );
  await page
    .getByRole("button", { name: "Resume background motion", exact: true })
    .click();
  await expect(page.locator(".focus-zone-scene")).toHaveAttribute(
    "data-motion",
    "on",
  );
  await page
    .getByRole("button", { name: "Pause background motion", exact: true })
    .click();
  await expect(page.locator(".zone-glow-one")).toHaveCSS(
    "animation-play-state",
    "paused",
  );
  for (const width of [320, 390, 834, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Start timer", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Leave focus zone" }),
    ).toBeInViewport();
  }
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page
    .getByRole("button", { name: "Session controls", exact: true })
    .click();
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page
    .getByLabel("Progress note", { exact: true })
    .fill("Compared the memory models in Focus zone.");
  await page
    .getByRole("button", { name: "Save session & prepare break", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let your mind wander." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leave focus zone" }).click();
  await expect(
    page.getByText("Compared the memory models in Focus zone."),
  ).toBeVisible();
  await expect(
    page.getByText("Ready for offline study", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("link", { name: "Focus zone", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Let your mind wander." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled();
});
