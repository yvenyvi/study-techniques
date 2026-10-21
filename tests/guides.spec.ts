import { test, expect, type Page } from "@playwright/test";
import { checkIntroGuide, GUIDE_KEY } from "./guides-flow.mjs";
import { pdf } from "../tests-desktop/pdf.mjs";

async function seed(page: Page) {
  await page.goto("/app/");
  await expect(
    page.getByRole("button", { name: "Page guide", exact: true }),
  ).toBeEnabled();
  await page.waitForFunction(async () =>
    (await indexedDB.databases()).some((db) => db.name === "study-room"),
  );
  await page.evaluate(
    async (bytes) => {
      const content = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Working memory helps us learn." }],
          },
        ],
      };
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("study-room");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["courses", "documents", "notes", "reviewers", "goals"],
            "readwrite",
          );
          tx.objectStore("courses").put({
            id: "guide-course",
            name: "Cognitive Psychology",
            description: "Memory and thought",
            color: "#648b6c",
          });
          tx.objectStore("documents").put({
            id: "guide-pdf",
            title: "Memory reading",
            courseId: "guide-course",
            tags: "memory",
            blob: new Blob([new Uint8Array(bytes)], {
              type: "application/pdf",
            }),
            hash: "guide-hash",
            pages: 1,
            page: 1,
            created: 1,
          });
          tx.objectStore("notes").put({
            id: "guide-note",
            title: "Memory notes",
            courseId: "guide-course",
            content,
            updated: 1,
          });
          tx.objectStore("notes").put({
            id: "guide-linked",
            title: "Reading notes",
            documentId: "guide-pdf",
            courseId: "guide-course",
            content,
            updated: 1,
          });
          tx.objectStore("reviewers").put({
            id: "guide-reviewer",
            title: "Memory reviewer",
            courseId: "guide-course",
            tags: "memory",
            updated: 1,
            sections: [
              {
                id: "question",
                kind: "Practice questions",
                fields: {
                  Question: "What does working memory do?",
                  Answer: "Holds information for active use.",
                },
                refs: [],
              },
            ],
          });
          tx.objectStore("goals").put({
            id: "guide-goal",
            title: "Compare memory models",
            criterion: "Write three differences",
            courseId: "guide-course",
            materialIds: ["guide-pdf"],
            created: 1,
            done: false,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    [...pdf()],
  );
}

test("overview guide appears once, supports keyboard navigation, and can be replayed", async ({
  page,
}) => {
  await page.goto("/app/");
  await checkIntroGuide(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Page guide", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".page-guide-card")).toHaveCount(0);
  const seen = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).seen,
    GUIDE_KEY,
  );
  expect(seen).toEqual(["overview"]);
});

test("guides appear on in-app navigation without being consumed before they are shown", async ({
  page,
}) => {
  await page.goto("/app/");
  const card = page.locator(".page-guide-card");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await expect(card).toContainText("Bring your readings together");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(card).toContainText("Make the note easy to find");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Page guide", exact: true }),
  ).toBeEnabled();
  await expect(card).toHaveCount(0);
  await page
    .getByRole("link", { name: "Reviewers", exact: true })
    .first()
    .click();
  await expect(card).toContainText("Build a reviewer you understand");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page.getByRole("button", { name: "New reviewer", exact: true }).click();
  await expect(card).toContainText("Name the topic");
});

for (const { path, title } of [
  { path: "/library", title: "Library" },
  { path: "/courses/guide-course", title: "Course" },
  { path: "/study/guide-pdf", title: "PDF & notes" },
  { path: "/study/note-guide-note", title: "Notes editor" },
  { path: "/reviewers", title: "Reviewers" },
  { path: "/reviewers/guide-reviewer", title: "Reviewer editor" },
  { path: "/reviewers/guide-reviewer", title: "Practice" },
  { path: "/goals", title: "Goals & history" },
  { path: "/settings", title: "Settings & data" },
]) {
  test(`${title} guide points to real controls and finishes without changing study content`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page);
    await page.goto(`/app${path}`);
    const card = page.locator(".page-guide-card");
    if (title === "Practice") {
      await card
        .getByRole("button", { name: "Skip guide", exact: true })
        .click();
      await page.getByRole("button", { name: "Practice", exact: true }).click();
    }
    await expect(card.locator(".page-guide-topline")).toContainText(
      `${title} guide`,
    );
    let count = 0;
    do {
      await expect(card).toBeVisible();
      await expect(page.locator(".page-guide-highlight")).toBeVisible();
      const bounds = await card.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height + 1,
      );
      count++;
      if (
        await card.getByRole("button", { name: "Finish", exact: true }).count()
      )
        break;
      await card.getByRole("button", { name: "Next", exact: true }).click();
    } while (count < 7);
    expect(count).toBeGreaterThanOrEqual(3);
    await card.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Page guide", exact: true }),
    ).toBeEnabled();
    await expect(card).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("a mobile guide lets the student try a real search and reset guides without changing notes", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/library");
  const card = page.locator(".page-guide-card");
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Search PDFs", { exact: true }).fill("memory");
  await expect(card).toContainText("You tried it!");
  await page.screenshot({
    path: "test-results/page-guide-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 420 });
  await expect
    .poll(async () => {
      const box = await card.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(421);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page.goto("/app/settings");
  await page
    .locator(".page-guide-card")
    .getByRole("button", { name: "Skip guide", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show all guides again", exact: true })
    .click();
  await page.goto("/app/library");
  await expect(card).toContainText("Bring your readings together");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page.getByRole("link", { name: "Memory notes", exact: false }).click();
  await page
    .locator(".page-guide-card")
    .getByRole("button", { name: "Skip guide", exact: true })
    .click();
  await expect(page.locator(".tiptap")).toContainText(
    "Working memory helps us learn.",
  );
});

test("first-visit guides do not make an empty workspace ineligible for ZIP restoration", async ({
  page,
}) => {
  await page.goto("/app/settings");
  const card = page.locator(".page-guide-card");
  await expect(card).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles("mobile/test/fixtures/web-v1.zip");
  await expect(page.getByRole("status")).toContainText("Backup restored.");
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page
    .locator(".page-guide-card")
    .getByRole("button", { name: "Skip guide", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Working memory notes", exact: false }),
  ).toBeVisible();
});

test("guides work offline and explain an empty reviewer and practice view", async ({
  page,
  context,
}) => {
  await page.goto("/app/settings");
  const card = page.locator(".page-guide-card");
  await expect(
    page.getByText("✓ Application cached for offline use."),
  ).toBeVisible();
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await context.setOffline(true);
  await page
    .getByRole("link", { name: "Reviewers", exact: true })
    .first()
    .click();
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".page-guide-highlight")).toBeVisible();
  await card.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "New reviewer", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await expect(page.locator(".page-guide-highlight")).toBeVisible();
    await card.getByRole("button", { name: "Next", exact: true }).click();
  }
  await card.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(card).toContainText("Try recalling before checking");
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(card).toContainText("If there are no questions yet");
  await expect(page.locator(".page-guide-highlight")).toBeVisible();
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await card.getByRole("button", { name: "Finish", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit reviewer", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Page guide", exact: true }),
  ).toBeEnabled();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Page guide", exact: true }).click();
  await expect(card).toContainText("Name the topic");
});

test("a saved note keeps its guide available when its source PDF is unavailable", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("study-room");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("documents", "readwrite");
        tx.objectStore("documents").delete("guide-pdf");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/study/guide-pdf");
  const card = page.locator(".page-guide-card");
  await expect(card).toContainText("Make the note easy to find");
  await expect(page.getByLabel("Note title", { exact: true })).toBeVisible();
  await expect(page.locator(".page-guide-highlight")).toBeVisible();
  await card.getByRole("button", { name: "Skip guide", exact: true }).click();
  await expect(page.locator(".tiptap")).toContainText(
    "Working memory helps us learn.",
  );
});
