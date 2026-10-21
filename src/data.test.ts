import "fake-indexeddb/auto";
import { beforeEach, afterAll, describe, it, expect } from "vitest";
import {
  db,
  secondsLeft,
  removeDocument,
  removeCourse,
  type Timer,
  section,
  textOf,
} from "./data";
import { validateBackup, backup, restore } from "./backup";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterAll(() => db.close());
describe("durable study content", () => {
  it("preserves notes and reviewer references when a PDF is removed", async () => {
    await db.documents.add({
      id: "d",
      title: "Memory",
      courseId: "c",
      tags: "",
      blob: new Blob(["pdf"]),
      hash: "h",
      pages: 2,
      page: 1,
      created: 0,
    });
    await db.notes.add({
      id: "n",
      title: "Notes",
      courseId: "c",
      documentId: "d",
      content: { type: "doc", content: [] },
      updated: 0,
    });
    const s = section("Key concepts");
    s.refs = [{ documentId: "d", page: 2, quote: "Memory" }];
    await db.reviewers.add({
      id: "r",
      title: "Reviewer",
      courseId: "c",
      tags: "",
      sections: [s],
      updated: 0,
    });
    await removeDocument("d");
    expect(await db.documents.count()).toBe(0);
    expect((await db.notes.get("n"))?.documentId).toBe("d");
    expect((await db.reviewers.get("r"))?.sections[0].refs[0].quote).toBe(
      "Memory",
    );
  });
  it("unfiles content transactionally when deleting a course", async () => {
    await db.courses.add({
      id: "c",
      name: "Cognitive",
      description: "",
      color: "#123456",
    });
    await db.goals.add({
      id: "g",
      title: "Compare",
      criterion: "Write comparison",
      courseId: "c",
      materialIds: [],
      done: false,
      created: 0,
    });
    await removeCourse("c");
    expect(await db.courses.count()).toBe(0);
    expect((await db.goals.get("g"))?.courseId).toBe("");
  });
  it("round-trips a PDF and structured reviewer through ZIP", async () => {
    await db.documents.add({
      id: "d",
      title: "Memory",
      courseId: "",
      tags: "memory",
      blob: new Blob(["%PDF-test"]),
      hash: "h",
      pages: 2,
      page: 2,
      created: 0,
    });
    await db.reviewers.add({
      id: "r",
      title: "Memory",
      courseId: "",
      tags: "",
      sections: [section("Research summary")],
      updated: 1,
    });
    const zip = await backup();
    await expect(restore(new File([zip], "backup.zip"))).rejects.toThrow(
      "empty",
    );
    await Promise.all(db.tables.map((t) => t.clear()));
    await restore(new File([zip], "backup.zip"));
    expect(await (await db.documents.get("d"))?.blob.text()).toBe("%PDF-test");
    expect((await db.reviewers.get("r"))?.sections[0].kind).toBe(
      "Research summary",
    );
  });
  it("rejects malformed backups before writing anything", () => {
    expect(() => validateBackup({ version: 3 }, {})).toThrow("Unsupported");
    expect(() => validateBackup({ version: 1, courses: [] }, {})).toThrow(
      "Missing",
    );
  });
});
describe("focus time", () => {
  const t: Timer = {
    id: "active",
    phase: "focus",
    running: true,
    deadline: 10000,
    remaining: 10,
    goalId: "g",
    started: 0,
    elapsed: 0,
  };
  it("uses deadlines after background throttling", () => {
    expect(secondsLeft(t, 7000)).toBe(3);
    expect(secondsLeft(t, 20000)).toBe(0);
  });
  it("holds a paused duration regardless of elapsed wall time", () => {
    expect(secondsLeft({ ...t, running: false, remaining: 4 }, 100000)).toBe(4);
  });
});
it("extracts searchable text from structured notes", () => {
  expect(
    textOf({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Working memory" }],
        },
      ],
    }),
  ).toContain("Working memory");
});
