import { test, expect } from "./fixtures";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 834, height: 1194 },
  { width: 390, height: 844 },
]) {
  test(`landing page opens the workspace at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Make room forunderstanding.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "How to install on your device" })
      .click();
    await expect(page.locator("#install-guide")).toBeInViewport();
    await expect(
      page.getByText("Native iPad download coming soon"),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open web app", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(
      page.getByRole("heading", { name: "Make room for understanding." }),
    ).toBeVisible();
  });
}

test("installed app launches the workspace and legacy sources stay usable offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifest = await (await page.request.get(manifestUrl!)).json();
  expect(manifest.start_url).toBe("/app/");
  expect(manifest.scope).toBe("/app/");
  await page.goto(manifest.start_url);
  await expect(page.getByText("Ready for offline study")).toBeVisible();
  await page.goto("/library");
  await expect(page).toHaveURL(/\/app\/library$/);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.locator(".tiptap")).toBeVisible();
  const legacySource = new URL(page.url()).pathname.replace("/app", "");
  await context.setOffline(true);
  await page.goto(legacySource);
  await expect(page.locator(".tiptap")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app${legacySource}$`));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make room forunderstanding.",
  );
  await page.getByRole("link", { name: "Find your focus" }).click();
  await expect(
    page.getByRole("heading", { name: "Make room for understanding." }),
  ).toBeVisible();
});
