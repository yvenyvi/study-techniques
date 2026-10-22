import { expect } from "@playwright/test";
import { chooseOption } from "./select-flow.mjs";

export async function assertRichNote(page) {
  const body = page.getByRole("textbox", { name: "Note content", exact: true });
  await expect(body).toHaveAttribute("data-columns", "2");
  await expect(body.locator("h2")).toContainText(
    "Psychology connects evidence and understanding.",
  );
  for (const tag of ["strong", "em", "u", "mark"])
    await expect(body.locator(tag).first()).toContainText(
      "Psychology connects",
    );
  await expect(body.locator("mark").first()).toHaveAttribute(
    "data-color",
    "#f8d3e3",
  );
  await expect(body.locator("a").first()).toHaveAttribute(
    "href",
    "https://example.com/psychology",
  );
  await expect(body.locator("h2")).toHaveCSS("text-align", "center");
  await expect(body.locator("h2 span").first()).toHaveCSS(
    "font-family",
    "Georgia",
  );
  await expect(body.locator("h2 span").first()).toHaveCSS(
    "font-size",
    "18.6667px",
  );
  await expect(body.locator("table tr")).toHaveCount(3);
  await expect(body.locator("table tr").first().locator("th")).toHaveCount(2);
  await expect(body.locator("table")).toContainText("Behaviorism");
  await expect(body.locator("table")).toContainText("Mental processes");
}

/** Exercise the same document tools in the browser, native storage bridge, and Windows app. */
export async function checkRichEditor(page) {
  const body = page.getByRole("textbox", { name: "Note content", exact: true });
  await expect(body).toHaveAttribute("contenteditable", "true");
  await body.fill("Psychology connects evidence and understanding.");
  await body.press("ControlOrMeta+a");
  for (const name of ["Bold", "Italic", "Underline", "Highlight"])
    await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bold", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await chooseOption(page, "Highlight color", "Pink");
  await chooseOption(page, "Font family", "Georgia");
  await chooseOption(page, "Font size", "14 pt");
  await page.getByLabel("Text color", { exact: true }).fill("#3344aa");
  await chooseOption(page, "Paragraph style", "Heading 2");
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  await page
    .getByRole("button", { name: "Insert or edit link", exact: true })
    .click();
  await page
    .getByLabel("Link address", { exact: true })
    .fill("https://example.com/psychology");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await chooseOption(page, "Document columns", "Two");

  await body.press("ControlOrMeta+End");
  await body.press("Enter");
  await page
    .getByRole("button", { name: "Clear text formatting", exact: true })
    .click();
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Insert table",
    exact: true,
  });
  await dialog.getByLabel("Rows", { exact: true }).fill("3");
  await dialog.getByLabel("Columns", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: "Insert table", exact: true })
    .click();
  await expect(body.locator("table")).toBeVisible();
  await body.locator("th p").first().click();
  for (const [index, value] of [
    "Theory",
    "Description",
    "Behaviorism",
    "Learning through experience",
    "Cognitive",
    "Mental processes",
  ].entries()) {
    if (index) await page.keyboard.press("Tab");
    await page.keyboard.type(value);
  }
  await page.getByRole("button", { name: "Row below", exact: true }).click();
  await expect(body.locator("tr")).toHaveCount(4);
  await body.locator("tr").last().locator("td p").first().click();
  await page.getByRole("button", { name: "Delete row", exact: true }).click();
  await expect(body.locator("tr")).toHaveCount(3);
  await body.locator("tr").first().locator("th p").first().click();
  await page.getByRole("button", { name: "Column after", exact: true }).click();
  await expect(body.locator("tr").first().locator("th")).toHaveCount(3);
  // New column is immediately after the selected first column.
  await body.locator("tr").first().locator("th p").nth(1).click();
  await page
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await expect(body.locator("tr").first().locator("th")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete table", exact: true }).click();
  await expect(body.locator("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(body.locator("table")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(body.locator("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await assertRichNote(page);
}
