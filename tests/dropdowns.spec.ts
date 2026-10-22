import { test, expect } from "./fixtures";
import { chooseOption } from "./select-flow.mjs";

async function addCourse(page: any, name: string) {
  await page.getByRole("button", { name: "New course", exact: true }).click();
  await page.getByLabel("Course name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("Library and Reviewers use custom course dropdowns with keyboard selection and real filtering", async ({
  page,
}) => {
  await page.goto("/app/library");
  await addCourse(page, "Cognitive Psychology");
  await addCourse(page, "Research Methods");
  const filter = page.getByRole("combobox", { name: "Course", exact: true });
  await filter.focus();
  await page.keyboard.press("r");
  await page.keyboard.press("Enter");
  await expect(filter).toContainText("Research Methods");
  await page.keyboard.press("Home");
  await page.keyboard.press("Escape");
  await expect(filter).toContainText("Research Methods");
  await expect(filter).toBeFocused();
  await page.goto("/app/reviewers");
  await page.getByRole("button", { name: "New reviewer", exact: true }).click();
  await page
    .getByLabel("Reviewer title", { exact: true })
    .fill("Research comparison");
  await chooseOption(page, "Course", "Research Methods");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Course", exact: true }),
  ).toContainText("Research Methods");
  await page.goto("/app/reviewers");
  await chooseOption(page, "Course", "Cognitive Psychology");
  await expect(
    page.getByRole("link", { name: /Research comparison/ }),
  ).toHaveCount(0);
  await chooseOption(page, "Course", "Research Methods");
  await expect(
    page.getByRole("link", { name: /Research comparison/ }),
  ).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
});

test("custom dropdowns stay inside narrow viewports and close when focus moves away", async ({
  page,
}) => {
  await page.goto("/app/library");
  const name =
    "A-course-with-a-very-long-name-that-must-wrap-in-a-mobile-dropdown";
  await addCourse(page, name);
  for (const route of ["/app/library", "/app/reviewers"]) {
    await page.goto(route);
    for (const width of [320, 390, 834, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const filter = page.getByRole("combobox", {
        name: "Course",
        exact: true,
      });
      await filter.click();
      const popup = page.getByRole("listbox", { name: "Course", exact: true });
      await expect(popup).toBeVisible();
      const bounds = await popup.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      await page.getByRole("option", { name, exact: true }).click();
      await expect(filter).toContainText(name);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await filter.click();
      await page.keyboard.press("Tab");
      await expect(filter).toHaveAttribute("aria-expanded", "false");
    }
    await expect(page.locator("select")).toHaveCount(0);
  }
});

test("timer dropdown opens above the dock and remains disabled during a session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/goals");
  await page
    .getByLabel("Study goal", { exact: true })
    .fill("Finish the research comparison");
  await page.getByLabel("Finished looks like…").fill("Explain three methods");
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  await page.getByRole("button", { name: "Expand focus timer" }).click();
  const goal = page.getByRole("combobox", { name: "Study goal", exact: true });
  await goal.click();
  const menu = page.getByRole("listbox", { name: "Study goal", exact: true });
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page
    .getByRole("option", {
      name: "Finish the research comparison",
      exact: true,
    })
    .click();
  await expect(goal).toContainText("Finish the research comparison");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(goal).toBeDisabled();
  await expect(page.locator("select")).toHaveCount(0);
});
