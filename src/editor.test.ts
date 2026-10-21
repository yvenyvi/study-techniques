import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { StudyDB, textOf } from "./data";
import { webStore } from "./storage/store";
import { backup, restore } from "./backup";
import { editorExtensions } from "./editor-schema";

const rich = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/rich-note.json", import.meta.url),
    "utf8",
  ),
);
const schema = getSchema(editorExtensions());
const raw = new StudyDB("rich-note-test");
const store = webStore(raw);
afterAll(() => raw.delete());

it("loads legacy notes with source links in the expanded document schema", () => {
  const old = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Working memory",
            marks: [
              { type: "bold" },
              { type: "link", attrs: { href: "/study/d?page=2" } },
            ],
          },
        ],
      },
    ],
  };
  const doc = schema.nodeFromJSON(old);
  doc.check();
  expect(doc.attrs.columns).toBe(1);
  expect(doc.textContent).toBe("Working memory");
  expect(JSON.stringify(doc.toJSON())).toContain("/study/d?page=2");
});

it("round-trips tables, formatting, and columns through ZIP without flattening content", async () => {
  const parsed = schema.nodeFromJSON(rich);
  parsed.check();
  const content = parsed.toJSON();
  await store.notes.add({
    id: "n",
    title: "Psychology",
    courseId: "",
    content,
    updated: 1,
  });
  const zip = await backup(store);
  await store.notes.clear();
  await restore(new File([zip], "rich.zip"), store);
  const reopened = (await store.notes.get("n"))!.content;
  expect(reopened).toEqual(content);
  expect(textOf(reopened)).toContain("Mental processes");
  expect(schema.nodeFromJSON(reopened).attrs.columns).toBe(2);
});
