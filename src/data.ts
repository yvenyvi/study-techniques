import Dexie, { type Table } from "dexie";
export type Ref = { documentId: string; page: number; quote: string };
export type Course = {
  id: string;
  name: string;
  description: string;
  color: string;
};
export type Doc = {
  id: string;
  title: string;
  courseId: string;
  tags: string;
  blob: Blob;
  hash: string;
  pages: number;
  page: number;
  created: number;
  lastOpened?: number;
};
export type Note = {
  id: string;
  title: string;
  courseId: string;
  documentId?: string;
  content: any;
  updated: number;
};
export type Section = {
  id: string;
  kind: string;
  fields: Record<string, string>;
  refs: Ref[];
};
export type Reviewer = {
  id: string;
  title: string;
  courseId: string;
  tags: string;
  sections: Section[];
  updated: number;
};
export type Goal = {
  id: string;
  title: string;
  criterion: string;
  courseId: string;
  materialIds: string[];
  done: boolean;
  created: number;
  completed?: number;
};
export type Session = {
  id: string;
  goalId: string;
  started: number;
  ended: number;
  duration: number;
  outcome: string;
  note: string;
};
export type Timer = {
  id: string;
  phase: "focus" | "break";
  running: boolean;
  deadline: number;
  remaining: number;
  goalId: string;
  started: number;
  elapsed: number;
};
export class StudyDB extends Dexie {
  courses!: Table<Course>;
  documents!: Table<Doc>;
  notes!: Table<Note>;
  reviewers!: Table<Reviewer>;
  goals!: Table<Goal>;
  sessions!: Table<Session>;
  timers!: Table<Timer>;
  settings!: Table<{ id: string; value: any }>;
  constructor(name = "study-room") {
    super(name);
    this.version(1).stores({
      courses: "id,name",
      documents: "id,courseId,hash,created",
      notes: "id,courseId,documentId,updated",
      reviewers: "id,courseId,updated",
      goals: "id,courseId,created",
      sessions: "id,goalId,started",
      timers: "id",
      settings: "id",
    });
  }
}
export const db = new StudyDB();
export const uid = () => crypto.randomUUID();
export const textOf = (v: any): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? v.map(textOf).join(" ")
      : v && typeof v === "object"
        ? v.text || textOf(v.content || [])
        : "";
export const secondsLeft = (t: Timer, now = Date.now()) =>
  t.running ? Math.max(0, Math.ceil((t.deadline - now) / 1000)) : t.remaining;
export const templates: Record<string, string[]> = {
  "Key concepts": ["Term", "Explanation", "Example"],
  "Theory comparison": [
    "Theory",
    "Main ideas",
    "Similarities",
    "Differences",
    "Applications",
  ],
  "Research summary": [
    "Research question",
    "Method",
    "Findings",
    "Limitations",
  ],
  "Practice questions": ["Question", "Answer"],
  "Free notes": ["Notes"],
};
export const section = (kind: string): Section => ({
  id: uid(),
  kind,
  fields: Object.fromEntries(templates[kind].map((k) => [k, ""])),
  refs: [],
});
export async function removeDocument(id: string) {
  await db.documents.delete(id);
}
export async function removeCourse(id: string) {
  await db.transaction(
    "rw",
    [db.courses, db.documents, db.notes, db.reviewers, db.goals],
    async () => {
      for (const name of ["documents", "notes", "reviewers", "goals"])
        await db
          .table(name)
          .where("courseId")
          .equals(id)
          .modify({ courseId: "" });
      await db.courses.delete(id);
    },
  );
}
export async function importPDF(file: File, courseId = "") {
  if (file.size > 50 * 1024 * 1024)
    throw Error("Please choose a PDF smaller than 50 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw Error("This file is not a PDF.");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const duplicate = await db.documents.where("hash").equals(hash).first();
  if (duplicate) return { id: duplicate.id, duplicate: true };
  const { getDocument } = await import("./pdf");
  const task = getDocument({ data: bytes.slice() });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e) {
    await task.destroy();
    const name = (e as Error).name;
    throw Error(
      name === "PasswordException"
        ? "Password-protected PDFs are not supported. Save an unlocked copy first."
        : "This PDF could not be opened. It may be corrupt or unsupported.",
    );
  }
  const pages = pdf.numPages;
  await pdf.destroy();
  const id = uid();
  await db.documents.add({
    id,
    title: file.name.replace(/\.pdf$/i, ""),
    courseId,
    tags: "",
    blob: file,
    hash,
    pages,
    page: 1,
    created: Date.now(),
  });
  return { id, duplicate: false };
}
