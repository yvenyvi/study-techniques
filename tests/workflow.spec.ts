import { test, expect } from "./fixtures";
function pdf() {
  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream =
    "BT /F1 18 Tf 50 720 Td (Working memory supports learning.) Tj ET";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(parts.join("")));
    parts.push(`${i + 1} 0 obj\n${o}\nendobj\n`);
  });
  const xref = Buffer.byteLength(parts.join(""));
  parts.push(
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  );
  return Buffer.from(parts.join(""));
}
test("student creates a course, imports PDF, writes notes and practices a reviewer offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app/");
  await expect(
    page.getByRole("heading", { name: "Make room for understanding." }),
  ).toBeVisible();
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New course" }).click();
  await page.getByLabel("Course name").fill("Cognitive Psychology");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Memory and thinking");
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(
    page.getByRole("heading", { name: "Cognitive Psychology" }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "Memory.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  await expect(page).toHaveURL(/study/);
  await expect(page.locator(".textLayer")).toContainText("Working memory");
  await page.getByRole("button", { name: "Create a note" }).click();
  await page
    .locator(".tiptap")
    .fill("Working memory temporarily holds information for active use.");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".tiptap")).toContainText("temporarily holds");
  await page.goto("/app/reviewers");
  await page.getByRole("button", { name: "New reviewer" }).click();
  await page.getByLabel("Reviewer title").fill("Memory reviewer");
  await page
    .getByRole("button", { name: "Practice questions", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Question", exact: true })
    .fill("What does working memory do?");
  await page
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("Holds information for active use.");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(
    page.getByText("Holds information for active use.", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(
    page.getByText("Holds information for active use.", { exact: true }),
  ).toBeVisible();
  await page.goto("/app/settings");
  await expect(
    page.getByText("✓ Application cached for offline use."),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings & your data" }),
  ).toBeVisible();
  await page.goto("/app/library");
  await page.getByRole("link", { name: "Memory", exact: true }).first().click();
  await expect(page.locator(".textLayer")).toContainText("Working memory");
  await expect(page.locator(".tiptap")).toContainText("temporarily holds");
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("focus sessions preserve a goal until explicitly completed and recover across reload", async ({
  page,
}) => {
  await page.goto("/app/goals");
  await page
    .getByLabel("Study goal", { exact: true })
    .fill("Compare memory models");
  await page.getByLabel("Finished looks like…").fill("Write the comparison");
  await page.getByRole("button", { name: "Create goal" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await page.getByRole("button", { name: "Expand focus timer" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByLabel("Progress note").fill("Read the first model");
  await page
    .getByRole("button", { name: "Save session & prepare break" })
    .click();
  await expect(
    page.getByRole("button", { name: "Complete goal" }),
  ).toBeVisible();
  await expect(page.getByText("Read the first model")).toBeVisible();
  await page.getByRole("button", { name: "Complete goal" }).click();
  await expect(page.getByRole("button", { name: "Reopen goal" })).toBeVisible();
});
test("mobile navigation and empty state are usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/");
  await expect(
    page.getByRole("link", { name: "Library", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("PDF excerpts retain page links and can be copied into a reviewer", async ({
  page,
}) => {
  await page.goto("/app/reviewers");
  await page.getByRole("button", { name: "New reviewer" }).click();
  await page.getByLabel("Reviewer title").fill("Linked reviewer");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "Source.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  await expect(page.locator(".textLayer")).toContainText("Working memory");
  await page.getByRole("button", { name: "Create a note" }).click();
  await page.locator(".textLayer").evaluate((el) => {
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.getByRole("button", { name: "Add excerpt", exact: true }).click();
  await page.getByRole("button", { name: "Insert excerpt into note" }).click();
  await expect(page.locator(".tiptap blockquote")).toContainText(
    "Working memory",
  );
  await expect(page.locator(".tiptap a")).toContainText("Source · page 1");
  await page.locator(".tiptap").evaluate((el) => {
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Add selection to reviewer" }).click();
  await page
    .getByRole("combobox", { name: "Reviewer", exact: true })
    .selectOption({ label: "Linked reviewer" });
  await page.getByRole("button", { name: "Copy to reviewer" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add to reviewer" }),
  ).not.toBeVisible();
  await page.getByRole("link", { name: "Reviewers", exact: true }).click();
  await page.getByRole("heading", { name: "Linked reviewer" }).click();
  await expect(page.locator(".reviewer-section .source")).toContainText(
    "Source · p. 1",
  );
});
test("edit locks prevent another tab from overwriting a note", async ({
  page,
  context,
}) => {
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.locator(".tiptap").fill("Only one editor owns this note.");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(
    other.getByText("Open in another tab. Close it and reload to edit here."),
  ).toBeVisible();
  await expect(other.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "false",
  );
  await expect(
    other.getByRole("button", { name: "Bold", exact: true }),
  ).toBeDisabled();
  await page.close();
  await other.reload();
  await expect(other.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(other.locator(".tiptap")).toContainText("Only one editor");
});
test("an expired focus phase records only its duration and waits for user input", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/app/");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.clock.fastForward(26 * 60 * 1000);
  await expect(
    page.getByRole("dialog", { name: "Session progress" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save session & prepare break" })
    .click();
  await page
    .getByRole("link", { name: "Goals & history", exact: true })
    .click();
  await expect(page.getByText(/25 focused minutes/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeVisible();
});

test("failed autosave preserves edits and prevents leaving until retry succeeds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "notes" && (window as any).failSave)
        throw new DOMException("Storage full", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.evaluate(() => ((window as any).failSave = true));
  await page
    .locator(".tiptap")
    .fill("These edits must remain visible if storage is full.");
  await expect(
    page.getByRole("button", {
      name: "Save failed — edits are still here. Retry.",
    }),
  ).toBeVisible();
  const path = page.url();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByText(
      "Your edits could not be saved. Please retry before leaving.",
    ),
  ).toBeVisible();
  expect(page.url()).toBe(path);
  await expect(page.locator(".tiptap")).toContainText("must remain visible");
  await page.evaluate(() => ((window as any).failSave = false));
  await page
    .getByRole("button", { name: "Save failed — edits are still here. Retry." })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/library$/);
});

test("imports handle unreadable text, duplicates, invalid PDFs and file limits without partial entries", async ({
  page,
}) => {
  await page.goto("/app/library");
  const blank = Buffer.from(
    pdf()
      .toString()
      .replace("Working memory supports learning.", (m) =>
        " ".repeat(m.length),
      ),
  );
  const file = {
    name: "Scanned.pdf",
    mimeType: "application/pdf",
    buffer: blank,
  };
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(
    page.getByText(
      "This page has no selectable text. You can still read it and write notes manually.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page).toHaveURL(/study/);
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.locator("input[type=file]").setInputFiles({
    name: "Broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nnot a document"),
  });
  await expect(page.getByRole("status")).toContainText(
    "This PDF could not be opened.",
  );
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.locator("input[type=file]").evaluate((input: HTMLInputElement) => {
    const files = new DataTransfer();
    files.items.add(
      new File([new Uint8Array(50 * 1024 * 1024 + 1)], "Huge.pdf", {
        type: "application/pdf",
      }),
    );
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("status")).toContainText("smaller than 50 MB");
  await expect(page.locator(".document-card")).toHaveCount(1);
});

test("Library deletion confirms the item, preserves PDF notes, and persists offline", async ({
  page,
  context,
}) => {
  await page.goto("/app/library");
  await page.locator("input[type=file]").setInputFiles({
    name: "Removal reading.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  await page.getByRole("button", { name: "Create a note" }).click();
  await page.getByLabel("Note title").fill("Keep this explanation");
  await page
    .locator(".tiptap")
    .fill("My own explanation must survive removing its PDF.");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  const deletePDF = page.getByRole("button", {
    name: "Delete PDF “Removal reading”",
    exact: true,
  });
  await deletePDF.click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete PDF?",
    exact: true,
  });
  await expect(confirmation).toContainText("Its notes and reviewers will stay");
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(page.locator(".document-card")).toHaveCount(1);
  await deletePDF.click();
  await confirmation
    .getByRole("button", { name: "Delete PDF", exact: true })
    .click();
  await expect(page.locator(".document-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".note-row")).toContainText(
    "Keep this explanation",
  );
  await page
    .getByRole("link", { name: "Keep this explanation", exact: true })
    .click();
  await expect(page.locator(".tiptap")).toContainText(
    "must survive removing its PDF",
  );
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Note title").fill("Unrelated note");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByText("Ready for offline study")).toBeVisible();
  await context.setOffline(true);
  const deleteNote = page.getByRole("button", {
    name: "Delete note “Keep this explanation”",
    exact: true,
  });
  await deleteNote.click();
  const noteDialog = page.getByRole("dialog", {
    name: "Delete note?",
    exact: true,
  });
  await expect(noteDialog).toContainText("Keep this explanation");
  await noteDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(deleteNote).toBeFocused();
  await expect(page.locator(".note-row")).toHaveCount(2);
  await deleteNote.click();
  await noteDialog
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  await expect(page.locator(".note-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".note-row")).toContainText("Unrelated note");
  await expect(
    page.getByRole("link", { name: "Keep this explanation", exact: true }),
  ).toHaveCount(0);
});

for (const viewport of [
  { width: 1194, height: 834 },
  { width: 390, height: 844 },
]) {
  test(`workspace deletes one linked note and its PDF independently at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/app/library");
    await page.locator("input[type=file]").setInputFiles({
      name: "Session.pdf",
      mimeType: "application/pdf",
      buffer: pdf(),
    });
    if (viewport.width < 700)
      await page.getByRole("button", { name: "Notes", exact: true }).click();
    await page.getByRole("button", { name: "Create a note" }).click();
    await page.getByLabel("Note title").fill("First note");
    await page.locator(".tiptap").fill("Keep this first note.");
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByLabel("Choose note").locator("option")).toHaveCount(
      2,
    );
    await expect(page.getByLabel("Note title")).toHaveValue("Session — notes");
    await page.getByLabel("Note title").fill("Second note");
    await page.locator(".tiptap").fill("Delete this second note.");
    await page
      .getByRole("button", { name: "Delete note “Second note”", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete note?", exact: true })
      .getByRole("button", { name: "Delete note", exact: true })
      .click();
    await expect(page.getByLabel("Note title")).toHaveValue("First note");
    await expect(page.locator(".tiptap")).toContainText("Keep this first note");
    await expect(
      page.getByRole("heading", { name: "Session", exact: true }),
    ).toBeVisible();
    await page.reload();
    if (viewport.width < 700)
      await page.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(page.getByLabel("Choose note").locator("option")).toHaveCount(
      1,
    );
    await page
      .getByRole("button", { name: "Delete PDF “Session”", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Delete PDF?",
      exact: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog
      .getByRole("button", { name: "Delete PDF", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/library$/);
    await expect(page.locator(".document-card")).toHaveCount(0);
    await expect(page.locator(".note-row")).toContainText("First note");
    await expect(page.locator(".note-row")).toHaveCount(1);
  });
}

test("deleting a note with failed autosave discards the draft without resurrecting it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "notes" && (window as any).failSave)
        throw new DOMException("Storage full", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.evaluate(() => ((window as any).failSave = true));
  await page
    .locator(".tiptap")
    .fill("Discard this unsaved draft when I confirm deletion.");
  await expect(
    page.getByRole("button", {
      name: "Save failed — edits are still here. Retry.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete note “Untitled note”", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete note?", exact: true })
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/library$/);
  await expect(page.locator(".note-row")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".note-row")).toHaveCount(0);
});

test("Library cannot delete another tab's open note, and deletion can be retried after closing it", async ({
  page,
  context,
}) => {
  await page.goto("/app/library");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page
    .locator(".tiptap")
    .fill("An open note is protected from deletion in another tab.");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const library = await context.newPage();
  await library.goto("/app/library");
  await library
    .getByRole("button", { name: "Delete note “Untitled note”", exact: true })
    .click();
  const dialog = library.getByRole("dialog", {
    name: "Delete note?",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This note is open in another tab. Close it before deleting.",
  );
  await expect(page.locator(".tiptap")).toContainText(
    "An open note is protected",
  );
  await page.close();
  await dialog
    .getByRole("button", { name: "Delete note", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(library.locator(".note-row")).toHaveCount(0);
  await library.reload();
  await expect(library.locator(".note-row")).toHaveCount(0);
});
