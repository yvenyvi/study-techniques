import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopStore } from "../src/storage/desktop";
import { backup, restore } from "../src/backup";
import { StudyDB } from "../src/data";
import { webStore } from "../src/storage/store";
import { openBridge } from "./bridge";
let folder: string;
let bridge: ReturnType<typeof openBridge>;
let db: DesktopStore;
const note = (id: string) => ({
  id,
  title: "Memory notes",
  courseId: "",
  documentId: "d",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Working memory" }],
      },
    ],
  },
  updated: 1,
});
const document = () => ({
  id: "d",
  title: "Memory",
  courseId: "",
  tags: "",
  hash: "hash",
  pages: 1,
  page: 1,
  created: 1,
  blob: new Blob(["%PDF-native persistence"]),
});
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "study-native-"));
  bridge = openBridge(folder);
  db = new DesktopStore(bridge.invoke);
  await db.initialize();
});
afterEach(async () => {
  await bridge.close();
  await rm(folder, { recursive: true, force: true });
});
describe("real SQLite and PDF storage", () => {
  it("persists without IndexedDB, reads PDFs lazily, and keeps notes after PDF deletion", async () => {
    await db.documents.add(document());
    await db.notes.add(note("n"));
    await bridge.close();
    bridge = openBridge(folder);
    db = new DesktopStore(bridge.invoke);
    await db.initialize();
    expect((await db.notes.get("n"))?.title).toBe("Memory notes");
    expect(await (await db.documents.get("d"))?.blob.text()).toBe(
      "%PDF-native persistence",
    );
    await db.documents.update("d", { title: "Renamed" });
    expect((await readdir(join(folder, "pdfs"))).length).toBe(1);
    await db.documents.delete("d");
    expect((await db.notes.get("n"))?.documentId).toBe("d");
    expect(await readdir(join(folder, "pdfs"))).toEqual([]);
    expect(await db.notes.update("missing", { title: "late autosave" })).toBe(
      0,
    );
  });
  it("round-trips the version-1 ZIP through desktop, browser, and desktop", async () => {
    await db.documents.add(document());
    await db.notes.add(note("n"));
    const webDB = new StudyDB(`desktop-test-${crypto.randomUUID()}`);
    const web = webStore(webDB);
    try {
      await restore(new File([await backup(db)], "desktop.zip"), web);
      expect(await (await web.documents.get("d"))?.blob.text()).toBe(
        "%PDF-native persistence",
      );
      const webZip = await backup(web);
      await expect(restore(new File([webZip], "web.zip"), db)).rejects.toThrow(
        "empty",
      );
      await db.atomic("rw", db.tables, async (tx) => {
        for (const table of tx.tables) await table.clear();
      });
      await restore(new File([webZip], "web.zip"), db);
      expect((await db.notes.get("n"))?.content).toEqual(note("n").content);
      expect(await (await db.documents.get("d"))?.blob.text()).toBe(
        "%PDF-native persistence",
      );
    } finally {
      web.close();
      await webDB.delete();
    }
  });
  it("rolls back failed SQL commits without publishing a partial cache", async () => {
    await db.notes.add(note("original"));
    await expect(
      db.atomic("rw", db.tables, async (tx) => {
        await tx.notes.add(note("new"));
        await tx.documents.add({ ...document(), blob: new Blob(["not PDF"]) });
      }),
    ).rejects.toThrow("Invalid PDF");
    await expect(db.settle()).resolves.toBeUndefined();
    expect(await db.notes.count()).toBe(1);
    expect(await db.documents.count()).toBe(0);
    await bridge.invoke("reopen");
    const reopened = new DesktopStore(bridge.invoke);
    expect(await reopened.notes.count()).toBe(1);
    expect(await reopened.documents.count()).toBe(0);
  });
  it("serializes independent writes and prevents UI events joining another transaction", async () => {
    let enter!: () => void, resume!: () => void;
    const entered = new Promise<void>((r) => {
      enter = r;
    });
    const gate = new Promise<void>((r) => {
      resume = r;
    });
    const failing = db.atomic("rw", [db.notes], async (tx) => {
      await tx.notes.add(note("rollback"));
      enter();
      await gate;
      throw Error("abort this operation");
    });
    await entered;
    const independent = db.notes.add(note("keep"));
    resume();
    await expect(failing).rejects.toThrow("abort");
    await independent;
    expect((await db.notes.toArray()).map((n) => n.id)).toEqual(["keep"]);
  });
  it("atomically unfiles a course and preserves timer/session state across reopen", async () => {
    await db.courses.add({
      id: "c",
      name: "Cognitive",
      color: "#35594b",
      description: "",
    });
    await db.notes.add({ ...note("n"), courseId: "c" });
    await db.atomic("rw", [db.courses, db.notes], async (tx) => {
      await tx.notes.where("courseId").equals("c").modify({ courseId: "" });
      await tx.courses.delete("c");
    });
    await db.timers.put({
      id: "active",
      phase: "focus",
      running: true,
      deadline: Date.now() + 10000,
      remaining: 10,
      goalId: "",
      started: Date.now(),
      elapsed: 0,
    });
    await bridge.invoke("reopen");
    const reopened = new DesktopStore(bridge.invoke);
    expect((await reopened.notes.get("n"))?.courseId).toBe("");
    expect((await reopened.timers.get("active"))?.running).toBe(true);
  });
});
