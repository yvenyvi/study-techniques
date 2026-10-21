import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { db } from "./data";
const names = [
  "courses",
  "documents",
  "notes",
  "reviewers",
  "goals",
  "sessions",
  "settings",
] as const;
export async function backup() {
  const data: any = { version: 1 };
  const files: Record<string, Uint8Array> = {};
  await db.transaction(
    "r",
    names.map((n) => db.table(n)),
    async () => {
      for (const n of names) data[n] = await db.table(n).toArray();
    },
  );
  for (const d of data.documents) {
    files[`pdfs/${d.id}.pdf`] = new Uint8Array(await d.blob.arrayBuffer());
    delete d.blob;
  }
  files["manifest.json"] = strToU8(JSON.stringify(data));
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export function validateBackup(data: any, files: Record<string, Uint8Array>) {
  if (data.version !== 1) throw Error("Unsupported backup version.");
  for (const n of names) {
    if (!Array.isArray(data[n])) throw Error(`Missing ${n}.`);
    const ids = new Set();
    for (const r of data[n]) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !r.id ||
        r.id.includes("/") ||
        ids.has(r.id)
      )
        throw Error("Invalid or duplicate record ID.");
      ids.add(r.id);
    }
  }
  const str = (v: any) => typeof v === "string";
  const num = (v: any) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const content = (v: any, depth = 0): boolean =>
    !!v &&
    depth < 40 &&
    str(v.type) &&
    (v.text === undefined || str(v.text)) &&
    (v.content === undefined ||
      (Array.isArray(v.content) &&
        v.content.every((x: any) => content(x, depth + 1)))) &&
    (v.marks === undefined ||
      (Array.isArray(v.marks) &&
        v.marks.every(
          (m: any) =>
            m && str(m.type) && (!m.attrs || typeof m.attrs === "object"),
        )));
  for (const c of data.courses)
    if (!str(c.name) || !str(c.description) || !str(c.color))
      throw Error("Invalid course.");
  for (const n of ["documents", "notes", "reviewers", "goals"])
    for (const r of data[n])
      if (!str(r.courseId)) throw Error("Invalid course reference.");
  for (const d of data.documents) {
    const bytes = files[`pdfs/${d.id}.pdf`];
    if (
      !bytes ||
      bytes.length > 50 * 1024 * 1024 ||
      !str(d.title) ||
      !str(d.tags) ||
      !str(d.hash) ||
      !num(d.created) ||
      !Number.isInteger(d.pages) ||
      d.pages < 1 ||
      !Number.isInteger(d.page) ||
      d.page < 1 ||
      d.page > d.pages ||
      !strFromU8(bytes.slice(0, 1024)).includes("%PDF-")
    )
      throw Error("Invalid document.");
  }
  for (const n of data.notes)
    if (
      !str(n.title) ||
      !num(n.updated) ||
      !content(n.content) ||
      n.content.type !== "doc" ||
      (n.documentId !== undefined && !str(n.documentId))
    )
      throw Error("Invalid note.");
  for (const r of data.reviewers)
    if (
      !str(r.title) ||
      !str(r.tags) ||
      !num(r.updated) ||
      !Array.isArray(r.sections) ||
      r.sections.some(
        (s: any) =>
          !s ||
          !str(s.id) ||
          !str(s.kind) ||
          !s.fields ||
          typeof s.fields !== "object" ||
          Array.isArray(s.fields) ||
          Object.values(s.fields).some((v) => !str(v)) ||
          !Array.isArray(s.refs) ||
          s.refs.some(
            (ref: any) =>
              !ref ||
              !str(ref.documentId) ||
              !Number.isInteger(ref.page) ||
              ref.page < 1 ||
              !str(ref.quote),
          ),
      )
    )
      throw Error("Invalid reviewer.");
  for (const g of data.goals)
    if (
      !str(g.title) ||
      !str(g.criterion) ||
      typeof g.done !== "boolean" ||
      !num(g.created) ||
      !Array.isArray(g.materialIds) ||
      g.materialIds.some((v: any) => !str(v))
    )
      throw Error("Invalid goal.");
  for (const s of data.sessions)
    if (
      !str(s.goalId) ||
      !num(s.started) ||
      !num(s.ended) ||
      !num(s.duration) ||
      !str(s.outcome) ||
      !str(s.note)
    )
      throw Error("Invalid session.");
  for (const s of data.settings)
    if (
      s.id !== "preferences" ||
      !s.value ||
      !num(s.value.focus) ||
      s.value.focus < 1 ||
      s.value.focus > 180 ||
      !num(s.value.rest) ||
      s.value.rest < 1 ||
      s.value.rest > 60 ||
      typeof s.value.sound !== "boolean"
    )
      throw Error("Invalid preferences.");
}
export async function restore(file: File) {
  if (file.size > 250 * 1024 * 1024) throw Error("Backup exceeds 250 MB.");
  let total = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      total += entry.originalSize;
      if (total > 512 * 1024 * 1024 || entry.originalSize > 50 * 1024 * 1024)
        throw Error("Expanded backup exceeds storage import limits.");
      return true;
    },
  });
  if (!files["manifest.json"]) throw Error("Missing backup manifest.");
  const data = JSON.parse(strFromU8(files["manifest.json"]));
  validateBackup(data, files);
  for (const d of data.documents)
    d.blob = new Blob([files[`pdfs/${d.id}.pdf`] as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    });
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables)
      if (await table.count())
        throw Error(
          "Restore requires an empty library, including settings and history.",
        );
    for (const n of names) await db.table(n).bulkAdd(data[n]);
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
