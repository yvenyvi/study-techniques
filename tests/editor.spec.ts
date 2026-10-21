import { test, expect } from "./fixtures";
import { readFile } from "node:fs/promises";
import { disableGuidesForContext } from "./guides-flow.mjs";
import { unzipSync, strFromU8 } from "fflate";
import { checkRichEditor, assertRichNote } from "./editor-flow.mjs";

test("table cells can merge and split, and keyboard text formatting works", async ({
  page,
}) => {
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const body = page.getByRole("textbox", { name: "Note content", exact: true });
  await expect(body).toHaveAttribute("contenteditable", "true");
  await body.fill("Compare the theories.");
  await body.press("ControlOrMeta+a");
  await body.press("ControlOrMeta+b");
  await expect(body.locator("strong")).toHaveText("Compare the theories.");
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await expect(body.locator("ul li")).toContainText("Compare the theories.");
  await page
    .getByRole("button", { name: "Numbered list", exact: true })
    .click();
  await expect(body.locator("ol li").first()).toContainText(
    "Compare the theories.",
  );
  await page
    .getByRole("button", { name: "Clear text formatting", exact: true })
    .click();
  await expect(body.locator("strong, ul, ol")).toHaveCount(0);
  await body.press("ControlOrMeta+End");
  await body.press("Enter");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Insert table",
    exact: true,
  });
  await dialog.getByLabel("Rows", { exact: true }).fill("2");
  await dialog.getByLabel("Columns", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: "Insert table", exact: true })
    .click();
  await body.locator("th").first().click();
  await body
    .locator("th")
    .nth(1)
    .click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Merge cells", exact: true }).click();
  await expect(body.locator("th")).toHaveCount(1);
  await expect(body.locator("th")).toHaveAttribute("colspan", "2");
  await page.getByRole("button", { name: "Split cell", exact: true }).click();
  await expect(body.locator("th")).toHaveCount(2);
});

test("document formatting, tables, and columns survive offline reload, printing, and ZIP restore", async ({
  page,
  browser,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByLabel("Note title", { exact: true })
    .fill("Psychology study notes");
  await checkRichEditor(page);
  await expect(page.locator(".tiptap")).toHaveCSS("column-count", "2");
  await page.screenshot({
    path: "test-results/document-editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Settings & data", exact: true })
    .click();
  await expect(
    page.getByText("✓ Application cached for offline use."),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloaded;
  const path = (await download.path())!;
  const manifest = JSON.parse(
    strFromU8(unzipSync(await readFile(path))["manifest.json"]),
  );
  expect(manifest.notes[0].content.attrs.columns).toBe(2);
  expect(JSON.stringify(manifest.notes[0].content)).toContain('"type":"table"');
  await context.setOffline(true);
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Psychology study notes", exact: false })
    .click();
  await page.reload();
  await assertRichNote(page);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("group", { name: "Document formatting", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".tiptap table")).toBeVisible();
  await expect(page.locator(".tiptap")).toHaveCSS("column-count", "2");
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".tiptap")).toHaveCSS("column-count", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/document-editor-mobile.png",
    fullPage: true,
  });

  const restoredContext = await browser.newContext();
  await disableGuidesForContext(restoredContext);
  try {
    const restored = await restoredContext.newPage();
    await restored.goto(`${new URL(page.url()).origin}/app/settings`);
    await restored.locator('input[type="file"]').setInputFiles(path);
    await expect(restored.getByRole("status")).toContainText(
      "Backup restored.",
    );
    await restored
      .getByRole("link", { name: "Library", exact: true })
      .first()
      .click();
    await restored
      .getByRole("link", { name: "Psychology study notes", exact: false })
      .click();
    await assertRichNote(restored);
  } finally {
    await restoredContext.close();
  }
  expect(errors).toEqual([]);
});
